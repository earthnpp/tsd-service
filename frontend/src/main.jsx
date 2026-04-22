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

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

const path = window.location.pathname;
const isLiffBooking  = path.startsWith("/liff/booking");
const isLiffCalendar = path.startsWith("/liff/calendar");
const isLiffAI       = path.startsWith("/liff/ai");
const isLiff         = path.startsWith("/liff");

function AdminRoot() {
  const [user, setUser] = useState(() => {
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
    setUser(null);
  }

  if (!user) return <LoginPage onLogin={handleLogin} />;
  return <App user={user} onLogout={handleLogout} />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {isLiffCalendar ? <LiffCalendar />
      : isLiffBooking ? <LiffBooking />
      : isLiffAI ? <LiffAI />
      : isLiff ? <LiffApp />
      : (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
          <AdminRoot />
        </GoogleOAuthProvider>
      )
    }
  </StrictMode>
);
