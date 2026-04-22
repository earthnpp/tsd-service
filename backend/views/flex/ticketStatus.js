const STATUS_LABEL = {
  pending:     { label: "รอดำเนินการ", icon: "🟡" },
  in_progress: { label: "กำลังดำเนินการ", icon: "🔵" },
  completed:   { label: "เสร็จสิ้น", icon: "🟢" },
};

function ticketStatusList(tickets) {
  if (!tickets || tickets.length === 0) {
    return {
      type: "text",
      text: "คุณยังไม่มี Ticket ที่เปิดอยู่ครับ\nพิมพ์ 'เมนู' เพื่อแจ้งปัญหาใหม่",
    };
  }

  const bubbles = tickets.map((t) => {
    const s = STATUS_LABEL[t.status] || { label: t.status, icon: "⚪" };
    return {
      type: "bubble",
      size: "kilo",
      styles: { header: { backgroundColor: "#1a3a5c" }, body: { backgroundColor: "#ffffff" } },
      header: {
        type: "box",
        layout: "horizontal",
        contents: [
          { type: "text", text: t.ticketNo, weight: "bold", size: "sm", color: "#ffffff", flex: 1 },
          { type: "text", text: `${s.icon} ${s.label}`, size: "xs", color: "#a8c8e8", align: "end" },
        ],
        paddingAll: "12px",
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "xs",
        contents: [
          { type: "text", text: t.title, size: "sm", wrap: true, weight: "bold" },
          { type: "text", text: `${t.category} › ${t.subcategory}`, size: "xs", color: "#888888" },
          { type: "text", text: t.createdAt.toLocaleString("th-TH"), size: "xs", color: "#aaaaaa", margin: "sm" },
          ...(t.assignee
            ? [{ type: "text", text: `👷 ${t.assignee}`, size: "xs", color: "#457b9d" }]
            : []),
          ...(t.status === "completed" && !t.rating
            ? [
                {
                  type: "button",
                  action: {
                    type: "postback",
                    label: "⭐ ให้คะแนน",
                    data: `action=rate&ticketId=${t.id}`,
                  },
                  style: "primary",
                  color: "#e9c46a",
                  height: "sm",
                  margin: "md",
                },
              ]
            : []),
        ],
        paddingAll: "12px",
      },
    };
  });

  return {
    type: "flex",
    altText: `สถานะ Ticket ของคุณ (${tickets.length} รายการ)`,
    contents: { type: "carousel", contents: bubbles },
  };
}

module.exports = ticketStatusList;
