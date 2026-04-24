# STD-Service — IT Helpdesk & Service Portal

ระบบ IT Helpdesk ผ่าน LINE Official Account + Service Portal สำหรับพนักงาน The Standard

**Stack:** Node.js 20 + Express · MySQL 8.0 + Prisma ORM · React 18 + Vite · Nginx · Docker Compose

---

## โครงสร้างโปรเจกต์

```
STD-Service/
├── docker-compose.yml
├── docker-compose.nas.yml          ← สำหรับ deploy บน NAS / Portainer
├── .env                            ← สร้างจาก .env.example (ไม่ commit)
│
├── backend/                        ← Node.js + Express REST API (Port 3000)
│   ├── app.js
│   ├── controllers/
│   │   ├── webhookController.js    ← LINE webhook events ทั้งหมด
│   │   ├── adminController.js      ← Admin API + Audit logs
│   │   ├── authController.js       ← Google OAuth (admin)
│   │   ├── liffController.js       ← LIFF: ticket, booking, AI chat, history
│   │   └── portalController.js     ← Portal login + PortalCard CRUD
│   ├── services/
│   │   ├── ticketService.js
│   │   ├── bookingService.js       ← Google Calendar sync
│   │   ├── calendarService.js
│   │   ├── categoryService.js
│   │   ├── notifyService.js        ← LINE group notifications
│   │   ├── sessionService.js
│   │   └── auditService.js
│   ├── routes/
│   │   ├── api.js                  ← Admin routes (JWT + requirePermission)
│   │   ├── portal.js               ← Portal auth + public cards
│   │   ├── liff.js                 ← LIFF routes (rate-limited)
│   │   ├── auth.js
│   │   └── webhook.js
│   ├── views/flex/                 ← LINE Flex Message templates
│   └── prisma/
│       ├── schema.prisma
│       └── migrations/             ← 15 migration files
│
└── frontend/                       ← React (Port 8080 via Nginx)
    ├── nginx.conf
    ├── index.html                  ← viewport + font-size 16px (ป้องกัน zoom ใน LINE)
    └── src/
        ├── main.jsx                ← Routing: path-based (ไม่ใช้ react-router)
        ├── PortalApp.jsx           ← Landing Page (/)
        ├── App.jsx                 ← Admin Console (/admin)
        ├── LoginPage.jsx           ← Admin Google OAuth login
        ├── LiffApp.jsx             ← LIFF แจ้งปัญหา + ประวัติ Ticket
        ├── LiffBooking.jsx         ← LIFF จองห้องประชุม + ประวัติการจอง
        ├── LiffCalendar.jsx        ← LIFF ปฏิทินห้องประชุม
        ├── LiffAI.jsx              ← LIFF AI chat (/liff/ai)
        └── services/api.js         ← Admin API client
```

---

## Routing

| Path | หน้า | เข้าได้ |
|------|------|---------|
| `/` | Service Portal (Landing Page) | @thestandard.co ทุกคน |
| `/admin` | Admin Console | AllowedUser whitelist เท่านั้น |
| `/liff/ai` | AI Assistant chat | LINE LIFF / Portal Desktop |
| `/liff/booking` | จองห้องประชุม | LINE LIFF / Portal Desktop |
| `/liff/calendar` | ปฏิทินห้องประชุม | LINE LIFF / Portal Desktop |
| `/liff/*` | แจ้งปัญหา IT (Ticket) | LINE LIFF / Portal Desktop |

> **Portal Desktop Mode** — หน้า LIFF ทุกหน้ารองรับการเปิดผ่าน Desktop โดยไม่ต้องใช้ LINE ถ้ามี portal session (`skipLiff = !isLineApp && !!portal_token`) ข้อมูลจะ sync กับ LINE ผ่าน email

> Portal login → ถ้ามีสิทธิ์ admin จะเห็นปุ่ม **"Admin Console"** → `/admin` โดยไม่ต้อง login ซ้ำ

---

## ฟีเจอร์หลัก

### Service Portal (`/`)
- Login ด้วย Google — ตรวจสอบ domain ตาม `ALLOWED_EMAIL_DOMAIN` (default `@thestandard.co`)
- Grid of **Service Cards** (icon + ชื่อ + description + URL)
- Admin จัดการ cards ผ่าน Admin Console → Settings → Landing Page
- Logout จากหน้าไหนก็ได้ → clear session ทั้งหมด → กลับ `/`

### LINE OA (User)
- Rich Menu 6 ปุ่ม (Text action → `richMenuMap` → postback handler)
- **ถาม AI** → เปิด LIFF AI chat
- **แจ้งปัญหา** → LIFF form: หมวดหมู่ → Asset Tag → อธิบาย → รูปภาพ (optional, compress อัตโนมัติ)
- **ดู Ticket** → Flex Message สถานะ ticket ล่าสุด
- **จองห้องประชุม** → LIFF booking form
- **รายการจอง** / **ติดต่อ IT** → ดึงข้อมูลจาก DB
- Rating: กดดาว → บันทึกเงียบ (ไม่ reply), กดซ้ำ → เงียบ (ตรวจสอบจาก DB)

### AI Assistant (`/liff/ai`)
- Chat กับ AI สำหรับแก้ปัญหา IT เบื้องต้น
- รองรับ 3 provider: **Anthropic Claude**, **OpenAI GPT**, **Google Gemini**
- Config ทั้งหมดใน Admin Settings → AI Assistant (provider, API key, model, system prompt)
- Default model ต่อ provider: `claude-haiku-4-5-20251001` / `gpt-4o-mini` / `gemini-2.0-flash`

### แจ้งปัญหา IT — Desktop Mode (`/liff/*`)
- เปิดได้ผ่าน Portal Desktop โดยไม่ต้องใช้ LINE
- กรอกฟอร์มเหมือนกัน ข้อมูลผู้ใช้ pre-fill จาก portal session
- **ประวัติการแจ้งซ่อม** แสดงด้านล่างฟอร์ม (อ้างอิงจาก email) — เลือกแสดง 5 / 10 / 15 รายการ พร้อม pagination

### จองห้องประชุม — Desktop Mode (`/liff/booking`)
- ปฏิทินรายเดือนแบบ Interactive: กดวันเพื่อดูรายการจอง (day detail popup)
- กดวันที่ว่างเพื่อเลือกวันจองทันที
- เลือก multi-day booking ได้
- จองสำเร็จ → Sweet Alert modal (ไม่ redirect)
- **ประวัติการจอง** แสดงด้านล่าง — เลือกแสดง 5 / 10 / 15 รายการ พร้อม pagination
- ข้อมูล sync กับ LINE ผ่าน email

### Admin Console (`/admin`) — Sidebar Layout
- **Dashboard**: KPI cards, 7-day trend chart, satisfaction rating, category/assignee breakdown
- **Tickets**: filter, search, assign, priority, close, cost breakdown, export CSV
- **Bookings**: ปฏิทินรายเดือน + ยกเลิก (confirmation dialog → success modal → แจ้ง LINE group)
- **Users**: AllowedUser whitelist + per-user module permissions (checkbox UI)
- **Export**: Tickets & Bookings CSV
- **Audit Logs**: ประวัติการกระทำทั้งหมด (ดู Coverage ด้านล่าง)
- **Settings** (sub-tabs):
  - 📞 ติดต่อ — ข้อมูล IT ที่แสดงใน LINE
  - 🔔 แจ้งเตือน — LINE Group ID (Ticket / Booking)
  - 👷 เจ้าหน้าที่ — IT Staff
  - 📂 หมวดหมู่ — Category / Subcategory
  - 🤖 AI Assistant — Provider, API Key, Model, System Prompt
  - 🏢 ห้องประชุม — ห้อง + Google Calendar
  - 🌐 Landing Page — จัดการ Service Cards

---

## Database Schema

| Model | คำอธิบาย |
|-------|----------|
| `Ticket` | Ticket IT (status, priority, assignee, cost, rating) |
| `UserSession` | สถานะ LINE bot conversation ต่อ user |
| `Category` / `Subcategory` | หมวดหมู่ปัญหา |
| `Assignee` | IT Staff |
| `TicketCounter` | ตัวนับ HLP-XXXX |
| `FaqItem` | FAQ (เก็บไว้ใน DB) |
| `Room` | ห้องประชุม + Google Calendar ID |
| `RoomBooking` | การจอง (lineUserId, email, status, cancelledBy) + Google Event ID |
| `BookingCounter` | ตัวนับ BK-XXXX |
| `AllowedUser` | Admin whitelist + `permissions Json` |
| `SystemConfig` | Key-value config ทุกอย่าง (AI key, contact info ฯลฯ) |
| `AuditLog` | ประวัติการกระทำของ admin/portal/line |
| `PortalCard` | Service cards ที่แสดงใน Landing Page |

> **Portal users** จะมี `lineUserId = "portal:email@domain.com"` เพื่อ satisfy NOT NULL constraint โดยไม่ต้องมี LINE

---

## Permissions System

```
null        → full access (INITIAL_ADMIN_EMAIL)
[]          → ไม่มีสิทธิ์เลย
["tickets"] → เข้าได้เฉพาะ tickets module
```

**Modules:** `dashboard` · `tickets` · `bookings` · `settings` · `users` · `export` · `audit`

---

## Audit Log Coverage

| Action | เกิดเมื่อ |
|--------|----------|
| `PORTAL_LOGIN` | Portal user login สำเร็จ |
| `TICKET_CREATED` | สร้าง ticket ใหม่ (LIFF / Portal) |
| `TICKET_ASSIGNED` | Assign ticket ให้ staff |
| `TICKET_STATUS_CHANGED` | เปลี่ยนสถานะ ticket |
| `TICKET_COST_UPDATED` | บันทึกค่าใช้จ่าย |
| `TICKET_CLOSED` | ปิด ticket |
| `BOOKING_CREATED` | จองห้องใหม่ (LIFF / Portal) |
| `BOOKING_CANCELLED` | ยกเลิกการจอง (Admin) |
| `CATEGORY_CREATED/UPDATED/DELETED` | จัดการหมวดหมู่ |
| `SUBCATEGORY_CREATED/UPDATED/DELETED` | จัดการประเภทปัญหา |
| `FAQ_CREATED/UPDATED/DELETED` | จัดการ FAQ |
| `ASSIGNEE_CREATED/UPDATED/DELETED` | จัดการ IT Staff |
| `ROOM_CREATED/UPDATED/DELETED` | จัดการห้องประชุม |
| `ROOM_CALENDAR_CREATED/UPDATED` | เชื่อม/อัพเดต Google Calendar ห้อง |
| `USER_ADDED/REMOVED` | เพิ่ม/ลบ Admin user |
| `USER_PERMISSIONS_UPDATED` | แก้ไข permissions |
| `SETTINGS_CHANGED` | บันทึก System Config |

---

## API Endpoints

### Portal (ต้องมี portal JWT)
| Method | Path | คำอธิบาย |
|--------|------|----------|
| POST | `/api/portal/auth` | Google login (domain check) |
| GET | `/api/portal/cards` | ดึง active cards |

### Admin (ต้องมี JWT หรือ `ADMIN_SECRET`)
| Method | Path | คำอธิบาย |
|--------|------|----------|
| GET | `/api/tickets` | รายการ Ticket (filter/search/page) |
| GET | `/api/tickets/export` | Export CSV |
| PATCH | `/api/tickets/:id/assign` | Assign |
| PATCH | `/api/tickets/:id/status` | เปลี่ยนสถานะ |
| PATCH | `/api/tickets/:id/close` | ปิด Ticket |
| PATCH | `/api/tickets/:id/close-cost` | ปิด + บันทึกค่าใช้จ่าย |
| GET | `/api/stats` | สถิติ Dashboard |
| GET/POST/PUT/DELETE | `/api/categories` | หมวดหมู่ |
| GET/POST/PUT/DELETE | `/api/assignees` | IT Staff |
| GET/POST/PUT/DELETE | `/api/rooms` | ห้องประชุม |
| GET/PATCH | `/api/bookings` | การจอง |
| DELETE | `/api/bookings/:id` | ยกเลิกการจอง (Admin) |
| GET/POST/DELETE/PUT | `/api/allowed-users` | Admin whitelist |
| GET/PUT | `/api/config` | System Config |
| GET/POST/PUT/DELETE | `/api/portal-cards` | Portal Cards (admin) |
| GET | `/api/audit-logs` | Audit Logs |

### LIFF / Portal Desktop (rate-limited: 20 req / 5 min)
| Method | Path | Auth | คำอธิบาย |
|--------|------|------|----------|
| POST | `/api/liff/ticket` | LINE token / Portal JWT | สร้าง Ticket |
| POST | `/api/liff/booking` | LINE token / Portal JWT | จองห้องประชุม |
| POST | `/api/liff/ai` | ไม่บังคับ | AI chat |
| GET | `/api/liff/categories` | - | หมวดหมู่ทั้งหมด |
| GET | `/api/liff/rooms` | - | รายการห้องประชุม |
| GET | `/api/liff/room-slots` | - | Busy slots ของห้อง |
| GET | `/api/liff/bookings-calendar` | - | ข้อมูลปฏิทินรายเดือน |
| GET | `/api/liff/my-tickets` | Portal JWT | ประวัติ Ticket ของ user (อ้างอิง email) |
| GET | `/api/liff/my-bookings` | Portal JWT | ประวัติการจองของ user (อ้างอิง email) |

### Public
| Method | Path | คำอธิบาย |
|--------|------|----------|
| POST | `/webhook` | LINE Webhook |
| POST | `/api/auth/google` | Admin Google OAuth |
| GET | `/health` | Health check |

---

## Environment Variables

```env
# ── MySQL ──────────────────────────────────────────
MYSQL_ROOT_PASSWORD=
MYSQL_DATABASE=STD_Service
MYSQL_USER=helpdesk_user
MYSQL_PASSWORD=
DATABASE_URL="mysql://helpdesk_user:PASSWORD@db:3306/STD_Service"

# ── LINE ───────────────────────────────────────────
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=
LIFF_ID=

# ── Security ───────────────────────────────────────
ADMIN_SECRET=change_this_to_a_strong_secret
JWT_SECRET=change_this_to_a_random_secret_string
CORS_ORIGIN=https://your-domain.com

# ── Portal ─────────────────────────────────────────
# Domain ที่อนุญาต login ผ่าน Portal (ขึ้นต้นด้วย @)
ALLOWED_EMAIL_DOMAIN=@thestandard.co

# ── Google OAuth (Admin Login) ──────────────────────
GOOGLE_CLIENT_ID=
INITIAL_ADMIN_EMAIL=your_admin@company.com

# ── Google Calendar (Room Booking) ──────────────────
# Service Account JSON (string หรือ base64)
GOOGLE_CREDENTIALS=
# Calendar ID สำหรับแสดงใน LIFF (optional)
MASTER_CALENDAR_ID=

# ── Optional ───────────────────────────────────────
DAILY_TICKET_LIMIT=3
PORT=3000
NODE_ENV=production
```

> AI API Key (Anthropic / OpenAI / Gemini) ตั้งผ่าน Admin Console → Settings → AI Assistant ไม่ต้องใส่ใน `.env`

---

## Deploy บน Portainer (NAS)

```bash
# 1. clone + config
git clone https://github.com/earthnpp/tsd-service /opt/stacks/STD-Service
cd /opt/stacks/STD-Service && cp .env.example .env
# แก้ .env ใส่ค่าจริง

# 2. external network (ครั้งแรก)
docker network create management_xtech_net

# 3. deploy ผ่าน Portainer Stacks หรือ
docker compose -f docker-compose.nas.yml up -d

# 4. update หลัง GitHub Actions build เสร็จ
docker compose -f docker-compose.nas.yml pull && docker compose -f docker-compose.nas.yml up -d
```

**ตั้งค่า LINE Webhook:** `https://your-domain.com/webhook`

> LIFF ต้อง Publish (ไม่ใช่ Developing) ถึงจะใช้กับทุกคนได้

---

## CI/CD (GitHub Actions)

Push ไป `main` → GitHub Actions build Docker images ทั้ง backend และ frontend → push ขึ้น GitHub Container Registry (GHCR) พร้อม tag `latest` และ `sha-xxxxxxx`

```
ghcr.io/earthnpp/tsd-service-backend:latest
ghcr.io/earthnpp/tsd-service-frontend:latest
```

---

## Ports

| Service | Host Port |
|---------|-----------|
| Frontend (Nginx) | 8080 |
| Backend (debug only) | 127.0.0.1:3001 |
| MySQL | ไม่ expose |

---

## Troubleshooting

```bash
# ดู logs
docker compose logs backend -f
docker compose logs frontend -f

# รัน migration ด้วยตัวเอง
docker compose exec backend npx prisma migrate deploy

# ทดสอบ Google Calendar
curl -H "x-admin-token: YOUR_ADMIN_SECRET" http://localhost:3001/api/calendar/test

# Rebuild
docker compose up -d --build
```

---

## Google Calendar Setup

1. สร้าง Service Account ใน Google Cloud Console → Enable Calendar API
2. Download JSON key → stringify เป็น string เดียว
3. ใส่ใน `GOOGLE_CREDENTIALS` ใน `.env`
4. Admin Console → Settings → ห้องประชุม → กด **"สร้าง Calendar"** ต่อห้อง

---

## AI Assistant Setup

1. ไป Admin Console → Settings → AI Assistant
2. เลือก **Provider**:
   - `anthropic` → API key จาก [console.anthropic.com](https://console.anthropic.com)
   - `openai` → API key จาก [platform.openai.com](https://platform.openai.com)
   - `gemini` → API key จาก [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
3. ใส่ API Key + เลือก Model + แก้ System Prompt
4. กด **Save**

> Free tier Gemini: 15 req/min, 1,500 req/day — เพียงพอสำหรับใช้งานภายในองค์กร
