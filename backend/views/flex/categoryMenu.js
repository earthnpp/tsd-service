function categoryMenu(categories) {
  return {
    type: "flex",
    altText: "เลือกหมวดหมู่ปัญหา",
    contents: {
      type: "bubble",
      styles: { header: { backgroundColor: "#f5c6ca" }, body: { backgroundColor: "#ffffff" } },
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "🛠️ แจ้งปัญหา IT", weight: "bold", size: "lg", color: "#e63946" },
          { type: "text", text: "กรุณาเลือกหมวดหมู่ปัญหา", size: "sm", color: "#555555", margin: "xs" },
        ],
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
