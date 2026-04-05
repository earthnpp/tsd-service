const ticketService = require("../services/ticketService");
const categoryService = require("../services/categoryService");
const bookingService = require("../services/bookingService");
const calendarService = require("../services/calendarService");

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const line = require("@line/bot-sdk");

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

// ── Tickets ───────────────────────────────────────────────

async function listTickets(req, res) {
  const { status, category, search, page, limit } = req.query;
  const result = await ticketService.getAllTickets({ status, category, search, page, limit });
  res.json(result);
}

async function exportTickets(req, res) {
  const { status, category, search } = req.query;
  const tickets = await ticketService.getAllTicketsForExport({ status, category, search });
  res.json(tickets);
}

async function getTicket(req, res) {
  const ticket = await ticketService.getTicketById(req.params.id);
  if (!ticket) return res.status(404).json({ error: "Not found" });
  res.json(ticket);
}

async function assignTicket(req, res) {
  const { assignee } = req.body;
  if (!assignee) return res.status(400).json({ error: "assignee required" });
  const ticket = await ticketService.updateTicket(req.params.id, { status: "in_progress", assignee });
  await notifyUser(ticket.lineUserId, [{
    type: "text",
    text: `🔵 ได้รับงานแล้วครับ!\n\n📋 ${ticket.ticketNo}\n📌 ${ticket.title}\n👷 ผู้รับผิดชอบ: ${assignee}\n\nกำลังดำเนินการแก้ไขให้ครับ 🙏`,
  }]);
  res.json(ticket);
}

async function updateTicketStatus(req, res) {
  const { status, priority, workStartAt } = req.body;
  const data = {};
  if (status) data.status = status;
  if (priority !== undefined) data.priority = priority;
  if (workStartAt !== undefined) data.workStartAt = workStartAt ? new Date(workStartAt) : null;
  const ticket = await ticketService.updateTicket(req.params.id, data);

  // Notify user on status change
  if (status === "in_progress") {
    await notifyUser(ticket.lineUserId, [{
      type: "text",
      text: `🔵 ได้รับงานแล้วครับ!\n\n📋 ${ticket.ticketNo}\n📌 ${ticket.title}\n👷 ผู้รับผิดชอบ: ${ticket.assignee || "ทีม IT"}\n\nกำลังดำเนินการแก้ไขให้ครับ 🙏`,
    }]);
  } else if (status === "completed") {
    const ratingMenu = require("../views/flex/ratingMenu");
    await notifyUser(ticket.lineUserId, [
      { type: "text", text: `✅ ${ticket.ticketNo} ดำเนินการเสร็จสิ้นแล้วครับ\n📝 ${ticket.resolution || "เสร็จเรียบร้อย"}` },
      ratingMenu(ticket.id),
    ]);
  } else if (status === "pending") {
    await notifyUser(ticket.lineUserId, [{
      type: "text",
      text: `🟡 ${ticket.ticketNo} ถูกส่งกลับสู่สถานะรอดำเนินการครับ`,
    }]);
  }

  res.json(ticket);
}

async function updateTicketCost(req, res) {
  const { hasCost, costDescription, costAmount, costVat, repairVendor } = req.body;
  const ticket = await ticketService.updateTicket(req.params.id, {
    hasCost: !!hasCost,
    costDescription: costDescription || null,
    costAmount: costAmount ? Number(costAmount) : null,
    costVat: costVat ? Number(costVat) : null,
    repairVendor: repairVendor || null,
  });
  res.json(ticket);
}

async function closeWithCost(req, res) {
  const { resolution, hasCost, costDescription, costAmount, costVat, repairVendor } = req.body;
  if (!resolution) return res.status(400).json({ error: "resolution required" });

  const ticket = await ticketService.updateTicket(req.params.id, {
    status: "completed",
    resolution,
    completedAt: new Date(),
    hasCost: !!hasCost,
    costDescription: costDescription || null,
    costAmount: costAmount ? Number(costAmount) : null,
    costVat: costVat ? Number(costVat) : null,
    repairVendor: repairVendor || null,
  });

  const ratingMenu = require("../views/flex/ratingMenu");
  await notifyUser(ticket.lineUserId, [
    { type: "text", text: `✅ ${ticket.ticketNo} ดำเนินการเสร็จสิ้นแล้วครับ\n📝 ${resolution}` },
    ratingMenu(ticket.id),
  ]);

  res.json(ticket);
}

async function closeTicket(req, res) {
  const { resolution } = req.body;
  if (!resolution) return res.status(400).json({ error: "resolution required" });
  const ticket = await ticketService.updateTicket(req.params.id, {
    status: "completed", resolution, completedAt: new Date(),
  });
  const ratingMenu = require("../views/flex/ratingMenu");
  await notifyUser(ticket.lineUserId, [
    { type: "text", text: `✅ ${ticket.ticketNo} ได้รับการแก้ไขเรียบร้อยแล้วครับ\n📝 ${resolution}` },
    ratingMenu(ticket.id),
  ]);
  res.json(ticket);
}

async function getStats(req, res) {
  const { dateFrom, dateTo } = req.query;
  const stats = await ticketService.getStats({ dateFrom, dateTo });
  res.json(stats);
}

// ── Categories ────────────────────────────────────────────

async function listCategories(req, res) {
  const cats = await categoryService.getAllCategories();
  res.json(cats);
}

async function createCategory(req, res) {
  try {
    const cat = await categoryService.createCategory(req.body);
    res.json(cat);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateCategory(req, res) {
  try {
    const cat = await categoryService.updateCategory(req.params.id, req.body);
    res.json(cat);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deleteCategory(req, res) {
  try {
    await categoryService.deleteCategory(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// ── Subcategories ─────────────────────────────────────────

async function createSubcategory(req, res) {
  try {
    const sub = await categoryService.createSubcategory(req.params.id, req.body.name);
    res.json(sub);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateSubcategory(req, res) {
  try {
    const sub = await categoryService.updateSubcategory(req.params.id, req.body);
    res.json(sub);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deleteSubcategory(req, res) {
  try {
    await categoryService.deleteSubcategory(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// ── FAQ ───────────────────────────────────────────────────

async function listFaqs(req, res) {
  const faqs = await categoryService.getAllFaqs();
  res.json(faqs);
}

async function createFaq(req, res) {
  try {
    const faq = await categoryService.createFaq(req.body);
    res.json(faq);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateFaq(req, res) {
  try {
    const faq = await categoryService.updateFaq(req.params.id, req.body);
    res.json(faq);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deleteFaq(req, res) {
  try {
    await categoryService.deleteFaq(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// ── Assignees ─────────────────────────────────────────────

async function listAssignees(req, res) {
  const assignees = await prisma.assignee.findMany({ orderBy: { name: "asc" } });
  res.json(assignees);
}

async function createAssignee(req, res) {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    const a = await prisma.assignee.create({ data: { name: name.trim() } });
    res.json(a);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateAssignee(req, res) {
  try {
    const a = await prisma.assignee.update({ where: { id: Number(req.params.id) }, data: req.body });
    res.json(a);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deleteAssignee(req, res) {
  try {
    await prisma.assignee.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// ── Bookings ──────────────────────────────────────────────

async function listBookings(req, res) {
  const { status, roomId, page, limit } = req.query;
  const result = await bookingService.getAllBookings({ status, roomId, page, limit });
  res.json(result);
}

async function listBookingsMonth(req, res) {
  const { year, month } = req.query;
  const bookings = await bookingService.getBookingsForMonth(Number(year), Number(month));
  res.json(bookings);
}

async function listRooms(req, res) {
  const rooms = await bookingService.getRooms();
  res.json(rooms);
}

async function cancelBookingAdmin(req, res) {
  try {
    const booking = await bookingService.adminCancelBooking(req.params.id);
    const fmt = (dt) => new Date(dt).toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short",
    });
    await notifyUser(booking.lineUserId, [{
      type: "text",
      text: `📢 การจองของคุณถูกยกเลิกโดยผู้ดูแลระบบครับ\n\n📋 ${booking.bookingNo}\n🏢 ห้อง: ${booking.room?.name || "-"}\n📝 ${booking.title}\n🕐 ${fmt(booking.startAt)} – ${fmt(booking.endAt)}\n\nหากมีข้อสงสัยกรุณาติดต่อเจ้าหน้าที่ครับ 🙏`,
    }]);
    res.json(booking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateRoomCalendar(req, res) {
  try {
    const { calendarId } = req.body;
    const room = await bookingService.updateRoomCalendar(req.params.id, calendarId);
    res.json(room);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function createRoom(req, res) {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "กรุณาระบุชื่อห้อง" });
    const room = await bookingService.createRoom(name.trim());
    res.json(room);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateRoom(req, res) {
  try {
    const room = await bookingService.updateRoom(req.params.id, req.body);
    res.json(room);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deleteRoom(req, res) {
  try {
    await bookingService.deleteRoom(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function createRoomCalendar(req, res) {
  try {
    const rooms = await bookingService.getRooms();
    const room = rooms.find(r => r.id === Number(req.params.id));
    if (!room) return res.status(404).json({ error: "Room not found" });
    const calendarId = await calendarService.createOwnCalendar(`[TSD] ${room.name}`);
    const updated = await bookingService.updateRoomCalendar(req.params.id, calendarId);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── Calendar Debug ────────────────────────────────────────

async function testCalendar(req, res) {
  const creds = process.env.GOOGLE_CREDENTIALS;
  if (!creds) {
    return res.status(500).json({ ok: false, error: "GOOGLE_CREDENTIALS ไม่ได้ตั้งค่าไว้ใน environment" });
  }

  let parsed;
  try {
    parsed = JSON.parse(creds);
  } catch {
    try {
      parsed = JSON.parse(Buffer.from(creds, "base64").toString());
    } catch {
      return res.status(500).json({ ok: false, error: "GOOGLE_CREDENTIALS parse ไม่ได้ — ต้องเป็น JSON string หรือ base64" });
    }
  }

  const serviceEmail = parsed?.client_email || null;
  if (!serviceEmail) {
    return res.status(500).json({ ok: false, error: "ไม่พบ client_email ใน credentials" });
  }

  // ทดสอบ list calendars
  try {
    const { google } = require("googleapis");
    const auth = new google.auth.GoogleAuth({
      credentials: parsed,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });
    const calendar = google.calendar({ version: "v3", auth });
    const list = await calendar.calendarList.list({ maxResults: 5 });
    const rooms = await bookingService.getRooms();
    return res.json({
      ok: true,
      serviceAccountEmail: serviceEmail,
      calendarsAccessible: list.data.items?.length ?? 0,
      rooms: rooms.map(r => ({
        id: r.id,
        name: r.name,
        calendarId: r.calendarId || null,
        hasCalendar: !!r.calendarId,
      })),
    });
  } catch (err) {
    return res.status(500).json({ ok: false, serviceAccountEmail: serviceEmail, error: err.message });
  }
}

// ── Allowed Users ─────────────────────────────────────────

async function listAllowedUsers(req, res) {
  const users = await prisma.allowedUser.findMany({ orderBy: { createdAt: "asc" } });
  res.json(users);
}

async function createAllowedUser(req, res) {
  try {
    const { email, name } = req.body;
    if (!email) return res.status(400).json({ error: "email required" });
    const u = await prisma.allowedUser.create({ data: { email: email.trim().toLowerCase(), name: name?.trim() || null } });
    res.json(u);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deleteAllowedUser(req, res) {
  try {
    await prisma.allowedUser.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// ── Helper ────────────────────────────────────────────────

async function notifyUser(lineUserId, messages) {
  try {
    await client.pushMessage({ to: lineUserId, messages });
  } catch (err) {
    console.error("Line push error:", err.message);
  }
}

module.exports = {
  listTickets, exportTickets, getTicket, assignTicket, closeTicket, getStats,
  updateTicketStatus, updateTicketCost, closeWithCost,
  listCategories, createCategory, updateCategory, deleteCategory,
  createSubcategory, updateSubcategory, deleteSubcategory,
  listFaqs, createFaq, updateFaq, deleteFaq,
  listAssignees, createAssignee, updateAssignee, deleteAssignee,
  listBookings, listBookingsMonth, listRooms, cancelBookingAdmin, updateRoomCalendar,
  createRoom, updateRoom, deleteRoom, createRoomCalendar, testCalendar,
  listAllowedUsers, createAllowedUser, deleteAllowedUser,
};
