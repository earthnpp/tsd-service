const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function generateTicketNo() {
  const counter = await prisma.ticketCounter.update({
    where: { id: 1 },
    data: { count: { increment: 1 } },
  });
  return `HLP-${String(counter.count).padStart(4, "0")}`;
}

const DAILY_LIMIT = parseInt(process.env.DAILY_TICKET_LIMIT || "3");

async function getDailyTicketCount(lineUserId) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return prisma.ticket.count({
    where: { lineUserId, createdAt: { gte: start, lte: end } },
  });
}

async function createTicket(data) {
  if (data.lineUserId) {
    const count = await getDailyTicketCount(data.lineUserId);
    if (count >= DAILY_LIMIT) {
      const err = new Error(`เกินจำนวนการแจ้งปัญหาต่อวัน (สูงสุด ${DAILY_LIMIT} ครั้ง/วัน)`);
      err.code = "RATE_LIMIT";
      throw err;
    }
  }
  const ticketNo = await generateTicketNo();
  return prisma.ticket.create({
    data: { ...data, ticketNo },
  });
}

async function getTicketsByUser(lineUserId, limit = 5) {
  return prisma.ticket.findMany({
    where: { lineUserId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

async function getAllTickets({ status, category, search, page = 1, limit = 20 } = {}) {
  const where = {};
  if (status && status !== "all") where.status = status;
  if (category && category !== "all") where.category = category;
  if (search) {
    where.OR = [
      { ticketNo: { contains: search } },
      { title: { contains: search } },
      { displayName: { contains: search } },
    ];
  }
  const skip = (Number(page) - 1) * Number(limit);
  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: Number(limit) }),
    prisma.ticket.count({ where }),
  ]);
  return { tickets, total };
}

async function getAllTicketsForExport({ status, category, search } = {}) {
  const where = {};
  if (status && status !== "all") where.status = status;
  if (category && category !== "all") where.category = category;
  if (search) {
    where.OR = [
      { ticketNo: { contains: search } },
      { title: { contains: search } },
      { displayName: { contains: search } },
    ];
  }
  return prisma.ticket.findMany({ where, orderBy: { createdAt: "desc" } });
}

async function getTicketById(id) {
  return prisma.ticket.findUnique({ where: { id: Number(id) } });
}

async function updateTicket(id, data) {
  return prisma.ticket.update({
    where: { id: Number(id) },
    data: { ...data, updatedAt: new Date() },
  });
}

async function getStats({ dateFrom, dateTo } = {}) {
  const dateFilter = {};
  if (dateFrom || dateTo) {
    dateFilter.createdAt = {};
    if (dateFrom) dateFilter.createdAt.gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      dateFilter.createdAt.lte = end;
    }
  }

  const [total, pending, inProgress, completed, ratings, faqRaw, activeAssignees] = await Promise.all([
    prisma.ticket.count({ where: dateFilter }),
    prisma.ticket.count({ where: { ...dateFilter, status: "pending" } }),
    prisma.ticket.count({ where: { ...dateFilter, status: "in_progress" } }),
    prisma.ticket.count({ where: { ...dateFilter, status: "completed" } }),
    prisma.ticket.findMany({
      where: { ...dateFilter, rating: { not: null } },
      select: { rating: true },
    }),
    prisma.faqItem.aggregate({ _sum: { viewCount: true, resolvedCount: true } }),
    prisma.assignee.findMany({ where: { isActive: true }, select: { name: true } }),
  ]);

  const avgRating =
    ratings.length > 0
      ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1)
      : null;

  const activeNames = activeAssignees.map((a) => a.name);

  // Category breakdown
  const categoryRaw = await prisma.ticket.groupBy({
    by: ["category"],
    where: dateFilter,
    _count: { id: true },
  });
  const byCategory = categoryRaw.map((r) => ({
    category: r.category,
    count: r._count.id,
  }));

  // Assignee workload — only active staff
  const assigneeRaw = await prisma.ticket.groupBy({
    by: ["assignee"],
    where: { ...dateFilter, assignee: { not: null, in: activeNames } },
    _count: { id: true },
    _avg: { rating: true },
  });
  const byAssignee = assigneeRaw.map((r) => ({
    assignee: r.assignee,
    count: r._count.id,
    avgRating: r._avg.rating ? Number(r._avg.rating).toFixed(1) : null,
  }));

  const faqViews = faqRaw._sum.viewCount || 0;
  const faqResolved = faqRaw._sum.resolvedCount || 0;
  const faqSelfResolveRate = faqViews > 0 ? Math.round((faqResolved / faqViews) * 100) : 0;

  return { total, pending, inProgress, completed, avgRating, byCategory, byAssignee, faqViews, faqResolved, faqSelfResolveRate };
}

module.exports = {
  createTicket,
  getTicketsByUser,
  getAllTickets,
  getAllTicketsForExport,
  getTicketById,
  updateTicket,
  getStats,
};
