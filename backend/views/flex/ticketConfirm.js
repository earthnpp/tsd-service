function ticketConfirm(ticket) {
  const statusIcon = { pending: "🟡", in_progress: "🔵", completed: "🟢" };

  return {
    type: "flex",
    altText: `✅ สร้าง Ticket สำเร็จ: ${ticket.ticketNo}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "✅ แจ้งปัญหาสำเร็จ", weight: "bold", size: "lg", color: "#ffffff" },
        ],
        backgroundColor: "#2a9d8f",
        paddingAll: "16px",
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: ticket.ticketNo, weight: "bold", size: "xl", color: "#1a1a2e" },
          { type: "separator", margin: "md" },
          row("ผู้แจ้ง", ticket.displayName || "-"),
          row("หัวข้อ", ticket.title || "-"),
          row("หมวด", `${ticket.category} › ${ticket.subcategory}`),
          ...(ticket.location ? [row("สถานที่", ticket.location)] : []),
          ...(ticket.assetTag ? [row("Asset", ticket.assetTag)] : []),
          row("สถานะ", `${statusIcon[ticket.status] || "🟡"} รอดำเนินการ`),
          { type: "separator", margin: "md" },
          {
            type: "text",
            text: "ทีม IT จะติดต่อกลับเร็วๆ นี้ครับ 🙏",
            size: "sm",
            color: "#888888",
            wrap: true,
            margin: "md",
          },
        ],
        paddingAll: "20px",
      },
    },
  };
}

function row(label, value) {
  return {
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: label, size: "sm", color: "#888888", flex: 2 },
      { type: "text", text: value, size: "sm", color: "#1a1a2e", flex: 4, wrap: true },
    ],
  };
}

module.exports = ticketConfirm;
