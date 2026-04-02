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
  };
  const mapped = richMenuMap[text.toLowerCase()];
  if (mapped) {
    await sessionService.clearSession(userId);
    const fakeEvent = { ...event, postback: { data: mapped } };
    return onPostback(fakeEvent, userId);
  }

  // ── Ticket Flow ────────────────────────────────────────────

  if (state === "report_describe") {
    // บรรทัดแรก = หัวข้อ, ที่เหลือ = รายละเอียด
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const title = lines[0] || text;
    const description = lines.length > 1 ? lines.slice(1).join("\n") : text;
    const profile = await client.getProfile(userId).catch(() => null);
    const ticket = await ticketService.createTicket({
      lineUserId: userId,
      displayName: profile?.displayName || null,
      title,
      category: tempData.category,
      subcategory: tempData.subcategory,
      description,
    });
    await sessionService.clearSession(userId);
    return client.replyMessage({ replyToken, messages: [ticketConfirm(ticket)] });
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

  // ── Ticket Actions ─────────────────────────────────────────

  if (action === "report") {
    await sessionService.setState(userId, "report_category", {});
    const categories = await categoryService.getActiveCategories();
    return client.replyMessage({ replyToken, messages: [categoryMenu(categories)] });
  }

  if (action === "status") {
    const tickets = await ticketService.getTicketsByUser(userId, 5);
    return client.replyMessage({ replyToken, messages: [ticketStatusList(tickets)] });
  }

  if (action === "faq") {
    const faqs = await categoryService.getActiveFaqs();
    return client.replyMessage({ replyToken, messages: [buildFaqListMessage(faqs)] });
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
    await sessionService.setState(userId, "report_describe", data);
    return client.replyMessage({
      replyToken,
      messages: [{
        type: "text",
        text: `📝 อธิบายปัญหาได้เลยครับ\n\nพิมพ์บรรทัดแรก = หัวข้อ\nบรรทัดถัดไป = รายละเอียดเพิ่มเติม\n\nหรือจะแนบรูปภาพมาก็ได้ครับ 📷`,
      }],
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
    await ticketService.updateTicket(ticketId, { rating });
    await sessionService.clearSession(userId);
    const stars = "⭐".repeat(rating);
    return client.replyMessage({
      replyToken,
      messages: [{ type: "text", text: `ขอบคุณสำหรับการให้คะแนน ${stars}\nทีม IT จะนำไปปรับปรุงการบริการต่อไปครับ 🙏` }],
    });
  }

  // ── Booking Actions ────────────────────────────────────────

  if (action === "book_room") {
    await sessionService.clearSession(userId);
    const rooms = await bookingService.getRooms();
    return client.replyMessage({ replyToken, messages: [roomQuickReply(rooms)] });
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

  if (action === "my_bookings") {
    const bookings = await bookingService.getBookingsByUser(userId, 5);
    return client.replyMessage({ replyToken, messages: [bookingList(bookings)] });
  }

  if (action === "contact_it") {
    return client.replyMessage({
      replyToken,
      messages: [
        {
          type: "text",
          text: "📞 ติดต่อทีม IT Support\n\n☎️ โทรภายใน: 1234\n📧 Email: it@company.com\n🕐 เวลาทำการ: จ-ศ 08:00-18:00",
        },
      ],
    });
  }
}

async function onImage(event, userId) {
  const replyToken = event.replyToken;
  const session = await sessionService.getSession(userId);

  if (session.state === "report_describe") {
    const imageUrl = `/api/line-image/${event.message.id}`;
    const data = session.tempData || {};
    const profile = await client.getProfile(userId).catch(() => null);
    const ticket = await ticketService.createTicket({
      lineUserId: userId,
      displayName: profile?.displayName || null,
      title: `${data.subcategory || "ปัญหา"} - แนบรูปภาพ`,
      category: data.category,
      subcategory: data.subcategory,
      description: "(แนบรูปภาพ)",
      imageUrl,
    });
    await sessionService.clearSession(userId);
    return client.replyMessage({ replyToken, messages: [ticketConfirm(ticket)] });
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
        backgroundColor: "#1a1a2e",
        paddingAll: "16px",
        contents: [
          { type: "text", text: "💡 FAQ", weight: "bold", size: "lg", color: "#ffffff" },
          { type: "text", text: "กดเลือกคำถามที่ต้องการ", size: "sm", color: "#aaaacc", margin: "xs" },
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
          backgroundColor: i % 2 === 0 ? "#f5f6ff" : "#ffffff",
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
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "12px",
        contents: [{
          type: "button",
          action: { type: "postback", label: "📝 แจ้งปัญหา IT", data: "action=report" },
          style: "primary",
          color: "#e63946",
          height: "sm",
        }],
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
        backgroundColor: "#1a1a2e",
        paddingAll: "16px",
        contents: [
          { type: "text", text: "💡 วิธีแก้ไข", weight: "bold", size: "md", color: "#ffffff" },
          { type: "text", text: faq.question, size: "sm", color: "#aaaacc", margin: "xs", wrap: true },
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
        layout: "horizontal",
        spacing: "sm",
        paddingAll: "12px",
        contents: [
          {
            type: "button",
            action: { type: "postback", label: "🔙 กลับ FAQ", data: "action=faq" },
            style: "secondary",
            height: "sm",
            flex: 1,
          },
          {
            type: "button",
            action: { type: "postback", label: "📝 แจ้งปัญหา", data: "action=report" },
            style: "primary",
            color: "#e63946",
            height: "sm",
            flex: 1,
          },
        ],
      },
    },
  };
}

module.exports = { handleEvents };
