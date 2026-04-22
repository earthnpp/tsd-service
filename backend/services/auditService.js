const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function log({ actor, actorType = "admin", action, resourceType, resourceId, detail, ipAddress, userAgent }) {
  try {
    await prisma.auditLog.create({
      data: {
        actor: actor || "system",
        actorType,
        action,
        resourceType: resourceType || null,
        resourceId: resourceId ? String(resourceId) : null,
        detail: detail || null,
        ipAddress: ipAddress || null,
        userAgent: userAgent ? userAgent.substring(0, 500) : null,
      },
    });
  } catch (err) {
    console.error("Audit log error:", err.message);
  }
}

function fromReq(req) {
  const actor = req.adminUser?.email || "system";
  const ip = req.ip || req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || null;
  const ua = req.headers["user-agent"] || null;
  return { actor, ipAddress: ip, userAgent: ua };
}

module.exports = { log, fromReq };
