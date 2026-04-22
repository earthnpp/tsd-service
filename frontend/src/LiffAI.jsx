import { useState, useEffect, useRef } from "react";
import liff from "@line/liff";

const LIFF_ID = import.meta.env.VITE_LIFF_ID;

export default function LiffAI() {
  const [ready, setReady]       = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "สวัสดีครับ 👋 มีปัญหา IT อะไรให้ช่วยไหมครับ?" },
  ]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const bottomRef               = useRef(null);

  useEffect(() => {
    liff.init({ liffId: LIFF_ID })
      .then(() => { if (!liff.isLoggedIn()) { liff.login(); return; } setReady(true); })
      .catch(() => setReady(true));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError("");

    const updated = [...messages, { role: "user", content: text }];
    setMessages(updated);
    setLoading(true);

    try {
      const res = await fetch("/api/liff/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updated.map(m => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
      setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  function openTicket() {
    liff.openWindow({ url: `https://liff.line.me/${LIFF_ID}`, external: false });
  }

  if (!ready) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f4f6" }}>
      <p style={{ color: "#888" }}>⏳ กำลังโหลด...</p>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#f4f4f6", fontFamily: "system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ background: "#1a3a5c", padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#457b9d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🤖</div>
        <div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>IT Assistant</div>
          <div style={{ color: "#a8c8e8", fontSize: 11 }}>ผู้ช่วย IT Support เบื้องต้น</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            {m.role === "assistant" && (
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1a3a5c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, marginRight: 8, flexShrink: 0, alignSelf: "flex-end" }}>🤖</div>
            )}
            <div style={{
              maxWidth: "72%", padding: "10px 14px", borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              background: m.role === "user" ? "#1a3a5c" : "#fff",
              color: m.role === "user" ? "#fff" : "#1a1a2e",
              fontSize: 14, lineHeight: 1.6,
              boxShadow: "0 1px 3px #0001",
              whiteSpace: "pre-wrap",
            }}>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1a3a5c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🤖</div>
            <div style={{ background: "#fff", borderRadius: "18px 18px 18px 4px", padding: "10px 16px", boxShadow: "0 1px 3px #0001" }}>
              <span style={{ display: "inline-flex", gap: 4 }}>
                {[0, 1, 2].map(n => (
                  <span key={n} style={{ width: 6, height: 6, borderRadius: "50%", background: "#aaa", display: "inline-block", animation: `bounce 1s ${n * 0.2}s infinite` }} />
                ))}
              </span>
            </div>
          </div>
        )}

        {error && <p style={{ color: "#e63946", fontSize: 13, textAlign: "center" }}>{error}</p>}
        <div ref={bottomRef} />
      </div>

      {/* Ticket suggestion */}
      <div style={{ padding: "6px 12px", borderTop: "1px solid #e8e8e8", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: "#aaa" }}>แก้ไม่ได้? แจ้ง Ticket</span>
        <button onClick={openTicket} style={{ fontSize: 12, padding: "5px 14px", borderRadius: 20, background: "#e63946", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}>
          🎫 แจ้ง Ticket
        </button>
      </div>

      {/* Input */}
      <div style={{ padding: "10px 12px", background: "#fff", display: "flex", gap: 8, borderTop: "1px solid #eee", flexShrink: 0 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="พิมพ์คำถาม IT ของคุณ..."
          disabled={loading}
          style={{ flex: 1, border: "1px solid #ddd", borderRadius: 24, padding: "10px 16px", fontSize: 14, outline: "none", background: "#f9f9f9" }}
        />
        <button onClick={send} disabled={loading || !input.trim()} style={{
          width: 42, height: 42, borderRadius: "50%", background: input.trim() && !loading ? "#1a3a5c" : "#ddd",
          border: "none", cursor: input.trim() && !loading ? "pointer" : "default",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0,
        }}>➤</button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
