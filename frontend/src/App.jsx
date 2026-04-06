import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "./services/api";

const STATUS = {
  pending:     { label: "รอดำเนินการ",    color: "#e9c46a", bg: "#fff8e1", icon: "🟡" },
  in_progress: { label: "กำลังดำเนินการ", color: "#457b9d", bg: "#e3f2fd", icon: "🔵" },
  completed:   { label: "เสร็จสิ้น",       color: "#2a9d8f", bg: "#e8f5e9", icon: "🟢" },
};
const PRIORITY = {
  critical: { label: "Critical", color: "#d00000" },
  high:     { label: "High",     color: "#e63946" },
  medium:   { label: "Medium",   color: "#e9c46a" },
  low:      { label: "Low",      color: "#2a9d8f" },
};
const PAGE_SIZES = [20, 50, 100];

function Badge({ map, value }) {
  const m = map[value] || { label: value, color: "#999", bg: "#eee" };
  return (
    <span style={{ background: m.bg || "#eee", color: m.color, border: `1px solid ${m.color}`,
      borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>
      {m.icon ? `${m.icon} ${m.label}` : m.label}
    </span>
  );
}

function Stars({ value }) {
  return <span style={{ color: "#f4a261", fontSize: 16 }}>{"⭐".repeat(value || 0)}</span>;
}

export default function App({ user, onLogout }) {
  const [tab, setTab] = useState(() => window.location.hash.replace("#", "") || "tickets");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const changeTab = useCallback((t) => {
    setTab(t);
    window.location.hash = t;
    setSidebarOpen(false);
  }, []);
  const [tickets, setTickets] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);

  const [filterStatus, setFilterStatus]     = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [searchInput, setSearchInput]       = useState("");
  const [search, setSearch]                 = useState("");
  const [page, setPage]                     = useState(1);
  const [pageSize, setPageSize]             = useState(20);

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [resolution, setResolution]         = useState("");
  const [loading, setLoading]               = useState(false);
  const [assignees, setAssignees]           = useState([]);

  const loadAssignees = useCallback(async () => { try { setAssignees(await api.getAssignees()); } catch {} }, []);
  useEffect(() => { loadAssignees(); }, [loadAssignees]);

  // Debounce search
  const debounceRef = useRef(null);
  function handleSearchInput(val) {
    setSearchInput(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setSearch(val); setPage(1); }, 500);
  }

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getTickets({
        status: filterStatus, category: filterCategory,
        search: search || undefined, page, limit: pageSize,
      });
      setTickets(result.tickets);
      setTotal(result.total);
    } catch { /* silent */ }
    setLoading(false);
  }, [filterStatus, filterCategory, search, page, pageSize]);

  const [statDateFrom, setStatDateFrom] = useState("");
  const [statDateTo,   setStatDateTo]   = useState("");

  const loadStats = useCallback(async (from, to) => {
    try { setStats(await api.getStats({ dateFrom: from, dateTo: to })); } catch {}
  }, []);
  const loadCategories = useCallback(async () => { try { setCategories(await api.getCategories()); } catch {} }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);
  useEffect(() => { if (tab === "dashboard") loadStats(statDateFrom, statDateTo); }, [tab, loadStats, statDateFrom, statDateTo]);
  useEffect(() => { loadCategories(); }, [loadCategories]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [filterStatus, filterCategory, pageSize]);

  async function handleAssign(id, assignee) {
    await api.assignTicket(id, assignee);
    const updated = await api.getTicket(id);
    setSelectedTicket(updated);
    setTickets((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }

  async function handleClose(id) {
    if (!resolution.trim()) return alert("กรุณาระบุวิธีแก้ไข");
    await api.closeTicket(id, resolution);
    const updated = await api.getTicket(id);
    setSelectedTicket(updated);
    setTickets((prev) => prev.map((t) => (t.id === id ? updated : t)));
    setResolution("");
  }

  async function exportCSV() {
    const all = await api.exportTickets({ status: filterStatus, category: filterCategory, search });
    const headers = ["ticketNo","title","category","subcategory","location","status","priority",
      "assignee","displayName","assetTag","createdAt","completedAt","rating"];
    const rows = all.map((t) => headers.map((h) => `"${(t[h] ?? "").toString().replace(/"/g,'""')}"`).join(","));
    const blob = new Blob([headers.join(",") + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "tickets.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const TABS = [
    { key: "tickets",   label: "🎫 Tickets" },
    { key: "bookings",  label: "🏢 ห้องประชุม" },
    { key: "dashboard", label: "📊 Dashboard" },
    { key: "settings",  label: "⚙️ Settings" },
    { key: "users",     label: "👥 Users" },
    { key: "export",    label: "📥 Export" },
  ];

  return (
    <div className="app-layout">

      {/* Hamburger (mobile) */}
      <button className="hamburger" onClick={() => setSidebarOpen(o => !o)}>☰</button>

      {/* Overlay (mobile) */}
      <div className={`sidebar-overlay${sidebarOpen ? " open" : ""}`} onClick={() => setSidebarOpen(false)} />

      {/* ── Sidebar ── */}
      <div className={`sidebar${sidebarOpen ? " open" : ""}`}>
        {/* Logo */}
        <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid #ffffff18" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#fff", lineHeight: 1.3 }}>
            🖥️ Standard Service
          </div>
          <div style={{ fontSize: 11, color: "#aaa", marginTop: 3 }}>Admin Console</div>
        </div>

        {/* Menu */}
        <nav style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => changeTab(key)} style={{
              display: "block", width: "100%", textAlign: "left",
              background: tab === key ? "#e63946" : "transparent",
              color: tab === key ? "#fff" : "#ccc",
              border: "none", borderRadius: 8, padding: "9px 14px",
              cursor: "pointer", fontSize: 14, fontWeight: tab === key ? 600 : 400,
              transition: "background 0.15s",
            }}
              onMouseEnter={e => { if (tab !== key) e.currentTarget.style.background = "#ffffff14"; }}
              onMouseLeave={e => { if (tab !== key) e.currentTarget.style.background = "transparent"; }}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* User + Logout */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid #ffffff18" }}>
          <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8, wordBreak: "break-all" }}>
            {user?.name || user?.email}
          </div>
          <button onClick={onLogout} style={{
            width: "100%", background: "transparent", color: "#f4a261",
            border: "1px solid #f4a26155", borderRadius: 6, padding: "6px 0",
            cursor: "pointer", fontSize: 13,
          }}>
            ออกจากระบบ
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="main-content">
        {tab === "tickets" && !selectedTicket && (
          <TicketList
            tickets={tickets} loading={loading} total={total}
            filterStatus={filterStatus} setFilterStatus={setFilterStatus}
            filterCategory={filterCategory} setFilterCategory={setFilterCategory}
            categories={categories}
            searchInput={searchInput} onSearch={handleSearchInput}
            page={page} setPage={setPage}
            pageSize={pageSize} setPageSize={setPageSize}
            onSelect={setSelectedTicket}
          />
        )}
        {tab === "tickets" && selectedTicket && (
          <TicketDetail ticket={selectedTicket} resolution={resolution}
            setResolution={setResolution} onAssign={handleAssign}
            onClose={handleClose} assignees={assignees}
            onBack={() => { setSelectedTicket(null); loadTickets(); }}
            onRefresh={async () => { const t = await api.getTicket(selectedTicket.id); setSelectedTicket(t); }} />
        )}
        {tab === "bookings"  && <BookingsPanel />}
        {tab === "dashboard" && <Dashboard stats={stats} dateFrom={statDateFrom} dateTo={statDateTo} setDateFrom={setStatDateFrom} setDateTo={setStatDateTo} />}
        {tab === "settings"  && <SettingsPanel categories={categories} onReload={loadCategories} assignees={assignees} onReloadAssignees={loadAssignees} />}
        {tab === "users"     && <UsersPanel />}
        {tab === "export"    && <ExportPanel total={total} onExport={exportCSV} />}
      </div>
    </div>
  );
}

// ── Ticket List ──────────────────────────────────────────
function TicketList({ tickets, loading, total, filterStatus, setFilterStatus,
  filterCategory, setFilterCategory, categories, searchInput, onSearch,
  page, setPage, pageSize, setPageSize, onSelect }) {

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      {/* Search */}
      <div style={{ background: "#fff", borderRadius: 10, padding: "12px 16px",
        marginBottom: 12, boxShadow: "0 1px 4px #0001", display: "flex", gap: 10, alignItems: "center" }}>
        <input value={searchInput} onChange={(e) => onSearch(e.target.value)}
          placeholder="🔍 ค้นหา Ticket No, ชื่อปัญหา, ผู้แจ้ง..."
          style={{ flex: 1, border: "1px solid #ddd", borderRadius: 8, padding: "8px 12px",
            fontSize: 14, outline: "none" }} />
        {searchInput && (
          <button onClick={() => onSearch("")}
            style={{ border: "none", background: "#eee", borderRadius: 6, padding: "6px 12px",
              cursor: "pointer", fontSize: 13 }}>✕ ล้าง</button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        {["all","pending","in_progress","completed"].map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)}
            style={{ padding: "6px 14px", borderRadius: 999, cursor: "pointer", fontWeight: 600, fontSize: 13,
              background: filterStatus === s ? "#1a1a2e" : "#fff",
              color: filterStatus === s ? "#fff" : "#333", border: "1px solid #ddd" }}>
            {{ all:"ทั้งหมด", pending:"🟡 รอ", in_progress:"🔵 กำลังดำเนินการ", completed:"🟢 เสร็จ" }[s]}
          </button>
        ))}
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
          style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #ddd",
            fontSize: 13, background: "#fff", cursor: "pointer" }}>
          <option value="all">📂 ทุกหมวด</option>
          {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#888" }}>
          ทั้งหมด <strong>{total}</strong> รายการ
        </span>
      </div>

      {/* List */}
      {loading ? <p style={{ textAlign: "center", color: "#888", padding: 32 }}>⏳ กำลังโหลด...</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tickets.map((t) => (
            <div key={t.id} onClick={() => onSelect(t)}
              className="ticket-card"
              style={{ borderLeftColor: STATUS[t.status]?.color || "#ccc" }}>
              {/* Row 1: ticket no + badges */}
              <div className="ticket-top">
                <span className="ticket-no">#{t.ticketNo}</span>
                <div className="ticket-badges">
                  <Badge map={STATUS} value={t.status} />
                  {t.priority && <Badge map={PRIORITY} value={t.priority} />}
                </div>
              </div>
              {/* Row 2: title */}
              <div className="ticket-title">{t.title}</div>
              {/* Row 3: meta */}
              <div className="ticket-meta">
                <span className="ticket-meta-item">📁 {t.category}{t.subcategory ? ` › ${t.subcategory}` : ""}</span>
                {t.location && <span className="ticket-meta-item">📍 {t.location}</span>}
                <span className="ticket-meta-item">👤 {t.displayName || "-"}</span>
                {t.assignee
                  ? <span className="ticket-meta-item ticket-assignee">👷 {t.assignee}</span>
                  : <span className="ticket-meta-item" style={{ color: "#f4a261" }}>⚠️ ยังไม่ assign</span>}
                <span className="ticket-meta-item">🕐 {new Date(t.createdAt).toLocaleDateString("th-TH", { day:"numeric", month:"short", year:"2-digit" })}</span>
              </div>
            </div>
          ))}
          {tickets.length === 0 && <p style={{ color: "#999", textAlign: "center", padding: 32 }}>ไม่มี Ticket</p>}
        </div>
      )}

      {/* Pagination */}
      {total > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
          marginTop: 16, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button onClick={() => setPage(1)} disabled={page === 1} style={pageBtnStyle(page === 1)}>«</button>
            <button onClick={() => setPage(page - 1)} disabled={page === 1} style={pageBtnStyle(page === 1)}>‹</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.min(Math.max(page - 2, 1) + i, totalPages);
              return (
                <button key={p} onClick={() => setPage(p)} style={pageBtnStyle(false, p === page)}>
                  {p}
                </button>
              );
            })}
            <button onClick={() => setPage(page + 1)} disabled={page >= totalPages} style={pageBtnStyle(page >= totalPages)}>›</button>
            <button onClick={() => setPage(totalPages)} disabled={page >= totalPages} style={pageBtnStyle(page >= totalPages)}>»</button>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
            <span style={{ color: "#666" }}>หน้า {page}/{totalPages}</span>
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}
              style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 }}>
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} รายการ/หน้า</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

function pageBtnStyle(disabled, active = false) {
  return {
    padding: "5px 10px", borderRadius: 6, border: "1px solid #ddd", cursor: disabled ? "default" : "pointer",
    background: active ? "#1a1a2e" : "#fff", color: active ? "#fff" : disabled ? "#ccc" : "#333",
    fontWeight: active ? 700 : 400, fontSize: 13,
  };
}

// ── Ticket Detail ─────────────────────────────────────────
function parseCostItems(raw) {
  try { const arr = JSON.parse(raw); if (Array.isArray(arr)) return arr; } catch {}
  return [{ desc: raw || "", amount: "", vat: "" }];
}

function TicketDetail({ ticket: t, resolution, setResolution, onAssign, onClose, onBack, onRefresh, assignees }) {
  const [editStatus, setEditStatus]   = useState(false);
  const [newStatus, setNewStatus]     = useState(t.status);
  const [newPriority, setNewPriority] = useState(t.priority || "");
  const [workStart, setWorkStart]     = useState(t.workStartAt ? t.workStartAt.slice(0, 16) : "");
  const [showCost, setShowCost]       = useState(t.hasCost || false);
  const [costItems, setCostItems]     = useState(parseCostItems(t.costDescription));
  const [vendor, setVendor]           = useState(t.repairVendor || "");
  const [savingCost, setSavingCost]   = useState(false);
  const [toast, setToast]             = useState("");
  const [closeResolution, setCloseResolution] = useState(t.resolution || "");

  const activeAssignees = assignees.filter((a) => a.isActive);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function updateItem(i, field, val) {
    setCostItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  }

  function addItem() {
    setCostItems((prev) => [...prev, { desc: "", amount: "", vat: "" }]);
  }

  function removeItem(i) {
    setCostItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  const totalAmount = costItems.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalVat    = costItems.reduce((s, r) => s + (Number(r.vat) || 0), 0);
  const totalCost   = totalAmount + totalVat;

  function buildCostPayload() {
    return {
      hasCost: showCost,
      costDescription: showCost ? JSON.stringify(costItems) : null,
      costAmount: showCost ? totalAmount : null,
      costVat: showCost ? totalVat : null,
      repairVendor: vendor || null,
    };
  }

  async function saveStatus() {
    await api.updateTicketStatus(t.id, {
      status: newStatus,
      priority: newPriority || null,
      workStartAt: workStart || null,
    });
    setEditStatus(false);
    onRefresh();
  }

  async function saveCost() {
    setSavingCost(true);
    await api.updateTicketCost(t.id, buildCostPayload());
    setSavingCost(false);
    showToast("✅ บันทึกค่าใช้จ่ายเรียบร้อยแล้ว");
    onRefresh();
  }

  async function handleCloseWithCost() {
    if (!closeResolution.trim()) { showToast("❌ กรุณาระบุสรุปการแก้ไขก่อนปิดงาน"); return; }
    setSavingCost(true);
    await api.closeWithCost(t.id, { resolution: closeResolution, ...buildCostPayload() });
    setSavingCost(false);
    showToast("✅ ปิดงานและบันทึกค่าใช้จ่ายเรียบร้อย");
    onRefresh();
  }

  return (
    <div>
      <button onClick={onBack} style={{ marginBottom: 16, background: "none", border: "none",
        color: "#457b9d", cursor: "pointer", fontSize: 15, fontWeight: 600 }}>← กลับ</button>
      <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 6px #0001" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h2 style={{ margin: 0 }}>{t.ticketNo}</h2>
            <p style={{ margin: "4px 0 0", color: "#555" }}>{t.title}</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Badge map={STATUS} value={t.status} />
            {t.priority && <Badge map={PRIORITY} value={t.priority} />}
            <button onClick={() => setEditStatus(!editStatus)}
              style={smallBtn("#457b9d")}>⚙️ แก้ไขสถานะ</button>
          </div>
        </div>

        {/* Status / Priority / WorkStart editor */}
        {editStatus && (
          <div style={{ marginTop: 14, background: "#f0f4f8", borderRadius: 10, padding: 16,
            display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>สถานะ</label>
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} style={{ ...inputStyle, fontSize: 13 }}>
                <option value="pending">🟡 รอดำเนินการ</option>
                <option value="in_progress">🔵 กำลังดำเนินการ</option>
                <option value="completed">🟢 เสร็จสิ้น</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>ความเร่งด่วน</label>
              <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)} style={{ ...inputStyle, fontSize: 13 }}>
                <option value="">— ยังไม่ประเมิน —</option>
                <option value="critical">🔴 Critical</option>
                <option value="high">🟠 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>เริ่มดำเนินการ</label>
              <input type="datetime-local" value={workStart} onChange={(e) => setWorkStart(e.target.value)}
                style={{ ...inputStyle, fontSize: 13 }} />
            </div>
            <button onClick={saveStatus} style={btnStyle("#2a9d8f")}>บันทึก</button>
            <button onClick={() => setEditStatus(false)} style={btnStyle("#999")}>ยกเลิก</button>
          </div>
        )}

        <hr style={{ margin: "16px 0", borderColor: "#eee" }} />

        {/* Info grid */}
        <div className="ticket-meta" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 14 }}>
          {[
            ["หมวดหมู่", `${t.category} › ${t.subcategory}`],
            ["สถานที่", t.location],
            ["Asset Tag", t.assetTag || "-"],
            ["ผู้แจ้ง", t.displayName || "-"],
            ["อีเมล", t.email || "-"],
            ["ฝ่าย/แผนก", t.department || "-"],
            ["เวลาแจ้ง", new Date(t.createdAt).toLocaleString("th-TH")],
            ["ผู้รับผิดชอบ", t.assignee || "-"],
            t.workStartAt ? ["เริ่มดำเนินการ", new Date(t.workStartAt).toLocaleString("th-TH")] : null,
            t.completedAt ? ["เสร็จสิ้นเมื่อ", new Date(t.completedAt).toLocaleString("th-TH")] : null,
          ].filter(Boolean).map(([k, v]) => (
            <div key={k}><span style={{ color: "#999" }}>{k}: </span><strong>{v}</strong></div>
          ))}
        </div>

        {/* Description */}
        <div style={{ marginTop: 16, background: "#f9f9f9", borderRadius: 8, padding: 14, fontSize: 14 }}>
          <strong>รายละเอียดปัญหา:</strong>
          <p style={{ margin: "6px 0 0" }}>{t.description}</p>
        </div>

        {/* Image attachment */}
        {t.imageUrl && (
          <div style={{ marginTop: 12 }}>
            <strong style={{ fontSize: 13, color: "#555" }}>📷 รูปภาพที่แนบมา:</strong>
            <div style={{ marginTop: 8 }}>
              <a href={t.imageUrl} target="_blank" rel="noreferrer">
                <img src={t.imageUrl} alt="ticket attachment"
                  style={{ maxWidth: "100%", maxHeight: 320, borderRadius: 8, border: "1px solid #eee", cursor: "pointer" }}
                  onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "block"; }} />
                <span style={{ display: "none", color: "#e63946", fontSize: 13 }}>⚠️ รูปภาพหมดอายุแล้ว (LINE เก็บรูปได้ 30 วัน)</span>
              </a>
            </div>
          </div>
        )}

        {/* Resolution (completed) */}
        {t.status === "completed" && t.resolution && (
          <div style={{ marginTop: 12, background: "#e8f5e9", borderRadius: 8, padding: 14, fontSize: 14 }}>
            <strong>✅ วิธีแก้ไข:</strong>
            <p style={{ margin: "6px 0 0" }}>{t.resolution}</p>
            {t.rating && <div style={{ marginTop: 8 }}>ความพึงพอใจ: <Stars value={t.rating} /> ({t.rating}/5)</div>}
          </div>
        )}

        {/* Assign (pending) */}
        {t.status === "pending" && (
          <div style={{ marginTop: 20 }}>
            <p style={{ fontWeight: 600, marginBottom: 8 }}>มอบหมายให้:</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {activeAssignees.map((a) => (
                <button key={a.id} onClick={() => onAssign(t.id, a.name)}
                  style={{ padding: "8px 16px", borderRadius: 8, cursor: "pointer",
                    background: "#1a1a2e", color: "#fff", border: "none", fontWeight: 600 }}>
                  👷 {a.name}
                </button>
              ))}
              {activeAssignees.length === 0 && <p style={{ color: "#aaa", fontSize: 13 }}>ยังไม่มีเจ้าหน้าที่ในระบบ</p>}
            </div>
          </div>
        )}

        {/* ใช้ปุ่ม "บันทึกปิดงาน" ใน Cost Section แทนแล้ว */}

        {/* Toast */}
        {toast && (
          <div style={{ position: "fixed", top: 24, right: 24, background: toast.startsWith("❌") ? "#e63946" : "#2a9d8f",
            color: "#fff", borderRadius: 10, padding: "12px 20px", fontWeight: 600,
            fontSize: 14, boxShadow: "0 4px 16px #0003", zIndex: 9999 }}>
            {toast}
          </div>
        )}

        {/* Cost Section */}
        <div style={{ marginTop: 20, border: "1px solid #eee", borderRadius: 10, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <strong style={{ fontSize: 15 }}>💰 ค่าใช้จ่ายในการซ่อม</strong>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 14 }}>
              <input type="checkbox" checked={showCost} onChange={(e) => setShowCost(e.target.checked)} />
              มีค่าใช้จ่าย
            </label>
          </div>

          {showCost && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Header row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 110px 32px",
                gap: 6, fontSize: 11, color: "#888", padding: "0 4px" }}>
                <span>รายการ / รายละเอียด</span>
                <span>ราคา (บาท)</span>
                <span>VAT (บาท)</span>
                <span></span>
              </div>

              {/* Cost rows */}
              {costItems.map((item, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 110px 110px 32px", gap: 6 }}>
                  <input value={item.desc} onChange={(e) => updateItem(i, "desc", e.target.value)}
                    placeholder={`รายการที่ ${i + 1} เช่น เปลี่ยน RAM 8GB`}
                    style={{ ...inputStyle, fontSize: 13, boxSizing: "border-box" }} />
                  <input type="number" value={item.amount} onChange={(e) => updateItem(i, "amount", e.target.value)}
                    placeholder="0.00" style={{ ...inputStyle, fontSize: 13, boxSizing: "border-box" }} />
                  <input type="number" value={item.vat} onChange={(e) => updateItem(i, "vat", e.target.value)}
                    placeholder="0.00" style={{ ...inputStyle, fontSize: 13, boxSizing: "border-box" }} />
                  <button onClick={() => removeItem(i)} disabled={costItems.length === 1}
                    style={{ background: costItems.length === 1 ? "#eee" : "#e63946", color: "#fff",
                      border: "none", borderRadius: 6, cursor: costItems.length === 1 ? "default" : "pointer",
                      fontSize: 14, fontWeight: 700 }}>×</button>
                </div>
              ))}

              {/* Add row */}
              <button onClick={addItem}
                style={{ background: "none", border: "1px dashed #aaa", borderRadius: 6,
                  color: "#666", padding: "6px 12px", cursor: "pointer", fontSize: 13, textAlign: "left" }}>
                + เพิ่มรายการ
              </button>

              {/* Vendor */}
              <div style={{ marginTop: 4 }}>
                <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>ช่างซ่อม / ผู้รับเหมา</label>
                <input value={vendor} onChange={(e) => setVendor(e.target.value)}
                  placeholder="ชื่อช่างหรือบริษัท"
                  style={{ width: "100%", ...inputStyle, boxSizing: "border-box" }} />
              </div>

              {/* Total */}
              <div style={{ background: "#f0f4f8", borderRadius: 8, padding: "10px 14px", fontSize: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#666" }}>ค่าซ่อมรวม</span>
                  <span>{totalAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#666" }}>VAT รวม</span>
                  <span>{totalVat.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700,
                  fontSize: 16, marginTop: 6, paddingTop: 6, borderTop: "1px solid #ddd" }}>
                  <span>รวมทั้งสิ้น</span>
                  <span style={{ color: "#1a1a2e" }}>
                    {totalCost.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Summary for close */}
          <div style={{ marginTop: 14 }}>
            <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>
              สรุปการแก้ไข (จำเป็นสำหรับปิดงาน)
            </label>
            <textarea value={closeResolution} onChange={(e) => setCloseResolution(e.target.value)}
              rows={2} placeholder="อธิบายสิ่งที่แก้ไข..."
              style={{ width: "100%", ...inputStyle, resize: "vertical", boxSizing: "border-box" }} />
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <button onClick={saveCost} disabled={savingCost} style={btnStyle("#457b9d")}>
              {savingCost ? "กำลังบันทึก..." : "💾 บันทึกค่าใช้จ่าย"}
            </button>
            {t.status !== "completed" && (
              <button onClick={handleCloseWithCost} disabled={savingCost}
                style={{ ...btnStyle("#2a9d8f"), fontSize: 14, padding: "8px 20px" }}>
                ✅ บันทึกปิดงาน
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────
function Dashboard({ stats, dateFrom, dateTo, setDateFrom, setDateTo }) {
  const today = new Date().toISOString().slice(0, 10);

  function applyPreset(preset) {
    const now = new Date();
    if (preset === "today") {
      setDateFrom(today); setDateTo(today);
    } else if (preset === "week") {
      const d = new Date(now); d.setDate(d.getDate() - 6);
      setDateFrom(d.toISOString().slice(0, 10)); setDateTo(today);
    } else if (preset === "month") {
      setDateFrom(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
      setDateTo(today);
    } else if (preset === "year") {
      setDateFrom(`${now.getFullYear()}-01-01`); setDateTo(today);
    } else {
      setDateFrom(""); setDateTo("");
    }
  }

  const presets = [
    { key: "all", label: "ทั้งหมด" },
    { key: "today", label: "วันนี้" },
    { key: "week", label: "7 วัน" },
    { key: "month", label: "เดือนนี้" },
    { key: "year", label: "ปีนี้" },
  ];

  if (!stats) return <p>⏳ กำลังโหลด...</p>;
  const cards = [
    { label: "Ticket ทั้งหมด", value: stats.total, color: "#1a1a2e" },
    { label: "🟡 รอดำเนินการ", value: stats.pending, color: "#e9c46a" },
    { label: "🔵 กำลังดำเนินการ", value: stats.inProgress, color: "#457b9d" },
    { label: "🟢 เสร็จสิ้น", value: stats.completed, color: "#2a9d8f" },
    { label: "💡 FAQ เข้าถึง", value: stats.faqViews || 0, color: "#f4a261" },
    { label: "✅ แก้เองได้", value: `${stats.faqSelfResolveRate || 0}%`, color: "#2a9d8f", sub: `${stats.faqResolved || 0} / ${stats.faqViews || 0} ครั้ง` },
  ];
  return (
    <div>
      {/* Date Filter */}
      <div style={{ background: "#fff", borderRadius: 12, padding: "14px 20px", marginBottom: 20, boxShadow: "0 1px 4px #0001", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#555", marginRight: 4 }}>ช่วงเวลา:</span>
        {presets.map(p => {
          const active = p.key === "all" && !dateFrom && !dateTo;
          return (
            <button key={p.key} onClick={() => applyPreset(p.key)}
              style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${active ? "#1a1a2e" : "#ddd"}`, fontSize: 13, cursor: "pointer",
                background: active ? "#1a1a2e" : "#f5f6ff",
                color: active ? "#fff" : "#333", fontWeight: 500 }}>
              {p.label}
            </button>
          );
        })}
        <span style={{ fontSize: 13, color: "#aaa" }}>หรือกำหนดเอง:</span>
        <input type="date" value={dateFrom} max={today} onChange={e => setDateFrom(e.target.value)}
          style={{ padding: "4px 8px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13 }} />
        <span style={{ fontSize: 13 }}>ถึง</span>
        <input type="date" value={dateTo} max={today} onChange={e => setDateTo(e.target.value)}
          style={{ padding: "4px 8px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13 }} />
        {(dateFrom || dateTo) && (
          <button onClick={() => applyPreset("all")}
            style={{ padding: "5px 10px", borderRadius: 20, border: "1px solid #e63946", fontSize: 12, cursor: "pointer", color: "#e63946", background: "#fff" }}>
            ✕ ล้าง
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 16, marginBottom: 24 }}>
        {cards.map((c) => (
          <div key={c.label} style={{ background: "#fff", borderRadius: 12, padding: "20px 24px",
            borderTop: `4px solid ${c.color}`, boxShadow: "0 1px 4px #0001" }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 14, color: "#666", marginTop: 4 }}>{c.label}</div>
            {c.sub && <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{c.sub}</div>}
          </div>
        ))}
      </div>
      {stats.avgRating && (
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: "0 1px 4px #0001" }}>
          <strong>ความพึงพอใจเฉลี่ย: </strong>
          <Stars value={Math.round(stats.avgRating)} /> {stats.avgRating} / 5
        </div>
      )}
      <div className="two-col">
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px #0001" }}>
          <strong style={{ display: "block", marginBottom: 12 }}>📊 สัดส่วนตามหมวด</strong>
          {stats.byCategory.map((c) => (
            <div key={c.category} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span>{c.category}</span><span>{c.count}</span>
              </div>
              <div style={{ background: "#eee", borderRadius: 4, height: 8, marginTop: 4 }}>
                <div style={{ background: "#457b9d", borderRadius: 4, height: 8,
                  width: `${stats.total ? Math.round((c.count / stats.total) * 100) : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px #0001" }}>
          <strong style={{ display: "block", marginBottom: 12 }}>👷 ภาระงาน IT Staff</strong>
          {stats.byAssignee.map((a) => (
            <div key={a.assignee} style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f0f0f0", fontSize: 14 }}>
              <span>{a.assignee}</span>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700 }}>{a.count} tickets</div>
                {a.avgRating && <Stars value={Math.round(a.avgRating)} />}
              </div>
            </div>
          ))}
          {stats.byAssignee.length === 0 && <p style={{ color: "#aaa", fontSize: 13 }}>ยังไม่มีการมอบหมาย</p>}
        </div>
      </div>
    </div>
  );
}

// ── Settings Panel ────────────────────────────────────────
function SettingsPanel({ categories, onReload, assignees, onReloadAssignees }) {
  const [faqs, setFaqs] = useState([]);
  const [rooms, setRooms] = useState([]);
  const loadFaqs = useCallback(async () => { try { setFaqs(await api.getFaqs()); } catch {} }, []);
  const loadRooms = useCallback(async () => { try { setRooms(await api.getRooms()); } catch {} }, []);
  useEffect(() => { loadFaqs(); }, [loadFaqs]);
  useEffect(() => { loadRooms(); }, [loadRooms]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <ContactSettings />
      <AssigneeSettings assignees={assignees} onReload={onReloadAssignees} />
      <div className="two-col">
        <CategorySettings categories={categories} onReload={onReload} />
        <FaqSettings faqs={faqs} onReload={loadFaqs} />
      </div>
      <RoomSettings rooms={rooms} onReload={loadRooms} />
    </div>
  );
}

function ContactSettings() {
  const [form, setForm] = useState({ contact_name: "", contact_phone: "", contact_email: "", contact_hours: "", contact_line: "" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getConfig().then(cfg => setForm(f => ({ ...f, ...cfg }))).catch(() => {});
  }, []);

  async function save() {
    await api.updateConfig(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const field = (key, label, placeholder) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 12, color: "#666", fontWeight: 600 }}>{label}</label>
      <input value={form[key] || ""} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder} style={{ ...inputStyle, fontSize: 13 }} />
    </div>
  );

  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px #0001" }}>
      <strong style={{ fontSize: 15, display: "block", marginBottom: 14 }}>📞 ข้อมูลติดต่อ IT (แสดงใน LINE)</strong>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        {field("contact_name",  "ชื่อทีม",        "เช่น ทีม IT Support")}
        {field("contact_phone", "เบอร์โทร",        "เช่น 02-xxx-xxxx")}
        {field("contact_email", "Email",           "เช่น it@company.com")}
        {field("contact_hours", "เวลาทำการ",       "เช่น จ–ศ 08:00–18:00")}
        {field("contact_line",  "LINE ID (ถ้ามี)", "เช่น @itsupport")}
      </div>
      <button onClick={save} style={{ ...btnStyle(saved ? "#2a9d8f" : "#1a1a2e"), minWidth: 120 }}>
        {saved ? "✅ บันทึกแล้ว" : "บันทึก"}
      </button>
    </div>
  );
}

function RoomSettings({ rooms, onReload }) {
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editCalId, setEditCalId] = useState(null);
  const [calInput, setCalInput] = useState("");

  async function addRoom() {
    if (!newName.trim()) return;
    await api.createRoom(newName.trim());
    setNewName(""); onReload();
  }
  async function saveEdit(id) {
    if (!editName.trim()) return;
    await api.updateRoom(id, { name: editName.trim() });
    setEditId(null); onReload();
  }
  async function saveCalendar(id) {
    await api.updateRoomCalendar(id, calInput.trim() || null);
    setEditCalId(null); onReload();
  }
  async function autoCreateCalendar(id, name) {
    if (!confirm(`สร้าง Google Calendar ใหม่สำหรับ "${name}" อัตโนมัติ?`)) return;
    try {
      await api.createRoomCalendar(id);
      onReload();
      alert("สร้าง Calendar สำเร็จ! ปฏิทินจะถูกเชื่อมกับห้องนี้อัตโนมัติ");
    } catch (err) {
      alert("เกิดข้อผิดพลาด: " + (err.message || "ไม่สามารถสร้าง Calendar ได้"));
    }
  }
  const [globalCalInput, setGlobalCalInput] = useState("");

  async function applyCalendarToAll() {
    const calId = globalCalInput.trim();
    if (!calId) return alert("กรุณากรอก Calendar ID ก่อน");
    if (!confirm(`ใช้ Calendar ID นี้กับทุกห้อง (${rooms.length} ห้อง)?`)) return;
    await Promise.all(rooms.map(r => api.updateRoomCalendar(r.id, calId)));
    setGlobalCalInput("");
    onReload();
  }

  async function removeRoom(id) {
    if (!confirm("ลบห้องนี้? การจองทั้งหมดของห้องนี้จะถูกลบด้วย")) return;
    await api.deleteRoom(id); onReload();
  }

  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px #0001" }}>
      <strong style={{ fontSize: 15, display: "block", marginBottom: 14 }}>🏢 จัดการห้องประชุม</strong>

      {/* ตั้งค่า Calendar ทุกห้องพร้อมกัน */}
      <div style={{ background: "#f0f7ff", border: "1px solid #bcd", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#457b9d" }}>📆 ตั้งค่า Calendar ID ทุกห้องพร้อมกัน</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={globalCalInput} onChange={e => setGlobalCalInput(e.target.value)}
            placeholder="xxx@group.calendar.google.com"
            style={{ ...inputStyle, flex: 1, fontSize: 12 }} />
          <button onClick={applyCalendarToAll} style={btnStyle("#457b9d")}>ใช้กับทุกห้อง</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input value={newName} onChange={e => setNewName(e.target.value)}
          placeholder="ชื่อห้องใหม่" style={{ ...inputStyle, flex: 1 }}
          onKeyDown={e => e.key === "Enter" && addRoom()} />
        <button onClick={addRoom} style={btnStyle("#1a1a2e")}>+ เพิ่ม</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rooms.map(room => (
          <div key={room.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: "12px 14px" }}>
            {/* Room name row */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              {editId === room.id ? (
                <>
                  <input value={editName} onChange={e => setEditName(e.target.value)}
                    style={{ ...inputStyle, flex: 1, fontSize: 13 }} autoFocus />
                  <button onClick={() => saveEdit(room.id)} style={btnStyle("#2a9d8f")}>บันทึก</button>
                  <button onClick={() => setEditId(null)} style={btnStyle("#999")}>ยกเลิก</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>🏢 {room.name}</span>
                  <button onClick={() => { setEditId(room.id); setEditName(room.name); }} style={smallBtn("#457b9d")}>✏️</button>
                  <button onClick={() => removeRoom(room.id)} style={smallBtn("#e63946")}>🗑️</button>
                </>
              )}
            </div>
            {/* Calendar ID row */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "#888", minWidth: 80 }}>📆 Calendar ID:</span>
              {editCalId === room.id ? (
                <>
                  <input value={calInput} onChange={e => setCalInput(e.target.value)}
                    placeholder="xxx@group.calendar.google.com"
                    style={{ ...inputStyle, flex: 1, fontSize: 12 }} />
                  <button onClick={() => saveCalendar(room.id)} style={btnStyle("#2a9d8f")}>บันทึก</button>
                  <button onClick={() => setEditCalId(null)} style={btnStyle("#999")}>ยกเลิก</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: 12, color: room.calendarId ? "#333" : "#bbb" }}>
                    {room.calendarId || "(ยังไม่ตั้งค่า)"}
                  </span>
                  <button onClick={() => { setEditCalId(room.id); setCalInput(room.calendarId || ""); }}
                    style={smallBtn("#f4a261")}>✏️</button>
                  {!room.calendarId && (
                    <button onClick={() => autoCreateCalendar(room.id, room.name)}
                      style={smallBtn("#2a9d8f")}>🗓️ สร้างอัตโนมัติ</button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        {rooms.length === 0 && <p style={{ color: "#aaa", fontSize: 13 }}>ยังไม่มีห้องประชุม</p>}
      </div>
    </div>
  );
}

function AssigneeSettings({ assignees, onReload }) {
  const [newName, setNewName] = useState("");

  async function addAssignee() {
    if (!newName.trim()) return;
    await api.createAssignee(newName.trim());
    setNewName("");
    onReload();
  }

  async function toggleAssignee(a) {
    await api.updateAssignee(a.id, { isActive: !a.isActive });
    onReload();
  }

  async function removeAssignee(id) {
    if (!confirm("ลบเจ้าหน้าที่นี้?")) return;
    await api.deleteAssignee(id);
    onReload();
  }

  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px #0001" }}>
      <strong style={{ display: "block", fontSize: 16, marginBottom: 14 }}>👷 เจ้าหน้าที่รับงาน</strong>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input value={newName} onChange={(e) => setNewName(e.target.value)}
          placeholder="ชื่อเจ้าหน้าที่ เช่น พี่โจ้ (IT Support)"
          style={{ flex: 1, ...inputStyle }}
          onKeyDown={(e) => e.key === "Enter" && addAssignee()} />
        <button onClick={addAssignee} style={btnStyle("#1a1a2e")}>+ เพิ่ม</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {assignees.map((a) => (
          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8,
            padding: "8px 12px", borderRadius: 8, background: a.isActive ? "#f8f9ff" : "#f8f8f8",
            border: "1px solid #eee" }}>
            <span style={{ flex: 1, fontSize: 14, color: a.isActive ? "#333" : "#bbb" }}>
              👷 {a.name}
            </span>
            <button onClick={() => toggleAssignee(a)} style={smallBtn(a.isActive ? "#2a9d8f" : "#aaa")}>
              {a.isActive ? "✓ เปิด" : "✗ ปิด"}
            </button>
            <button onClick={() => removeAssignee(a.id)} style={smallBtn("#e63946")}>🗑️</button>
          </div>
        ))}
        {assignees.length === 0 && <p style={{ color: "#aaa", fontSize: 13 }}>ยังไม่มีเจ้าหน้าที่</p>}
      </div>
    </div>
  );
}

function CategorySettings({ categories, onReload }) {
  const [newCatName, setNewCatName]   = useState("");
  const [newCatIcon, setNewCatIcon]   = useState("📋");
  const [newCatColor, setNewCatColor] = useState("#457b9d");
  const [addingSubOf, setAddingSubOf] = useState(null);
  const [newSubName, setNewSubName]   = useState("");
  const [editCat, setEditCat]         = useState(null);
  const [editSub, setEditSub]         = useState(null);

  async function addCategory() {
    if (!newCatName.trim()) return;
    await api.createCategory({ name: newCatName.trim(), icon: newCatIcon, color: newCatColor });
    setNewCatName(""); setNewCatIcon("📋"); setNewCatColor("#457b9d");
    onReload();
  }

  async function toggleCategory(cat) {
    await api.updateCategory(cat.id, { isActive: !cat.isActive });
    onReload();
  }

  async function removeCat(id) {
    if (!confirm("ลบหมวดหมู่นี้? (จะลบหมวดย่อยทั้งหมดด้วย)")) return;
    await api.deleteCategory(id); onReload();
  }

  async function addSub(catId) {
    if (!newSubName.trim()) return;
    await api.createSubcategory(catId, newSubName.trim());
    setAddingSubOf(null); setNewSubName(""); onReload();
  }

  async function toggleSub(sub) {
    await api.updateSubcategory(sub.id, { isActive: !sub.isActive }); onReload();
  }

  async function removeSub(id) {
    if (!confirm("ลบหมวดย่อยนี้?")) return;
    await api.deleteSubcategory(id); onReload();
  }

  async function saveEditCat() {
    await api.updateCategory(editCat.id, { name: editCat.name, icon: editCat.icon, color: editCat.color });
    setEditCat(null); onReload();
  }

  async function saveEditSub() {
    await api.updateSubcategory(editSub.id, { name: editSub.name });
    setEditSub(null); onReload();
  }

  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px #0001" }}>
      <strong style={{ display: "block", fontSize: 16, marginBottom: 16 }}>📂 หมวดหมู่ & หมวดย่อย</strong>

      {/* Add category form */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        <input value={newCatIcon} onChange={(e) => setNewCatIcon(e.target.value)}
          placeholder="icon" style={{ width: 50, ...inputStyle }} />
        <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
          placeholder="ชื่อหมวดหมู่ใหม่" style={{ flex: 1, ...inputStyle }}
          onKeyDown={(e) => e.key === "Enter" && addCategory()} />
        <input type="color" value={newCatColor} onChange={(e) => setNewCatColor(e.target.value)}
          style={{ width: 40, height: 34, border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", padding: 2 }} />
        <button onClick={addCategory} style={btnStyle("#1a1a2e")}>+ เพิ่ม</button>
      </div>

      {/* Category list */}
      {categories.map((cat) => (
        <div key={cat.id} style={{ marginBottom: 14, border: "1px solid #eee", borderRadius: 8, overflow: "hidden" }}>
          {editCat?.id === cat.id ? (
            <div style={{ display: "flex", gap: 6, padding: 10, background: "#f9f9f9" }}>
              <input value={editCat.icon} onChange={(e) => setEditCat({ ...editCat, icon: e.target.value })}
                style={{ width: 50, ...inputStyle }} />
              <input value={editCat.name} onChange={(e) => setEditCat({ ...editCat, name: e.target.value })}
                style={{ flex: 1, ...inputStyle }} />
              <input type="color" value={editCat.color} onChange={(e) => setEditCat({ ...editCat, color: e.target.value })}
                style={{ width: 40, height: 34, border: "1px solid #ddd", borderRadius: 6, padding: 2 }} />
              <button onClick={saveEditCat} style={btnStyle("#2a9d8f")}>บันทึก</button>
              <button onClick={() => setEditCat(null)} style={btnStyle("#999")}>ยกเลิก</button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", padding: "8px 12px",
              background: cat.isActive ? `${cat.color}18` : "#f8f8f8", gap: 8 }}>
              <span style={{ fontSize: 18 }}>{cat.icon}</span>
              <span style={{ flex: 1, fontWeight: 600, color: cat.isActive ? "#333" : "#bbb" }}>{cat.name}</span>
              <button onClick={() => toggleCategory(cat)} style={smallBtn(cat.isActive ? "#2a9d8f" : "#aaa")}>
                {cat.isActive ? "✓ เปิด" : "✗ ปิด"}
              </button>
              <button onClick={() => setEditCat({ ...cat })} style={smallBtn("#457b9d")}>✏️</button>
              <button onClick={() => removeCat(cat.id)} style={smallBtn("#e63946")}>🗑️</button>
            </div>
          )}

          {/* Subcategories */}
          <div style={{ padding: "4px 12px 8px 32px" }}>
            {cat.subcategories.map((sub) => (
              <div key={sub.id} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                {editSub?.id === sub.id ? (
                  <>
                    <input value={editSub.name} onChange={(e) => setEditSub({ ...editSub, name: e.target.value })}
                      style={{ flex: 1, ...inputStyle, fontSize: 12, padding: "4px 8px" }} />
                    <button onClick={saveEditSub} style={smallBtn("#2a9d8f")}>✓</button>
                    <button onClick={() => setEditSub(null)} style={smallBtn("#aaa")}>✕</button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1, fontSize: 13, color: sub.isActive ? "#444" : "#bbb" }}>
                      — {sub.name}
                    </span>
                    <button onClick={() => toggleSub(sub)} style={smallBtn(sub.isActive ? "#2a9d8f" : "#aaa", true)}>
                      {sub.isActive ? "✓" : "✗"}
                    </button>
                    <button onClick={() => setEditSub({ ...sub })} style={smallBtn("#457b9d", true)}>✏️</button>
                    <button onClick={() => removeSub(sub.id)} style={smallBtn("#e63946", true)}>🗑️</button>
                  </>
                )}
              </div>
            ))}
            {addingSubOf === cat.id ? (
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <input value={newSubName} onChange={(e) => setNewSubName(e.target.value)}
                  placeholder="ชื่อหมวดย่อย" autoFocus
                  style={{ flex: 1, ...inputStyle, fontSize: 13, padding: "4px 8px" }}
                  onKeyDown={(e) => e.key === "Enter" && addSub(cat.id)} />
                <button onClick={() => addSub(cat.id)} style={smallBtn("#1a1a2e")}>+ เพิ่ม</button>
                <button onClick={() => { setAddingSubOf(null); setNewSubName(""); }} style={smallBtn("#aaa")}>✕</button>
              </div>
            ) : (
              <button onClick={() => { setAddingSubOf(cat.id); setNewSubName(""); }}
                style={{ marginTop: 6, fontSize: 12, color: "#457b9d", background: "none",
                  border: "1px dashed #ccc", borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}>
                + เพิ่มหมวดย่อย
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function FaqSettings({ faqs, onReload }) {
  const [adding, setAdding]     = useState(false);
  const [newQ, setNewQ]         = useState("");
  const [newA, setNewA]         = useState("");
  const [editFaq, setEditFaq]   = useState(null);

  async function addFaq() {
    if (!newQ.trim() || !newA.trim()) return;
    await api.createFaq({ question: newQ.trim(), answer: newA.trim() });
    setAdding(false); setNewQ(""); setNewA(""); onReload();
  }

  async function toggleFaq(faq) {
    await api.updateFaq(faq.id, { isActive: !faq.isActive }); onReload();
  }

  async function removeFaq(id) {
    if (!confirm("ลบ FAQ นี้?")) return;
    await api.deleteFaq(id); onReload();
  }

  async function saveEdit() {
    await api.updateFaq(editFaq.id, { question: editFaq.question, answer: editFaq.answer });
    setEditFaq(null); onReload();
  }

  const totalViews = faqs.reduce((s, f) => s + (f.viewCount || 0), 0);
  const sortedByViews = [...faqs].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));

  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px #0001" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <strong style={{ fontSize: 16 }}>💡 FAQ / วิธีแก้ปัญหาเบื้องต้น</strong>
        <button onClick={() => setAdding(true)} style={btnStyle("#1a1a2e")}>+ เพิ่ม FAQ</button>
      </div>

      {totalViews > 0 && (
        <div style={{ background: "#f5f6ff", borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <strong style={{ fontSize: 13, color: "#1a1a2e" }}>📊 Analytics — FAQ ที่ถูกดูมากสุด</strong>
            <span style={{ fontSize: 12, color: "#888" }}>รวม {totalViews} ครั้ง</span>
          </div>
          {sortedByViews.filter(f => f.viewCount > 0).map(faq => {
            const pct = Math.round((faq.viewCount / totalViews) * 100);
            return (
              <div key={faq.id} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: "#333", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>
                    {faq.question}
                  </span>
                  <span style={{ color: "#555", flexShrink: 0 }}>{faq.viewCount} ครั้ง ({pct}%)</span>
                </div>
                <div style={{ height: 6, background: "#e0e0f0", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: "#457b9d", borderRadius: 999, transition: "width .4s" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {adding && (
        <div style={{ border: "1px solid #e0e0e0", borderRadius: 8, padding: 12, marginBottom: 12, background: "#f9f9f9" }}>
          <input value={newQ} onChange={(e) => setNewQ(e.target.value)}
            placeholder="คำถาม / ปัญหา" style={{ width: "100%", ...inputStyle, marginBottom: 6, boxSizing: "border-box" }} />
          <textarea value={newA} onChange={(e) => setNewA(e.target.value)}
            placeholder="วิธีแก้ไข / คำตอบ" rows={3}
            style={{ width: "100%", ...inputStyle, resize: "vertical", boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button onClick={addFaq} style={btnStyle("#2a9d8f")}>บันทึก</button>
            <button onClick={() => { setAdding(false); setNewQ(""); setNewA(""); }} style={btnStyle("#999")}>ยกเลิก</button>
          </div>
        </div>
      )}

      {faqs.map((faq) => (
        <div key={faq.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: 12,
          marginBottom: 10, background: faq.isActive ? "#fff" : "#f8f8f8" }}>
          {editFaq?.id === faq.id ? (
            <>
              <input value={editFaq.question} onChange={(e) => setEditFaq({ ...editFaq, question: e.target.value })}
                style={{ width: "100%", ...inputStyle, marginBottom: 6, boxSizing: "border-box" }} />
              <textarea value={editFaq.answer} onChange={(e) => setEditFaq({ ...editFaq, answer: e.target.value })}
                rows={3} style={{ width: "100%", ...inputStyle, resize: "vertical", boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button onClick={saveEdit} style={btnStyle("#2a9d8f")}>บันทึก</button>
                <button onClick={() => setEditFaq(null)} style={btnStyle("#999")}>ยกเลิก</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 14, color: faq.isActive ? "#1a1a2e" : "#bbb" }}>
                    ❓ {faq.question}
                  </strong>
                  <span style={{ marginLeft: 8, fontSize: 11, color: "#888", background: "#f0f0f0",
                    borderRadius: 999, padding: "1px 7px" }}>
                    👁 {faq.viewCount || 0} ครั้ง
                  </span>
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0, marginLeft: 8 }}>
                  <button onClick={() => toggleFaq(faq)} style={smallBtn(faq.isActive ? "#2a9d8f" : "#aaa")}>
                    {faq.isActive ? "✓ เปิด" : "✗ ปิด"}
                  </button>
                  <button onClick={() => setEditFaq({ ...faq })} style={smallBtn("#457b9d")}>✏️</button>
                  <button onClick={() => removeFaq(faq.id)} style={smallBtn("#e63946")}>🗑️</button>
                </div>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: faq.isActive ? "#555" : "#bbb",
                whiteSpace: "pre-wrap" }}>{faq.answer}</p>
            </>
          )}
        </div>
      ))}
      {faqs.length === 0 && <p style={{ color: "#aaa", fontSize: 13 }}>ยังไม่มี FAQ</p>}
    </div>
  );
}

// ── Bookings Panel ────────────────────────────────────────
const ROOM_COLORS = ["#1a73e8","#d50000","#33b679","#f4511e","#8e24aa","#0b8043","#e67c73","#039be5"];
const MONTH_TH_LONG = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];

function BookingsPanel() {
  const now = new Date();
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [monthBookings, setMonthBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [popup, setPopup] = useState(null); // { booking, x, y }

  const loadRooms = useCallback(async () => { try { setRooms(await api.getRooms()); } catch {} }, []);
  const loadMonth = useCallback(async () => {
    try { setMonthBookings(await api.getBookingsMonth(viewYear, viewMonth)); } catch {}
  }, [viewYear, viewMonth]);

  useEffect(() => { loadRooms(); }, [loadRooms]);
  useEffect(() => { loadMonth(); }, [loadMonth]);
  useEffect(() => {
    function close(e) { if (!e.target.closest("[data-popup]")) setPopup(null); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function handleCancel(id) {
    if (!confirm("ยืนยันการยกเลิกจองนี้?")) return;
    await api.cancelBooking(id);
    setPopup(null);
    loadMonth();
  }

  function openPopup(e, booking) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setPopup({ booking, x: rect.left, y: rect.bottom + 6 });
  }

  const roomColor = {};
  rooms.forEach((r, i) => { roomColor[r.id] = ROOM_COLORS[i % ROOM_COLORS.length]; });

  const firstDow    = new Date(viewYear, viewMonth - 1, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const cells = Array(firstDow).fill(null).concat(
    Array.from({ length: daysInMonth }, (_, i) => i + 1)
  );
  while (cells.length % 7 !== 0) cells.push(null);

  function prevMonth() {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); } else setViewMonth(m => m - 1);
    setSelectedDay(null);
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); } else setViewMonth(m => m + 1);
    setSelectedDay(null);
  }
  function goToday() {
    setViewYear(now.getFullYear()); setViewMonth(now.getMonth() + 1); setSelectedDay(now.getDate());
  }

  // bookings by day — รองรับ multi-day (ใส่ booking ทุกวันที่ครอบคลุมภายในเดือน)
  const byDay = {};
  const monthStart = new Date(viewYear, viewMonth - 1, 1);
  const monthEnd   = new Date(viewYear, viewMonth, 0);
  monthBookings.filter(b => b.status !== "cancelled").forEach(b => {
    const bStart = new Date(new Date(b.startAt).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }) + "T00:00:00");
    const bEnd   = new Date(new Date(b.endAt  ).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }) + "T00:00:00");
    const iterStart = bStart < monthStart ? monthStart : bStart;
    const iterEnd   = bEnd   > monthEnd   ? monthEnd   : bEnd;
    for (const cur = new Date(iterStart); cur <= iterEnd; cur.setDate(cur.getDate() + 1)) {
      const day = cur.getDate();
      if (!byDay[day]) byDay[day] = [];
      if (!byDay[day].find(x => x.id === b.id)) byDay[day].push(b);
    }
  });

  function fmtTime(dt) {
    const d = new Date(dt);
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  }
  function bookingStatus(b) {
    if (b.status === "cancelled") return { label: "ยกเลิกคำขอ", color: "#e63946", bg: "#fff0f0" };
    if (new Date(b.endAt) < now)  return { label: "ห้องประชุมปิดแล้ว", color: "#999", bg: "#f0f0f0" };
    return { label: "จองสำเร็จ", color: "#1a73e8", bg: "#e8f0fe" };
  }

  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth() + 1;
  const todayDate = isCurrentMonth ? now.getDate() : null;
  const selBookings = selectedDay ? (byDay[selectedDay] || []) : [];

  return (
    <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px #0001", overflow: "hidden" }}>

      {/* ── Header ── */}
      <div style={{ padding: "10px 16px 8px", borderBottom: "1px solid #e8eaed", display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={goToday}
          style={{ border: "1px solid #dadce0", background: "#fff", borderRadius: 4, padding: "5px 12px",
            fontSize: 13, fontWeight: 500, cursor: "pointer", color: "#3c4043" }}>
          วันนี้
        </button>
        <button onClick={prevMonth}
          style={{ border: "none", background: "none", cursor: "pointer", borderRadius: "50%",
            width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, color: "#3c4043" }}>‹</button>
        <button onClick={nextMonth}
          style={{ border: "none", background: "none", cursor: "pointer", borderRadius: "50%",
            width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, color: "#3c4043" }}>›</button>
        <span style={{ fontSize: 17, fontWeight: 400, color: "#3c4043", flex: 1 }}>
          {MONTH_TH_LONG[viewMonth - 1]} {viewYear + 543}
        </span>
      </div>

      {/* ── DOW headers ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: "1px solid #e8eaed" }}>
        {["อา","จ","อ","พ","พฤ","ศ","ส"].map((d, i) => (
          <div key={d} style={{ textAlign: "center", padding: "6px 0", fontSize: 11, fontWeight: 500,
            color: i === 0 ? "#d50000" : i === 6 ? "#1a73e8" : "#70757a" }}>{d}</div>
        ))}
      </div>

      {/* ── Grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderLeft: "1px solid #e8eaed" }}>
        {cells.map((day, idx) => {
          const dayBkgs  = day ? (byDay[day] || []) : [];
          const isToday  = day === todayDate;
          const isSel    = day === selectedDay;
          const isSun    = idx % 7 === 0;
          const isSat    = idx % 7 === 6;
          return (
            <div key={idx} onClick={() => day && setSelectedDay(isSel ? null : day)}
              style={{
                minHeight: 80, borderRight: "1px solid #e8eaed", borderBottom: "1px solid #e8eaed",
                padding: "4px 2px", cursor: day ? "pointer" : "default",
                background: isSel ? "#e8f0fe" : "#fff",
              }}>
              {day && (
                <>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 2 }}>
                    <span style={{
                      width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
                      borderRadius: "50%", fontSize: 12, fontWeight: isToday ? 500 : 400,
                      background: isToday ? "#1a73e8" : "transparent",
                      color: isToday ? "#fff" : isSun ? "#d50000" : isSat ? "#1a73e8" : "#3c4043",
                    }}>{day}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 1, padding: "0 1px" }}>
                    {dayBkgs.slice(0, 3).map((b, i) => (
                      <div key={i} onClick={e => openPopup(e, b)} style={{
                        background: roomColor[b.roomId] || "#1a73e8", color: "#fff",
                        borderRadius: 3, fontSize: 10, padding: "1px 4px", cursor: "pointer",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.5,
                      }}>
                        {fmtTime(b.startAt)} {b.room?.name || ""}
                      </div>
                    ))}
                    {dayBkgs.length > 3 && (
                      <div style={{ fontSize: 10, color: "#70757a", padding: "0 3px" }}>+{dayBkgs.length - 3} รายการ</div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Room legend ── */}
      {rooms.length > 0 && (
        <div style={{ borderTop: "1px solid #e8eaed", padding: "8px 16px", display: "flex", flexWrap: "wrap", gap: 10 }}>
          {rooms.map((r, i) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#3c4043" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: ROOM_COLORS[i % ROOM_COLORS.length] }} />
              {r.name}
            </div>
          ))}
        </div>
      )}

      {/* ── Selected day detail ── */}
      {selectedDay && (
        <div style={{ borderTop: "1px solid #e8eaed", padding: "14px 16px" }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#3c4043", marginBottom: 10 }}>
            {new Date(viewYear, viewMonth - 1, selectedDay)
              .toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            {selBookings.length === 0 && <span style={{ color: "#aaa", fontWeight: 400 }}> — ว่าง</span>}
          </div>
          {selBookings.length === 0
            ? <p style={{ color: "#aaa", fontSize: 13, margin: 0 }}>ไม่มีการจองในวันนี้</p>
            : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {selBookings.map(b => {
                  const st = bookingStatus(b);
                  const isPast = new Date(b.endAt) < now;
                  return (
                    <div key={b.id} style={{
                      display: "flex", gap: 10, alignItems: "flex-start",
                      padding: "10px 12px", borderRadius: 8,
                      borderLeft: `4px solid ${roomColor[b.roomId] || "#1a73e8"}`,
                      background: "#f8f9fa",
                      opacity: isPast ? 0.65 : 1,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "#3c4043", marginBottom: 4 }}>{b.title}</div>
                        <div style={{ fontSize: 12, color: "#70757a" }}>📍 สถานที่ : {b.room?.name}</div>
                        <div style={{ fontSize: 12, color: "#70757a" }}>🕐 เวลา {fmtTime(b.startAt)} – {fmtTime(b.endAt)} น.</div>
                        <div style={{ fontSize: 12, color: "#70757a" }}>👤 ผู้จอง {b.displayName || b.lineUserId}</div>
                        {b.email && <div style={{ fontSize: 12, color: "#70757a" }}>📧 อีเมล {b.email}</div>}
                        {b.department && <div style={{ fontSize: 12, color: "#70757a" }}>🏢 ฝ่าย/แผนก {b.department}</div>}
                        {b.notes && <div style={{ fontSize: 12, color: "#70757a" }}>📌 รายละเอียดเพิ่มเติม {b.notes}</div>}
                        <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>📋 หมายเลขการจอง: {b.bookingNo}</div>
                        <div style={{ fontSize: 11, color: "#aaa", marginTop: 1 }}>🗓️ วันที่จอง: {new Date(b.createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" })}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
                        <span style={{ background: st.bg, color: st.color, border: `1px solid ${st.color}`,
                          borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 500, whiteSpace: "nowrap" }}>
                          {st.label}
                        </span>
                        {b.status === "confirmed" && !isPast && (
                          <button onClick={() => handleCancel(b.id)}
                            style={{ ...smallBtn("#d50000"), padding: "3px 10px", fontSize: 11 }}>
                            🗑️ ยกเลิกจอง
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          }
        </div>
      )}

      {/* ── Popup ── */}
      {popup && (() => {
        const b  = popup.booking;
        const st = bookingStatus(b);
        const isPast = new Date(b.endAt) < now;
        // clamp x so popup doesn't overflow viewport
        const popW = 260;
        const clampedX = Math.min(popup.x, window.innerWidth - popW - 12);
        return (
          <div data-popup="1" style={{
            position: "fixed", top: popup.y, left: Math.max(8, clampedX),
            width: popW, background: "#fff", borderRadius: 10,
            boxShadow: "0 4px 24px #0003, 0 1px 6px #0002",
            zIndex: 9999, overflow: "hidden",
          }}>
            {/* color bar */}
            <div style={{ height: 6, background: roomColor[b.roomId] || "#1a73e8" }} />
            <div style={{ padding: "12px 14px" }}>
              {/* close */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
                <button onClick={() => setPopup(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#70757a", padding: 0 }}>✕</button>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#3c4043", marginBottom: 8 }}>{b.title}</div>
              <div style={{ fontSize: 12, color: "#70757a", marginBottom: 3 }}>📍 สถานที่ : {b.room?.name}</div>
              <div style={{ fontSize: 12, color: "#70757a", marginBottom: 3 }}>🕐 เวลา {fmtTime(b.startAt)} – {fmtTime(b.endAt)} น.</div>
              <div style={{ fontSize: 12, color: "#70757a", marginBottom: 3 }}>👤 ผู้จอง {b.displayName || b.lineUserId}</div>
              {b.email && <div style={{ fontSize: 12, color: "#70757a", marginBottom: 3 }}>📧 อีเมล {b.email}</div>}
              {b.department && <div style={{ fontSize: 12, color: "#70757a", marginBottom: 3 }}>🏢 ฝ่าย/แผนก {b.department}</div>}
              {b.notes && <div style={{ fontSize: 12, color: "#70757a", marginBottom: 3 }}>📌 รายละเอียดเพิ่มเติม {b.notes}</div>}
              <div style={{ fontSize: 11, color: "#aaa", marginBottom: 3 }}>📋 หมายเลขการจอง: {b.bookingNo}</div>
              <div style={{ fontSize: 11, color: "#aaa", marginBottom: 10 }}>🗓️ วันที่จอง: {new Date(b.createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" })}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ background: st.bg, color: st.color, border: `1px solid ${st.color}`,
                  borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 500 }}>
                  {st.label}
                </span>
                {b.status === "confirmed" && !isPast && (
                  <button onClick={() => handleCancel(b.id)}
                    style={{ ...smallBtn("#d50000"), padding: "4px 10px", fontSize: 12 }}>
                    🗑️ ยกเลิกจอง
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Export Panel ──────────────────────────────────────────
function ExportPanel({ total, onExport }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: 32, textAlign: "center", boxShadow: "0 1px 4px #0001" }}>
      <div style={{ fontSize: 48 }}>📊</div>
      <h3>Export Ticket Data</h3>
      <p style={{ color: "#666" }}>จำนวน Ticket ที่กรองอยู่: <strong>{total}</strong> รายการ</p>
      <button onClick={onExport}
        style={{ padding: "12px 32px", background: "#1a1a2e", color: "#fff",
          border: "none", borderRadius: 8, fontWeight: 700, fontSize: 16, cursor: "pointer" }}>
        📥 Download CSV
      </button>
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────
const inputStyle = {
  border: "1px solid #ddd", borderRadius: 6, padding: "7px 10px",
  fontSize: 14, outline: "none", fontFamily: "inherit",
};

function btnStyle(bg) {
  return {
    background: bg, color: "#fff", border: "none", borderRadius: 6,
    padding: "7px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap",
  };
}

function smallBtn(bg, tiny = false) {
  return {
    background: bg, color: "#fff", border: "none", borderRadius: 4,
    padding: tiny ? "2px 6px" : "4px 8px", cursor: "pointer", fontSize: 11, whiteSpace: "nowrap",
  };
}

// ── Users Panel ───────────────────────────────────────────
function UsersPanel() {
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState("");
  const [name, setName]   = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try { setUsers(await api.getAllowedUsers()); } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addUser() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      alert("รูปแบบอีเมลไม่ถูกต้อง"); return;
    }
    setLoading(true);
    try {
      await api.createAllowedUser(trimmed, name.trim() || null);
      setEmail(""); setName(""); load();
    } catch (err) {
      alert("เกิดข้อผิดพลาด: " + (err.message || "อาจมีอีเมลนี้แล้ว"));
    }
    setLoading(false);
  }

  async function removeUser(id) {
    if (!confirm("ลบผู้ใช้นี้ออกจากรายชื่อที่อนุญาต?")) return;
    await api.deleteAllowedUser(id); load();
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px #0001", marginBottom: 16 }}>
        <strong style={{ display: "block", marginBottom: 14, fontSize: 16 }}>👥 จัดการผู้ใช้ที่อนุญาต</strong>
        <p style={{ fontSize: 13, color: "#888", margin: "0 0 16px" }}>
          เฉพาะอีเมลในรายชื่อนี้เท่านั้นที่สามารถเข้าสู่ระบบด้วย Google ได้
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="อีเมล Google *"
            onKeyDown={(e) => e.key === "Enter" && addUser()}
            style={{ ...inputStyle, flex: "1 1 200px" }} />
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="ชื่อ (ไม่บังคับ)"
            onKeyDown={(e) => e.key === "Enter" && addUser()}
            style={{ ...inputStyle, flex: "1 1 160px" }} />
          <button onClick={addUser} disabled={loading} style={btnStyle("#1a1a2e")}>
            + เพิ่ม
          </button>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px #0001" }}>
        <strong style={{ display: "block", marginBottom: 12 }}>รายชื่อที่อนุญาต ({users.length})</strong>
        {users.length === 0 && (
          <p style={{ color: "#bbb", fontSize: 13, textAlign: "center", padding: "16px 0" }}>
            ยังไม่มีรายชื่อ — กรุณาเพิ่มอีเมลด้านบน
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {users.map((u) => (
            <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 8, background: "#f8f9ff", border: "1px solid #eee" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{u.name || u.email}</div>
                {u.name && <div style={{ fontSize: 12, color: "#888" }}>{u.email}</div>}
              </div>
              <div style={{ fontSize: 11, color: "#bbb", whiteSpace: "nowrap" }}>
                {new Date(u.createdAt).toLocaleDateString("th-TH")}
              </div>
              <button onClick={() => removeUser(u.id)} style={smallBtn("#e63946")}>🗑️</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
