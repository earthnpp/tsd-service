const express = require("express");
const line = require("@line/bot-sdk");
const { handleEvents } = require("../controllers/webhookController");

const router = express.Router();

const lineConfig = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

router.post(
  "/",
  line.middleware(lineConfig),
  async (req, res) => {
    try {
      await handleEvents(req.body.events);
      res.status(200).end();
    } catch (err) {
      console.error("Webhook error:", err);
      res.status(500).end();
    }
  }
);

module.exports = router;
