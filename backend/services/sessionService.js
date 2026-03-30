const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function getSession(lineUserId) {
  let session = await prisma.userSession.findUnique({ where: { lineUserId } });
  if (!session) {
    session = await prisma.userSession.create({
      data: { lineUserId, state: "idle", updatedAt: new Date() },
    });
  }
  return session;
}

async function setState(lineUserId, state, tempData = null) {
  await prisma.userSession.upsert({
    where: { lineUserId },
    create: { lineUserId, state, tempData, updatedAt: new Date() },
    update: { state, tempData, updatedAt: new Date() },
  });
}

async function clearSession(lineUserId) {
  await setState(lineUserId, "idle", null);
}

module.exports = { getSession, setState, clearSession };
