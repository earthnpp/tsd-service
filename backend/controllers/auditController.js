const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function listAuditLogs(req, res) {
  const { page = 1, limit = 50, actor, action, actorType, from, to, search } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const where = {};
  if (actor) where.actor = { contains: actor };
  if (action) where.action = action;
  if (actorType) where.actorType = actorType;
  if (from || to) {
    where.timestamp = {};
    if (from) where.timestamp.gte = new Date(from);
    if (to) {
      const d = new Date(to);
      d.setHours(23, 59, 59, 999);
      where.timestamp.lte = d;
    }
  }
  if (search) {
    where.OR = [
      { actor: { contains: search } },
      { detail: { contains: search } },
      { ipAddress: { contains: search } },
      { resourceId: { contains: search } },
    ];
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { timestamp: "desc" }, skip, take: Number(limit) }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({ logs, total, page: Number(page), limit: Number(limit) });
}

async function getAuditActions(req, res) {
  const actions = await prisma.auditLog.findMany({
    select: { action: true },
    distinct: ["action"],
    orderBy: { action: "asc" },
  });
  res.json(actions.map((a) => a.action));
}

async function exportAuditLogs(req, res) {
  const { actor, action, actorType, from, to, search } = req.query;

  const where = {};
  if (actor) where.actor = { contains: actor };
  if (action) where.action = action;
  if (actorType) where.actorType = actorType;
  if (from || to) {
    where.timestamp = {};
    if (from) where.timestamp.gte = new Date(from);
    if (to) {
      const d = new Date(to);
      d.setHours(23, 59, 59, 999);
      where.timestamp.lte = d;
    }
  }
  if (search) {
    where.OR = [
      { actor: { contains: search } },
      { detail: { contains: search } },
      { ipAddress: { contains: search } },
    ];
  }

  const logs = await prisma.auditLog.findMany({ where, orderBy: { timestamp: "desc" }, take: 10000 });

  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const headers = ["ID", "Timestamp", "Actor", "Actor Type", "Action", "Resource Type", "Resource ID", "Detail", "IP Address"];
  const rows = logs.map((l) => [
    l.id, new Date(l.timestamp).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
    l.actor, l.actorType, l.action,
    l.resourceType || "", l.resourceId || "", l.detail || "", l.ipAddress || "",
  ].map(esc).join(","));

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="audit-log-${Date.now()}.csv"`);
  res.send("﻿" + [headers.join(","), ...rows].join("\n"));
}

module.exports = { listAuditLogs, getAuditActions, exportAuditLogs };
