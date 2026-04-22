function subcategoryMenu(categoryName, subcategories) {
  return {
    type: "flex",
    altText: `เลือกประเภทย่อย - ${categoryName}`,
    contents: {
      type: "bubble",
      styles: { header: { backgroundColor: "#f5c6ca" }, body: { backgroundColor: "#f4f4f6" } },
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: `หมวด: ${categoryName}`, weight: "bold", size: "lg", color: "#e63946" },
          { type: "text", text: "เลือกประเภทย่อย", size: "sm", color: "#555555", margin: "xs" },
        ],
        paddingAll: "16px",
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: subcategories.map((sub) => ({
          type: "button",
          action: {
            type: "postback",
            label: sub.name.substring(0, 20),
            data: `action=select_subcategory&subcategory=${encodeURIComponent(sub.name)}`,
          },
          style: "secondary",
          height: "sm",
        })),
        paddingAll: "16px",
      },
    },
  };
}

module.exports = { subcategoryMenu };
