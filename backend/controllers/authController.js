const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const prisma = require("../prisma/client");
const audit = require("../services/auditService");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function googleLogin(req, res) {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: "Missing credential" });

  const ip = req.ip || req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || null;
  const ua = req.headers["user-agent"] || null;

  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload.email?.toLowerCase();
    const name = payload.name;

    if (!email) return res.status(400).json({ error: "Cannot get email from Google" });

    const allowed = await isEmailAllowed(email);
    if (!allowed) {
      audit.log({ actor: email, actorType: "admin", action: "ADMIN_LOGIN_FAILED", detail: "Not in allowed users", ipAddress: ip, userAgent: ua });
      return res.status(403).json({ error: "ไม่มีสิทธิ์เข้าใช้งาน กรุณาติดต่อผู้ดูแลระบบ" });
    }

    // null permissions = full access (INITIAL_ADMIN_EMAIL not in DB)
    const dbUser = await prisma.allowedUser.findUnique({ where: { email } });
    const permissions = dbUser ? (dbUser.permissions || []) : null;

    const token = jwt.sign({ email, name, permissions }, process.env.JWT_SECRET, { expiresIn: "8h" });
    audit.log({ actor: email, actorType: "admin", action: "ADMIN_LOGIN", detail: name, ipAddress: ip, userAgent: ua });
    res.json({ token, email, name, permissions });
  } catch (err) {
    console.error("Google auth error:", err.message);
    res.status(401).json({ error: "Token ไม่ถูกต้อง" });
  }
}

async function isEmailAllowed(email) {
  // INITIAL_ADMIN_EMAIL ใช้สำหรับ bootstrap ครั้งแรก
  const initialEmail = process.env.INITIAL_ADMIN_EMAIL?.toLowerCase();
  if (initialEmail && email === initialEmail) return true;

  const user = await prisma.allowedUser.findUnique({ where: { email } });
  return !!user;
}

module.exports = { googleLogin };
