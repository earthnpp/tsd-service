const { PrismaClient } = require("@prisma/client");
const line = require("@line/bot-sdk");
const jwt = require("jsonwebtoken");
const ticketService = require("../services/ticketService");
const categoryService = require("../services/categoryService");
const bookingService = require("../services/bookingService");
const ticketConfirm = require("../views/flex/ticketConfirm");
const { bookingSuccess } = require("../views/flex/bookingViews");
const notifyService = require("../services/notifyService");
const audit = require("../services/auditService");

const prisma = new PrismaClient();
const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

async function verifyLineToken(accessToken) {
  const res = await fetch(`https://api.line.me/oauth2/v2.1/verify?access_token=${accessToken}`);
  if (!res.ok) throw new Error("Invalid LINE token");
  return res.json(); // { client_id, expires_in, scope }
}

async function checkEmailDomain(email) {
  const row = await prisma.systemConfig.findUnique({ where: { key: "allowed_email_domains" } });
  if (!row?.value?.trim()) return; // ไม่ได้ตั้งค่า = อนุญาตทุก domain
  const allowed = row.value.split(",").map(d => d.trim().toLowerCase()).filter(Boolean);
  const domain = email.trim().toLowerCase().split("@")[1];
  if (!allowed.includes(domain)) {
    const err = new Error("เฉพาะอีเมลของพนักงานเท่านั้นที่สามารถใช้งานได้ครับ");
    err.code = "DOMAIN_NOT_ALLOWED";
    throw err;
  }
}

async function getLineUserId(accessToken) {
  const res = await fetch("https://api.line.me/v2/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Cannot get LINE profile");
  const profile = await res.json();
  return { userId: profile.userId, displayName: profile.displayName };
}

async function getCategories(req, res) {
  const categories = await categoryService.getActiveCategories();
  res.json(categories);
}

async function createTicket(req, res) {
  try {
    const lineToken   = req.headers["x-line-access-token"];
    const portalToken = req.headers["x-portal-token"];

    let userId = null;
    let displayName = null;

    if (lineToken) {
      await verifyLineToken(lineToken);
      ({ userId, displayName } = await getLineUserId(lineToken));
    } else if (portalToken) {
      const decoded = jwt.verify(portalToken, process.env.JWT_SECRET);
      if (!decoded.isPortal) return res.status(401).json({ error: "Invalid portal token" });
      userId = `portal:${decoded.email}`;
      displayName = decoded.name;
    } else {
      return res.status(401).json({ error: "No auth token" });
    }

    const { name, email, department, category, subcategory, assetTag, description } = req.body;
    if (!name?.trim() || !email?.trim() || !department?.trim() || !category || !subcategory || !description?.trim()) {
      return res.status(400).json({ error: "กรุณากรอกข้อมูลที่จำเป็นให้ครบ" });
    }
    await checkEmailDomain(email);

    const lines = description.trim().split("\n").map(l => l.trim()).filter(Boolean);
    const title = lines[0] || description;
    const desc = lines.length > 1 ? lines.slice(1).join("\n") : description;

    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }

    const ticket = await ticketService.createTicket({
      lineUserId: userId,
      displayName: name || displayName,
      email: email.trim(),
      department: department.trim(),
      title,
      category,
      subcategory,
      assetTag: assetTag?.trim().toUpperCase() || null,
      description: desc,
      imageUrl,
    });

    // ส่ง LINE notification เฉพาะ user ที่มาจาก LINE (ไม่ใช่ portal)
    if (userId && !userId.startsWith("portal:")) {
      client.pushMessage({ to: userId, messages: [ticketConfirm(ticket)] }).catch(() => {});
    }

    // Notify admin group
    notifyService.notifyNewTicket(ticket).catch(() => {});

    audit.log({
      actor: userId || "anonymous",
      actorType: userId?.startsWith("portal:") ? "portal" : "line",
      action: "TICKET_CREATED",
      resourceType: "ticket",
      resourceId: ticket.id,
      detail: `${ticket.ticketNo}: ${ticket.title}`,
      ipAddress: req.ip || req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || null,
    });

    res.json({ success: true, ticketNo: ticket.ticketNo });
  } catch (err) {
    console.error("LIFF createTicket error:", err);
    const status = err.code === "RATE_LIMIT" ? 429 : 500;
    res.status(status).json({ error: err.message });
  }
}

async function getRooms(req, res) {
  const rooms = await bookingService.getRooms();
  res.json(rooms);
}

async function getRoomSlots(req, res) {
  const { roomId, date } = req.query;
  if (!roomId || !date) return res.json([]);
  const slots = await bookingService.getRoomSlots(roomId, date);
  res.json(slots);
}

async function getBookingsCalendar(req, res) {
  const year   = parseInt(req.query.year)   || new Date().getFullYear();
  const month  = parseInt(req.query.month)  || new Date().getMonth() + 1;
  const roomId = req.query.roomId ? parseInt(req.query.roomId) : undefined;
  const start  = new Date(year, month - 1, 1);
  const end    = new Date(year, month, 0, 23, 59, 59, 999);

  const bookings = await prisma.roomBooking.findMany({
    where: {
      startAt: { gte: start, lte: end },
      status: "confirmed",
      ...(roomId ? { roomId } : {}),
    },
    include: { room: true },
    orderBy: { startAt: "asc" },
  });

  const masterCalId = process.env.MASTER_CALENDAR_ID;
  const masterCalUrl = masterCalId
    ? `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(masterCalId)}`
    : null;

  res.json({ bookings, masterCalUrl });
}

async function createBooking(req, res) {
  try {
    const lineToken   = req.headers["x-line-access-token"];
    const portalToken = req.headers["x-portal-token"];

    let userId = null;
    let displayName = null;

    if (lineToken) {
      await verifyLineToken(lineToken);
      ({ userId, displayName } = await getLineUserId(lineToken));
    } else if (portalToken) {
      const decoded = jwt.verify(portalToken, process.env.JWT_SECRET);
      if (!decoded.isPortal) return res.status(401).json({ error: "Invalid portal token" });
      userId = `portal:${decoded.email}`;
      displayName = decoded.name;
    } else {
      return res.status(401).json({ error: "No auth token" });
    }

    const { roomId, startDate, startTime, endDate, endTime, title, notes, name, email, department } = req.body;
    if (!roomId || !startDate || !startTime || !endDate || !endTime || !title?.trim() || !name?.trim() || !email?.trim() || !department?.trim()) {
      return res.status(400).json({ error: "กรุณากรอกข้อมูลที่จำเป็นให้ครบ" });
    }
    await checkEmailDomain(email);

    const startAt = new Date(`${startDate}T${startTime}:00+07:00`);
    const endAt   = new Date(`${endDate}T${endTime}:00+07:00`);
    if (endAt <= startAt) {
      return res.status(400).json({ error: "เวลาสิ้นสุดต้องหลังจากเวลาเริ่มต้น" });
    }

    const booking = await bookingService.createBooking({
      roomId: Number(roomId),
      lineUserId: userId,
      displayName: name.trim() || displayName,
      email: email.trim(),
      department: department.trim(),
      title: title.trim(),
      notes: notes?.trim() || null,
      startAt,
      endAt,
    });

    if (userId && !userId.startsWith("portal:")) {
      client.pushMessage({ to: userId, messages: [bookingSuccess(booking)] }).catch(() => {});
    }

    // Notify admin group
    notifyService.notifyNewBooking(booking).catch(() => {});

    audit.log({
      actor: userId || "anonymous",
      actorType: userId?.startsWith("portal:") ? "portal" : "line",
      action: "BOOKING_CREATED",
      resourceType: "booking",
      resourceId: booking.id,
      detail: `${booking.bookingNo}: ${booking.title}`,
      ipAddress: req.ip || req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || null,
    });

    res.json({ success: true, bookingNo: booking.bookingNo });
  } catch (err) {
    console.error("LIFF createBooking error:", err);
    res.status(500).json({ error: err.message });
  }
}

async function aiChat(req, res) {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) return res.status(400).json({ error: "messages required" });

    const rows = await prisma.systemConfig.findMany({
      where: { key: { in: ["ai_provider", "ai_api_key", "ai_model", "ai_system_prompt"] } },
    });
    const cfg = Object.fromEntries(rows.map(r => [r.key, r.value]));

    const provider    = cfg.ai_provider    || "anthropic";
    const apiKey      = cfg.ai_api_key;
    const defaultModel = provider === "gemini" ? "gemini-2.0-flash" : provider === "openai" ? "gpt-4o-mini" : "claude-haiku-4-5-20251001";
    const model       = cfg.ai_model       || defaultModel;
    const systemPrompt = cfg.ai_system_prompt || "คุณคือผู้ช่วย IT Support ตอบเป็นภาษาไทย กระชับ เข้าใจง่าย";

    if (!apiKey) return res.status(400).json({ error: "ยังไม่ได้ตั้งค่า AI API Key ในระบบครับ" });

    let reply = "";
    if (provider === "anthropic") {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 1024, system: systemPrompt, messages }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.message || "Anthropic API error");
      reply = data.content?.[0]?.text || "";
    } else if (provider === "openai") {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: "system", content: systemPrompt }, ...messages] }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.message || "OpenAI API error");
      reply = data.choices?.[0]?.message?.content || "";
    } else if (provider === "gemini") {
      const geminiModel = model || "gemini-2.0-flash";
      const geminiMessages = messages.map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      const geminiBody = { contents: geminiMessages };
      if (systemPrompt) geminiBody.system_instruction = { parts: [{ text: systemPrompt }] };
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(geminiBody),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.message || "Gemini API error");
      reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    res.json({ reply });
  } catch (err) {
    console.error("AI chat error:", err.message);
    res.status(500).json({ error: "ขณะนี้ AI ไม่พร้อมใช้งานครับ กรุณาลองใหม่อีกครั้ง" });
  }
}

async function getMyTickets(req, res) {
  try {
    const portalToken = req.headers["x-portal-token"];
    if (!portalToken) return res.status(401).json({ error: "Unauthorized" });
    const decoded = jwt.verify(portalToken, process.env.JWT_SECRET);
    if (!decoded.isPortal) return res.status(401).json({ error: "Invalid portal token" });
    const email = decoded.email.toLowerCase();
    const tickets = await prisma.ticket.findMany({
      where: { email },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getMyBookings(req, res) {
  try {
    const portalToken = req.headers["x-portal-token"];
    if (!portalToken) return res.status(401).json({ error: "Unauthorized" });
    const decoded = jwt.verify(portalToken, process.env.JWT_SECRET);
    if (!decoded.isPortal) return res.status(401).json({ error: "Invalid portal token" });
    const email = decoded.email.toLowerCase();
    const bookings = await prisma.roomBooking.findMany({
      where: { email },
      include: { room: true },
      orderBy: { startAt: "desc" },
      take: 20,
    });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getCategories, createTicket, getRooms, getRoomSlots, createBooking, getBookingsCalendar, aiChat, getMyTickets, getMyBookings };
