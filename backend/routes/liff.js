const express = require("express");
const multer = require("multer");
const path = require("path");
const liffController = require("../controllers/liffController");

const rateLimit = require("express-rate-limit");
const router = express.Router();

// Rate limit: สร้าง ticket/booking ได้ 20 ครั้ง / 5 นาที ต่อ IP
const writeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: { error: "Too many requests, please slow down" },
  standardHeaders: true, legacyHeaders: false,
});

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "/app/uploads"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // ลดจาก 15MB → 10MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
    cb(new Error("อนุญาตเฉพาะไฟล์รูปภาพเท่านั้น (JPEG, PNG, GIF, WebP)"));
  },
});

router.get("/categories", liffController.getCategories);
router.post("/ai", writeLimiter, liffController.aiChat);
router.get("/rooms", liffController.getRooms);
router.get("/room-slots", liffController.getRoomSlots);
router.get("/bookings-calendar", liffController.getBookingsCalendar);
router.post("/booking", writeLimiter, liffController.createBooking);
router.post("/ticket", writeLimiter, (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      const msg = err.code === "LIMIT_FILE_SIZE"
        ? "ไฟล์รูปใหญ่เกินไป (สูงสุด 10MB)"
        : "อัปโหลดรูปไม่สำเร็จ: " + err.message;
      return res.status(400).json({ error: msg });
    }
    next();
  });
}, liffController.createTicket);

module.exports = router;
