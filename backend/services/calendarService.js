const path = require("path");
const fs = require("fs");

const CREDENTIALS_PATH = path.join(__dirname, "../config/google-credentials.json");

function getCredentials() {
  // 1) Environment variable (สำหรับ Docker/Portainer)
  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      return JSON.parse(process.env.GOOGLE_CREDENTIALS);
    } catch {
      // อาจเป็น base64
      try {
        return JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS, "base64").toString());
      } catch {}
    }
  }
  // 2) File fallback (local dev)
  if (fs.existsSync(CREDENTIALS_PATH)) {
    try { return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf-8")); } catch {}
  }
  return null;
}

function getCalendar() {
  const credentials = getCredentials();
  if (!credentials) return null;
  try {
    const { google } = require("googleapis");
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });
    return google.calendar({ version: "v3", auth });
  } catch (err) {
    console.error("calendarService init error:", err.message);
    return null;
  }
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

module.exports = { createEvent, deleteEvent };
