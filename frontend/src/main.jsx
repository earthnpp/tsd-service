import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import LiffApp from "./LiffApp";

const isLiff = window.location.pathname.startsWith("/liff");

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {isLiff ? <LiffApp /> : <App />}
  </StrictMode>
);
