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
app.use("/api", apiRouter);

// Health check
app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Helpdesk backend running on port ${PORT}`);
});
