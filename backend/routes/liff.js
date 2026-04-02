const express = require("express");
const multer = require("multer");
const path = require("path");
const liffController = require("../controllers/liffController");

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "/app/uploads"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get("/categories", liffController.getCategories);
router.post("/ticket", upload.single("image"), liffController.createTicket);

module.exports = router;
