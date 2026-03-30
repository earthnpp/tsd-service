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

async function createBooking({ roomId, lineUserId, displayName, title, startAt, endAt }) {
  const overlap = await checkOverlap(roomId, startAt, endAt);
  if (overlap) throw new Error("ห้องนี้ถูกจองในช่วงเวลาดังกล่าวแล้วครับ");

  const bookingNo = await nextBookingNo();
  const booking = await prisma.roomBooking.create({
    data: { bookingNo, roomId, lineUserId, displayName, title, startAt, endAt },
    include: { room: true },
  });

  // Google Calendar sync (non-blocking)
  if (booking.room.calendarId) {
    calendarService.createEvent(booking.room.calendarId, {
      summary: `[${bookingNo}] ${title}`,
      description: `จองโดย: ${displayName || lineUserId}`,
      startAt,
      endAt,
    }).then((eventId) => {
      if (eventId) {
        prisma.roomBooking.update({
          where: { id: booking.id },
          data: { googleEventId: eventId },
        }).catch(() => {});
      }
    }).catch(() => {});
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
    data: { status: "cancelled" },
    include: { room: true },
  });

  if (booking.googleEventId && booking.room.calendarId) {
    calendarService.deleteEvent(booking.room.calendarId, booking.googleEventId).catch(() => {});
  }

  return updated;
}

async function getBookingsByUser(lineUserId, limit = 5) {
  const now = new Date();
  return prisma.roomBooking.findMany({
    where: {
      lineUserId,
      endAt: { gte: now },
      status: { not: "cancelled" },
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

async function adminCancelBooking(bookingId) {
  const booking = await prisma.roomBooking.findUnique({
    where: { id: Number(bookingId) },
    include: { room: true },
  });
  if (!booking) throw new Error("ไม่พบการจอง");

  const updated = await prisma.roomBooking.update({
    where: { id: Number(bookingId) },
    data: { status: "cancelled" },
  });

  if (booking.googleEventId && booking.room.calendarId) {
    calendarService.deleteEvent(booking.room.calendarId, booking.googleEventId).catch(() => {});
  }

  return updated;
}

async function updateRoomCalendar(roomId, calendarId) {
  return prisma.room.update({
    where: { id: Number(roomId) },
    data: { calendarId },
  });
}

module.exports = {
  getRooms,
  createBooking,
  cancelBooking,
  getBookingsByUser,
  getAllBookings,
  adminCancelBooking,
  updateRoomCalendar,
};
