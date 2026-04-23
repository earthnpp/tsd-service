const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const ALLOWED_DOMAIN = "@thestandard.co";

// POST /api/portal/auth — Google login (domain check only)
async function portalLogin(req, res) {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: "Missing credential" });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload.email?.toLowerCase();
    const name = payload.name;
    const picture = payload.picture;

    if (!email) return res.status(400).json({ error: "Cannot get email from Google" });
    if (!email.endsWith(ALLOWED_DOMAIN)) {
      return res.status(403).json({ error: `เฉพาะบัญชี ${ALLOWED_DOMAIN} เท่านั้น` });
    }

    // Check if also admin
    const initialEmail = process.env.INITIAL_ADMIN_EMAIL?.toLowerCase();
    const dbUser = await prisma.allowedUser.findUnique({ where: { email } });
    const isAdmin = (initialEmail && email === initialEmail) || !!dbUser;
    const adminPermissions = isAdmin ? (dbUser ? (dbUser.permissions || []) : null) : undefined;

    const token = jwt.sign(
      { email, name, picture, isPortal: true, isAdmin, adminPermissions },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({ token, email, name, picture, isAdmin, adminPermissions });
  } catch (err) {
    console.error("Portal auth error:", err.message);
    res.status(401).json({ error: "Token ไม่ถูกต้อง" });
  }
}

// GET /api/portal/cards — public (only portal JWT needed)
async function listCards(req, res) {
  const cards = await prisma.portalCard.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
  });
  res.json(cards);
}

// Admin CRUD — ต้องมี admin token
async function adminListCards(req, res) {
  const cards = await prisma.portalCard.findMany({ orderBy: { order: "asc" } });
  res.json(cards);
}

async function adminCreateCard(req, res) {
  const { title, description, icon, url, color, order } = req.body;
  if (!title || !url) return res.status(400).json({ error: "title และ url จำเป็น" });
  const card = await prisma.portalCard.create({
    data: { title, description: description || null, icon: icon || "🔗", url, color: color || "#1a3a5c", order: order ?? 0 },
  });
  res.json(card);
}

async function adminUpdateCard(req, res) {
  const id = Number(req.params.id);
  const { title, description, icon, url, color, isActive, order } = req.body;
  const card = await prisma.portalCard.update({
    where: { id },
    data: { title, description, icon, url, color, isActive, order },
  });
  res.json(card);
}

async function adminDeleteCard(req, res) {
  const id = Number(req.params.id);
  await prisma.portalCard.delete({ where: { id } });
  res.json({ ok: true });
}

module.exports = { portalLogin, listCards, adminListCards, adminCreateCard, adminUpdateCard, adminDeleteCard };
