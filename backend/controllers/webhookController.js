const line = require("@line/bot-sdk");
const sessionService = require("../services/sessionService");
const ticketService = require("../services/ticketService");
const categoryService = require("../services/categoryService");
const bookingService = require("../services/bookingService");
const mainMenu = require("../views/flex/mainMenu");
const { categoryMenu } = require("../views/flex/categoryMenu");
const { subcategoryMenu } = require("../views/flex/subcategoryMenu");
const ticketConfirm = require("../views/flex/ticketConfirm");
const ticketStatusList = require("../views/flex/ticketStatus");
const ratingMenu = require("../views/flex/ratingMenu");
const {
  roomQuickReply,
  dateQuickReply,
  endDateQuickReply,
  timeQuickReply,
  bookingPreview,
  bookingSuccess,
  bookingList,
} = require("../views/flex/bookingViews");

// Deduplication — กัน event ซ้ำจากการกดหลายครั้ง
const processedTokens = new Set();
function isDuplicate(replyToken) {
  if (!replyToken || processedTokens.has(replyToken)) return true;
  processedTokens.add(replyToken);
  setTimeout(() => processedTokens.delete(replyToken), 60000);
  return false;
}

// Per-user lock — กัน user กดซ้ำขณะกำลังประมวลผล
const userLocks = new Set();
function acquireLock(userId) {
  if (userLocks.has(userId)) return false;
  userLocks.add(userId);
  setTimeout(() => userLocks.delete(userId), 10000);
  return true;
}
function releaseLock(userId) {
  userLocks.delete(userId);
}

// Per-user action dedup — กัน user กดปุ่มซ้ำ
const actionDedup = new Map();
function isActionDuplicate(userId, actionKey, windowMs) {
  const key = `${userId}:${actionKey}`;
  if (actionDedup.has(key)) return true;
  actionDedup.set(key, true);
  setTimeout(() => actionDedup.delete(key), windowMs);
  return false;
}

// window สำหรับแต่ละ action (ms)
const ACTION_WINDOWS = {
  faq_resolved:    60 * 60 * 1000,  // 1 ชม. — กดยืนยันแก้ได้ครั้งเดียว
  submit_rating:   24 * 60 * 60 * 1000, // 24 ชม. — ให้คะแนนครั้งเดียว
  confirm_booking: 30 * 1000,        // 30 วิ — กัน double submit
  submit_no_image: 30 * 1000,
  default:          5 * 1000,        // 5 วิ — ปุ่มทั่วไป
};


const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

async function handleEvents(events) {
  for (const event of events) {
    await handleEvent(event);
  }
}

async function handleEvent(event) {
  const userId = event.source.userId;
  const replyToken = event.replyToken;

  // ── Group message: help admin get Group ID ─────────────────
  if (event.source.type === "group" && event.type === "message" && event.message.type === "text") {
    const txt = event.message.text.trim().toLowerCase();
    if (txt === "group id" || txt === "/groupid") {
      return client.replyMessage({
        replyToken,
        messages: [{ type: "text", text: `🆔 Group ID ของกลุ่มนี้คือ:\n${event.source.groupId}\n\nคัดลอกไปใส่ใน Settings → Notify Group ID ได้เลยครับ` }],
      });
    }
    // ไม่ตอบสนองต่อข้อความกลุ่มทั่วไป
    return;
  }
  if (event.source.type === "group") return;

  if (isDuplicate(replyToken)) return;
  if (!acquireLock(userId)) return;
  try {
    if (event.type === "follow") return await onFollow(replyToken, userId);
    if (event.type === "postback") return await onPostback(event, userId);
    if (event.type === "message" && event.message.type === "text") return await onText(event, userId);
    if (event.type === "message" && event.message.type === "image") return await onImage(event, userId);
  } catch (err) {
    console.error("handleEvent error:", err);
  } finally {
    releaseLock(userId);
  }
}

async function onFollow(replyToken, userId) {
  const profile = await client.getProfile(userId).catch(() => null);
  const name = profile?.displayName || "คุณ";
  return client.replyMessage({
    replyToken,
    messages: [
      { type: "text", text: `ยินดีต้อนรับ ${name} สู่ระบบ IT Helpdesk 🎉\nแตะปุ่มด้านล่างเพื่อเริ่มต้นใช้งาน` },
      mainMenu(name),
    ],
  });
}

async function onText(event, userId) {
  const text = event.message.text.trim();
  const session = await sessionService.getSession(userId);
  const { state, tempData } = session;
  const replyToken = event.replyToken;

  if (["เมนู", "menu", "หน้าแรก"].includes(text.toLowerCase())) {
    await sessionService.clearSession(userId);
    const profile = await client.getProfile(userId).catch(() => null);
    return client.replyMessage({ replyToken, messages: [mainMenu(profile?.displayName)] });
  }

  // ── Rich Menu Text Triggers ────────────────────────────────
  const richMenuMap = {
    "faq": "action=faq",
    "แจ้งปัญหา": "action=report",
    "ดูสถานะ": "action=status",
    "จองห้อง": "action=book_room",
    "รายการจอง": "action=my_bookings",
    "ติดต่อ it": "action=contact_it",
    "ปฏิทิน": "action=room_calendar",
  };
  const mapped = richMenuMap[text.toLowerCase()];
  if (mapped) {
    await sessionService.clearSession(userId);
    const fakeEvent = { ...event, postback: { data: mapped } };
    return onPostback(fakeEvent, userId);
  }

  // ── Ticket Flow ────────────────────────────────────────────

  if (state === "report_asset") {
    const isSkip = ["ข้าม", "skip", "-"].includes(text.trim().toLowerCase());
    const data = isSkip ? { ...tempData } : { ...tempData, assetTag: text.trim().toUpperCase() };
    await sessionService.setState(userId, "report_describe", data);
    return client.replyMessage({
      replyToken,
      messages: [{ type: "text", text: `📝 อธิบายปัญหาได้เลยครับ\n\nพิมพ์บรรทัดแรก = หัวข้อ\nบรรทัดถัดไป = รายละเอียดเพิ่มเติม\n\nหรือจะแนบรูปภาพมาก็ได้ครับ 📷` }],
    });
  }

  if (state === "report_describe") {
    // บรรทัดแรก = หัวข้อ, ที่เหลือ = รายละเอียด
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const title = lines[0] || text;
    const description = lines.length > 1 ? lines.slice(1).join("\n") : text;
    const data = { ...tempData, title, description };
    await sessionService.setState(userId, "report_image_optional", data);
    return client.replyMessage({
      replyToken,
      messages: [{
        type: "text",
        text: `📷 ต้องการแนบรูปภาพประกอบด้วยไหมครับ?\n\nส่งรูปมาได้เลย หรือกด "ส่งได้เลย" ถ้าไม่มีรูป`,
        quickReply: {
          items: [{
            type: "action",
            action: { type: "postback", label: "✅ ส่งได้เลย", data: "action=submit_no_image" },
          }],
        },
      }],
    });
  }

  if (state === "report_image_optional") {
    // user พิมพ์ข้อความในขั้นตอนนี้ → ข้ามไปสร้าง ticket เลย
    const profile = await client.getProfile(userId).catch(() => null);
    const ticket = await ticketService.createTicket({
      lineUserId: userId,
      displayName: profile?.displayName || null,
      title: tempData.title,
      category: tempData.category,
      subcategory: tempData.subcategory,
      assetTag: tempData.assetTag || null,
      description: tempData.description,
    });
    await sessionService.clearSession(userId);
    return client.replyMessage({ replyToken, messages: [
  { type: "text", text: "✅ แจ้งรับบริการเรียบร้อยครับ" },
  ticketConfirm(ticket),
] });
  }

  if (state === "rating_pending") {
    return client.replyMessage({
      replyToken,
      messages: [{ type: "text", text: "กรุณากดปุ่มดาวเพื่อให้คะแนนครับ ⭐" }],
    });
  }

  // ── Booking Flow ───────────────────────────────────────────

  if (state === "book_enter_title") {
    const data = { ...tempData, title: text };
    await sessionService.setState(userId, "book_confirm_pending", data);
    return client.replyMessage({ replyToken, messages: [bookingPreview(data)] });
  }

  if (state && state.startsWith("book_")) {
    return client.replyMessage({
      replyToken,
      messages: [{ type: "text", text: "กรุณาเลือกตัวเลือกจากปุ่มด้านบนครับ 🙏" }],
    });
  }

  return client.replyMessage({
    replyToken,
    messages: [{ type: "text", text: "กรุณาใช้เมนูด้านล่างเพื่อเริ่มต้นครับ 😊" }],
  });
}

async function onPostback(event, userId) {
  const replyToken = event.replyToken;
  const params = new URLSearchParams(event.postback.data);
  const action = params.get("action");

  // ── Action dedup ───────────────────────────────────────────
  // สร้าง key จาก action + params สำคัญ (เช่น id, ticketId)
  const dedupKey = `${action}:${params.get("id") || params.get("ticketId") || params.get("rating") || ""}`;
  const windowMs = ACTION_WINDOWS[action] ?? ACTION_WINDOWS.default;
  if (isActionDuplicate(userId, dedupKey, windowMs)) return;

  // ── Ticket Actions ─────────────────────────────────────────

  if (action === "report") {
    const liffUrl = `https://liff.line.me/${process.env.LIFF_ID}`;
    return client.replyMessage({
      replyToken,
      messages: [{
        type: "flex",
        altText: "🛠️ แจ้งปัญหา IT",
        contents: {
          type: "bubble",
          header: {
            type: "box", layout: "vertical", backgroundColor: "#1a3a5c", paddingAll: "16px",
            contents: [
              { type: "text", text: "🛠️ แจ้งปัญหา IT", weight: "bold", size: "lg", color: "#ffffff" },
              { type: "text", text: "กรอกแบบฟอร์มเพื่อแจ้งปัญหา", size: "sm", color: "#a8c8e8", margin: "xs" },
            ],
          },
          body: {
            type: "box", layout: "vertical", paddingAll: "16px",
            contents: [
              { type: "text", text: "📋 ระบุหมวดหมู่ปัญหา", size: "sm", color: "#555555" },
              { type: "text", text: "🏷️ หมายเลขครุภัณฑ์ (Asset Tag)", size: "sm", color: "#555555", margin: "sm" },
              { type: "text", text: "📝 อาการเสีย / รายละเอียด", size: "sm", color: "#555555", margin: "sm" },
              { type: "text", text: "📷 แนบรูปภาพ (ถ้ามี)", size: "sm", color: "#555555", margin: "sm" },
            ],
          },
          footer: {
            type: "box", layout: "vertical", paddingAll: "12px",
            contents: [{
              type: "button",
              action: { type: "uri", label: "📝 กรอกแบบฟอร์มแจ้งปัญหา", uri: liffUrl },
              style: "primary", color: "#e63946",
            }],
          },
        },
      }],
    });
  }

  if (action === "status") {
    const tickets = await ticketService.getTicketsByUser(userId, 5);
    return client.replyMessage({ replyToken, messages: [ticketStatusList(tickets)] });
  }

  if (action === "faq") {
    const faqs = await categoryService.getActiveFaqs();
    return client.replyMessage({ replyToken, messages: [buildFaqListMessage(faqs)] });
  }

  if (action === "submit_no_image") {
    const session = await sessionService.getSession(userId);
    const d = session.tempData || {};
    const profile = await client.getProfile(userId).catch(() => null);
    const ticket = await ticketService.createTicket({
      lineUserId: userId,
      displayName: profile?.displayName || null,
      title: d.title,
      category: d.category,
      subcategory: d.subcategory,
      assetTag: d.assetTag || null,
      description: d.description,
    });
    await sessionService.clearSession(userId);
    return client.replyMessage({ replyToken, messages: [
  { type: "text", text: "✅ แจ้งรับบริการเรียบร้อยครับ" },
  ticketConfirm(ticket),
] });
  }

  if (action === "faq_resolved") {
    const faqId = Number(params.get("id"));
    if (faqId) categoryService.incrementFaqResolved(faqId).catch(() => {});
    return client.replyMessage({
      replyToken,
      messages: [{ type: "text", text: "ยินดีด้วยครับ! 🎉\nหากมีปัญหาอื่นสามารถแจ้งได้ตลอดเวลานะครับ 😊" }],
    });
  }

  if (action === "faq_item") {
    const faqId = Number(params.get("id"));
    const faq = await categoryService.getFaqById(faqId);
    if (!faq) return client.replyMessage({ replyToken, messages: [{ type: "text", text: "ไม่พบข้อมูล FAQ" }] });
    categoryService.incrementFaqViews([faqId]).catch(() => {});
    return client.replyMessage({ replyToken, messages: [buildFaqAnswerMessage(faq)] });
  }

  if (action === "select_category") {
    const categoryName = decodeURIComponent(params.get("category"));
    const categories = await categoryService.getActiveCategories();
    const cat = categories.find((c) => c.name === categoryName);
    await sessionService.setState(userId, "report_subcategory", { category: categoryName });
    return client.replyMessage({
      replyToken,
      messages: [subcategoryMenu(categoryName, cat ? cat.subcategories : [])],
    });
  }

  if (action === "select_subcategory") {
    const subcategory = decodeURIComponent(params.get("subcategory"));
    const session = await sessionService.getSession(userId);
    const data = { ...(session.tempData || {}), subcategory };
    await sessionService.setState(userId, "report_asset", data);
    return client.replyMessage({
      replyToken,
      messages: [{
        type: "text",
        text: `🏷️ กรุณาระบุหมายเลขครุภัณฑ์ (Asset Tag)\n\nหมายเลขอยู่บนสติกเกอร์ ใต้เครื่องหรือหลังเครื่อง\nเช่น TSDMB001, TSDIMAC001\n\n(ไม่ทราบ กดปุ่ม "ข้าม" ได้เลย)`,
        quickReply: {
          items: [{
            type: "action",
            action: { type: "message", label: "⏭️ ข้าม", text: "ข้าม" },
          }],
        },
      }],
    });
  }

  if (action === "skip_asset") {
    const session = await sessionService.getSession(userId);
    await sessionService.setState(userId, "report_describe", session.tempData || {});
    return client.replyMessage({
      replyToken,
      messages: [{ type: "text", text: `📝 อธิบายปัญหาได้เลยครับ\n\nพิมพ์บรรทัดแรก = หัวข้อ\nบรรทัดถัดไป = รายละเอียดเพิ่มเติม\n\nหรือจะแนบรูปภาพมาก็ได้ครับ 📷` }],
    });
  }

  if (action === "rate") {
    const ticketId = params.get("ticketId");
    await sessionService.setState(userId, "rating_pending", { ticketId });
    return client.replyMessage({ replyToken, messages: [ratingMenu(ticketId)] });
  }

  if (action === "submit_rating") {
    const ticketId = Number(params.get("ticketId"));
    const rating = Number(params.get("rating"));
    const existing = await ticketService.getTicketById(ticketId);
    if (!existing?.rating) {
      await ticketService.updateTicket(ticketId, { rating });
      await sessionService.clearSession(userId);
    }
    return; // ไม่ reply — กดแล้วเงียบ ไม่มี bubble ขึ้น
  }

  // ── Booking Actions ────────────────────────────────────────

  if (action === "book_room") {
    await sessionService.clearSession(userId);
    const liffUrl = `https://liff.line.me/${process.env.LIFF_ID}/booking`;
    return client.replyMessage({
      replyToken,
      messages: [{
        type: "flex",
        altText: "🗓️ จองห้องประชุม",
        contents: {
          type: "bubble",
          header: {
            type: "box", layout: "vertical", backgroundColor: "#1a3a5c", paddingAll: "16px",
            contents: [
              { type: "text", text: "🗓️ จองห้องประชุม", weight: "bold", size: "lg", color: "#ffffff" },
              { type: "text", text: "กรอกแบบฟอร์มเพื่อจองห้อง", size: "sm", color: "#a8c8e8", margin: "xs" },
            ],
          },
          body: {
            type: "box", layout: "vertical", paddingAll: "16px",
            contents: [
              { type: "text", text: "🏢 เลือกห้องประชุม", size: "sm", color: "#555555" },
              { type: "text", text: "📅 เลือกวันและเวลา", size: "sm", color: "#555555", margin: "sm" },
              { type: "text", text: "📝 ระบุหัวข้อการประชุม", size: "sm", color: "#555555", margin: "sm" },
            ],
          },
          footer: {
            type: "box", layout: "horizontal", paddingAll: "12px", spacing: "sm",
            contents: [
              {
                type: "button", flex: 1,
                action: { type: "uri", label: "📅 จองห้อง", uri: liffUrl },
                style: "primary", color: "#1a1a2e",
              },
              {
                type: "button", flex: 1,
                action: { type: "uri", label: "🗓️ ดูปฏิทิน", uri: `https://liff.line.me/${process.env.LIFF_ID}/calendar` },
                style: "secondary",
              },
            ],
          },
        },
      }],
    });
  }

  if (action === "select_room") {
    const roomId = Number(params.get("roomId"));
    const rooms = await bookingService.getRooms();
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return client.replyMessage({ replyToken, messages: [{ type: "text", text: "ไม่พบห้องที่เลือกครับ" }] });
    await sessionService.setState(userId, "book_select_startdate", { roomId, roomName: room.name });
    return client.replyMessage({ replyToken, messages: [dateQuickReply("start")] });
  }

  if (action === "book_date") {
    const phase = params.get("phase");
    const date = params.get("date");
    const session = await sessionService.getSession(userId);
    const data = { ...(session.tempData || {}) };

    if (phase === "start") {
      data.startDate = date;
      await sessionService.setState(userId, "book_select_starttime", data);
      return client.replyMessage({ replyToken, messages: [timeQuickReply("start")] });
    }

    if (phase === "end") {
      data.endDate = date;
      await sessionService.setState(userId, "book_select_endtime", data);
      return client.replyMessage({ replyToken, messages: [timeQuickReply("end", data.startTime)] });
    }
  }

  if (action === "book_time") {
    const phase = params.get("phase");
    const time = params.get("time");
    const session = await sessionService.getSession(userId);
    const data = { ...(session.tempData || {}) };

    if (phase === "start") {
      data.startTime = time;
      await sessionService.setState(userId, "book_select_enddate", data);
      return client.replyMessage({ replyToken, messages: [endDateQuickReply(data.startDate)] });
    }

    if (phase === "end") {
      data.endTime = time;
      await sessionService.setState(userId, "book_enter_title", data);
      return client.replyMessage({
        replyToken,
        messages: [{ type: "text", text: "ระบุหัวข้อ / วัตถุประสงค์การประชุมครับ 📝" }],
      });
    }
  }

  if (action === "confirm_booking") {
    const session = await sessionService.getSession(userId);
    const data = session.tempData || {};
    if (!data.roomId || !data.startDate || !data.startTime || !data.endDate || !data.endTime || !data.title) {
      await sessionService.clearSession(userId);
      return client.replyMessage({ replyToken, messages: [{ type: "text", text: "ข้อมูลการจองไม่ครบครับ กรุณาเริ่มใหม่" }] });
    }
    const startAt = new Date(`${data.startDate}T${data.startTime}:00+07:00`);
    const endAt = new Date(`${data.endDate}T${data.endTime}:00+07:00`);
    if (endAt <= startAt) {
      return client.replyMessage({ replyToken, messages: [{ type: "text", text: "❌ เวลาสิ้นสุดต้องหลังจากเวลาเริ่มต้นครับ กรุณาเริ่มใหม่" }] });
    }
    const profile = await client.getProfile(userId).catch(() => null);
    try {
      const booking = await bookingService.createBooking({
        roomId: data.roomId,
        lineUserId: userId,
        displayName: profile?.displayName || null,
        title: data.title,
        startAt,
        endAt,
      });
      await sessionService.clearSession(userId);
      return client.replyMessage({ replyToken, messages: [bookingSuccess(booking)] });
    } catch (err) {
      await sessionService.clearSession(userId);
      return client.replyMessage({
        replyToken,
        messages: [
          { type: "text", text: `❌ ${err.message}\nกรุณาเลือกห้องหรือเวลาใหม่ครับ` },
        ],
      });
    }
  }

  if (action === "cancel_book") {
    const bookingId = params.get("bookingId");
    return client.replyMessage({
      replyToken,
      messages: [
        {
          type: "text",
          text: "ยืนยันการยกเลิกการจองนี้?",
          quickReply: {
            items: [
              {
                type: "action",
                action: {
                  type: "postback",
                  label: "✅ ยืนยันยกเลิก",
                  data: `action=confirm_cancel&bookingId=${bookingId}`,
                },
              },
              {
                type: "action",
                action: {
                  type: "postback",
                  label: "❌ ไม่ยกเลิก",
                  data: "action=my_bookings",
                },
              },
            ],
          },
        },
      ],
    });
  }

  if (action === "confirm_cancel") {
    const bookingId = Number(params.get("bookingId"));
    try {
      await bookingService.cancelBooking(bookingId, userId);
      return client.replyMessage({
        replyToken,
        messages: [{ type: "text", text: "✅ ยกเลิกการจองเรียบร้อยแล้วครับ" }],
      });
    } catch (err) {
      return client.replyMessage({
        replyToken,
        messages: [{ type: "text", text: `❌ ${err.message}` }],
      });
    }
  }

  if (action === "room_calendar") {
    const liffUrl = `https://liff.line.me/${process.env.LIFF_ID}/calendar`;
    return client.replyMessage({
      replyToken,
      messages: [{
        type: "flex",
        altText: "📅 ปฏิทินห้องประชุม",
        contents: {
          type: "bubble",
          header: {
            type: "box", layout: "vertical", backgroundColor: "#1a3a5c", paddingAll: "16px",
            contents: [
              { type: "text", text: "📅 ปฏิทินห้องประชุม", weight: "bold", size: "lg", color: "#ffffff" },
              { type: "text", text: "ดูตารางการจองและความพร้อมของห้อง", size: "sm", color: "#a8c8e8", margin: "xs" },
            ],
          },
          footer: {
            type: "box", layout: "vertical", paddingAll: "12px",
            contents: [{
              type: "button",
              action: { type: "uri", label: "📅 เปิดปฏิทินกลาง", uri: liffUrl },
              style: "primary", color: "#457b9d",
            }],
          },
        },
      }],
    });
  }

  if (action === "my_bookings") {
    const bookings = await bookingService.getBookingsByUser(userId, 5);
    return client.replyMessage({ replyToken, messages: [bookingList(bookings)] });
  }

  if (action === "contact_it") {
    const { PrismaClient } = require("@prisma/client");
    const _prisma = new PrismaClient();
    const rows = await _prisma.systemConfig.findMany();
    const cfg = Object.fromEntries(rows.map(r => [r.key, r.value]));

    const name   = cfg.contact_name  || "ทีม IT Support";
    const phone  = cfg.contact_phone || "-";
    const email  = cfg.contact_email || "-";
    const hours  = cfg.contact_hours || "-";
    const lineId = cfg.contact_line  || "";

    let text = `📞 ${name}\n\n☎️ โทร: ${phone}\n📧 Email: ${email}\n🕐 เวลาทำการ: ${hours}`;
    if (lineId) text += `\n💬 LINE ID: ${lineId}`;

    return client.replyMessage({
      replyToken,
      messages: [{ type: "text", text }],
    });
  }
}

async function onImage(event, userId) {
  const replyToken = event.replyToken;
  const session = await sessionService.getSession(userId);

  const imageStates = ["report_describe", "report_image_optional"];
  if (imageStates.includes(session.state)) {
    const imageUrl = `/api/line-image/${event.message.id}`;
    const data = session.tempData || {};
    const profile = await client.getProfile(userId).catch(() => null);
    const hasText = data.title && data.description;
    const ticket = await ticketService.createTicket({
      lineUserId: userId,
      displayName: profile?.displayName || null,
      title: hasText ? data.title : `${data.subcategory || "ปัญหา"} - แนบรูปภาพ`,
      category: data.category,
      subcategory: data.subcategory,
      assetTag: data.assetTag || null,
      description: hasText ? data.description : "(แนบรูปภาพ)",
      imageUrl,
    });
    await sessionService.clearSession(userId);
    return client.replyMessage({ replyToken, messages: [
  { type: "text", text: "✅ แจ้งรับบริการเรียบร้อยครับ" },
  ticketConfirm(ticket),
] });
  }

  return client.replyMessage({
    replyToken,
    messages: [{ type: "text", text: "ได้รับรูปภาพแล้วครับ 📷\nกรุณาใช้เมนูด้านล่างเพื่อดำเนินการต่อ" }],
  });
}

function buildFaqListMessage(faqs) {
  if (!faqs.length) {
    return { type: "text", text: "ยังไม่มี FAQ ในระบบครับ\nพิมพ์ 'เมนู' เพื่อแจ้งปัญหา" };
  }
  const displayFaqs = faqs.slice(0, 12);
  return {
    type: "flex",
    altText: "💡 FAQ วิธีแก้ปัญหาเบื้องต้น",
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#1a3a5c",
        paddingAll: "16px",
        contents: [
          { type: "text", text: "💡 FAQ", weight: "bold", size: "lg", color: "#ffffff" },
          { type: "text", text: "กดเลือกคำถามที่ต้องการ", size: "sm", color: "#a8c8e8", margin: "xs" },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "12px",
        contents: displayFaqs.map((faq, i) => ({
          type: "box",
          layout: "horizontal",
          paddingAll: "10px",
          backgroundColor: i % 2 === 0 ? "#eef0f8" : "#f4f4f6",
          cornerRadius: "8px",
          action: {
            type: "postback",
            label: faq.question.substring(0, 40),
            data: `action=faq_item&id=${faq.id}`,
          },
          contents: [
            { type: "text", text: `❓ ${faq.question}`, size: "sm", wrap: true, flex: 1, color: "#1a1a2e" },
            { type: "text", text: "›", size: "xl", color: "#aaaaaa", align: "end", gravity: "center", flex: 0 },
          ],
        })),
      },
    },
  };
}

function buildFaqAnswerMessage(faq) {
  return {
    type: "flex",
    altText: `💡 ${faq.question}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#1a3a5c",
        paddingAll: "16px",
        contents: [
          { type: "text", text: "💡 วิธีแก้ไข", weight: "bold", size: "md", color: "#ffffff" },
          { type: "text", text: faq.question, size: "sm", color: "#a8c8e8", margin: "xs", wrap: true },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        contents: [{
          type: "text",
          text: faq.answer,
          wrap: true,
          size: "sm",
          color: "#333333",
          lineSpacing: "6px",
        }],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "12px",
        contents: [
          {
            type: "button",
            action: { type: "postback", label: "✅ แก้ปัญหาได้แล้ว", data: `action=faq_resolved&id=${faq.id}` },
            style: "primary",
            color: "#2a9d8f",
            height: "sm",
          },
          {
            type: "button",
            action: { type: "postback", label: "📝 ยังไม่ได้ แจ้งปัญหา", data: "action=report" },
            style: "secondary",
            height: "sm",
          },
        ],
      },
    },
  };
}

module.exports = { handleEvents };
