function row(label, value) {
  return {
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: label, size: "sm", color: "#888888", flex: 3 },
      { type: "text", text: String(value ?? "-"), size: "sm", color: "#1a1a2e", flex: 5, wrap: true },
    ],
  };
}

function assignedCard(ticket) {
  return {
    type: "flex",
    altText: `🔵 ${ticket.ticketNo} ได้รับงานแล้วครับ!`,
    contents: {
      type: "bubble",
      styles: { header: { backgroundColor: "#cce5ff" }, body: { backgroundColor: "#f4f4f6" } },
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "🔵 ได้รับงานแล้วครับ!", weight: "bold", size: "lg", color: "#1565c0" },
        ],
        paddingAll: "16px",
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: ticket.ticketNo, weight: "bold", size: "xl", color: "#1a1a2e" },
          { type: "separator", margin: "md" },
          row("หัวข้อ", ticket.title || "-"),
          row("ผู้รับผิดชอบ", ticket.assignee || "ทีม IT"),
          { type: "separator", margin: "md" },
          { type: "text", text: "กำลังดำเนินการแก้ไขให้ครับ 🙏", size: "sm", color: "#888888", wrap: true, margin: "md" },
        ],
        paddingAll: "20px",
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
      styles: { header: { backgroundColor: "#b8e8e0" }, body: { backgroundColor: "#f4f4f6" } },
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "✅ ดำเนินการเสร็จสิ้นแล้วครับ", weight: "bold", size: "lg", color: "#2a9d8f" },
        ],
        paddingAll: "16px",
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: ticket.ticketNo, weight: "bold", size: "xl", color: "#1a1a2e" },
          { type: "separator", margin: "md" },
          row("หัวข้อ", ticket.title || "-"),
          row("ผลการดำเนินการ", ticket.resolution || "เสร็จเรียบร้อย"),
          { type: "separator", margin: "md" },
          { type: "text", text: "ขอบคุณที่ใช้บริการ IT Support ครับ 🙏", size: "sm", color: "#888888", wrap: true, margin: "md" },
        ],
        paddingAll: "20px",
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
      styles: { header: { backgroundColor: "#fff3cd" }, body: { backgroundColor: "#f4f4f6" } },
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "🟡 ส่งกลับรอดำเนินการครับ", weight: "bold", size: "lg", color: "#856404" },
        ],
        paddingAll: "16px",
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: ticket.ticketNo, weight: "bold", size: "xl", color: "#1a1a2e" },
          { type: "separator", margin: "md" },
          row("หัวข้อ", ticket.title || "-"),
          { type: "separator", margin: "md" },
          { type: "text", text: "ทีม IT จะดำเนินการต่อโดยเร็วครับ 🙏", size: "sm", color: "#888888", wrap: true, margin: "md" },
        ],
        paddingAll: "20px",
      },
    },
  };
}

function ratingCard(ticketId) {
  return {
    type: "flex",
    altText: "⭐ กรุณาให้คะแนนการบริการ IT Support ครับ",
    contents: {
      type: "bubble",
      styles: { header: { backgroundColor: "#fff8dc" }, body: { backgroundColor: "#f4f4f6" } },
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "⭐ ให้คะแนนการบริการ", weight: "bold", size: "lg", color: "#b8860b" },
        ],
        paddingAll: "16px",
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: "กรุณาให้คะแนนความพึงพอใจครับ", size: "sm", color: "#888888", wrap: true },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              starBtn("😞", 1, "#aaaaaa", ticketId),
              starBtn("😐", 2, "#e9730e", ticketId),
              starBtn("🙂", 3, "#e9c46a", ticketId),
              starBtn("😊", 4, "#2a9d8f", ticketId),
              starBtn("🤩", 5, "#457b9d", ticketId),
            ],
            margin: "md",
          },
        ],
        paddingAll: "20px",
      },
    },
  };
}

function starBtn(emoji, n, color, ticketId) {
  return {
    type: "button",
    style: "primary",
    color,
    height: "sm",
    flex: 1,
    action: {
      type: "postback",
      label: `${emoji}${n}`,
      data: `action=submit_rating&ticketId=${ticketId}&rating=${n}`,
      displayText: `${emoji} ${n} ดาว`,
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
      styles: { header: { backgroundColor: "#ffe0e0" }, body: { backgroundColor: "#f4f4f6" } },
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "📢 การจองถูกยกเลิกครับ", weight: "bold", size: "lg", color: "#c62828" },
        ],
        paddingAll: "16px",
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: booking.bookingNo, weight: "bold", size: "xl", color: "#1a1a2e" },
          { type: "separator", margin: "md" },
          row("ห้อง", booking.room?.name || "-"),
          row("หัวข้อ", booking.title || "-"),
          row("เวลา", `${fmt(booking.startAt)} – ${fmt(booking.endAt)}`),
          { type: "separator", margin: "md" },
          { type: "text", text: "หากมีข้อสงสัยกรุณาติดต่อเจ้าหน้าที่ครับ 🙏", size: "sm", color: "#888888", wrap: true, margin: "md" },
        ],
        paddingAll: "20px",
      },
    },
  };
}

module.exports = { assignedCard, completedCard, pendingCard, ratingCard, bookingCancelledCard };
