import { useState, useEffect } from "react";
import liff from "@line/liff";

const LIFF_ID = import.meta.env.VITE_LIFF_ID;

function compressImage(file, maxWidth = 1920, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round(height * maxWidth / width);
          width = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("compress failed")), "image/jpeg", quality);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function LiffApp() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", department: "", category: "", subcategory: "", assetTag: "", description: "" });
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageInputKey, setImageInputKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    liff.init({ liffId: LIFF_ID })
      .then(async () => {
        if (!liff.isLoggedIn()) { liff.login(); return; }
        const p = await liff.getProfile();
        setProfile(p);
        setForm(f => ({ ...f, name: p.displayName }));
        const res = await fetch("/api/liff/categories");
        const data = await res.json();
        setCategories(data);
        setReady(true);
      })
      .catch(err => setError("ไม่สามารถเชื่อมต่อ LINE ได้: " + err.message));
  }, []);

  const subcategories = categories.find(c => c.name === form.category)?.subcategories || [];

  async function handleImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setImage(compressed);
      setImagePreview(URL.createObjectURL(compressed));
    } catch {
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  }

  function handleRemoveImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImage(null);
    setImagePreview(null);
    setImageInputKey(k => k + 1); // reset file input
  }

  async function handleSubmit() {
    if (!form.name.trim() || !form.email.trim() || !form.department.trim() || !form.category || !form.subcategory || !form.description.trim()) {
      setError("กรุณากรอกข้อมูลที่มี * ให้ครบถ้วน"); return;
    }
    setSubmitting(true); setError("");
    try {
      const token = liff.getAccessToken();
      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("email", form.email);
      fd.append("department", form.department);
      fd.append("category", form.category);
      fd.append("subcategory", form.subcategory);
      fd.append("assetTag", form.assetTag);
      fd.append("description", form.description);
      if (image) fd.append("image", image);
      const res = await fetch("/api/liff/ticket", {
        method: "POST",
        headers: { "x-line-access-token": token },
        body: fd,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่");
      }
      setDone(true);
      setTimeout(() => { try { liff.closeWindow(); } catch {} }, 2500);
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
      <h2 style={{ color: "#2a9d8f", margin: "12px 0 4px" }}>แจ้งรับบริการเรียบร้อยครับ</h2>
      <p style={{ color: "#666", fontSize: 14 }}>ทีม IT จะรีบดำเนินการให้ครับ 🙏</p>
    </div>
  );

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {profile?.pictureUrl && <img src={profile.pictureUrl} alt="" style={s.avatar} />}
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#fff" }}>🛠️ แจ้งปัญหา IT</div>
            <div style={{ fontSize: 12, color: "#aaaacc" }}>{profile?.displayName}</div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div style={s.body}>

        {/* ชื่อผู้แจ้ง */}
        <Field label="ชื่อ-นามสกุล" required>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            style={s.input} placeholder="ชื่อ-นามสกุล" />
        </Field>

        {/* อีเมล */}
        <Field label="อีเมล" required>
          <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
            style={s.input} placeholder="example@thestandard.co" type="email" inputMode="email" />
        </Field>

        {/* ฝ่าย/แผนก */}
        <Field label="ฝ่าย / แผนก" required>
          <input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}
            style={s.input} placeholder="เช่น Marketing, Finance" />
        </Field>

        {/* หมวดหมู่ */}
        <Field label="หมวดหมู่ปัญหา" required>
          <select value={form.category}
            onChange={e => setForm({ ...form, category: e.target.value, subcategory: "" })}
            style={s.input}>
            <option value="">-- เลือกหมวดหมู่ --</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.icon} {c.name}</option>)}
          </select>
        </Field>

        {/* ประเภทปัญหา */}
        {form.category && (
          <Field label="ประเภทปัญหา" required>
            <select value={form.subcategory}
              onChange={e => setForm({ ...form, subcategory: e.target.value })}
              style={s.input}>
              <option value="">-- เลือกประเภท --</option>
              {subcategories.map(sc => <option key={sc.id} value={sc.name}>{sc.name}</option>)}
            </select>
          </Field>
        )}

        {/* Asset Tag */}
        <Field label="หมายเลขครุภัณฑ์ (Asset Tag)">
          <input value={form.assetTag}
            onChange={e => setForm({ ...form, assetTag: e.target.value.toUpperCase() })}
            style={s.input} placeholder="เช่น TSDMB001 (ไม่บังคับ)" />
          <p style={s.hint}>หมายเลขอยู่บนสติกเกอร์ ใต้เครื่องหรือหลังเครื่อง</p>
        </Field>

        {/* อาการเสีย */}
        <Field label="อาการเสีย / รายละเอียด" required>
          <textarea value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            style={{ ...s.input, minHeight: 110, resize: "vertical" }}
            placeholder="อธิบายอาการปัญหาให้ละเอียดครับ เช่น เปิดเครื่องไม่ติด, หน้าจอค้าง" />
        </Field>

        {/* แนบรูป */}
        <Field label="แนบรูปภาพ (ถ้ามี)">
          {imagePreview ? (
            <div style={{ position: "relative" }}>
              <img src={imagePreview} alt="preview"
                style={{ width: "100%", maxHeight: 200, objectFit: "contain", borderRadius: 8, background: "#f0f0f0", display: "block" }} />
              <button onClick={handleRemoveImage} style={s.removeBtn} type="button">✕ ลบรูป</button>
            </div>
          ) : (
            <label style={s.imageBox}>
              <input key={imageInputKey} type="file" accept="image/*" onChange={handleImage} style={{ display: "none" }} />
              <div style={{ color: "#aaa", textAlign: "center", padding: "24px 0", fontSize: 14 }}>
                <div style={{ fontSize: 36 }}>📷</div>
                แตะเพื่อเลือกหรือถ่ายรูป
              </div>
            </label>
          )}
        </Field>

        {error && <p style={{ color: "#e63946", fontSize: 13, margin: "4px 0 0" }}>{error}</p>}

        {/* ปุ่มยืนยัน */}
        <button onClick={handleSubmit} disabled={submitting} style={{ ...s.btn, opacity: submitting ? 0.7 : 1 }}>
          {submitting ? "⏳ กำลังส่ง..." : "✅ ยืนยันการแจ้งปัญหา"}
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
  hint: { margin: "4px 0 0", fontSize: 11, color: "#aaa" },
  imageBox: { display: "block", border: "2px dashed #ccc", borderRadius: 8, overflow: "hidden", cursor: "pointer", background: "#fafafa" },
  removeBtn: { display: "block", width: "100%", marginTop: 6, padding: "8px", background: "#fff", border: "1px solid #e63946", borderRadius: 8, color: "#e63946", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  btn: { width: "100%", padding: "15px", background: "#2a9d8f", color: "#fff", border: "none", borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: "pointer", marginTop: 8 },
  center: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "sans-serif", textAlign: "center", padding: 24 },
  spinner: { width: 40, height: 40, border: "4px solid #e0e0f0", borderTop: "4px solid #2a9d8f", borderRadius: "50%", animation: "spin 1s linear infinite" },
};
