const path = require("path");
const fs = require("fs");

const CREDENTIALS_PATH = path.join(__dirname, "../config/google-credentials.json");

function loadCredentials() {
  const raw = process.env.GOOGLE_CREDENTIALS;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      console.log(`[Calendar] credentials loaded (JSON), client_email=${parsed.client_email}`);
      return parsed;
    } catch {
      try {
        const parsed = JSON.parse(Buffer.from(raw, "base64").toString());
        console.log(`[Calendar] credentials loaded (base64), client_email=${parsed.client_email}`);
        return parsed;
      } catch (e) {
        console.error("[Calendar] GOOGLE_CREDENTIALS parse failed:", e.message);
      }
    }
  } else {
    console.warn("[Calendar] GOOGLE_CREDENTIALS not set in environment");
  }
  if (fs.existsSync(CREDENTIALS_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf-8"));
      console.log(`[Calendar] credentials loaded (file), client_email=${parsed.client_email}`);
      return parsed;
    } catch {}
  }
  console.error("[Calendar] No credentials available — calendar sync disabled");
  return null;
}

// Cache calendar client — credentials don't change at runtime
let _calendar = null;
function getCalendar() {
  if (_calendar) return _calendar;
  const credentials = loadCredentials();
  if (!credentials) return null;
  try {
    const { google } = require("googleapis");
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });
    _calendar = google.calendar({ version: "v3", auth });
    return _calendar;
  } catch (err) {
    console.error("calendarService init error:", err.message);
    return null;
  }
}

async function createOwnCalendar(name) {
  const calendar = getCalendar();
  if (!calendar) throw new Error("ไม่พบ Google credentials");
  const res = await calendar.calendars.insert({
    requestBody: { summary: name, timeZone: "Asia/Bangkok" },
  });
  return res.data.id; // calendarId ที่ service account เป็นเจ้าของ
}

async function shareCalendar(calendarId, email) {
  const calendar = getCalendar();
  if (!calendar) return;
  await calendar.acl.insert({
    calendarId,
    requestBody: { role: "reader", scope: { type: "user", value: email } },
  });
}

async function createEvent(calendarId, { summary, description, startAt, endAt }) {
  const calendar = getCalendar();
  if (!calendar) return null;
  try {
    const res = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary,
        description,
        start: { dateTime: new Date(startAt).toISOString(), timeZone: "Asia/Bangkok" },
        end: { dateTime: new Date(endAt).toISOString(), timeZone: "Asia/Bangkok" },
      },
    });
    return res.data.id;
  } catch (err) {
    console.error("Calendar createEvent error:", err.message);
    return null;
  }
}

async function deleteEvent(calendarId, eventId) {
  const calendar = getCalendar();
  if (!calendar) return;
  try {
    await calendar.events.delete({ calendarId, eventId });
  } catch (err) {
    console.error("Calendar deleteEvent error:", err.message);
  }
}

module.exports = { createOwnCalendar, shareCalendar, createEvent, deleteEvent };
