import { useState, useEffect } from "react";
import { GoogleLogin } from "@react-oauth/google";

const STORAGE_KEY = "portal_token";
const STORAGE_USER = "portal_user";

function saveSession(data) {
  localStorage.setItem(STORAGE_KEY, data.token);
  localStorage.setItem(STORAGE_USER, JSON.stringify({ email: data.email, name: data.name, picture: data.picture, isAdmin: data.isAdmin, adminPermissions: data.adminPermissions }));
}
function loadSession() {
  const token = localStorage.getItem(STORAGE_KEY);
  const raw = localStorage.getItem(STORAGE_USER);
  if (!token || !raw) return null;
  try { return { token, ...JSON.parse(raw) }; } catch { return null; }
}
function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_USER);
}

// ── Login Page ────────────────────────────────────────────────
function PortalLogin({ onLogin }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSuccess(credentialResponse) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/portal/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "เกิดข้อผิดพลาด"); return; }
      saveSession(data);
      onLogin(data);
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f2544 0%, #1a3a5c 60%, #1d4e89 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", padding: 20 }}>
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <img src="/logo.png" alt="The Standard" style={{ height: 60, marginBottom: 16, filter: "brightness(0) invert(1)" }} />
        <p style={{ margin: 0, color: "#a8c8e8", fontSize: 15 }}>Service Portal</p>
      </div>

      <div style={{ background: "#fff", borderRadius: 20, padding: "36px 32px", boxShadow: "0 8px 40px #0004", textAlign: "center", maxWidth: 360, width: "100%" }}>
        <h2 style={{ margin: "0 0 6px", color: "#1a1a2e", fontSize: 18, fontWeight: 700 }}>เข้าสู่ระบบ</h2>
        <p style={{ margin: "0 0 24px", color: "#888", fontSize: 13 }}>ใช้บัญชี @thestandard.co</p>

        {loading ? (
          <p style={{ color: "#888", fontSize: 14 }}>⏳ กำลังยืนยัน...</p>
        ) : (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <GoogleLogin
              onSuccess={handleSuccess}
              onError={() => setError("Google Sign-In ล้มเหลว")}
              text="signin_with"
              shape="rectangular"
              locale="th"
            />
          </div>
        )}

        {error && <p style={{ marginTop: 16, color: "#e63946", fontSize: 13 }}>{error}</p>}
      </div>
    </div>
  );
}

// ── Service Card ──────────────────────────────────────────────
function ServiceCard({ card }) {
  const isExternal = card.url.startsWith("http");
  const isPlaceholder = card.url === "#";

  function handleClick() {
    if (isPlaceholder) return;
    if (isExternal) window.open(card.url, "_blank", "noopener");
    else window.location.href = card.url;
  }

  return (
    <div
      onClick={handleClick}
      style={{
        background: "#fff",
        borderRadius: 16,
        padding: "24px 20px",
        cursor: isPlaceholder ? "default" : "pointer",
        transition: "transform 0.15s, box-shadow 0.15s",
        boxShadow: "0 2px 12px #0001",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        opacity: isPlaceholder ? 0.55 : 1,
        position: "relative",
        overflow: "hidden",
        borderTop: `4px solid ${card.color || "#1a3a5c"}`,
      }}
      onMouseEnter={e => { if (!isPlaceholder) { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 24px #0002"; } }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 2px 12px #0001"; }}
    >
      <div style={{ fontSize: 36 }}>{card.icon}</div>
      <div style={{ fontWeight: 700, fontSize: 16, color: "#1a1a2e" }}>{card.title}</div>
      {card.description && (
        <div style={{ fontSize: 13, color: "#666", lineHeight: 1.5 }}>{card.description}</div>
      )}
      {isPlaceholder && (
        <div style={{ position: "absolute", top: 8, right: 10, fontSize: 11, color: "#aaa", fontWeight: 600 }}>เร็วๆ นี้</div>
      )}
    </div>
  );
}

// ── Main Portal ───────────────────────────────────────────────
export default function PortalApp() {
  const [user, setUser] = useState(() => loadSession());
  const [cards, setCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoadingCards(true);
    fetch("/api/portal/cards", {
      headers: { "x-portal-token": user.token },
    })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setCards(data); })
      .catch(() => {})
      .finally(() => setLoadingCards(false));
  }, [user]);

  function handleLogin(data) {
    setUser({ token: data.token, email: data.email, name: data.name, picture: data.picture, isAdmin: data.isAdmin, adminPermissions: data.adminPermissions });
  }

  function handleLogout() {
    clearSession();
    setUser(null);
    setCards([]);
  }

  function goToAdmin() {
    // ส่ง admin token ผ่าน sessionStorage เพื่อใช้ใน /admin
    const adminToken = user.token;
    sessionStorage.setItem("admin_token_from_portal", adminToken);
    window.location.href = "/admin";
  }

  if (!user) return <PortalLogin onLogin={handleLogin} />;

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <header style={{ background: "linear-gradient(90deg, #0f2544 0%, #1a3a5c 100%)", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo.png" alt="The Standard" style={{ height: 28, filter: "brightness(0) invert(1)" }} />
          <span style={{ color: "#a8c8e8", fontSize: 13, borderLeft: "1px solid #457b9d", paddingLeft: 12 }}>Service Portal</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {user.isAdmin && (
            <button onClick={goToAdmin} style={{ fontSize: 13, padding: "6px 14px", borderRadius: 20, background: "#e63946", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}>
              ⚙️ Admin Console
            </button>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {user.picture && <img src={user.picture} referrerPolicy="no-referrer" style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #457b9d" }} />}
            <span style={{ color: "#a8c8e8", fontSize: 13 }}>{user.name || user.email}</span>
          </div>
          <button onClick={handleLogout} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 20, background: "transparent", color: "#a8c8e8", border: "1px solid #457b9d", cursor: "pointer" }}>
            ออกจากระบบ
          </button>
        </div>
      </header>

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #0f2544 0%, #1a3a5c 100%)", padding: "40px 24px 48px", textAlign: "center" }}>
        <h1 style={{ margin: 0, color: "#fff", fontSize: 26, fontWeight: 800 }}>ยินดีต้อนรับ, {user.name?.split(" ")[0] || "คุณ"} 👋</h1>
        <p style={{ margin: "8px 0 0", color: "#a8c8e8", fontSize: 15 }}>เลือก Service ที่ต้องการใช้งาน</p>
      </div>

      {/* Cards Grid */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 20px" }}>
        {loadingCards ? (
          <p style={{ textAlign: "center", color: "#888" }}>⏳ กำลังโหลด...</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 20 }}>
            {cards.map(card => <ServiceCard key={card.id} card={card} />)}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{ textAlign: "center", padding: "24px", color: "#aaa", fontSize: 12 }}>
        © {new Date().getFullYear()} The Standard · IT Department
      </footer>
    </div>
  );
}
