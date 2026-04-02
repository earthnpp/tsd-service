require("dotenv").config();
const express = require("express");
const cors = require("cors");

const webhookRouter = require("./routes/webhook");
const apiRouter = require("./routes/api");

const app = express();

// LINE webhook requires raw body for signature verification
app.use("/webhook", express.raw({ type: "application/json" }), webhookRouter);

// REST API for admin dashboard
app.use(express.json());
app.use(cors());

// LINE image proxy — ต้องอยู่ก่อน apiRouter เพราะ apiRouter ต้อง auth
app.get("/api/line-image/:messageId", async (req, res) => {
  try {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const response = await fetch(
      `https://api-data.line.me/v2/bot/message/${req.params.messageId}/content`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok) return res.status(404).send("Image not found");
    res.set("Content-Type", response.headers.get("content-type") || "image/jpeg");
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch {
    res.status(500).send("Error fetching image");
  }
});

app.use("/api", apiRouter);

// Health check
app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Helpdesk backend running on port ${PORT}`);
});
