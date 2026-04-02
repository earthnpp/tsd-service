import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import LiffApp from "./LiffApp";
import LiffBooking from "./LiffBooking";

const path = window.location.pathname;
const isLiffBooking = path.startsWith("/liff/booking");
const isLiff = path.startsWith("/liff");

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {isLiffBooking ? <LiffBooking /> : isLiff ? <LiffApp /> : <App />}
  </StrictMode>
);
