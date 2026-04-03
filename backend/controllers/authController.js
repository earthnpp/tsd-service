const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function googleLogin(req, res) {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: "Missing credential" });

  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload.email?.toLowerCase();
    const name = payload.name;

    if (!email) return res.status(400).json({ error: "Cannot get email from Google" });

    // Check whitelist
    const allowed = await isEmailAllowed(email);
    if (!allowed) {
      return res.status(403).json({ error: "ไม่มีสิทธิ์เข้าใช้งาน กรุณาติดต่อผู้ดูแลระบบ" });
    }

    const token = jwt.sign(
      { email, name },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({ token, email, name });
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
