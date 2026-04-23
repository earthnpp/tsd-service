const express = require("express");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const portalController = require("../controllers/portalController");

const router = express.Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

function portalAuth(req, res, next) {
  const token = req.headers["x-portal-token"] || req.headers["x-admin-token"];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    req.portalUser = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Token หมดอายุหรือไม่ถูกต้อง" });
  }
}

router.post("/auth", authLimiter, portalController.portalLogin);
router.get("/cards", portalAuth, portalController.listCards);

module.exports = router;
