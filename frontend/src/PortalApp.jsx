import { useState, useEffect } from "react";
import { GoogleLogin } from "@react-oauth/google";

const STORAGE_KEY = "portal_token";
const STORAGE_USER = "portal_user";
const RED = "#CC0000";
const BLACK = "#111111";

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
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_email");
  localStorage.removeItem("admin_name");
  localStorage.removeItem("admin_permissions");
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
    <div style={{ minHeight: "100vh", background: "#F5F5F5", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 4, padding: "40px 36px", boxShadow: "0 4px 24px rgba(0,0,0,0.10)", textAlign: "center", maxWidth: 380, width: "100%" }}>
        <img src="/logo-brand.png" alt="The Standard" style={{ height: 100, marginBottom: 0, display: "block", margin: "0 auto 0" }} />
        <div style={{ height: 3, background: RED, width: 48, margin: "14px auto 24px" }} />

        <h2 style={{ margin: "0 0 6px", color: BLACK, fontSize: 17, fontWeight: 700 }}>เข้าสู่ระบบ Service Portal</h2>
        <p style={{ margin: "0 0 24px", color: "#777", fontSize: 13 }}>ใช้บัญชี @thestandard.co</p>

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

        {error && <p style={{ marginTop: 16, color: RED, fontSize: 13 }}>{error}</p>}
      </div>
      <p style={{ marginTop: 20, color: "#aaa", fontSize: 12 }}>© {new Date().getFullYear()} The Standard · IT Department</p>
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
        borderRadius: 4,
        padding: "24px 20px",
        cursor: isPlaceholder ? "default" : "pointer",
        transition: "transform 0.15s, box-shadow 0.15s",
        boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        opacity: isPlaceholder ? 0.5 : 1,
        position: "relative",
        overflow: "hidden",
        borderTop: `4px solid ${card.color || RED}`,
      }}
      onMouseEnter={e => { if (!isPlaceholder) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.12)"; } }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 1px 6px rgba(0,0,0,0.07)"; }}
    >
      <div style={{ fontSize: 32 }}>{card.icon}</div>
      <div style={{ fontWeight: 700, fontSize: 15, color: BLACK }}>{card.title}</div>
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
  const [logoutConfirm, setLogoutConfirm] = useState(false);

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
    setLogoutConfirm(false);
  }

  function goToAdmin() {
    const adminToken = user.token;
    sessionStorage.setItem("admin_token_from_portal", adminToken);
    window.location.href = "/admin";
  }

  if (!user) return <PortalLogin onLogin={handleLogin} />;

  return (
    <div style={{ minHeight: "100vh", background: "#F5F5F5", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <header style={{ background: BLACK, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, position: "sticky", top: 0, zIndex: 100 }}>
        <img src="/logo-brand.png" alt="The Standard" style={{ height: 24, filter: "brightness(0) invert(1)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {user.isAdmin && (
            <button onClick={goToAdmin} style={{ fontSize: 13, padding: "6px 14px", borderRadius: 2, background: RED, color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}>
              ⚙️ Admin
            </button>
          )}
          {user.picture && <img src={user.picture} referrerPolicy="no-referrer" style={{ width: 28, height: 28, borderRadius: "50%", border: `2px solid ${RED}` }} />}
          <span style={{ color: "#ccc", fontSize: 13 }}>{user.name?.split(" ")[0] || user.email}</span>

          {logoutConfirm ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#222", borderRadius: 2, padding: "4px 8px" }}>
              <span style={{ color: "#ccc", fontSize: 12 }}>ออกจากระบบ?</span>
              <button onClick={handleLogout} style={{ background: RED, color: "#fff", border: "none", borderRadius: 2, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>ยืนยัน</button>
              <button onClick={() => setLogoutConfirm(false)} style={{ background: "transparent", color: "#aaa", border: "1px solid #444", borderRadius: 2, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}>ยกเลิก</button>
            </div>
          ) : (
            <button onClick={() => setLogoutConfirm(true)} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 2, background: "transparent", color: "#aaa", border: "1px solid #444", cursor: "pointer" }}>
              ออกจากระบบ
            </button>
          )}
        </div>
      </header>

      {/* Hero */}
      <div style={{ background: BLACK, padding: "48px 24px 52px", textAlign: "center" }}>
        <h1 style={{ margin: "0 0 8px", color: "#fff", fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>
          สวัสดี, {user.name?.split(" ")[0] || "คุณ"}
        </h1>
        <div style={{ height: 3, background: RED, width: 40, margin: "0 auto 12px" }} />
        <p style={{ margin: 0, color: "#888", fontSize: 15 }}>เลือก Service ที่ต้องการใช้งาน</p>
      </div>

      {/* Cards Grid */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 20px 48px" }}>
        {loadingCards ? (
          <p style={{ textAlign: "center", color: "#aaa" }}>⏳ กำลังโหลด...</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
            {cards.map(card => <ServiceCard key={card.id} card={card} />)}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{ textAlign: "center", padding: "20px", color: "#bbb", fontSize: 12, background: BLACK }}>
        © {new Date().getFullYear()} The Standard · IT Department
      </footer>
    </div>
  );
}
