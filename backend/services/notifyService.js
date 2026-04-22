const { PrismaClient } = require("@prisma/client");
const line = require("@line/bot-sdk");

const prisma = new PrismaClient();
const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

async function getGroupId() {
  const row = await prisma.systemConfig.findUnique({ where: { key: "notify_group_id" } });
  return row?.value?.trim() || null;
}

async function push(messages) {
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) return;
  const groupId = await getGroupId();
  if (!groupId) return;
  try {
    await client.pushMessage({ to: groupId, messages });
  } catch (err) {
    console.error("[Notify] push failed:", err.message);
  }
}

function fmtDateTime(dt) {
  return new Date(dt).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short",
  });
}

async function notifyNewTicket(ticket) {
  await push([{
    type: "flex",
    altText: `🎫 Ticket ใหม่: ${ticket.ticketNo}`,
    contents: {
      type: "bubble",
      styles: { header: { backgroundColor: "#fff0f1" }, body: { backgroundColor: "#ffffff" } },
      header: {
        type: "box", layout: "vertical", paddingAll: "14px",
        contents: [
          { type: "text", text: "🎫 มี Ticket ใหม่เข้าระบบ", weight: "bold", size: "md", color: "#e63946" },
        ],
      },
      body: {
        type: "box", layout: "vertical", spacing: "sm", paddingAll: "16px",
        contents: [
          row("📋 เลขที่", ticket.ticketNo),
          row("📝 หัวข้อ", ticket.title || "-"),
          row("📂 หมวด", `${ticket.category} › ${ticket.subcategory}`),
          row("👤 ผู้แจ้ง", ticket.displayName || "-"),
          row("🏢 แผนก", ticket.department || "-"),
          ...(ticket.assetTag ? [row("🏷️ Asset", ticket.assetTag)] : []),
          row("⏰ เวลา", fmtDateTime(ticket.createdAt)),
        ],
      },
    },
  }]);
}

async function notifyNewBooking(booking) {
  const start = fmtDateTime(booking.startAt);
  const end   = new Date(booking.endAt).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });
  await push([{
    type: "flex",
    altText: `🏢 จองห้องใหม่: ${booking.bookingNo}`,
    contents: {
      type: "bubble",
      styles: { header: { backgroundColor: "#e8f5ff" }, body: { backgroundColor: "#ffffff" } },
      header: {
        type: "box", layout: "vertical", paddingAll: "14px",
        contents: [
          { type: "text", text: "🏢 มีการจองห้องประชุมใหม่", weight: "bold", size: "md", color: "#457b9d" },
        ],
      },
      body: {
        type: "box", layout: "vertical", spacing: "sm", paddingAll: "16px",
        contents: [
          row("📋 เลขที่", booking.bookingNo),
          row("🏢 ห้อง", booking.room?.name || "-"),
          row("📝 หัวข้อ", booking.title || "-"),
          row("👤 ผู้จอง", booking.displayName || "-"),
          row("🏢 แผนก", booking.department || "-"),
          row("📅 เวลา", `${start} – ${end} น.`),
          ...(booking.notes ? [row("📌 หมายเหตุ", booking.notes)] : []),
        ],
      },
    },
  }]);
}

function row(label, value) {
  return {
    type: "box", layout: "horizontal", spacing: "sm",
    contents: [
      { type: "text", text: label, size: "sm", color: "#888888", flex: 3 },
      { type: "text", text: String(value || "-"), size: "sm", color: "#1a1a2e", flex: 5, wrap: true },
    ],
  };
}

module.exports = { notifyNewTicket, notifyNewBooking };
