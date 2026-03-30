function categoryMenu(categories) {
  return {
    type: "flex",
    altText: "เลือกหมวดหมู่ปัญหา",
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "🛠️ แจ้งปัญหา IT", weight: "bold", size: "lg", color: "#ffffff" },
          { type: "text", text: "กรุณาเลือกหมวดหมู่ปัญหา", size: "sm", color: "#e0e0e0", margin: "xs" },
        ],
        backgroundColor: "#1a1a2e",
        paddingAll: "16px",
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: categories.map((cat) => ({
          type: "button",
          action: {
            type: "postback",
            label: `${cat.icon} ${cat.name}`.substring(0, 20),
            data: `action=select_category&category=${encodeURIComponent(cat.name)}`,
          },
          style: "primary",
          color: cat.color,
          height: "sm",
        })),
        paddingAll: "16px",
      },
    },
  };
}

module.exports = { categoryMenu };
