import { useState, useEffect } from "react";
import liff from "@line/liff";

const LIFF_ID = import.meta.env.VITE_LIFF_ID;

const DAY_LABELS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const MONTH_TH_LONG = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const ROOM_COLORS = ["#1a73e8","#d50000","#33b679","#f4511e","#8e24aa","#0b8043","#e67c73","#039be5"];

export default function LiffCalendar() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [bookings, setBookings]     = useState([]);
  const [rooms, setRooms]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [ready, setReady]           = useState(false);
  const [masterCalUrl, setMasterCalUrl] = useState("");

  useEffect(() => {
    liff.init({ liffId: LIFF_ID })
      .then(async () => {
        if (!liff.isLoggedIn()) { liff.login(); return; }
        const res = await fetch("/api/liff/rooms");
        setRooms(await res.json());
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    fetch(`/api/liff/bookings-calendar?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(data => {
        setBookings(data.bookings || []);
        setMasterCalUrl(data.masterCalUrl || "");
      })
      .finally(() => setLoading(false));
  }, [year, month, ready]);

  function goToday() {
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
    setSelectedDay(now.getDate());
  }
  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1);
    setSelectedDay(null);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1);
    setSelectedDay(null);
  }

  const firstDow    = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = Array(firstDow).fill(null).concat(
    Array.from({ length: daysInMonth }, (_, i) => i + 1)
  );
  while (cells.length % 7 !== 0) cells.push(null);

  const roomColorMap = {};
  rooms.forEach((r, i) => { roomColorMap[r.id] = ROOM_COLORS[i % ROOM_COLORS.length]; });

  // Group confirmed bookings by day
  const byDay = {};
  bookings.filter(b => b.status !== "cancelled").forEach(b => {
    const d = new Date(b.startAt).getDate();
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(b);
  });

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const todayDate = isCurrentMonth ? now.getDate() : null;

  function fmtTime(dt) {
    const d = new Date(dt);
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  }

  const selBookings = selectedDay ? (byDay[selectedDay] || []) : [];

  if (!ready) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh" }}>
      <div style={{ width:36, height:36, border:"4px solid #e8eaed", borderTop:"4px solid #1a73e8",
        borderRadius:"50%", animation:"spin 1s linear infinite" }} />
    </div>
  );

  return (
    <div style={{ fontFamily:"'Noto Sans Thai',sans-serif", minHeight:"100vh", background:"#fff", display:"flex", flexDirection:"column" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── Google Calendar-style Header ── */}
      <div style={{ padding:"10px 12px 6px", borderBottom:"1px solid #e8eaed", display:"flex", alignItems:"center", gap:8 }}>
        <button onClick={goToday}
          style={{ border:"1px solid #dadce0", background:"#fff", borderRadius:4, padding:"6px 12px",
            fontSize:13, fontWeight:500, cursor:"pointer", color:"#3c4043" }}>
          วันนี้
        </button>
        <button onClick={prevMonth}
          style={{ border:"none", background:"none", cursor:"pointer", borderRadius:"50%",
            width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:18, color:"#3c4043" }}>‹</button>
        <button onClick={nextMonth}
          style={{ border:"none", background:"none", cursor:"pointer", borderRadius:"50%",
            width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:18, color:"#3c4043" }}>›</button>
        <span style={{ fontSize:18, fontWeight:400, color:"#3c4043", flex:1 }}>
          {MONTH_TH_LONG[month-1]} {year + 543}
        </span>
        {masterCalUrl && (
          <a href={masterCalUrl} target="_blank" rel="noreferrer"
            style={{ fontSize:11, color:"#1a73e8", textDecoration:"none", padding:"4px 8px",
              border:"1px solid #1a73e8", borderRadius:12, whiteSpace:"nowrap" }}>
            ดูใน Google Calendar
          </a>
        )}
      </div>

      {/* ── Day headers ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", borderBottom:"1px solid #e8eaed" }}>
        {DAY_LABELS.map((d, i) => (
          <div key={d} style={{ textAlign:"center", padding:"6px 0", fontSize:11, fontWeight:500,
            color: i === 0 ? "#d50000" : i === 6 ? "#1a73e8" : "#70757a" }}>{d}</div>
        ))}
      </div>

      {/* ── Calendar Grid ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", flex:1,
        borderLeft:"1px solid #e8eaed" }}>
        {loading ? (
          <div style={{ gridColumn:"1/-1", textAlign:"center", padding:32, color:"#aaa" }}>กำลังโหลด...</div>
        ) : cells.map((day, idx) => {
          const dayBkgs   = day ? (byDay[day] || []) : [];
          const isToday   = day === todayDate;
          const isSel     = day === selectedDay;
          const colIdx    = idx % 7;
          const isSun     = colIdx === 0;
          const isSat     = colIdx === 6;

          return (
            <div key={idx}
              onClick={() => day && setSelectedDay(isSel ? null : day)}
              style={{
                minHeight: 64, borderRight:"1px solid #e8eaed", borderBottom:"1px solid #e8eaed",
                padding:"4px 2px", cursor: day ? "pointer" : "default",
                background: isSel ? "#e8f0fe" : "#fff",
              }}>
              {day && (
                <>
                  {/* Date number */}
                  <div style={{ display:"flex", justifyContent:"center", marginBottom:2 }}>
                    <span style={{
                      width:26, height:26, display:"flex", alignItems:"center", justifyContent:"center",
                      borderRadius:"50%", fontSize:12, fontWeight: isToday ? 500 : 400,
                      background: isToday ? "#1a73e8" : "transparent",
                      color: isToday ? "#fff" : isSun ? "#d50000" : isSat ? "#1a73e8" : "#3c4043",
                    }}>{day}</span>
                  </div>
                  {/* Event chips */}
                  <div style={{ display:"flex", flexDirection:"column", gap:1, padding:"0 1px" }}>
                    {dayBkgs.slice(0, 2).map((b, i) => (
                      <div key={i} style={{
                        background: roomColorMap[b.roomId] || "#1a73e8",
                        color:"#fff", borderRadius:3, fontSize:10, padding:"2px 4px",
                        overflow:"hidden", lineHeight:1.4,
                      }}>
                        <div style={{ fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          {b.room?.name || ""}
                        </div>
                        <div style={{ opacity:0.9, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          {fmtTime(b.startAt)} {b.title}
                        </div>
                      </div>
                    ))}
                    {dayBkgs.length > 2 && (
                      <div style={{ fontSize:10, color:"#70757a", padding:"0 3px" }}>
                        +{dayBkgs.length - 2} รายการ
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Selected Day Detail ── */}
      {selectedDay && (
        <div style={{ borderTop:"1px solid #e8eaed", padding:"12px 16px", background:"#fff" }}>
          <div style={{ fontSize:13, fontWeight:500, color:"#3c4043", marginBottom:8 }}>
            {selectedDay} {MONTH_TH_LONG[month-1]} {year + 543}
            {selBookings.length === 0 && <span style={{ color:"#aaa", fontWeight:400 }}> — ว่าง</span>}
          </div>
          {selBookings.length === 0 ? (
            <p style={{ color:"#aaa", fontSize:13, margin:0 }}>ไม่มีการจองในวันนี้</p>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {selBookings.map(b => (
                <div key={b.id} style={{
                  display:"flex", gap:10, alignItems:"flex-start",
                  padding:"8px 10px", borderRadius:8,
                  borderLeft:`4px solid ${roomColorMap[b.roomId] || "#1a73e8"}`,
                  background:"#f8f9fa",
                }}>
                  <div style={{ width:10, height:10, borderRadius:"50%", marginTop:3, flexShrink:0,
                    background: roomColorMap[b.roomId] || "#1a73e8" }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"#3c4043" }}>{b.room?.name}</div>
                    <div style={{ fontSize:13, color:"#3c4043" }}>{b.title}</div>
                    <div style={{ fontSize:12, color:"#70757a", marginTop:2 }}>
                      🕐 {fmtTime(b.startAt)} – {fmtTime(b.endAt)} น.
                    </div>
                    {b.displayName && <div style={{ fontSize:12, color:"#70757a" }}>👤 {b.displayName}</div>}
                    {b.bookingNo && <div style={{ fontSize:11, color:"#aaa", marginTop:2 }}>📋 หมายเลขการจอง: {b.bookingNo}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Room Legend ── */}
      {rooms.length > 0 && (
        <div style={{ borderTop:"1px solid #e8eaed", padding:"10px 16px", display:"flex", flexWrap:"wrap", gap:10 }}>
          {rooms.map((r, i) => (
            <div key={r.id} style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, color:"#3c4043" }}>
              <div style={{ width:10, height:10, borderRadius:"50%", background:ROOM_COLORS[i % ROOM_COLORS.length] }} />
              {r.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
