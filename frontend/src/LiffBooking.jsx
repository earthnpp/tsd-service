import { useState, useEffect, useRef } from "react";
import liff from "@line/liff";

const LIFF_ID = import.meta.env.VITE_LIFF_ID;
const MONTH_TH = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const DAY_SHORT = ["อา","จ","อ","พ","พฤ","ศ","ส"];
const SLOTS = Array.from({ length: 27 }, (_, i) => {
  const total = 8 * 60 + i * 30; // 08:00 – 21:00 step 30 min
  return `${String(Math.floor(total / 60)).padStart(2,"0")}:${total % 60 === 0 ? "00" : "30"}`;
});
const ROOM_COLORS = ["#457b9d", "#e63946", "#2a9d8f", "#f4a261", "#9c6fbe", "#e9c46a"];

function toISO(date) { return date.toISOString().slice(0,10); }
function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return `${DAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_TH[d.getMonth()].slice(0,3)}.`;
}
function fmtHour(iso) { const d = new Date(iso); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; }
function toThaiDate(isoStr) {
  return new Date(new Date(isoStr).getTime() + 7 * 3600000).toISOString().slice(0, 10);
}

export default function LiffBooking() {
  const today = toISO(new Date());

  // On desktop (non-LINE browser) with an active portal session → skip LIFF
  const isLineApp = /Line\//i.test(navigator.userAgent);
  const _portalToken = localStorage.getItem("portal_token");
  const _portalUser = (() => { try { return JSON.parse(localStorage.getItem("portal_user") || "null"); } catch { return null; } })();
  const skipLiff = !isLineApp && !!_portalToken && !!_portalUser;

  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [roomId, setRoomId] = useState("");
  const [busySlots, setBusySlots] = useState([]);
  const [showCal, setShowCal] = useState(null); // null | "start" | "end"
  const [showTime, setShowTime] = useState(false);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [bookingNo, setBookingNo] = useState("");
  const [error, setError] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [dayPopup, setDayPopup] = useState(null); // null | { iso, bookings }
  const titleRef = useRef(null);

  // Desktop-only state
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" && window.innerWidth >= 768);
  const [desktopCalYear, setDesktopCalYear] = useState(new Date().getFullYear());
  const [desktopCalMonth, setDesktopCalMonth] = useState(new Date().getMonth());
  const [calBookings, setCalBookings] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [bookingPage, setBookingPage] = useState(0);
  const [bookingPageSize, setBookingPageSize] = useState(5);

  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    if (skipLiff) {
      setName(_portalUser.name || "");
      setEmail(_portalUser.email || "");
      fetch("/api/liff/rooms")
        .then(r => r.json())
        .then(data => { setRooms(data); if (data.length) setRoomId(String(data[0].id)); })
        .catch(() => {})
        .finally(() => setReady(true));
      fetch("/api/liff/my-bookings", { headers: { "x-portal-token": _portalToken } })
        .then(r => r.json()).then(data => { if (Array.isArray(data)) setMyBookings(data); }).catch(() => {});
      return;
    }
    // เริ่ม fetch rooms ทันที ไม่รอ liff.init()
    const roomsPromise = fetch("/api/liff/rooms").then(r => r.json()).catch(() => []);

    liff.init({ liffId: LIFF_ID }).then(async () => {
      if (!liff.isLoggedIn()) { liff.login(); return; }
      const [p, data] = await Promise.all([liff.getProfile(), roomsPromise]);
      setProfile(p);
      setName(p.displayName || "");
      setRooms(data);
      if (data.length) setRoomId(String(data[0].id));
      setReady(true);
    }).catch(err => { setError(err.message); setReady(true); });
  }, []);

  // Fetch all-room bookings for desktop calendar
  useEffect(() => {
    fetch(`/api/liff/bookings-calendar?year=${desktopCalYear}&month=${desktopCalMonth + 1}`)
      .then(r => r.json())
      .then(data => setCalBookings(data.bookings || []))
      .catch(() => setCalBookings([]));
  }, [desktopCalYear, desktopCalMonth]);

  // Fetch busy slots when room + startDate changes
  useEffect(() => {
    if (!roomId || !startDate) { setBusySlots([]); return; }
    fetch(`/api/liff/room-slots?roomId=${roomId}&date=${startDate}`)
      .then(r => r.json()).then(setBusySlots).catch(() => setBusySlots([]));
  }, [roomId, startDate]);

  function isStartBusy(slot) {
    const t = new Date(`${startDate}T${slot}:00+07:00`);
    return busySlots.some(b => new Date(b.startAt) <= t && new Date(b.endAt) > t);
  }

  function isEndBusy(slot) {
    if (!startTime) return false;
    const rangeStart = new Date(`${startDate}T${startTime}:00+07:00`);
    const rangeEnd   = new Date(`${endDate}T${slot}:00+07:00`);
    return busySlots.some(b => new Date(b.startAt) < rangeEnd && new Date(b.endAt) > rangeStart);
  }

  // Mobile calendar grid
  const firstDow = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const cells = Array(firstDow).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));
  while (cells.length % 7 !== 0) cells.push(null);

  // Desktop calendar grid
  const deskFirstDow = new Date(desktopCalYear, desktopCalMonth, 1).getDay();
  const deskDaysInMonth = new Date(desktopCalYear, desktopCalMonth + 1, 0).getDate();
  const deskCells = Array(deskFirstDow).fill(null).concat(Array.from({ length: deskDaysInMonth }, (_, i) => i + 1));
  while (deskCells.length % 7 !== 0) deskCells.push(null);

  const roomColorMap = Object.fromEntries(rooms.map((r, i) => [String(r.id), ROOM_COLORS[i % ROOM_COLORS.length]]));

  function getBookingsForDay(iso) {
    return calBookings.filter(b => {
      const bStart = toThaiDate(b.startAt);
      const bEnd = toThaiDate(b.endAt);
      return bStart <= iso && bEnd >= iso;
    });
  }

  function openCal(phase) {
    const ref = phase === "start" ? startDate : endDate;
    const d = new Date(ref + "T00:00:00");
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
    setShowCal(phase);
    setShowTime(false);
  }

  function pickDate(day) {
    const iso = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    if (showCal === "start") {
      setStartDate(iso);
      if (endDate < iso) setEndDate(iso);
      setStartTime(""); setEndTime("");
    } else {
      const maxEnd = new Date(startDate + "T00:00:00");
      maxEnd.setDate(maxEnd.getDate() + 10);
      setEndDate(iso > toISO(maxEnd) ? toISO(maxEnd) : iso);
      setEndTime("");
    }
    setShowCal(null);
  }

  function pickDesktopDay(day) {
    const iso = `${desktopCalYear}-${String(desktopCalMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    const dayBks = getBookingsForDay(iso);
    if (dayBks.length > 0) setDayPopup({ iso, bookings: dayBks });
    if (iso < today) return;
    setStartDate(iso);
    setEndDate(iso);
    setStartTime(""); setEndTime("");
  }

  function prevCal() { if (calMonth === 0) { setCalYear(y=>y-1); setCalMonth(11); } else setCalMonth(m=>m-1); }
  function nextCal() { if (calMonth === 11) { setCalYear(y=>y+1); setCalMonth(0); } else setCalMonth(m=>m+1); }

  function prevDesktopCal() {
    if (desktopCalMonth === 0) { setDesktopCalYear(y=>y-1); setDesktopCalMonth(11); }
    else setDesktopCalMonth(m=>m-1);
  }
  function nextDesktopCal() {
    if (desktopCalMonth === 11) { setDesktopCalYear(y=>y+1); setDesktopCalMonth(0); }
    else setDesktopCalMonth(m=>m+1);
  }

  function pickStart(h) {
    setStartTime(h);
    setEndTime("");
  }

  const isMultiDay = startDate !== endDate;
  const maxEndDate = (() => { const d = new Date(startDate + "T00:00:00"); d.setDate(d.getDate() + 10); return toISO(d); })();
  const endSlots = SLOTS.filter(h => {
    if (!isMultiDay && h <= startTime) return false;
    if (isMultiDay && h < startTime) return false; // ข้ามวัน: endTime ต้อง >= startTime
    return true;
  });

  async function handleSubmit() {
    if (!title.trim()) { setError("กรุณาใส่ชื่อการประชุม"); titleRef.current?.focus(); return; }
    if (!name.trim()) { setError("กรุณาใส่ชื่อ-นามสกุล"); return; }
    if (!email.trim()) { setError("กรุณาใส่อีเมล"); return; }
    if (!department.trim()) { setError("กรุณาใส่ฝ่าย/แผนก"); return; }
    if (!startDate || !startTime || !endTime) { setError("กรุณาเลือกวันและเวลา"); return; }
    if (!roomId) { setError("กรุณาเลือกห้อง"); return; }
    const diffDays = (new Date(endDate) - new Date(startDate)) / 86400000;
    if (diffDays > 10) { setError("จองได้สูงสุด 10 วัน"); return; }
    const startAt = new Date(`${startDate}T${startTime}:00+07:00`);
    const endAt   = new Date(`${endDate}T${endTime}:00+07:00`);
    if (endAt <= startAt) { setError("เวลาสิ้นสุดต้องหลังจากเวลาเริ่มต้น"); return; }
    if (isMultiDay && endTime < startTime) { setError("เวลาสิ้นสุดต้องไม่น้อยกว่าเวลาเริ่มต้น"); return; }
    setSubmitting(true); setError("");
    try {
      const headers = { "Content-Type": "application/json" };
      if (skipLiff) headers["x-portal-token"] = _portalToken;
      else headers["x-line-access-token"] = liff.getAccessToken();

      const res = await fetch("/api/liff/booking", {
        method: "POST",
        headers,
        body: JSON.stringify({
          roomId, startDate, startTime, endDate, endTime,
          title: title.trim(), notes: notes.trim() || undefined,
          name: name.trim(), email: email.trim(), department: department.trim(),
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "จองไม่สำเร็จ");
      }
      const data = await res.json();
      setBookingNo(data.bookingNo);
      if (isDesktop) {
        setShowSuccessModal(true);
        // รีเฟรชปฏิทินหลังจองสำเร็จ
        fetch(`/api/liff/bookings-calendar?year=${desktopCalYear}&month=${desktopCalMonth + 1}`)
          .then(r => r.json()).then(d => setCalBookings(d.bookings || [])).catch(() => {});
      } else {
        setDone(true);
        if (!skipLiff) setTimeout(() => { try { liff.closeWindow(); } catch {} }, 3000);
      }
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  }

  function closeSuccessModal() {
    setShowSuccessModal(false);
    setTitle(""); setStartTime(""); setEndTime(""); setNotes(""); setError("");
  }

  if (!ready) return <div style={s.center}><div style={s.spinner}/></div>;
  if (done) return (
    <div style={s.center}>
      <div style={{ fontSize: 64 }}>✅</div>
      <h2 style={{ color: "#1a1a2e", margin: "12px 0 4px" }}>จองห้องเรียบร้อยครับ</h2>
      <p style={{ color: "#333" }}>หมายเลข: <strong>{bookingNo}</strong></p>
      {skipLiff
        ? <a href="/" style={{ color: "#457b9d", fontSize: 14 }}>← กลับ Portal</a>
        : <p style={{ color: "#888", fontSize: 13 }}>กำลังปิดหน้าต่าง...</p>
      }
    </div>
  );

  const todayISO = today;

  // ==================== DESKTOP LAYOUT ====================
  if (isDesktop) {
    return (
      <div style={{ fontFamily: "'Noto Sans Thai', sans-serif", minHeight: "100vh", background: "#f0f2ff", paddingBottom: 48 }}>

        {/* ─── Sweet Alert: จองสำเร็จ ─── */}
        {showSuccessModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
            onClick={closeSuccessModal}>
            <div style={{ background: "#fff", borderRadius: 20, padding: "48px 40px", textAlign: "center", maxWidth: 380, width: "90%", boxShadow: "0 12px 48px rgba(0,0,0,0.25)" }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 72, marginBottom: 4, lineHeight: 1 }}>✅</div>
              <h2 style={{ color: "#1a1a2e", margin: "12px 0 8px", fontSize: 22, fontWeight: 800 }}>จองห้องเรียบร้อยแล้วครับ</h2>
              <p style={{ color: "#666", margin: "0 0 6px", fontSize: 14 }}>หมายเลขการจอง</p>
              <p style={{ color: "#457b9d", margin: "0 0 28px", fontSize: 22, fontWeight: 700 }}>{bookingNo}</p>
              <button onClick={closeSuccessModal}
                style={{ padding: "12px 48px", background: "#1a1a2e", color: "#fff", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
                ตกลง
              </button>
            </div>
          </div>
        )}

        {/* ─── Day Popup: รายการจองในวันที่เลือก ─── */}
        {dayPopup && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}
            onClick={() => setDayPopup(null)}>
            <div style={{ background: "#fff", borderRadius: 16, padding: "24px", maxWidth: 460, width: "90%", maxHeight: "70vh", overflowY: "auto", boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#1a1a2e" }}>
                  📅 {fmtDate(dayPopup.iso)} — รายการจอง
                </div>
                <button onClick={() => setDayPopup(null)}
                  style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#aaa", lineHeight: 1, padding: 0 }}>✕</button>
              </div>
              {dayPopup.bookings.length === 0 ? (
                <p style={{ color: "#2a9d8f", textAlign: "center", padding: "24px 0", fontSize: 15 }}>✅ ไม่มีการจองในวันนี้</p>
              ) : dayPopup.bookings.map((b, i) => (
                <div key={i} style={{ padding: "12px 14px", borderRadius: 10, background: "#f8f9ff", marginBottom: 8, borderLeft: `4px solid ${roomColorMap[String(b.roomId)] || "#457b9d"}` }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1a1a2e", marginBottom: 4 }}>{b.title}</div>
                  <div style={{ fontSize: 13, color: "#555" }}>⏰ {fmtHour(b.startAt)} – {fmtHour(b.endAt)} น.</div>
                  <div style={{ fontSize: 12, color: "#888", marginTop: 3, display: "flex", gap: 10 }}>
                    <span>🏢 {b.room?.name || "-"}</span>
                    <span>👤 {b.displayName || "-"}</span>
                    {b.department && <span>· {b.department}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={s.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {(profile?.pictureUrl || _portalUser?.picture) && <img src={profile?.pictureUrl || _portalUser?.picture} alt="" referrerPolicy="no-referrer" style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid #aaaacc" }} />}
            <span style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>🗓️ จองห้องประชุม</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {skipLiff && <a href="/" style={{ ...s.calBtn, color: "#ffcccc" }}>← Portal</a>}
            <a href="/liff/calendar" style={s.calBtn}>📅 ปฏิทินทั้งหมด</a>
          </div>
        </div>

        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px 48px" }}>
          {/* Top: Monthly calendar */}
          <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 2px 12px #0001", padding: "24px", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
              <span style={{ fontWeight: 700, fontSize: 18, color: "#1a1a2e" }}>📅 ปฏิทินการจอง</span>
              {startDate && (
                <span style={{ marginLeft: 16, fontSize: 14, color: "#457b9d", background: "#ebf4ff", padding: "4px 12px", borderRadius: 20, fontWeight: 600 }}>
                  เลือก: {fmtDate(startDate)}
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 16 }}>
              <button onClick={prevDesktopCal} style={s.deskNavBtn}>‹</button>
              <span style={{ fontWeight: 700, fontSize: 18, minWidth: 200, textAlign: "center" }}>
                {MONTH_TH[desktopCalMonth]} {desktopCalYear + 543}
              </span>
              <button onClick={nextDesktopCal} style={s.deskNavBtn}>›</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 4 }}>
              {DAY_SHORT.map(d => (
                <div key={d} style={{ textAlign: "center", fontSize: 13, color: "#999", fontWeight: 600, padding: "4px 0" }}>{d}</div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
              {deskCells.map((day, i) => {
                if (!day) return <div key={i} style={{ minHeight: 80 }} />;
                const iso = `${desktopCalYear}-${String(desktopCalMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                const isPast = iso < todayISO;
                const isSelected = iso === startDate;
                const isToday = iso === todayISO;
                const dayBookings = getBookingsForDay(iso);
                return (
                  <div key={i} onClick={() => pickDesktopDay(day)}
                    style={{
                      minHeight: 80,
                      padding: "6px",
                      borderRadius: 8,
                      border: isSelected ? "2px solid #457b9d" : isToday ? "1px solid #457b9d" : "1px solid #f0f0f0",
                      background: isSelected ? "#ebf4ff" : isToday ? "#f5f9ff" : isPast ? "#fafafa" : "#fff",
                      cursor: (!isPast || dayBookings.length > 0) ? "pointer" : "default",
                      transition: "background 0.1s",
                    }}>
                    <div style={{
                      fontSize: 13,
                      fontWeight: isToday || isSelected ? 700 : 400,
                      color: isPast ? "#ccc" : isSelected ? "#457b9d" : isToday ? "#457b9d" : "#333",
                      marginBottom: 3,
                    }}>{day}</div>
                    {dayBookings.slice(0, 3).map((b, bi) => (
                      <div key={bi} style={{
                        fontSize: 10,
                        background: roomColorMap[String(b.roomId)] || "#457b9d",
                        color: "#fff",
                        borderRadius: 3,
                        padding: "1px 4px",
                        marginBottom: 2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}>
                        {fmtHour(b.startAt)}–{fmtHour(b.endAt)}
                      </div>
                    ))}
                    {dayBookings.length > 3 && (
                      <div style={{ fontSize: 10, color: "#888" }}>+{dayBookings.length - 3} เพิ่ม</div>
                    )}
                  </div>
                );
              })}
            </div>

            {rooms.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 16, paddingTop: 16, borderTop: "1px solid #f0f0f0" }}>
                {rooms.map((r, i) => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: ROOM_COLORS[i % ROOM_COLORS.length] }} />
                    <span style={{ fontSize: 12, color: "#555" }}>{r.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom: Booking form */}
          <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 2px 12px #0001", padding: "24px" }}>
            <div style={{ fontWeight: 700, fontSize: 18, color: "#1a1a2e", marginBottom: 20 }}>
              ✍️ ฟอร์มการจอง
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={s.deskLabel}>ชื่อการประชุม <span style={{ color: "#e63946" }}>*</span></label>
                <input ref={titleRef} value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="ชื่อการประชุม" style={s.deskInput} />
              </div>
              <div>
                <label style={s.deskLabel}>ชื่อ-นามสกุล <span style={{ color: "#e63946" }}>*</span></label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="ชื่อ-นามสกุล" style={s.deskInput} />
              </div>
              <div>
                <label style={s.deskLabel}>อีเมล <span style={{ color: "#e63946" }}>*</span></label>
                <input value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="example@thestandard.co" type="email" style={s.deskInput} />
              </div>
              <div>
                <label style={s.deskLabel}>ฝ่าย / แผนก <span style={{ color: "#e63946" }}>*</span></label>
                <input value={department} onChange={e => setDepartment(e.target.value)}
                  placeholder="เช่น Marketing, Finance" style={s.deskInput} />
              </div>
              <div>
                <label style={s.deskLabel}>ห้องประชุม</label>
                <select value={roomId} onChange={e => { setRoomId(e.target.value); setStartTime(""); setEndTime(""); }}
                  style={s.deskInput}>
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={s.deskLabel}>รายละเอียดเพิ่มเติม</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="ระบุรายละเอียดเพิ่มเติม เช่น จำนวนผู้เข้าร่วม อุปกรณ์ที่ต้องการ (ถ้ามี)"
                  rows={2} style={{ ...s.deskInput, resize: "vertical" }} />
              </div>
            </div>

            {/* Date + Time section */}
            <div style={{ background: "#f8f9ff", borderRadius: 12, padding: "16px", marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#1a1a2e", marginBottom: 12 }}>📅 วันและเวลา</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={s.deskLabel}>วันเริ่มต้น</label>
                  <input type="date" value={startDate}
                    onChange={e => { setStartDate(e.target.value); if (endDate < e.target.value) setEndDate(e.target.value); setStartTime(""); setEndTime(""); }}
                    min={today} style={s.deskInput} />
                </div>
                <div>
                  <label style={s.deskLabel}>วันสิ้นสุด</label>
                  <input type="date" value={endDate}
                    onChange={e => { setEndDate(e.target.value); setEndTime(""); }}
                    min={startDate} max={maxEndDate} style={s.deskInput} />
                </div>
                <div>
                  <label style={s.deskLabel}>เวลาเริ่มต้น</label>
                  <select value={startTime} onChange={e => pickStart(e.target.value)} style={s.deskInput}>
                    <option value="">-- เลือก --</option>
                    {SLOTS.slice(0, -1).map(h => (
                      <option key={h} value={h} disabled={!isMultiDay && isStartBusy(h)}>
                        {h}{!isMultiDay && isStartBusy(h) ? " (ไม่ว่าง)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={s.deskLabel}>เวลาสิ้นสุด</label>
                  <select value={endTime} onChange={e => setEndTime(e.target.value)}
                    style={s.deskInput} disabled={!startTime}>
                    <option value="">-- เลือก --</option>
                    {endSlots.map(h => (
                      <option key={h} value={h} disabled={!isMultiDay && isEndBusy(h)}>
                        {h}{!isMultiDay && isEndBusy(h) ? " (ไม่ว่าง)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {!isMultiDay && busySlots.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 13, color: "#e63946", fontWeight: 600, marginBottom: 6 }}>⚠️ มีการจองในวันที่เลือก</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {busySlots.map((b, i) => (
                      <div key={i} style={{ fontSize: 12, color: "#666", background: "#fff0f0", borderRadius: 6, padding: "4px 10px" }}>
                        {fmtHour(b.startAt)} – {fmtHour(b.endAt)} · {b.title}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!isMultiDay && roomId && startDate && busySlots.length === 0 && (
                <div style={{ marginTop: 10, fontSize: 13, color: "#2a9d8f" }}>✅ ห้องว่างทั้งวัน</div>
              )}
            </div>

            {error && <p style={{ color: "#e63946", fontSize: 13, margin: "0 0 12px" }}>{error}</p>}

            <button onClick={handleSubmit} disabled={submitting}
              style={{ ...s.btn, maxWidth: 360, opacity: submitting ? 0.7 : 1 }}>
              {submitting ? "⏳ กำลังจอง..." : "✅ ยืนยันการจอง"}
            </button>
          </div>

          {/* ── ประวัติการจองของคุณ ── */}
          {skipLiff && myBookings.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 2px 12px #0001", padding: "24px", marginTop: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 12, borderBottom: "2px solid #e8eaed" }}>
                <div style={{ fontWeight: 700, fontSize: 18, color: "#1a1a2e" }}>🗓️ ประวัติการจองของคุณ</div>
                <select
                  value={bookingPageSize}
                  onChange={e => { setBookingPageSize(Number(e.target.value)); setBookingPage(0); }}
                  style={{ fontSize: 13, padding: "5px 10px", border: "1px solid #e0e0f0", borderRadius: 8, background: "#fff", cursor: "pointer" }}>
                  <option value={5}>แสดง 5 รายการ</option>
                  <option value={10}>แสดง 10 รายการ</option>
                  <option value={15}>แสดง 15 รายการ</option>
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {myBookings.slice(bookingPage * bookingPageSize, (bookingPage + 1) * bookingPageSize).map(b => {
                  const isCancelled = b.status === "cancelled";
                  const start = new Date(b.startAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" });
                  const end   = new Date(b.endAt).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });
                  return (
                    <div key={b.id} style={{ padding: "12px 16px", borderRadius: 10, background: isCancelled ? "#fff5f5" : "#f8f9ff", border: `1px solid ${isCancelled ? "#ffcccc" : "#e8eaed"}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: "#457b9d" }}>{b.bookingNo}</span>
                          <span style={{ fontSize: 11, color: "#888" }}>🏢 {b.room?.name || "-"}</span>
                        </div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "#1a1a2e", marginBottom: 2 }}>{b.title}</div>
                        <div style={{ fontSize: 12, color: "#666" }}>⏰ {start} – {end} น.</div>
                        {isCancelled && b.cancelledBy && (
                          <div style={{ fontSize: 11, color: "#e63946", marginTop: 4 }}>ยกเลิกโดย {b.cancelledBy}</div>
                        )}
                      </div>
                      <span style={{ borderRadius: 999, padding: "3px 12px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0,
                        background: isCancelled ? "#fff0f0" : "#e8f8f5",
                        color: isCancelled ? "#e63946" : "#2a9d8f" }}>
                        {isCancelled ? "ยกเลิกแล้ว" : "ยืนยันแล้ว"}
                      </span>
                    </div>
                  );
                })}
              </div>
              {myBookings.length > bookingPageSize && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, fontSize: 13 }}>
                  <button
                    onClick={() => setBookingPage(p => Math.max(0, p - 1))}
                    disabled={bookingPage === 0}
                    style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid #e0e0f0", background: bookingPage === 0 ? "#f5f5f5" : "#fff", color: bookingPage === 0 ? "#bbb" : "#457b9d", cursor: bookingPage === 0 ? "default" : "pointer", fontWeight: 600 }}>
                    ← ก่อนหน้า
                  </button>
                  <span style={{ color: "#888" }}>
                    หน้า {bookingPage + 1} / {Math.ceil(myBookings.length / bookingPageSize)}
                  </span>
                  <button
                    onClick={() => setBookingPage(p => p + 1)}
                    disabled={(bookingPage + 1) * bookingPageSize >= myBookings.length}
                    style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid #e0e0f0", background: (bookingPage + 1) * bookingPageSize >= myBookings.length ? "#f5f5f5" : "#fff", color: (bookingPage + 1) * bookingPageSize >= myBookings.length ? "#bbb" : "#457b9d", cursor: (bookingPage + 1) * bookingPageSize >= myBookings.length ? "default" : "pointer", fontWeight: 600 }}>
                    ถัดไป →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==================== MOBILE LAYOUT (unchanged) ====================
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
        {/* ข้อมูลผู้จอง */}
        <div style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", marginBottom: 12, boxShadow: "0 1px 4px #0001" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>ชื่อการประชุม <span style={{ color: "#e63946" }}>*</span></div>
              <input ref={titleRef} value={title} onChange={e => setTitle(e.target.value)}
                placeholder="ชื่อการประชุม"
                style={{ width: "100%", padding: "9px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#888", marginTop: 2 }}>ข้อมูลผู้จอง</div>
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
            <div>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>รายละเอียดเพิ่มเติม</div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="ระบุรายละเอียดเพิ่มเติม เช่น จำนวนผู้เข้าร่วม อุปกรณ์ที่ต้องการ (ถ้ามี)"
                rows={3}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit", resize: "vertical" }} />
            </div>
          </div>
        </div>

        <div style={s.card}>
          {/* Room row */}
          <div style={s.row}>
            <span style={s.rowIcon}>🏢</span>
            <div style={{ flex: 1 }}>
              <div style={s.rowLabel}>ห้องประชุม</div>
              <select value={roomId} onChange={e => { setRoomId(e.target.value); setStartTime(""); setEndTime(""); }}
                style={s.roomSelect}>
                {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>

          <div style={s.divider} />

          {/* Date rows — start & end */}
          <div style={{ display: "flex" }}>
            {/* Start date */}
            <div style={{ flex: 1, ...s.row, borderRight: "1px solid #f0f0f0" }}
              onClick={() => openCal(showCal === "start" ? null : "start")}>
              <span style={s.rowIcon}>🗓</span>
              <div style={{ flex: 1 }}>
                <div style={s.rowLabel}>วันเริ่มต้น</div>
                <div style={{ ...s.rowValue, fontSize: 13 }}>{fmtDate(startDate)}</div>
              </div>
              <span style={s.chevron}>{showCal === "start" ? "▲" : "▼"}</span>
            </div>
            {/* End date */}
            <div style={{ flex: 1, ...s.row }}
              onClick={() => openCal(showCal === "end" ? null : "end")}>
              <span style={s.rowIcon}>🏁</span>
              <div style={{ flex: 1 }}>
                <div style={s.rowLabel}>วันสิ้นสุด</div>
                <div style={{ ...s.rowValue, fontSize: 13 }}>{fmtDate(endDate)}</div>
              </div>
              <span style={s.chevron}>{showCal === "end" ? "▲" : "▼"}</span>
            </div>
          </div>

          {/* Mini Calendar */}
          {showCal && (
            <div style={s.calContainer}>
              <div style={{ fontSize: 11, color: showCal === "start" ? "#457b9d" : "#e63946",
                fontWeight: 600, textAlign: "center", marginBottom: 6 }}>
                {showCal === "start" ? "เลือกวันเริ่มต้น" : "เลือกวันสิ้นสุด"}
              </div>
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
                  const isDisabled = isPast || (showCal === "end" && iso < startDate);
                  const isSelected = showCal === "start" ? iso === startDate : iso === endDate;
                  const isInRange = iso > startDate && iso < endDate;
                  const isToday = iso === todayISO;
                  return (
                    <div key={i} onClick={() => !isDisabled && pickDate(day)}
                      style={{
                        ...s.calCell,
                        background: isSelected ? (showCal === "start" ? "#457b9d" : "#e63946") : isInRange ? "#e8f0fe" : "transparent",
                        color: isSelected ? "#fff" : isDisabled ? "#ccc" : isToday ? "#457b9d" : "#333",
                        fontWeight: isToday || isSelected ? 700 : 400,
                        cursor: isDisabled ? "default" : "pointer",
                        border: isToday && !isSelected ? "1px solid #457b9d" : "1px solid transparent",
                        borderRadius: isInRange ? 4 : 50,
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
          <div style={s.row} onClick={() => { setShowTime(v => !v); setShowCal(null); }}>
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
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>เวลาเริ่มต้น</div>
                  <select value={startTime} onChange={e => pickStart(e.target.value)}
                    style={s.timeSelect}>
                    <option value="">-- เลือก --</option>
                    {SLOTS.slice(0, -1).map(h => (
                      <option key={h} value={h} disabled={!isMultiDay && isStartBusy(h)}>{h}{!isMultiDay && isStartBusy(h) ? " (ไม่ว่าง)" : ""}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>เวลาสิ้นสุด</div>
                  <select value={endTime} onChange={e => { setEndTime(e.target.value); if (e.target.value) setShowTime(false); }}
                    style={s.timeSelect} disabled={!startTime}>
                    <option value="">-- เลือก --</option>
                    {endSlots.map(h => (
                      <option key={h} value={h} disabled={!isMultiDay && isEndBusy(h)}>{h}{!isMultiDay && isEndBusy(h) ? " (ไม่ว่าง)" : ""}</option>
                    ))}
                  </select>
                </div>
              </div>
              {/* Busy slots info (single day only) */}
              {!isMultiDay && busySlots.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, color: "#e63946", fontWeight: 600, marginBottom: 6 }}>⚠️ มีการจองในวันนี้</div>
                  {busySlots.map((b, i) => (
                    <div key={i} style={{ fontSize: 12, color: "#666", background: "#fff0f0", borderRadius: 6, padding: "4px 10px", marginBottom: 4 }}>
                      {fmtHour(b.startAt)} – {fmtHour(b.endAt)} · {b.title}
                    </div>
                  ))}
                </div>
              )}
              {!isMultiDay && roomId && startDate && busySlots.length === 0 && (
                <div style={{ marginTop: 10, fontSize: 12, color: "#2a9d8f" }}>✅ ห้องว่างทั้งวัน</div>
              )}
            </div>
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
  calCell: { textAlign: "center", fontSize: 13, padding: "7px 2px", transition: "background 0.1s" },
  timeSelect: { width: "100%", padding: "9px 10px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, fontFamily: "inherit", background: "#fff", color: "#1a1a2e", outline: "none" },
  roomSelect: { fontSize: 15, fontWeight: 600, color: "#1a1a2e", border: "none", background: "transparent", outline: "none", padding: "2px 0", fontFamily: "inherit", width: "100%" },
  btn: { width: "100%", padding: "15px", background: "#1a1a2e", color: "#fff", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer" },
  center: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif", textAlign: "center", padding: 24 },
  spinner: { width: 40, height: 40, border: "4px solid #e0e0f0", borderTop: "4px solid #1a1a2e", borderRadius: "50%", animation: "spin 1s linear infinite" },
  // Desktop styles
  deskNavBtn: { background: "none", border: "1px solid #e0e0f0", borderRadius: 8, width: 36, height: 36, cursor: "pointer", fontSize: 18, color: "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center" },
  deskLabel: { fontSize: 13, color: "#555", display: "block", marginBottom: 6 },
  deskInput: { width: "100%", padding: "9px 12px", border: "1px solid #e0e0f0", borderRadius: 8, fontSize: 14, fontFamily: "inherit", background: "#fff", color: "#1a1a2e", outline: "none", boxSizing: "border-box" },
};
