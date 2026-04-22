const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const calendarService = require("./calendarService");

async function nextBookingNo() {
  const counter = await prisma.bookingCounter.update({
    where: { id: 1 },
    data: { count: { increment: 1 } },
  });
  return `BK-${String(counter.count).padStart(4, "0")}`;
}

async function getRooms() {
  return prisma.room.findMany({ orderBy: { name: "asc" } });
}

async function checkOverlap(roomId, startAt, endAt, excludeId = null) {
  const where = {
    roomId,
    status: "confirmed",
    AND: [
      { startAt: { lt: endAt } },
      { endAt: { gt: startAt } },
    ],
  };
  if (excludeId) where.id = { not: excludeId };
  const count = await prisma.roomBooking.count({ where });
  return count > 0;
}

async function createBooking({ roomId, lineUserId, displayName, email, department, title, notes, startAt, endAt }) {
  const overlap = await checkOverlap(roomId, startAt, endAt);
  if (overlap) throw new Error("ห้องนี้ถูกจองในช่วงเวลาดังกล่าวแล้วครับ");

  const bookingNo = await nextBookingNo();
  const booking = await prisma.roomBooking.create({
    data: { bookingNo, roomId, lineUserId, displayName, email, department, title, notes: notes || null, startAt, endAt },
    include: { room: true },
  });

  // Google Calendar sync (non-blocking)
  if (booking.room.calendarId) {
    calendarService.createEvent(booking.room.calendarId, {
      summary: `${booking.room.name} : ${title}`,
      description: `ผู้จอง: ${displayName || lineUserId}\nรายละเอียด: ${title}${notes ? `\nหมายเหตุ: ${notes}` : ""}\nหมายเลขการจอง: ${bookingNo}`,
      startAt,
      endAt,
    }).then((eventId) => {
      if (eventId) {
        prisma.roomBooking.update({
          where: { id: booking.id },
          data: { googleEventId: eventId },
        }).catch((err) => console.error(`[Calendar] DB update googleEventId failed for booking ${booking.id}:`, err.message));
        console.log(`[Calendar] Event created: ${eventId} for booking ${bookingNo}`);
      } else {
        console.warn(`[Calendar] createEvent returned null for booking ${bookingNo} (calendarId: ${booking.room.calendarId})`);
      }
    }).catch((err) => console.error(`[Calendar] createEvent threw for booking ${bookingNo}:`, err.message));
  } else {
    console.warn(`[Calendar] Room "${booking.room.name}" has no calendarId — skipping sync`);
  }

  return booking;
}

async function cancelBooking(bookingId, lineUserId) {
  const booking = await prisma.roomBooking.findUnique({
    where: { id: bookingId },
    include: { room: true },
  });
  if (!booking) throw new Error("ไม่พบการจอง");
  if (booking.lineUserId !== lineUserId) throw new Error("ไม่มีสิทธิ์ยกเลิกการจองนี้");
  if (booking.status === "cancelled") throw new Error("การจองนี้ถูกยกเลิกแล้ว");

  const updated = await prisma.roomBooking.update({
    where: { id: bookingId },
    data: {
      status: "cancelled",
      cancelledBy: booking.displayName || lineUserId,
      cancelledAt: new Date(),
      cancelledByType: "user",
    },
    include: { room: true },
  });

  if (booking.googleEventId && booking.room.calendarId) {
    calendarService.deleteEvent(booking.room.calendarId, booking.googleEventId)
      .then(() => console.log(`[Calendar] Event deleted for booking ${booking.bookingNo}`))
      .catch((err) => console.error(`[Calendar] deleteEvent failed for booking ${booking.bookingNo}:`, err.message));
  } else {
    console.warn(`[Calendar] skip delete — booking ${booking.bookingNo} has no googleEventId or calendarId`);
  }

  return updated;
}

async function getBookingsByUser(lineUserId, limit = 5) {
  const now = new Date();
  // Show upcoming confirmed + recently cancelled (within 7 days)
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return prisma.roomBooking.findMany({
    where: {
      lineUserId,
      OR: [
        { status: "confirmed", endAt: { gte: now } },
        { status: "cancelled", cancelledAt: { gte: weekAgo } },
      ],
    },
    include: { room: true },
    orderBy: { startAt: "asc" },
    take: limit,
  });
}

async function getAllBookings({ status, roomId, page = 1, limit = 20 } = {}) {
  const where = {};
  if (status && status !== "all") where.status = status;
  if (roomId) where.roomId = Number(roomId);

  const skip = (Number(page) - 1) * Number(limit);
  const [bookings, total] = await Promise.all([
    prisma.roomBooking.findMany({
      where,
      include: { room: true },
      orderBy: { startAt: "desc" },
      skip,
      take: Number(limit),
    }),
    prisma.roomBooking.count({ where }),
  ]);
  return { bookings, total };
}

async function adminCancelBooking(bookingId, actorEmail) {
  const booking = await prisma.roomBooking.findUnique({
    where: { id: Number(bookingId) },
    include: { room: true },
  });
  if (!booking) throw new Error("ไม่พบการจอง");

  const updated = await prisma.roomBooking.update({
    where: { id: Number(bookingId) },
    data: {
      status: "cancelled",
      cancelledBy: actorEmail || "admin",
      cancelledAt: new Date(),
      cancelledByType: "admin",
    },
    include: { room: true },
  });

  if (booking.googleEventId && booking.room.calendarId) {
    calendarService.deleteEvent(booking.room.calendarId, booking.googleEventId)
      .then(() => console.log(`[Calendar] Event deleted for booking ${booking.bookingNo}`))
      .catch((err) => console.error(`[Calendar] deleteEvent failed for booking ${booking.bookingNo}:`, err.message));
  } else {
    console.warn(`[Calendar] skip delete — booking ${booking.bookingNo} has no googleEventId or calendarId`);
  }

  return updated;
}

async function updateRoomCalendar(roomId, calendarId) {
  return prisma.room.update({
    where: { id: Number(roomId) },
    data: { calendarId },
  });
}

async function createRoom(name) {
  return prisma.room.create({ data: { name } });
}

async function updateRoom(roomId, data) {
  return prisma.room.update({ where: { id: Number(roomId) }, data });
}

async function deleteRoom(roomId) {
  return prisma.room.delete({ where: { id: Number(roomId) } });
}

async function getRoomSlots(roomId, date) {
  const dayStart = new Date(`${date}T00:00:00+07:00`);
  const dayEnd   = new Date(`${date}T23:59:59+07:00`);
  // หา booking ที่ overlap กับวันนี้ ไม่ว่าจะเริ่มวันนี้หรือวันก่อนหน้า
  return prisma.roomBooking.findMany({
    where: {
      roomId: Number(roomId),
      status: "confirmed",
      startAt: { lt: dayEnd },
      endAt:   { gt: dayStart },
    },
    orderBy: { startAt: "asc" },
    select: { startAt: true, endAt: true, title: true, displayName: true },
  });
}

async function getBookingsForMonth(year, month) {
  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month, 1);
  return prisma.roomBooking.findMany({
    where: { startAt: { gte: start, lt: end } },
    include: { room: true },
    orderBy: { startAt: "asc" },
  });
}

module.exports = {
  getRooms, createRoom, updateRoom, deleteRoom, getRoomSlots,
  createBooking, cancelBooking, getBookingsByUser,
  getAllBookings, adminCancelBooking, updateRoomCalendar,
  getBookingsForMonth,
};
