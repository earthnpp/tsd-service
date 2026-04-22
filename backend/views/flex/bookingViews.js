// ── Booking Flex/QuickReply Views ────────────────────────────

const DAY_NAMES = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function formatDateTH(dateStr) {
  // dateStr: "YYYY-MM-DD"
  const [y, m, d] = dateStr.split("-");
  const months = ["","ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  const be = Number(y) + 543;
  return `${Number(d)} ${months[Number(m)]} ${be}`;
}

function formatDateTimeTH(dt) {
  // offset to Asia/Bangkok (UTC+7) เพราะ Docker container ใช้ UTC
  const d = new Date(new Date(dt).getTime() + 7 * 60 * 60 * 1000);
  const months = ["","ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  const day = d.getUTCDate();
  const mon = months[d.getUTCMonth() + 1];
  const be = d.getUTCFullYear() + 543;
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${mon} ${be} ${hh}:${mm}`;
}

// Room selection quick reply
function roomQuickReply(rooms) {
  return {
    type: "text",
    text: "เลือกห้องประชุมที่ต้องการจองครับ 🏢",
    quickReply: {
      items: rooms.map((room) => ({
        type: "action",
        action: {
          type: "postback",
          label: room.name,
          data: `action=select_room&roomId=${room.id}`,
        },
      })),
    },
  };
}

// Date quick reply (next 7 days)
function dateQuickReply(phase, customText = null) {
  const items = [];
  // ใช้เวลาไทย (UTC+7) เพื่อให้ "วันนี้" ถูกต้องแม้ server ใช้ UTC
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + i);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const label = `${dd}/${mm} (${DAY_NAMES[d.getUTCDay()]})`;
    items.push({
      type: "action",
      action: {
        type: "postback",
        label,
        data: `action=book_date&phase=${phase}&date=${dateStr}`,
      },
    });
  }
  return {
    type: "text",
    text: customText || (phase === "start" ? "เลือกวันที่เริ่มต้นครับ 📅" : "เลือกวันที่สิ้นสุดครับ 📅"),
    quickReply: { items },
  };
}

// End date quick reply — shows start date first as default
function endDateQuickReply(startDate) {
  const [y, m, d] = startDate.split("-");
  const formatted = `${d}/${m} (วันเดิม)`;
  const items = [];

  // First item: same day
  items.push({
    type: "action",
    action: {
      type: "postback",
      label: formatted,
      data: `action=book_date&phase=end&date=${startDate}`,
    },
  });

  // Next 5 days
  const start = new Date(`${startDate}T00:00:00`);
  for (let i = 1; i <= 5; i++) {
    const nd = new Date(start);
    nd.setDate(nd.getDate() + i);
    const yyyy = nd.getFullYear();
    const mm = String(nd.getMonth() + 1).padStart(2, "0");
    const dd = String(nd.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const label = `${dd}/${mm} (${DAY_NAMES[nd.getDay()]})`;
    items.push({
      type: "action",
      action: {
        type: "postback",
        label,
        data: `action=book_date&phase=end&date=${dateStr}`,
      },
    });
  }

  return {
    type: "text",
    text: `เลือกวันสิ้นสุดครับ 📅\n(จองหลายวัน หรือวันเดิม)`,
    quickReply: { items },
  };
}

// Time quick reply
function timeQuickReply(phase, startTime = null) {
  let minHour = 8;
  if (phase === "end" && startTime) {
    minHour = parseInt(startTime.split(":")[0]) + 1;
  }
  const maxHour = 20;

  const items = [];
  for (let h = minHour; h <= maxHour && items.length < 13; h++) {
    const timeStr = `${String(h).padStart(2, "0")}:00`;
    items.push({
      type: "action",
      action: {
        type: "postback",
        label: timeStr,
        data: `action=book_time&phase=${phase}&time=${timeStr}`,
      },
    });
  }

  return {
    type: "text",
    text: phase === "start" ? "เลือกเวลาเริ่มต้นครับ ⏰\n(08:00 - 19:00)" : "เลือกเวลาสิ้นสุดครับ ⏰",
    quickReply: { items },
  };
}

// Booking preview (before confirm)
function bookingPreview(data) {
  const startStr = `${formatDateTH(data.startDate)} ${data.startTime} น.`;
  const endStr = `${formatDateTH(data.endDate)} ${data.endTime} น.`;
  return {
    type: "flex",
    altText: `ยืนยันจองห้อง ${data.roomName}`,
    contents: {
      type: "bubble",
      size: "kilo",
      styles: { header: { backgroundColor: "#d0d8f0" }, body: { backgroundColor: "#ffffff" } },
      header: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        contents: [
          { type: "text", text: "📋 สรุปการจองห้องประชุม", color: "#1a1a2e", weight: "bold", size: "md" },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        paddingAll: "16px",
        contents: [
          infoRow("🏢 ห้อง", data.roomName),
          infoRow("📅 เริ่มต้น", startStr),
          infoRow("📅 สิ้นสุด", endStr),
          infoRow("📝 หัวข้อ", data.title),
          { type: "separator", margin: "md" },
          {
            type: "text",
            text: "กรุณายืนยันการจองครับ",
            size: "sm",
            color: "#888888",
            margin: "md",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        paddingAll: "12px",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#2a9d8f",
            height: "sm",
            action: { type: "postback", label: "✅ ยืนยันจอง", data: "action=confirm_booking" },
          },
          {
            type: "button",
            style: "secondary",
            height: "sm",
            action: { type: "postback", label: "❌ ยกเลิก", data: "action=book_room" },
          },
        ],
      },
    },
  };
}

// Booking success message
function bookingSuccess(booking) {
  const startStr = formatDateTimeTH(booking.startAt);
  const endStr = formatDateTimeTH(booking.endAt);
  return {
    type: "flex",
    altText: `จอง ${booking.room.name} สำเร็จ! (${booking.bookingNo})`,
    contents: {
      type: "bubble",
      size: "kilo",
      styles: { header: { backgroundColor: "#b8e8e0" }, body: { backgroundColor: "#ffffff" } },
      header: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        contents: [
          { type: "text", text: "✅ จองห้องสำเร็จ!", color: "#2a9d8f", weight: "bold", size: "lg" },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        paddingAll: "16px",
        contents: [
          infoRow("📋 เลขที่จอง", booking.bookingNo),
          infoRow("🏢 ห้อง", booking.room.name),
          infoRow("⏰ เริ่มต้น", startStr),
          infoRow("⏰ สิ้นสุด", endStr),
          infoRow("📝 หัวข้อ", booking.title),
          ...(booking.notes ? [infoRow("📌 รายละเอียดเพิ่มเติม", booking.notes)] : []),
        ],
      },
    },
  };
}

// User's booking list (carousel)
function bookingList(bookings) {
  if (!bookings.length) {
    return {
      type: "text",
      text: "ไม่มีการจองห้องที่กำลังจะมาถึงครับ 📭\nกด 'จองห้องประชุม' เพื่อจองใหม่",
    };
  }

  const bubbles = bookings.map((b) => {
    const startStr = formatDateTimeTH(b.startAt);
    const endStr = formatDateTimeTH(b.endAt);
    const isConfirmed = b.status === "confirmed";
    return {
      type: "bubble",
      size: "kilo",
      styles: {
        header: { backgroundColor: isConfirmed ? "#d0d8f0" : "#e0e0e0" },
        body: { backgroundColor: "#ffffff" },
      },
      header: {
        type: "box",
        layout: "vertical",
        paddingAll: "12px",
        contents: [
          { type: "text", text: b.room.name, color: isConfirmed ? "#1a1a2e" : "#888888", weight: "bold", size: "md" },
          { type: "text", text: b.bookingNo, color: "#aaaaaa", size: "xs" },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "14px",
        contents: [
          infoRow("⏰ เริ่ม", startStr),
          infoRow("⏰ สิ้นสุด", endStr),
          infoRow("📝 หัวข้อ", b.title),
          {
            type: "text",
            text: isConfirmed ? "✅ ยืนยันแล้ว" : "❌ ยกเลิกแล้ว",
            color: isConfirmed ? "#2a9d8f" : "#e63946",
            size: "sm",
            weight: "bold",
            margin: "sm",
          },
          ...(!isConfirmed && b.cancelledBy ? [{
            type: "text",
            text: `ยกเลิกโดย: ${b.cancelledBy}${b.cancelledByType === "admin" ? " (Admin)" : ""}`,
            color: "#aaaaaa",
            size: "xxs",
            margin: "xs",
            wrap: true,
          }] : []),
          ...(!isConfirmed && b.cancelledAt ? [{
            type: "text",
            text: `เมื่อ: ${new Date(b.cancelledAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" })}`,
            color: "#aaaaaa",
            size: "xxs",
            wrap: true,
          }] : []),
        ],
      },
      footer: isConfirmed
        ? {
            type: "box",
            layout: "vertical",
            paddingAll: "10px",
            contents: [
              {
                type: "button",
                style: "secondary",
                height: "sm",
                action: {
                  type: "postback",
                  label: "🗑️ ยกเลิกการจอง",
                  data: `action=cancel_book&bookingId=${b.id}`,
                },
              },
            ],
          }
        : undefined,
    };
  });

  return {
    type: "flex",
    altText: `รายการจองของคุณ (${bookings.length} รายการ)`,
    contents: { type: "carousel", contents: bubbles },
  };
}

// Helper: key-value row
function infoRow(label, value) {
  return {
    type: "box",
    layout: "horizontal",
    spacing: "sm",
    contents: [
      { type: "text", text: label, size: "sm", color: "#888888", flex: 3, wrap: true },
      { type: "text", text: value || "-", size: "sm", color: "#333333", flex: 5, wrap: true, weight: "bold" },
    ],
  };
}

module.exports = {
  roomQuickReply,
  dateQuickReply,
  endDateQuickReply,
  timeQuickReply,
  bookingPreview,
  bookingSuccess,
  bookingList,
};
