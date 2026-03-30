function mainMenu(displayName) {
  return {
    type: "flex",
    altText: "IT Helpdesk - เมนูหลัก",
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "🖥️ IT Helpdesk",
            weight: "bold",
            size: "xl",
            color: "#ffffff",
          },
          {
            type: "text",
            text: `สวัสดี ${displayName || "คุณ"} 👋`,
            size: "sm",
            color: "#e0e0e0",
            margin: "xs",
          },
        ],
        backgroundColor: "#1a1a2e",
        paddingAll: "20px",
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            action: { type: "postback", label: "🛠️ แจ้งปัญหา IT", data: "action=report" },
            style: "primary",
            color: "#e63946",
            height: "sm",
          },
          {
            type: "button",
            action: { type: "postback", label: "🎫 เช็คสถานะ Ticket", data: "action=status" },
            style: "secondary",
            height: "sm",
          },
          {
            type: "button",
            action: { type: "postback", label: "💡 FAQ / วิธีแก้ปัญหาเบื้องต้น", data: "action=faq" },
            style: "secondary",
            height: "sm",
          },
          { type: "separator", margin: "sm" },
          {
            type: "button",
            action: { type: "postback", label: "🏢 จองห้องประชุม", data: "action=book_room" },
            style: "primary",
            color: "#457b9d",
            height: "sm",
          },
          {
            type: "button",
            action: { type: "postback", label: "📋 รายการจองของฉัน", data: "action=my_bookings" },
            style: "secondary",
            height: "sm",
          },
          {
            type: "button",
            action: { type: "postback", label: "📞 ติดต่อเจ้าหน้าที่ IT", data: "action=contact_it" },
            style: "secondary",
            height: "sm",
          },
        ],
        paddingAll: "16px",
      },
    },
  };
}

module.exports = mainMenu;
