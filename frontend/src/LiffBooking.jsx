import { useState, useEffect } from "react";
import liff from "@line/liff";

const LIFF_ID = import.meta.env.VITE_LIFF_ID;

const TIME_SLOTS = [];
for (let h = 8; h <= 21; h++) TIME_SLOTS.push(`${String(h).padStart(2, "0")}:00`);

export default function LiffBooking() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [form, setForm] = useState({ roomId: "", date: "", startTime: "", endTime: "", title: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [bookingNo, setBookingNo] = useState("");
  const [error, setError] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    liff.init({ liffId: LIFF_ID })
      .then(async () => {
        if (!liff.isLoggedIn()) { liff.login(); return; }
        const p = await liff.getProfile();
        setProfile(p);
        const res = await fetch("/api/liff/rooms");
        const data = await res.json();
        setRooms(data);
        setReady(true);
      })
      .catch(err => setError("ไม่สามารถเชื่อมต่อ LINE ได้: " + err.message));
  }, []);

  const endTimeOptions = form.startTime
    ? TIME_SLOTS.filter(t => t > form.startTime)
    : [];

  async function handleSubmit() {
    if (!form.roomId || !form.date || !form.startTime || !form.endTime || !form.title.trim()) {
      setError("กรุณากรอกข้อมูลที่มี * ให้ครบถ้วน"); return;
    }
    setSubmitting(true); setError("");
    try {
      const token = liff.getAccessToken();
      const res = await fetch("/api/liff/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-line-access-token": token },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "จองไม่สำเร็จ กรุณาลองใหม่");
      }
      const data = await res.json();
      setBookingNo(data.bookingNo);
      setDone(true);
      setTimeout(() => { try { liff.closeWindow(); } catch {} }, 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready && !error) return (
    <div style={s.center}><div style={s.spinner} /><p style={{ color: "#888", marginTop: 16 }}>กำลังโหลด...</p></div>
  );
  if (error && !ready) return (
    <div style={s.center}><p style={{ fontSize: 40 }}>⚠️</p><p style={{ color: "#e63946" }}>{error}</p></div>
  );
  if (done) return (
    <div style={s.center}>
      <p style={{ fontSize: 64, margin: 0 }}>✅</p>
      <h2 style={{ color: "#1a1a2e", margin: "12px 0 4px" }}>จองห้องเรียบร้อยครับ</h2>
      <p style={{ color: "#333", fontSize: 15 }}>หมายเลขการจอง: <strong>{bookingNo}</strong></p>
      <p style={{ color: "#888", fontSize: 13 }}>กำลังปิดหน้าต่าง...</p>
    </div>
  );

  const selectedRoom = rooms.find(r => String(r.id) === String(form.roomId));

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {profile?.pictureUrl && <img src={profile.pictureUrl} alt="" style={s.avatar} />}
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#fff" }}>🗓️ จองห้องประชุม</div>
            <div style={{ fontSize: 12, color: "#aaaacc" }}>{profile?.displayName}</div>
          </div>
        </div>
      </div>

      <div style={s.body}>
        <Field label="ห้องประชุม" required>
          <select value={form.roomId}
            onChange={e => setForm({ ...form, roomId: e.target.value })}
            style={s.input}>
            <option value="">-- เลือกห้อง --</option>
            {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>

        <Field label="วันที่" required>
          <input type="date" value={form.date} min={today}
            onChange={e => setForm({ ...form, date: e.target.value, startTime: "", endTime: "" })}
            style={s.input} />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="เวลาเริ่ม" required>
            <select value={form.startTime}
              onChange={e => setForm({ ...form, startTime: e.target.value, endTime: "" })}
              style={s.input} disabled={!form.date}>
              <option value="">-- เลือก --</option>
              {TIME_SLOTS.slice(0, -1).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="เวลาสิ้นสุด" required>
            <select value={form.endTime}
              onChange={e => setForm({ ...form, endTime: e.target.value })}
              style={s.input} disabled={!form.startTime}>
              <option value="">-- เลือก --</option>
              {endTimeOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        </div>

        <Field label="หัวข้อ / วัตถุประสงค์" required>
          <input value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            style={s.input} placeholder="เช่น ประชุมทีม Marketing" />
        </Field>

        {/* Summary */}
        {form.roomId && form.date && form.startTime && form.endTime && (
          <div style={s.summary}>
            <div style={{ fontSize: 13, color: "#555", marginBottom: 4, fontWeight: 600 }}>📋 สรุปการจอง</div>
            <div style={{ fontSize: 13, color: "#333" }}>🏢 {selectedRoom?.name}</div>
            <div style={{ fontSize: 13, color: "#333" }}>📅 {form.date} · {form.startTime} – {form.endTime} น.</div>
            {form.title && <div style={{ fontSize: 13, color: "#333" }}>📝 {form.title}</div>}
          </div>
        )}

        {error && <p style={{ color: "#e63946", fontSize: 13, margin: "4px 0 8px" }}>{error}</p>}

        <button onClick={handleSubmit} disabled={submitting}
          style={{ ...s.btn, opacity: submitting ? 0.7 : 1 }}>
          {submitting ? "⏳ กำลังจอง..." : "✅ ยืนยันการจอง"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: "#333", display: "block", marginBottom: 6 }}>
        {label} {required && <span style={{ color: "#e63946" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const s = {
  page: { fontFamily: "'Noto Sans Thai', sans-serif", minHeight: "100vh", background: "#f5f6ff", paddingBottom: 48 },
  header: { background: "#1a1a2e", padding: "16px" },
  avatar: { width: 36, height: 36, borderRadius: "50%", border: "2px solid #aaaacc" },
  body: { padding: "16px" },
  input: { width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit", background: "#fff" },
  summary: { background: "#eef0ff", borderRadius: 10, padding: "12px 14px", marginBottom: 12, lineHeight: 1.7 },
  btn: { width: "100%", padding: "15px", background: "#1a1a2e", color: "#fff", border: "none", borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: "pointer", marginTop: 4 },
  center: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif", textAlign: "center", padding: 24 },
  spinner: { width: 40, height: 40, border: "4px solid #e0e0f0", borderTop: "4px solid #1a1a2e", borderRadius: "50%", animation: "spin 1s linear infinite" },
};
