function ratingMenu(ticketId) {
  const ratings = [
    { n: 1, emoji: "😞", label: "😞 1 ดาว" },
    { n: 2, emoji: "😐", label: "😐 2 ดาว" },
    { n: 3, emoji: "🙂", label: "🙂 3 ดาว" },
    { n: 4, emoji: "😊", label: "😊 4 ดาว" },
    { n: 5, emoji: "🤩", label: "🤩 5 ดาว" },
  ];

  return {
    type: "text",
    text: "⭐ กรุณาให้คะแนนความพึงพอใจการบริการ IT Support ครับ",
    quickReply: {
      items: ratings.map(({ n, label }) => ({
        type: "action",
        action: {
          type: "postback",
          label,
          data: `action=submit_rating&ticketId=${ticketId}&rating=${n}`,
          displayText: label,
        },
      })),
    },
  };
}

module.exports = ratingMenu;
