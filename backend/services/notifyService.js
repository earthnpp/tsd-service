const { PrismaClient } = require("@prisma/client");
const line = require("@line/bot-sdk");

const prisma = new PrismaClient();
const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

async function getConfigValue(key) {
  const row = await prisma.systemConfig.findUnique({ where: { key } });
  return row?.value?.trim() || null;
}

async function pushTo(configKey, messages) {
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) return;
  const groupId = await getConfigValue(configKey);
  if (!groupId) return;
  try {
    await client.pushMessage({ to: groupId, messages });
  } catch (err) {
    let lineMsg = "";
    try { lineMsg = JSON.parse(err.body)?.message || ""; } catch {}
    const detail = err.statusCode
      ? `${err.statusCode} – ${lineMsg || err.message}`
      : err.message;
    console.error(`[Notify] push to ${configKey} failed: ${detail} (groupId=${groupId})`);
  }
}

function fmtDateTime(dt) {
  return new Date(dt).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short",
  });
}

function footer(url) {
  if (!url) return undefined;
  return {
    type: "box", layout: "vertical", paddingAll: "12px",
    contents: [{
      type: "button",
      style: "primary",
      color: "#1a1a2e",
      height: "sm",
      action: { type: "uri", label: "เปิดดูในระบบ →", uri: url },
    }],
  };
}

async function notifyNewTicket(ticket) {
  const adminUrl = await getConfigValue("admin_url");
  const url = adminUrl ? `${adminUrl}/admin#tickets` : null;

  await pushTo("notify_ticket_group_id", [{
    type: "flex",
    altText: `🎫 Ticket ใหม่: ${ticket.ticketNo}`,
    contents: {
      type: "bubble",
      styles: {
        header: { backgroundColor: "#fff0f1" },
        body:   { backgroundColor: "#f4f4f6" },
        ...(url ? { footer: { backgroundColor: "#f9f9f9" } } : {}),
      },
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
      ...(url ? { footer: footer(url) } : {}),
    },
  }]);
}

async function notifyNewBooking(booking) {
  const adminUrl = await getConfigValue("admin_url");
  const url = adminUrl ? `${adminUrl}/admin#bookings` : null;

  const start = fmtDateTime(booking.startAt);
  const end   = new Date(booking.endAt).toLocaleTimeString("th-TH", {
    timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit",
  });

  await pushTo("notify_booking_group_id", [{
    type: "flex",
    altText: `🏢 จองห้องใหม่: ${booking.bookingNo}`,
    contents: {
      type: "bubble",
      styles: {
        header: { backgroundColor: "#e8f5ff" },
        body:   { backgroundColor: "#f4f4f6" },
        ...(url ? { footer: { backgroundColor: "#f9f9f9" } } : {}),
      },
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
      ...(url ? { footer: footer(url) } : {}),
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

async function pushDirect(groupId, type) {
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) throw new Error("LINE_CHANNEL_ACCESS_TOKEN ไม่ได้ตั้งค่า");
  const adminUrl = await getConfigValue("admin_url");
  const url = adminUrl ? `${adminUrl}/admin#${type === "booking" ? "bookings" : "tickets"}` : null;

  const messages = type === "booking" ? [{
    type: "flex",
    altText: "🧪 ทดสอบแจ้งเตือนจองห้อง",
    contents: {
      type: "bubble",
      styles: {
        header: { backgroundColor: "#e8f5ff" },
        body: { backgroundColor: "#f4f4f6" },
        ...(url ? { footer: { backgroundColor: "#f9f9f9" } } : {}),
      },
      header: { type: "box", layout: "vertical", paddingAll: "14px",
        contents: [{ type: "text", text: "🧪 ทดสอบ: มีการจองห้องประชุมใหม่", weight: "bold", size: "md", color: "#457b9d" }] },
      body: { type: "box", layout: "vertical", spacing: "sm", paddingAll: "16px",
        contents: [
          row("📋 เลขที่", "BK-TEST"),
          row("🏢 ห้อง", "ห้องทดสอบ"),
          row("📝 หัวข้อ", "ทดสอบแจ้งเตือนจองห้อง"),
          row("👤 ผู้จอง", "Admin"),
          row("📅 เวลา", fmtDateTime(new Date())),
        ] },
      ...(url ? { footer: footer(url) } : {}),
    },
  }] : [{
    type: "flex",
    altText: "🧪 ทดสอบแจ้งเตือน Ticket",
    contents: {
      type: "bubble",
      styles: {
        header: { backgroundColor: "#fff0f1" },
        body: { backgroundColor: "#f4f4f6" },
        ...(url ? { footer: { backgroundColor: "#f9f9f9" } } : {}),
      },
      header: { type: "box", layout: "vertical", paddingAll: "14px",
        contents: [{ type: "text", text: "🧪 ทดสอบ: มี Ticket ใหม่เข้าระบบ", weight: "bold", size: "md", color: "#e63946" }] },
      body: { type: "box", layout: "vertical", spacing: "sm", paddingAll: "16px",
        contents: [
          row("📋 เลขที่", "TEST-0000"),
          row("📝 หัวข้อ", "ทดสอบระบบแจ้งเตือน"),
          row("📂 หมวด", "ทดสอบ › ระบบ"),
          row("👤 ผู้แจ้ง", "Admin"),
          row("⏰ เวลา", fmtDateTime(new Date())),
        ] },
      ...(url ? { footer: footer(url) } : {}),
    },
  }];

  await client.pushMessage({ to: groupId, messages });
}

module.exports = { notifyNewTicket, notifyNewBooking, pushDirect };
