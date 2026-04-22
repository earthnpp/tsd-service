const ticketService = require("../services/ticketService");
const categoryService = require("../services/categoryService");
const bookingService = require("../services/bookingService");
const calendarService = require("../services/calendarService");
const audit = require("../services/auditService");

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
  const { status, category, search, dateFrom, dateTo } = req.query;
  const tickets = await ticketService.getAllTicketsForExport({ status, category, search, dateFrom, dateTo });
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
  audit.log({ ...audit.fromReq(req), action: "TICKET_ASSIGNED", resourceType: "ticket", resourceId: ticket.id, detail: `${ticket.ticketNo} → ${assignee}` });
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
      { type: "text", text: `✅ ${ticket.ticketNo} ดำเนินการเสร็จสิ้นแล้วครับ\n📝 ผลการดำเนินการ : ${ticket.resolution || "เสร็จเรียบร้อย"}` },
      ratingMenu(ticket.id),
    ]);
  } else if (status === "pending") {
    await notifyUser(ticket.lineUserId, [{
      type: "text",
      text: `🟡 ${ticket.ticketNo} ถูกส่งกลับสู่สถานะรอดำเนินการครับ`,
    }]);
  }

  audit.log({ ...audit.fromReq(req), action: "TICKET_STATUS_CHANGED", resourceType: "ticket", resourceId: ticket.id, detail: `${ticket.ticketNo}: → ${status || "updated"}` });
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
  audit.log({ ...audit.fromReq(req), action: "TICKET_COST_UPDATED", resourceType: "ticket", resourceId: ticket.id, detail: `${ticket.ticketNo} cost: ${costAmount || 0} THB` });
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
    { type: "text", text: `✅ ${ticket.ticketNo} ดำเนินการเสร็จสิ้นแล้วครับ\n📝 ผลการดำเนินการ : ${resolution}` },
    ratingMenu(ticket.id),
  ]);
  audit.log({ ...audit.fromReq(req), action: "TICKET_CLOSED", resourceType: "ticket", resourceId: ticket.id, detail: `${ticket.ticketNo}: ${resolution}` });
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
    { type: "text", text: `✅ ${ticket.ticketNo} ได้รับการแก้ไขเรียบร้อยแล้วครับ\n📝 ผลการดำเนินการ : ${resolution}` },
    ratingMenu(ticket.id),
  ]);
  audit.log({ ...audit.fromReq(req), action: "TICKET_CLOSED", resourceType: "ticket", resourceId: ticket.id, detail: `${ticket.ticketNo}: ${resolution}` });
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
    audit.log({ ...audit.fromReq(req), action: "CATEGORY_CREATED", resourceType: "category", resourceId: cat.id, detail: cat.name });
    res.json(cat);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateCategory(req, res) {
  try {
    const cat = await categoryService.updateCategory(req.params.id, req.body);
    audit.log({ ...audit.fromReq(req), action: "CATEGORY_UPDATED", resourceType: "category", resourceId: cat.id, detail: cat.name });
    res.json(cat);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deleteCategory(req, res) {
  try {
    await categoryService.deleteCategory(req.params.id);
    audit.log({ ...audit.fromReq(req), action: "CATEGORY_DELETED", resourceType: "category", resourceId: req.params.id });
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
    audit.log({ ...audit.fromReq(req), action: "FAQ_CREATED", resourceType: "faq", resourceId: faq.id, detail: faq.question });
    res.json(faq);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateFaq(req, res) {
  try {
    const faq = await categoryService.updateFaq(req.params.id, req.body);
    audit.log({ ...audit.fromReq(req), action: "FAQ_UPDATED", resourceType: "faq", resourceId: faq.id, detail: faq.question });
    res.json(faq);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deleteFaq(req, res) {
  try {
    await categoryService.deleteFaq(req.params.id);
    audit.log({ ...audit.fromReq(req), action: "FAQ_DELETED", resourceType: "faq", resourceId: req.params.id });
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
    audit.log({ ...audit.fromReq(req), action: "ASSIGNEE_CREATED", resourceType: "assignee", resourceId: a.id, detail: a.name });
    res.json(a);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateAssignee(req, res) {
  try {
    const a = await prisma.assignee.update({ where: { id: Number(req.params.id) }, data: req.body });
    audit.log({ ...audit.fromReq(req), action: "ASSIGNEE_UPDATED", resourceType: "assignee", resourceId: a.id, detail: a.name });
    res.json(a);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deleteAssignee(req, res) {
  try {
    await prisma.assignee.delete({ where: { id: Number(req.params.id) } });
    audit.log({ ...audit.fromReq(req), action: "ASSIGNEE_DELETED", resourceType: "assignee", resourceId: req.params.id });
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
    const booking = await bookingService.adminCancelBooking(req.params.id, req.adminUser?.email);
    const fmt = (dt) => new Date(dt).toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short",
    });
    await notifyUser(booking.lineUserId, [{
      type: "text",
      text: `📢 การจองของคุณถูกยกเลิกโดยผู้ดูแลระบบครับ\n\n📋 ${booking.bookingNo}\n🏢 ห้อง: ${booking.room?.name || "-"}\n📝 ${booking.title}\n🕐 ${fmt(booking.startAt)} – ${fmt(booking.endAt)}\n\nหากมีข้อสงสัยกรุณาติดต่อเจ้าหน้าที่ครับ 🙏`,
    }]);
    audit.log({ ...audit.fromReq(req), action: "BOOKING_CANCELLED", resourceType: "booking", resourceId: booking.id, detail: `${booking.bookingNo} ${booking.room?.name || ""}: ${booking.title}` });
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
    audit.log({ ...audit.fromReq(req), action: "ROOM_CREATED", resourceType: "room", resourceId: room.id, detail: room.name });
    res.json(room);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateRoom(req, res) {
  try {
    const room = await bookingService.updateRoom(req.params.id, req.body);
    audit.log({ ...audit.fromReq(req), action: "ROOM_UPDATED", resourceType: "room", resourceId: room.id, detail: room.name });
    res.json(room);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deleteRoom(req, res) {
  try {
    await bookingService.deleteRoom(req.params.id);
    audit.log({ ...audit.fromReq(req), action: "ROOM_DELETED", resourceType: "room", resourceId: req.params.id });
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

// ── System Config ─────────────────────────────────────────

async function getConfig(req, res) {
  const rows = await prisma.systemConfig.findMany();
  const config = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json(config);
}

async function updateConfig(req, res) {
  const updates = req.body;
  await Promise.all(
    Object.entries(updates).map(([key, value]) =>
      prisma.systemConfig.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    )
  );
  audit.log({ ...audit.fromReq(req), action: "SETTINGS_CHANGED", resourceType: "config", detail: Object.keys(updates).join(", ") });
  res.json({ ok: true });
}

async function testNotifyGroup(req, res) {
  const notify = require("../services/notifyService");
  const { type = "ticket" } = req.query;
  const { groupId: overrideGroupId } = req.body || {};

  // If caller passed groupId directly, push to it without needing a prior DB save
  if (overrideGroupId?.trim()) {
    try {
      await notify.pushDirect(overrideGroupId.trim(), type);
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  const key = type === "booking" ? "notify_booking_group_id" : "notify_ticket_group_id";
  const row = await prisma.systemConfig.findUnique({ where: { key } });
  if (!row?.value?.trim()) return res.status(400).json({ error: `ยังไม่ได้ตั้งค่า ${key} — กรุณาบันทึกก่อนทดสอบ` });
  try {
    await notify.pushDirect(row.value.trim(), type);
    res.json({ ok: true });
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
    audit.log({ ...audit.fromReq(req), action: "USER_ADDED", resourceType: "user", resourceId: u.id, detail: u.email });
    res.json(u);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deleteAllowedUser(req, res) {
  try {
    const u = await prisma.allowedUser.findUnique({ where: { id: Number(req.params.id) } });
    await prisma.allowedUser.delete({ where: { id: Number(req.params.id) } });
    audit.log({ ...audit.fromReq(req), action: "USER_REMOVED", resourceType: "user", resourceId: req.params.id, detail: u?.email });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// ── Helper ────────────────────────────────────────────────

async function notifyUser(lineUserId, messages) {
  if (!lineUserId || !process.env.LINE_CHANNEL_ACCESS_TOKEN) return;
  try {
    await client.pushMessage({ to: lineUserId, messages });
  } catch (err) {
    console.error("Line push error:", err.message);
  }
}

async function exportBookings(req, res) {
  const { status, roomId, from, to } = req.query;
  const where = {};
  if (status && status !== "all") where.status = status;
  if (roomId) where.roomId = Number(roomId);
  if (from || to) {
    where.startAt = {};
    if (from) where.startAt.gte = new Date(from);
    if (to) {
      const d = new Date(to); d.setHours(23, 59, 59, 999);
      where.startAt.lte = d;
    }
  }
  const bookings = await prisma.roomBooking.findMany({
    where, include: { room: true }, orderBy: { startAt: "desc" }, take: 10000,
  });

  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const fmt = (dt) => dt ? new Date(dt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }) : "";
  const headers = ["BookingNo", "Room", "Title", "Status", "DisplayName", "Email", "Department",
    "StartAt", "EndAt", "Notes", "CancelledBy", "CancelledByType", "CancelledAt", "CreatedAt"];
  const rows = bookings.map((b) => [
    b.bookingNo, b.room?.name || "", b.title, b.status,
    b.displayName || "", b.email || "", b.department || "",
    fmt(b.startAt), fmt(b.endAt), b.notes || "",
    b.cancelledBy || "", b.cancelledByType || "", fmt(b.cancelledAt), fmt(b.createdAt),
  ].map(esc).join(","));

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="bookings-${Date.now()}.csv"`);
  res.send("﻿" + [headers.join(","), ...rows].join("\n"));
}

module.exports = {
  listTickets, exportTickets, getTicket, assignTicket, closeTicket, getStats,
  updateTicketStatus, updateTicketCost, closeWithCost,
  listCategories, createCategory, updateCategory, deleteCategory,
  createSubcategory, updateSubcategory, deleteSubcategory,
  listFaqs, createFaq, updateFaq, deleteFaq,
  listAssignees, createAssignee, updateAssignee, deleteAssignee,
  listBookings, listBookingsMonth, exportBookings, listRooms, cancelBookingAdmin, updateRoomCalendar,
  createRoom, updateRoom, deleteRoom, createRoomCalendar, testCalendar,
  listAllowedUsers, createAllowedUser, deleteAllowedUser,
  getConfig, updateConfig, testNotifyGroup,
};
