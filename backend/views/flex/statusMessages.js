function row(label, value) {
  return {
    type: "box", layout: "horizontal", spacing: "sm",
    contents: [
      { type: "text", text: label, size: "sm", color: "#888888", flex: 3 },
      { type: "text", text: String(value || "-"), size: "sm", color: "#1a1a2e", flex: 5, wrap: true },
    ],
  };
}

function assignedCard(ticket) {
  return {
    type: "flex",
    altText: `🔵 ${ticket.ticketNo} ได้รับงานแล้วครับ!`,
    contents: {
      type: "bubble",
      styles: { header: { backgroundColor: "#cce5ff" }, body: { backgroundColor: "#ffffff" } },
      header: {
        type: "box", layout: "vertical", paddingAll: "14px",
        contents: [{ type: "text", text: "🔵 ได้รับงานแล้วครับ!", weight: "bold", size: "md", color: "#1565c0" }],
      },
      body: {
        type: "box", layout: "vertical", spacing: "sm", paddingAll: "16px",
        contents: [
          row("📋 เลขที่", ticket.ticketNo),
          row("📌 หัวข้อ", ticket.title || "-"),
          row("👷 ผู้รับผิดชอบ", ticket.assignee || "ทีม IT"),
          { type: "separator", margin: "sm" },
          { type: "text", text: "กำลังดำเนินการแก้ไขให้ครับ 🙏", size: "sm", color: "#457b9d", wrap: true, margin: "sm" },
        ],
      },
    },
  };
}

function completedCard(ticket) {
  return {
    type: "flex",
    altText: `✅ ${ticket.ticketNo} ดำเนินการเสร็จสิ้นแล้วครับ`,
    contents: {
      type: "bubble",
      styles: { header: { backgroundColor: "#b8e8e0" }, body: { backgroundColor: "#ffffff" } },
      header: {
        type: "box", layout: "vertical", paddingAll: "14px",
        contents: [{ type: "text", text: "✅ ดำเนินการเสร็จสิ้นแล้วครับ", weight: "bold", size: "md", color: "#2a9d8f" }],
      },
      body: {
        type: "box", layout: "vertical", spacing: "sm", paddingAll: "16px",
        contents: [
          row("📋 เลขที่", ticket.ticketNo),
          row("📌 หัวข้อ", ticket.title || "-"),
          row("📝 ผลการดำเนินการ", ticket.resolution || "เสร็จเรียบร้อย"),
        ],
      },
    },
  };
}

function pendingCard(ticket) {
  return {
    type: "flex",
    altText: `🟡 ${ticket.ticketNo} ส่งกลับรอดำเนินการครับ`,
    contents: {
      type: "bubble",
      styles: { header: { backgroundColor: "#fff3cd" }, body: { backgroundColor: "#ffffff" } },
      header: {
        type: "box", layout: "vertical", paddingAll: "14px",
        contents: [{ type: "text", text: "🟡 ส่งกลับรอดำเนินการครับ", weight: "bold", size: "md", color: "#856404" }],
      },
      body: {
        type: "box", layout: "vertical", spacing: "sm", paddingAll: "16px",
        contents: [
          row("📋 เลขที่", ticket.ticketNo),
          row("📌 หัวข้อ", ticket.title || "-"),
          { type: "separator", margin: "sm" },
          { type: "text", text: "ทีม IT จะดำเนินการต่อโดยเร็วครับ 🙏", size: "sm", color: "#888", wrap: true, margin: "sm" },
        ],
      },
    },
  };
}

function ratingCard(ticketId) {
  const stars = [
    { n: 1, emoji: "😞", color: "#999999" },
    { n: 2, emoji: "😐", color: "#e9730e" },
    { n: 3, emoji: "🙂", color: "#e9c46a" },
    { n: 4, emoji: "😊", color: "#2a9d8f" },
    { n: 5, emoji: "🤩", color: "#457b9d" },
  ];

  return {
    type: "flex",
    altText: "⭐ กรุณาให้คะแนนการบริการ IT Support ครับ",
    contents: {
      type: "bubble",
      styles: { header: { backgroundColor: "#fff8dc" }, body: { backgroundColor: "#ffffff" } },
      header: {
        type: "box", layout: "vertical", paddingAll: "14px",
        contents: [{ type: "text", text: "⭐ ให้คะแนนการบริการ", weight: "bold", size: "md", color: "#b8860b" }],
      },
      body: {
        type: "box", layout: "vertical", spacing: "md", paddingAll: "16px",
        contents: [
          { type: "text", text: "กรุณาให้คะแนนความพึงพอใจการบริการของทีม IT ครับ 🙏", size: "sm", color: "#555", wrap: true },
          {
            type: "box", layout: "horizontal", spacing: "sm", margin: "md",
            contents: stars.map(({ n, emoji, color }) => ({
              type: "button",
              action: {
                type: "postback",
                label: `${emoji}${n}`,
                data: `action=submit_rating&ticketId=${ticketId}&rating=${n}`,
                displayText: `${emoji} ${n} ดาว`,
              },
              style: "primary",
              color,
              height: "sm",
              flex: 1,
            })),
          },
        ],
      },
    },
  };
}

function bookingCancelledCard(booking) {
  const fmt = (dt) => new Date(dt).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short",
  });
  return {
    type: "flex",
    altText: `📢 การจองห้อง ${booking.bookingNo} ถูกยกเลิกครับ`,
    contents: {
      type: "bubble",
      styles: { header: { backgroundColor: "#ffe0e0" }, body: { backgroundColor: "#ffffff" } },
      header: {
        type: "box", layout: "vertical", paddingAll: "14px",
        contents: [{ type: "text", text: "📢 การจองถูกยกเลิกครับ", weight: "bold", size: "md", color: "#c62828" }],
      },
      body: {
        type: "box", layout: "vertical", spacing: "sm", paddingAll: "16px",
        contents: [
          row("📋 เลขที่", booking.bookingNo),
          row("🏢 ห้อง", booking.room?.name || "-"),
          row("📝 หัวข้อ", booking.title || "-"),
          row("🕐 เวลา", `${fmt(booking.startAt)} – ${fmt(booking.endAt)}`),
          { type: "separator", margin: "sm" },
          { type: "text", text: "หากมีข้อสงสัยกรุณาติดต่อเจ้าหน้าที่ครับ 🙏", size: "sm", color: "#888", wrap: true, margin: "sm" },
        ],
      },
    },
  };
}

module.exports = { assignedCard, completedCard, pendingCard, ratingCard, bookingCancelledCard };
