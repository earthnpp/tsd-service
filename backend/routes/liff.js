const express = require("express");
const multer = require("multer");
const path = require("path");
const liffController = require("../controllers/liffController");

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "/app/uploads"),
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);
  },
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

router.get("/categories", liffController.getCategories);
router.post("/ticket", (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      const msg = err.code === "LIMIT_FILE_SIZE"
        ? "ไฟล์รูปใหญ่เกินไป (สูงสุด 15MB)"
        : "อัปโหลดรูปไม่สำเร็จ: " + err.message;
      return res.status(400).json({ error: msg });
    }
    next();
  });
}, liffController.createTicket);

module.exports = router;
