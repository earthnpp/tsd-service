const { PrismaClient } = require("@prisma/client");
const line = require("@line/bot-sdk");
const ticketService = require("../services/ticketService");
const categoryService = require("../services/categoryService");
const bookingService = require("../services/bookingService");
const ticketConfirm = require("../views/flex/ticketConfirm");
const { bookingSuccess } = require("../views/flex/bookingViews");

const prisma = new PrismaClient();
const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

async function verifyLineToken(accessToken) {
  const res = await fetch(`https://api.line.me/oauth2/v2.1/verify?access_token=${accessToken}`);
  if (!res.ok) throw new Error("Invalid LINE token");
  return res.json(); // { client_id, expires_in, scope }
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
    const accessToken = req.headers["x-line-access-token"];
    if (!accessToken) return res.status(401).json({ error: "No LINE token" });

    await verifyLineToken(accessToken);
    const { userId, displayName } = await getLineUserId(accessToken);

    const { name, category, subcategory, assetTag, description } = req.body;
    if (!category || !subcategory || !description?.trim()) {
      return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบ" });
    }

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
      title,
      category,
      subcategory,
      assetTag: assetTag?.trim().toUpperCase() || null,
      description: desc,
      imageUrl,
    });

    // Push confirmation to user in LINE
    client.pushMessage({
      to: userId,
      messages: [ticketConfirm(ticket)],
    }).catch(() => {});

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
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  const year  = parseInt(req.query.year)  || new Date().getFullYear();
  const month = parseInt(req.query.month) || new Date().getMonth() + 1;
  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month, 0, 23, 59, 59, 999);

  const bookings = await prisma.roomBooking.findMany({
    where: { startAt: { gte: start, lte: end }, status: "confirmed" },
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
    const accessToken = req.headers["x-line-access-token"];
    if (!accessToken) return res.status(401).json({ error: "No LINE token" });

    await verifyLineToken(accessToken);
    const { userId, displayName } = await getLineUserId(accessToken);

    const { roomId, date, startTime, endTime, title } = req.body;
    if (!roomId || !date || !startTime || !endTime || !title?.trim()) {
      return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบ" });
    }

    const startAt = new Date(`${date}T${startTime}:00+07:00`);
    const endAt   = new Date(`${date}T${endTime}:00+07:00`);
    if (endAt <= startAt) {
      return res.status(400).json({ error: "เวลาสิ้นสุดต้องหลังจากเวลาเริ่มต้น" });
    }

    const booking = await bookingService.createBooking({
      roomId: Number(roomId),
      lineUserId: userId,
      displayName,
      title: title.trim(),
      startAt,
      endAt,
    });

    client.pushMessage({
      to: userId,
      messages: [bookingSuccess(booking)],
    }).catch(() => {});

    res.json({ success: true, bookingNo: booking.bookingNo });
  } catch (err) {
    console.error("LIFF createBooking error:", err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getCategories, createTicket, getRooms, getRoomSlots, createBooking, getBookingsCalendar };
