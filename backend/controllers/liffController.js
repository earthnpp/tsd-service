const { PrismaClient } = require("@prisma/client");
const line = require("@line/bot-sdk");
const ticketService = require("../services/ticketService");
const categoryService = require("../services/categoryService");
const ticketConfirm = require("../views/flex/ticketConfirm");

const prisma = new PrismaClient();
const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

async function verifyLineToken(accessToken) {
  const res = await fetch(`https://api.line.me/oauth2/v2.1/verify?access_token=${accessToken}`);
  if (!res.ok) throw new Error("Invalid LINE token");
  return res.json(); // { client_id, expires_in, scope }
}

async function getLineUserId(accessToken) {
  const res = await fetch("https://api.line.me/v2/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Cannot get LINE profile");
  const profile = await res.json();
  return { userId: profile.userId, displayName: profile.displayName };
}

async function getCategories(req, res) {
  const categories = await categoryService.getActiveCategories();
  res.json(categories);
}

async function createTicket(req, res) {
  try {
    const accessToken = req.headers["x-line-access-token"];
    if (!accessToken) return res.status(401).json({ error: "No LINE token" });

    await verifyLineToken(accessToken);
    const { userId, displayName } = await getLineUserId(accessToken);

    const { name, category, subcategory, assetTag, description } = req.body;
    if (!category || !subcategory || !description?.trim()) {
      return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบ" });
    }

    const lines = description.trim().split("\n").map(l => l.trim()).filter(Boolean);
    const title = lines[0] || description;
    const desc = lines.length > 1 ? lines.slice(1).join("\n") : description;

    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }

    const ticket = await ticketService.createTicket({
      lineUserId: userId,
      displayName: name || displayName,
      title,
      category,
      subcategory,
      assetTag: assetTag?.trim().toUpperCase() || null,
      description: desc,
      imageUrl,
    });

    // Push confirmation to user in LINE
    client.pushMessage({
      to: userId,
      messages: [
        { type: "text", text: "✅ แจ้งรับบริการเรียบร้อยครับ" },
        ticketConfirm(ticket),
      ],
    }).catch(() => {});

    res.json({ success: true, ticketNo: ticket.ticketNo });
  } catch (err) {
    console.error("LIFF createTicket error:", err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getCategories, createTicket };
