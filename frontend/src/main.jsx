import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import LiffApp from "./LiffApp";
import LiffBooking from "./LiffBooking";
import LiffCalendar from "./LiffCalendar";

const path = window.location.pathname;
const isLiffBooking  = path.startsWith("/liff/booking");
const isLiffCalendar = path.startsWith("/liff/calendar");
const isLiff         = path.startsWith("/liff");

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {isLiffCalendar ? <LiffCalendar />
      : isLiffBooking ? <LiffBooking />
      : isLiff ? <LiffApp />
      : <App />}
  </StrictMode>
);
