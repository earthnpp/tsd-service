require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const helmet  = require("helmet");
const rateLimit = require("express-rate-limit");

const webhookRouter = require("./routes/webhook");
const apiRouter     = require("./routes/api");
const liffRouter    = require("./routes/liff");
const authRouter    = require("./routes/auth");

const app = express();

app.set("trust proxy", 1);

// ── Security headers ────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // allow /uploads to be loaded by LINE
  contentSecurityPolicy: false,                          // frontend sets its own CSP
}));

// ── CORS ─────────────────────────────────────────────────────
// อนุญาตเฉพาะ origin ที่กำหนดใน CORS_ORIGIN (comma-separated)
// default: เปิดสำหรับ internal nginx proxy เท่านั้น
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",").map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // same-origin requests (nginx proxy) มี origin = undefined → อนุญาต
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// ── Rate limiters ────────────────────────────────────────────
// Auth: 10 requests / 15 นาที (brute force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// LIFF ticket/booking: 20 requests / 5 นาที ต่อ IP
const liffWriteLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: { error: "Too many requests, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Admin API: 300 requests / นาที (ผู้ใช้จริง ไม่ควรถึง)
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: { error: "Too many requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── LINE webhook (raw body สำหรับ signature verification) ─────
app.use("/webhook", express.raw({ type: "application/json" }), webhookRouter);

// ── Body parser (explicit size limit) ────────────────────────
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// ── Static uploads (served by nginx in production) ───────────
app.use("/uploads", express.static("/app/uploads"));

// ── Routes ───────────────────────────────────────────────────
app.use("/api/auth", authLimiter, authRouter);
app.use("/api/liff", liffRouter);  // per-route limiter applied in liff.js
app.use("/api", adminLimiter, apiRouter);

// ── LINE image proxy ──────────────────────────────────────────
app.get("/api/line-image/:messageId", async (req, res) => {
  const messageId = req.params.messageId;
  // validate: LINE message IDs are numeric strings
  if (!/^\d+$/.test(messageId)) return res.status(400).send("Invalid message ID");
  try {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const response = await fetch(
      `https://api-data.line.me/v2/bot/message/${messageId}/content`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok) return res.status(404).send("Image not found");
    const ct = response.headers.get("content-type") || "image/jpeg";
    if (!ct.startsWith("image/")) return res.status(400).send("Not an image");
    res.set("Content-Type", ct);
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch {
    res.status(500).send("Error fetching image");
  }
});

// ── Health check ──────────────────────────────────────────────
app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Helpdesk backend running on port ${PORT}`);
});
