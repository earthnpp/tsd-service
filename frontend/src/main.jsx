import { StrictMode, useState } from "react";
import "./index.css";
import { createRoot } from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App";
import LiffApp from "./LiffApp";
import LiffBooking from "./LiffBooking";
import LiffCalendar from "./LiffCalendar";
import LiffAI from "./LiffAI";
import LoginPage from "./LoginPage";
import PortalApp from "./PortalApp";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

const path = window.location.pathname;
const isLiffBooking  = path.startsWith("/liff/booking");
const isLiffCalendar = path.startsWith("/liff/calendar");
const isLiffAI       = path.startsWith("/liff/ai");
const isLiff         = path.startsWith("/liff");
const isAdmin        = path.startsWith("/admin");

function AdminRoot() {
  const [user, setUser] = useState(() => {
    // รองรับ token ที่ส่งมาจาก Portal
    const fromPortal = sessionStorage.getItem("admin_token_from_portal");
    if (fromPortal) {
      sessionStorage.removeItem("admin_token_from_portal");
      localStorage.setItem("admin_token", fromPortal);
    }
    const token = localStorage.getItem("admin_token");
    const email = localStorage.getItem("admin_email");
    const name  = localStorage.getItem("admin_name");
    const raw   = localStorage.getItem("admin_permissions");
    const permissions = raw === "null" ? null : (raw ? JSON.parse(raw) : null);
    return token ? { token, email, name, permissions } : null;
  });

  function handleLogin(userData) {
    setUser(userData);
  }

  function handleLogout() {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_email");
    localStorage.removeItem("admin_name");
    localStorage.removeItem("admin_permissions");
    window.location.href = "/";
  }

  if (!user) return <LoginPage onLogin={handleLogin} />;
  return <App user={user} onLogout={handleLogout} />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      {isLiffCalendar ? <LiffCalendar />
        : isLiffBooking ? <LiffBooking />
        : isLiffAI ? <LiffAI />
        : isLiff ? <LiffApp />
        : isAdmin ? <AdminRoot />
        : <PortalApp />
      }
    </GoogleOAuthProvider>
  </StrictMode>
);
