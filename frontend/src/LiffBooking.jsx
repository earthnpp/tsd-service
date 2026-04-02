import { useState, useEffect, useRef } from "react";
import liff from "@line/liff";

const LIFF_ID = import.meta.env.VITE_LIFF_ID;
const MONTH_TH = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const DAY_SHORT = ["อา","จ","อ","พ","พฤ","ศ","ส"];
const HOURS = Array.from({ length: 14 }, (_, i) => `${String(i + 8).padStart(2,"0")}:00`); // 08-21

function toISO(date) { return date.toISOString().slice(0,10); }
function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return `${DAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_TH[d.getMonth()].slice(0,3)}.`;
}
function fmtHour(iso) { const d = new Date(iso); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; }

export default function LiffBooking() {
  const today = toISO(new Date());
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [roomId, setRoomId] = useState("");
  const [busySlots, setBusySlots] = useState([]);
  const [showCal, setShowCal] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [bookingNo, setBookingNo] = useState("");
  const [error, setError] = useState("");
  const titleRef = useRef(null);

  useEffect(() => {
    liff.init({ liffId: LIFF_ID }).then(async () => {
      if (!liff.isLoggedIn()) { liff.login(); return; }
      const p = await liff.getProfile();
      setProfile(p);
      setName(p.displayName || "");
      const res = await fetch("/api/liff/rooms");
      const data = await res.json();
      setRooms(data);
      if (data.length) setRoomId(String(data[0].id));
      setReady(true);
    }).catch(err => { setError(err.message); setReady(true); });
  }, []);

  // Fetch busy slots when room+date changes
  useEffect(() => {
    if (!roomId || !date) { setBusySlots([]); return; }
    fetch(`/api/liff/room-slots?roomId=${roomId}&date=${date}`)
      .then(r => r.json()).then(setBusySlots).catch(() => setBusySlots([]));
  }, [roomId, date]);

  function isBusy(hour) {
    const hStart = new Date(`${date}T${hour}:00+07:00`);
    const hEnd   = new Date(`${date}T${hour.slice(0,2)}:59:59+07:00`);
    return busySlots.some(b => new Date(b.startAt) < hEnd && new Date(b.endAt) > hStart);
  }

  // Calendar grid
  const firstDow = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const cells = Array(firstDow).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));
  while (cells.length % 7 !== 0) cells.push(null);

  function pickDate(day) {
    const iso = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    setDate(iso); setShowCal(false); setStartTime(""); setEndTime("");
  }
  function prevCal() { if (calMonth === 0) { setCalYear(y=>y-1); setCalMonth(11); } else setCalMonth(m=>m-1); }
  function nextCal() { if (calMonth === 11) { setCalYear(y=>y+1); setCalMonth(0); } else setCalMonth(m=>m+1); }

  function pickStart(h) {
    setStartTime(h);
    if (endTime && endTime <= h) setEndTime("");
  }

  const endHours = startTime ? HOURS.filter(h => h > startTime) : [];

  async function handleSubmit() {
    if (!title.trim()) { setError("กรุณาใส่ชื่อการประชุม"); titleRef.current?.focus(); return; }
    if (!name.trim()) { setError("กรุณาใส่ชื่อ-นามสกุล"); return; }
    if (!email.trim()) { setError("กรุณาใส่อีเมล"); return; }
    if (!department.trim()) { setError("กรุณาใส่ฝ่าย/แผนก"); return; }
    if (!date || !startTime || !endTime) { setError("กรุณาเลือกวันและเวลา"); return; }
    if (!roomId) { setError("กรุณาเลือกห้อง"); return; }
    setSubmitting(true); setError("");
    try {
      const token = liff.getAccessToken();
      const res = await fetch("/api/liff/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-line-access-token": token },
        body: JSON.stringify({ roomId, date, startTime, endTime, title: title.trim(), name: name.trim(), email: email.trim(), department: department.trim() }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "จองไม่สำเร็จ");
      }
      const data = await res.json();
      setBookingNo(data.bookingNo); setDone(true);
      setTimeout(() => { try { liff.closeWindow(); } catch {} }, 3000);
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  }

  if (!ready) return <div style={s.center}><div style={s.spinner}/></div>;
  if (done) return (
    <div style={s.center}>
      <div style={{ fontSize: 64 }}>✅</div>
      <h2 style={{ color: "#1a1a2e", margin: "12px 0 4px" }}>จองห้องเรียบร้อยครับ</h2>
      <p style={{ color: "#333" }}>หมายเลข: <strong>{bookingNo}</strong></p>
      <p style={{ color: "#888", fontSize: 13 }}>กำลังปิดหน้าต่าง...</p>
    </div>
  );

  const todayISO = today;

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {profile?.pictureUrl && <img src={profile.pictureUrl} alt="" style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid #aaaacc" }} />}
          <span style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>🗓️ จองห้องประชุม</span>
        </div>
        <a href="/liff/calendar" style={s.calBtn}>📅 ปฏิทิน</a>
      </div>

      <div style={s.body}>
        {/* Title — like Google Cal "Add title" */}
        <input ref={titleRef} value={title} onChange={e => setTitle(e.target.value)}
          placeholder="ชื่อการประชุม"
          style={s.titleInput} />

        {/* ข้อมูลผู้จอง */}
        <div style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", marginBottom: 12, boxShadow: "0 1px 4px #0001" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#888", marginBottom: 10 }}>ข้อมูลผู้จอง</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>ชื่อ-นามสกุล <span style={{ color: "#e63946" }}>*</span></div>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="ชื่อ-นามสกุล"
                style={{ width: "100%", padding: "9px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>อีเมล <span style={{ color: "#e63946" }}>*</span></div>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="example@thestandard.co"
                type="email" inputMode="email"
                style={{ width: "100%", padding: "9px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>ฝ่าย / แผนก <span style={{ color: "#e63946" }}>*</span></div>
              <input value={department} onChange={e => setDepartment(e.target.value)} placeholder="เช่น Marketing, Finance"
                style={{ width: "100%", padding: "9px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" }} />
            </div>
          </div>
        </div>

        <div style={s.card}>
          {/* Date row */}
          <div style={s.row} onClick={() => { setShowCal(v => !v); setShowTime(false); }}>
            <span style={s.rowIcon}>🗓</span>
            <div style={{ flex: 1 }}>
              <div style={s.rowLabel}>วันที่</div>
              <div style={s.rowValue}>{fmtDate(date)}</div>
            </div>
            <span style={s.chevron}>{showCal ? "▲" : "▼"}</span>
          </div>

          {/* Mini Calendar */}
          {showCal && (
            <div style={s.calContainer}>
              <div style={s.calHeader}>
                <button onClick={prevCal} style={s.calNavBtn}>‹</button>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{MONTH_TH[calMonth]} {calYear + 543}</span>
                <button onClick={nextCal} style={s.calNavBtn}>›</button>
              </div>
              <div style={s.calGrid}>
                {DAY_SHORT.map(d => <div key={d} style={s.calDayLabel}>{d}</div>)}
                {cells.map((day, i) => {
                  if (!day) return <div key={i} />;
                  const iso = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                  const isPast = iso < todayISO;
                  const isSelected = iso === date;
                  const isToday = iso === todayISO;
                  return (
                    <div key={i} onClick={() => !isPast && pickDate(day)}
                      style={{
                        ...s.calCell,
                        background: isSelected ? "#1a1a2e" : "transparent",
                        color: isSelected ? "#fff" : isPast ? "#ccc" : isToday ? "#457b9d" : "#333",
                        fontWeight: isToday || isSelected ? 700 : 400,
                        cursor: isPast ? "default" : "pointer",
                        border: isToday && !isSelected ? "1px solid #457b9d" : "1px solid transparent",
                      }}>
                      {day}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={s.divider} />

          {/* Time row */}
          <div style={s.row} onClick={() => { setShowTime(v => !v); setShowCal(false); }}>
            <span style={s.rowIcon}>⏰</span>
            <div style={{ flex: 1 }}>
              <div style={s.rowLabel}>เวลา</div>
              <div style={s.rowValue}>
                {startTime && endTime ? `${startTime} – ${endTime} น.` : <span style={{ color: "#aaa" }}>เลือกเวลา</span>}
              </div>
            </div>
            <span style={s.chevron}>{showTime ? "▲" : "▼"}</span>
          </div>

          {/* Time Picker */}
          {showTime && (
            <div style={{ padding: "0 16px 16px" }}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>เวลาเริ่ม</div>
              <div style={s.timeGrid}>
                {HOURS.slice(0,-1).map(h => {
                  const busy = isBusy(h);
                  const sel = startTime === h;
                  return (
                    <div key={h} onClick={() => !busy && pickStart(h)}
                      style={{ ...s.timeChip, background: sel ? "#1a1a2e" : busy ? "#fff0f0" : "#f5f6ff",
                        color: sel ? "#fff" : busy ? "#e63946" : "#333",
                        border: sel ? "none" : busy ? "1px solid #ffcccc" : "1px solid #e0e2ff",
                        cursor: busy ? "default" : "pointer",
                        textDecoration: busy ? "line-through" : "none" }}>
                      {h}
                    </div>
                  );
                })}
              </div>
              {startTime && (
                <>
                  <div style={{ fontSize: 12, color: "#888", margin: "10px 0 6px" }}>เวลาสิ้นสุด</div>
                  <div style={s.timeGrid}>
                    {endHours.map(h => {
                      const sel = endTime === h;
                      return (
                        <div key={h} onClick={() => { setEndTime(h); setShowTime(false); }}
                          style={{ ...s.timeChip, background: sel ? "#457b9d" : "#f5f6ff",
                            color: sel ? "#fff" : "#333", border: sel ? "none" : "1px solid #e0e2ff",
                            cursor: "pointer" }}>
                          {h}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          <div style={s.divider} />

          {/* Room row */}
          <div style={s.row}>
            <span style={s.rowIcon}>🏢</span>
            <div style={{ flex: 1 }}>
              <div style={s.rowLabel}>ห้อง</div>
              <select value={roomId} onChange={e => setRoomId(e.target.value)}
                style={s.roomSelect}>
                {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>

          {/* Busy slots info */}
          {busySlots.length > 0 && (
            <div style={{ padding: "0 16px 14px" }}>
              <div style={{ fontSize: 12, color: "#e63946", fontWeight: 600, marginBottom: 6 }}>⚠️ มีการจองในวันนี้</div>
              {busySlots.map((b, i) => (
                <div key={i} style={{ fontSize: 12, color: "#666", background: "#fff0f0", borderRadius: 6, padding: "4px 10px", marginBottom: 4 }}>
                  {fmtHour(b.startAt)} – {fmtHour(b.endAt)} · {b.title}
                </div>
              ))}
            </div>
          )}
          {roomId && date && busySlots.length === 0 && (
            <div style={{ padding: "0 16px 14px", fontSize: 12, color: "#2a9d8f" }}>✅ ห้องว่างทั้งวัน</div>
          )}
        </div>

        {error && <p style={{ color: "#e63946", fontSize: 13, margin: "4px 0 8px" }}>{error}</p>}

        <button onClick={handleSubmit} disabled={submitting}
          style={{ ...s.btn, opacity: submitting ? 0.7 : 1 }}>
          {submitting ? "⏳ กำลังจอง..." : "✅ ยืนยันการจอง"}
        </button>
      </div>
    </div>
  );
}

const s = {
  page: { fontFamily: "'Noto Sans Thai', sans-serif", minHeight: "100vh", background: "#f0f2ff", paddingBottom: 48 },
  header: { background: "#1a1a2e", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  calBtn: { fontSize: 12, color: "#aaddff", textDecoration: "none", background: "rgba(255,255,255,0.1)", padding: "6px 12px", borderRadius: 20 },
  body: { padding: "16px" },
  titleInput: { width: "100%", fontSize: 22, fontWeight: 600, border: "none", borderBottom: "2px solid #1a1a2e", background: "transparent", padding: "8px 0 10px", marginBottom: 16, boxSizing: "border-box", fontFamily: "inherit", outline: "none", color: "#1a1a2e" },
  card: { background: "#fff", borderRadius: 16, boxShadow: "0 2px 12px #0001", marginBottom: 14, overflow: "hidden" },
  row: { display: "flex", alignItems: "center", padding: "14px 16px", cursor: "pointer", gap: 12 },
  rowIcon: { fontSize: 20, width: 28, textAlign: "center" },
  rowLabel: { fontSize: 11, color: "#888", marginBottom: 2 },
  rowValue: { fontSize: 15, fontWeight: 600, color: "#1a1a2e" },
  chevron: { fontSize: 12, color: "#aaa" },
  divider: { height: 1, background: "#f0f0f0", margin: "0 16px" },
  calContainer: { padding: "8px 12px 16px" },
  calHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, padding: "0 4px" },
  calNavBtn: { background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#1a1a2e", fontWeight: 700, padding: "0 8px" },
  calGrid: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 },
  calDayLabel: { textAlign: "center", fontSize: 11, color: "#aaa", padding: "2px 0", fontWeight: 600 },
  calCell: { textAlign: "center", fontSize: 13, padding: "7px 2px", borderRadius: 50, transition: "background 0.1s" },
  timeGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 },
  timeChip: { textAlign: "center", fontSize: 13, padding: "8px 4px", borderRadius: 8, fontWeight: 500 },
  roomSelect: { fontSize: 15, fontWeight: 600, color: "#1a1a2e", border: "none", background: "transparent", outline: "none", padding: "2px 0", fontFamily: "inherit", width: "100%" },
  btn: { width: "100%", padding: "15px", background: "#1a1a2e", color: "#fff", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer" },
  center: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif", textAlign: "center", padding: 24 },
  spinner: { width: 40, height: 40, border: "4px solid #e0e0f0", borderTop: "4px solid #1a1a2e", borderRadius: "50%", animation: "spin 1s linear infinite" },
};
