import { GoogleLogin } from "@react-oauth/google";

export default function LoginPage({ onLogin }) {
  async function handleSuccess(credentialResponse) {
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "เกิดข้อผิดพลาด");
        return;
      }
      localStorage.setItem("admin_token", data.token);
      localStorage.setItem("admin_email", data.email);
      localStorage.setItem("admin_name", data.name || "");
      localStorage.setItem("admin_permissions", JSON.stringify(data.permissions ?? null));
      onLogin({ token: data.token, email: data.email, name: data.name, permissions: data.permissions ?? null });
    } catch {
      alert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    }
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#f4f4f8",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "system-ui, sans-serif",
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: "48px 40px",
        boxShadow: "0 4px 24px #0002", textAlign: "center", maxWidth: 360, width: "100%",
      }}>
        <img src="/logo-brand-new.png" alt="THE STANDARD" style={{ height: 100, marginBottom: 12, display: "block", margin: "0 auto 12px" }} />
        <h2 style={{ margin: "0 0 6px", color: "#1a1a2e", fontSize: 22, fontWeight: 700 }}>
          THE STANDARD Service
        </h2>
        <p style={{ margin: "0 0 32px", color: "#888", fontSize: 14 }}>
          Admin Console
        </p>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => alert("Google Sign-In ล้มเหลว")}
            text="signin_with"
            shape="rectangular"
            locale="th"
          />
        </div>
        <p style={{ marginTop: 24, fontSize: 12, color: "#bbb" }}>
          เฉพาะบัญชีที่ได้รับอนุญาตเท่านั้น
        </p>
      </div>
    </div>
  );
}
