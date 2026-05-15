const prisma = require("../prisma/client");

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

async function getAllTicketsForExport({ status, category, search, dateFrom, dateTo } = {}) {
  const where = {};
  if (status && status !== "all") where.status = status;
  if (category && category !== "all") where.category = category;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) {
      const d = new Date(dateTo); d.setHours(23, 59, 59, 999);
      where.createdAt.lte = d;
    }
  }
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

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [
    total, pending, inProgress, completed, ratings, faqRaw, activeAssignees,
    categoryRaw, trendTickets, resolvedWithTime,
  ] = await Promise.all([
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
    prisma.ticket.groupBy({
      by: ["category"],
      where: dateFilter,
      _count: { id: true },
    }),
    prisma.ticket.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
    }),
    prisma.ticket.findMany({
      where: { ...dateFilter, status: "completed", completedAt: { not: null } },
      select: { createdAt: true, completedAt: true },
    }),
  ]);

  const avgRating =
    ratings.length > 0
      ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1)
      : null;

  const activeNames = activeAssignees.map((a) => a.name);

  const byCategory = categoryRaw.map((r) => ({
    category: r.category,
    count: r._count.id,
  }));

  // Assignee workload — only active staff (depends on activeNames, runs after Promise.all)
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

  const dailyTrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return {
      date: key,
      label: d.toLocaleDateString("th-TH", { month: "short", day: "numeric" }),
      count: trendTickets.filter(t => t.createdAt.toISOString().slice(0, 10) === key).length,
    };
  });
  const avgResolutionHours = resolvedWithTime.length > 0
    ? Math.round(resolvedWithTime.reduce((s, t) => s + (new Date(t.completedAt) - new Date(t.createdAt)) / 3600000, 0) / resolvedWithTime.length)
    : null;

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { total, pending, inProgress, completed, avgRating, byCategory, byAssignee, dailyTrend, avgResolutionHours, completionRate };
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
