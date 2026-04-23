# STD-Service — IT Helpdesk & Service Portal

ระบบ IT Helpdesk ผ่าน LINE Official Account + Service Portal สำหรับพนักงาน The Standard

**Stack:** Node.js 20 + Express · MySQL 8.0 + Prisma ORM · React 18 + Vite · Nginx · Docker Compose

---

## โครงสร้างโปรเจกต์

```
STD-Service/
├── docker-compose.yml
├── .env                            ← สร้างจาก .env.example (ไม่ commit)
│
├── backend/                        ← Node.js + Express REST API (Port 3000)
│   ├── app.js
│   ├── controllers/
│   │   ├── webhookController.js    ← LINE webhook events ทั้งหมด
│   │   ├── adminController.js      ← Admin API
│   │   ├── authController.js       ← Google OAuth (admin)
│   │   ├── liffController.js       ← LIFF: ticket, booking, AI chat, domain check
│   │   └── portalController.js     ← Portal login + PortalCard CRUD
│   ├── services/
│   │   ├── ticketService.js
│   │   ├── bookingService.js       ← Google Calendar sync
│   │   ├── calendarService.js
│   │   ├── categoryService.js
│   │   ├── sessionService.js
│   │   └── auditService.js
│   ├── routes/
│   │   ├── api.js                  ← Admin routes (JWT + requirePermission)
│   │   ├── portal.js               ← Portal auth + public cards
│   │   ├── liff.js
│   │   ├── auth.js
│   │   └── webhook.js
│   ├── views/flex/                 ← LINE Flex Message templates
│   └── prisma/
│       ├── schema.prisma
│       └── migrations/             ← 15 migration files
│
└── frontend/                       ← React (Port 8080 via Nginx)
    ├── nginx.conf
    └── src/
        ├── main.jsx                ← Routing: path-based (ไม่ใช้ react-router)
        ├── PortalApp.jsx           ← Landing Page (/)
        ├── App.jsx                 ← Admin Console (/admin)
        ├── LoginPage.jsx           ← Admin Google OAuth login
        ├── LiffApp.jsx             ← LIFF หน้าหลัก
        ├── LiffBooking.jsx         ← LIFF จองห้องประชุม
        ├── LiffCalendar.jsx        ← LIFF ปฏิทินห้องประชุม
        ├── LiffAI.jsx              ← LIFF AI chat (/liff/ai)
        └── services/api.js         ← API client
```

---

## Routing

| Path | หน้า | เข้าได้ |
|------|------|---------|
| `/` | Service Portal (Landing Page) | @thestandard.co ทุกคน |
| `/admin` | Admin Console | AllowedUser whitelist เท่านั้น |
| `/liff/ai` | AI Assistant chat | LINE LIFF |
| `/liff/booking` | จองห้องประชุม | LINE LIFF |
| `/liff/calendar` | ปฏิทินห้องประชุม | LINE LIFF |
| `/liff/*` | LIFF หลัก (แจ้ง Ticket) | LINE LIFF |

> Portal login → ถ้ามีสิทธิ์ admin จะเห็นปุ่ม **"Admin Console"** → `/admin` โดยไม่ต้อง login ซ้ำ

---

## ฟีเจอร์หลัก

### Service Portal (`/`)
- Login ด้วย Google — ตรวจสอบเฉพาะ @thestandard.co
- Grid of **Service Cards** (icon + ชื่อ + description + URL)
- Admin จัดการ cards ผ่าน Admin Console → Settings → Landing Page

### LINE OA (User)
- Rich Menu 6 ปุ่ม (Text action → `richMenuMap` → postback handler)
- **ถาม AI** → เปิด LIFF AI chat
- **แจ้งปัญหา** → LIFF form: หมวดหมู่ → Asset Tag → อธิบาย → รูปภาพ (optional)
- **ดู Ticket** → Flex Message สถานะ ticket ล่าสุด
- **จองห้องประชุม** → LIFF booking form
- **รายการจอง** / **ติดต่อ IT** → ดึงข้อมูลจาก DB
- Rating: กดดาว → บันทึกเงียบ (ไม่ reply), กดซ้ำ → เงียบ (ตรวจสอบจาก DB)

### AI Assistant (`/liff/ai`)
- Chat กับ AI สำหรับแก้ปัญหา IT เบื้องต้น
- รองรับ Anthropic Claude และ OpenAI GPT
- Config ทั้งหมดใน Admin Settings → AI Assistant (provider, API key, model, system prompt)

### Admin Console (`/admin`) — Sidebar Layout
- **Dashboard** (default): KPI cards, 7-day trend chart, satisfaction rating, category/assignee breakdown
- **Tickets**: filter, search, assign, priority, close, cost breakdown, export CSV
- **Bookings**: จอง/ยกเลิก + Google Calendar sync
- **Users**: AllowedUser whitelist + per-user module permissions (checkbox UI)
- **Export**: Tickets & Bookings CSV
- **Audit Logs**: ประวัติการกระทำทั้งหมด
- **Settings** (sub-tabs):
  - 📞 ติดต่อ — ข้อมูล IT ที่แสดงใน LINE
  - 🔔 แจ้งเตือน — LINE Group ID
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
| `FaqItem` | FAQ (เก็บไว้ใน DB แต่ไม่ได้ใช้ใน bot แล้ว) |
| `Room` | ห้องประชุม + Google Calendar ID |
| `RoomBooking` | การจอง + Google Event ID |
| `BookingCounter` | ตัวนับ BK-XXXX |
| `AllowedUser` | Admin whitelist + `permissions Json` |
| `SystemConfig` | Key-value config ทุกอย่าง (AI key, contact info ฯลฯ) |
| `AuditLog` | ประวัติการกระทำของ admin |
| `PortalCard` | Service cards ที่แสดงใน Landing Page |

---

## Permissions System

```
null        → full access (INITIAL_ADMIN_EMAIL)
[]          → ไม่มีสิทธิ์เลย
["tickets"] → เข้าได้เฉพาะ tickets module
```

**Modules:** `dashboard` · `tickets` · `bookings` · `settings` · `users` · `export` · `audit`

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
| GET | `/api/tickets` | รายการ Ticket |
| GET | `/api/tickets/export` | Export CSV |
| PATCH | `/api/tickets/:id/assign` | Assign |
| PATCH | `/api/tickets/:id/close` | ปิด Ticket |
| PATCH | `/api/tickets/:id/close-cost` | ปิด + บันทึกค่าใช้จ่าย |
| GET | `/api/stats` | สถิติ Dashboard |
| GET/POST/PUT/DELETE | `/api/categories` | หมวดหมู่ |
| GET/POST/PUT/DELETE | `/api/assignees` | IT Staff |
| GET/POST/PUT/DELETE | `/api/rooms` | ห้องประชุม |
| GET/PATCH | `/api/bookings` | การจอง |
| GET/POST/DELETE/PUT | `/api/allowed-users` | Admin whitelist |
| GET/PUT | `/api/config` | System Config |
| GET/POST/PUT/DELETE | `/api/portal-cards` | Portal Cards (admin) |
| GET | `/api/audit-logs` | Audit Logs |

### Public
| Method | Path | คำอธิบาย |
|--------|------|----------|
| POST | `/webhook` | LINE Webhook |
| POST | `/api/auth/google` | Admin Google OAuth |
| POST | `/api/liff/ticket` | สร้าง Ticket จาก LIFF |
| POST | `/api/liff/booking` | จองห้องจาก LIFF |
| POST | `/api/liff/ai` | AI chat |
| GET | `/health` | Health check |

---

## Environment Variables

```env
# MySQL
MYSQL_ROOT_PASSWORD=
MYSQL_DATABASE=helpdesk
MYSQL_USER=helpdesk_user
MYSQL_PASSWORD=
DATABASE_URL="mysql://helpdesk_user:PASSWORD@db:3306/helpdesk"

# LINE
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=
LIFF_ID=

# Security
ADMIN_SECRET=
JWT_SECRET=
CORS_ORIGIN=https://your-domain.com

# Google
GOOGLE_CLIENT_ID=
GOOGLE_CREDENTIALS={"type":"service_account",...}
INITIAL_ADMIN_EMAIL=your@email.com

# Optional
DAILY_TICKET_LIMIT=3
MASTER_CALENDAR_ID=
```

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
docker compose up -d

# 4. update หลัง GitHub Actions build เสร็จ
docker compose pull && docker compose up -d
```

**ตั้งค่า LINE Webhook:** `https://your-domain.com/webhook`

> LIFF ต้อง Publish (ไม่ใช่ Developing) ถึงจะใช้กับทุกคนได้

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
docker compose logs backend
docker compose logs frontend

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
