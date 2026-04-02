import { useState, useEffect } from "react";
import liff from "@line/liff";

const LIFF_ID = import.meta.env.VITE_LIFF_ID;

const DAY_LABELS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const MONTH_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const ROOM_COLORS = ["#2a9d8f", "#457b9d", "#e9c46a", "#e76f51", "#a8dadc", "#f4a261", "#6d6875"];

export default function LiffCalendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [ready, setReady] = useState(false);
  const [masterCalUrl, setMasterCalUrl] = useState("");

  useEffect(() => {
    liff.init({ liffId: LIFF_ID })
      .then(async () => {
        if (!liff.isLoggedIn()) { liff.login(); return; }
        const res = await fetch("/api/liff/rooms");
        setRooms(await res.json());
        setReady(true);
      })
      .catch(() => setReady(true)); // allow view even if LINE auth fails
  }, []);

  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    setSelectedDay(null);
    fetch(`/api/liff/bookings-calendar?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(data => {
        setBookings(data.bookings || []);
        setMasterCalUrl(data.masterCalUrl || "");
      })
      .finally(() => setLoading(false));
  }, [year, month, ready]);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = Array(firstDay).fill(null).concat(
    Array.from({ length: daysInMonth }, (_, i) => i + 1)
  );
  while (cells.length % 7 !== 0) cells.push(null);

  // Group bookings by day
  const byDay = {};
  bookings.forEach(b => {
    const d = new Date(b.startAt);
    const day = d.getDate();
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(b);
  });

  const roomColorMap = {};
  rooms.forEach((r, i) => { roomColorMap[r.id] = ROOM_COLORS[i % ROOM_COLORS.length]; });

  const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}`;
  const isCurrentMonth = todayStr === `${year}-${month}`;
  const todayDate = isCurrentMonth ? now.getDate() : null;

  const selectedBookings = selectedDay ? (byDay[selectedDay] || []) : [];

  function fmt(dateStr) {
    const d = new Date(dateStr);
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  }

  if (!ready) return (
    <div style={s.center}><div style={s.spinner} /></div>
  );

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={{ fontWeight: 700, fontSize: 17, color: "#fff" }}>📅 ปฏิทินห้องประชุม</div>
        {masterCalUrl && (
          <a href={masterCalUrl} style={s.calLink} target="_blank" rel="noreferrer">
            📆 ดูใน Google Calendar
          </a>
        )}
      </div>

      {/* Month Nav */}
      <div style={s.monthNav}>
        <button onClick={prevMonth} style={s.navBtn}>‹</button>
        <span style={{ fontWeight: 700, fontSize: 16 }}>
          {MONTH_TH[month - 1]} {year + 543}
        </span>
        <button onClick={nextMonth} style={s.navBtn}>›</button>
      </div>

      {/* Room Legend */}
      {rooms.length > 0 && (
        <div style={s.legend}>
          {rooms.map((r, i) => (
            <div key={r.id} style={s.legendItem}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: ROOM_COLORS[i % ROOM_COLORS.length], flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "#555" }}>{r.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Calendar Grid */}
      <div style={s.grid}>
        {DAY_LABELS.map(d => (
          <div key={d} style={s.dayLabel}>{d}</div>
        ))}
        {loading ? (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 24, color: "#aaa" }}>กำลังโหลด...</div>
        ) : cells.map((day, idx) => {
          const dayBookings = day ? (byDay[day] || []) : [];
          const isToday = day === todayDate;
          const isSelected = day === selectedDay;
          return (
            <div key={idx}
              onClick={() => day && setSelectedDay(isSelected ? null : day)}
              style={{
                ...s.cell,
                background: isSelected ? "#1a1a2e" : isToday ? "#e8f4f8" : "#fff",
                cursor: day ? "pointer" : "default",
                opacity: day ? 1 : 0,
              }}>
              {day && (
                <>
                  <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 400, color: isSelected ? "#fff" : isToday ? "#457b9d" : "#333" }}>
                    {day}
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 2, marginTop: 2 }}>
                    {dayBookings.slice(0, 3).map((b, i) => (
                      <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: roomColorMap[b.roomId] || "#aaa" }} />
                    ))}
                    {dayBookings.length > 3 && <span style={{ fontSize: 9, color: "#aaa" }}>+{dayBookings.length - 3}</span>}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Day Detail */}
      {selectedDay && (
        <div style={s.detail}>
          <div style={s.detailHeader}>
            📅 {selectedDay} {MONTH_TH[month - 1]} {year + 543}
            {selectedBookings.length === 0 && <span style={{ color: "#aaa", fontWeight: 400, fontSize: 13 }}> — ว่าง</span>}
          </div>
          {selectedBookings.length === 0 ? (
            <p style={{ color: "#aaa", fontSize: 13, margin: "8px 0 0" }}>ไม่มีการจองในวันนี้</p>
          ) : selectedBookings.map(b => (
            <div key={b.id} style={{ ...s.bookingRow, borderLeft: `4px solid ${roomColorMap[b.roomId] || "#aaa"}` }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{b.room?.name || "ห้อง"}</div>
              <div style={{ fontSize: 12, color: "#555" }}>{fmt(b.startAt)} – {fmt(b.endAt)} น.</div>
              <div style={{ fontSize: 12, color: "#777" }}>📝 {b.title}</div>
              {b.displayName && <div style={{ fontSize: 11, color: "#aaa" }}>👤 {b.displayName}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s = {
  page: { fontFamily: "'Noto Sans Thai', sans-serif", minHeight: "100vh", background: "#f5f6ff", paddingBottom: 40 },
  header: { background: "#1a1a2e", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  calLink: { fontSize: 12, color: "#aaddff", textDecoration: "none", background: "rgba(255,255,255,0.1)", padding: "4px 10px", borderRadius: 20 },
  monthNav: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", background: "#fff", borderBottom: "1px solid #eee" },
  navBtn: { background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#1a1a2e", padding: "0 8px", fontWeight: 700 },
  legend: { display: "flex", flexWrap: "wrap", gap: 8, padding: "8px 12px", background: "#fff", borderBottom: "1px solid #eee" },
  legendItem: { display: "flex", alignItems: "center", gap: 4 },
  grid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, padding: "8px", background: "#f5f6ff" },
  dayLabel: { textAlign: "center", fontSize: 11, fontWeight: 600, color: "#888", padding: "4px 0" },
  cell: { minHeight: 52, borderRadius: 8, padding: "6px 4px", display: "flex", flexDirection: "column", alignItems: "center", transition: "background 0.15s" },
  detail: { margin: "0 12px 16px", background: "#fff", borderRadius: 12, padding: "14px 16px", boxShadow: "0 1px 4px #0001" },
  detailHeader: { fontWeight: 700, fontSize: 15, color: "#1a1a2e", marginBottom: 8 },
  bookingRow: { background: "#f9f9ff", borderRadius: 8, padding: "10px 12px", marginBottom: 8, lineHeight: 1.6 },
  center: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" },
  spinner: { width: 40, height: 40, border: "4px solid #e0e0f0", borderTop: "4px solid #1a1a2e", borderRadius: "50%", animation: "spin 1s linear infinite" },
};
