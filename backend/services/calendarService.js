const path = require("path");
const fs = require("fs");

const CREDENTIALS_PATH = path.join(__dirname, "../config/google-credentials.json");

function getCalendar() {
  if (!fs.existsSync(CREDENTIALS_PATH)) return null;
  try {
    const { google } = require("googleapis");
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf-8"));
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
