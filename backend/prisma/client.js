const { PrismaClient } = require("@prisma/client");
const prisma = global._prisma ?? (global._prisma = new PrismaClient());
module.exports = prisma;
