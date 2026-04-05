# IT Helpdesk — LINE OA + Admin Dashboard

ระบบแจ้งปัญหา IT ผ่าน LINE Official Account พร้อม Admin Dashboard สำหรับจัดการ Ticket และจองห้องประชุม

**Stack:** Node.js 20 + Express · MySQL 8.0 + Prisma ORM · React 18 + Vite · Nginx · Docker Compose

---

## โครงสร้างโปรเจกต์

```
STD-Service/
├── docker-compose.yml              ← Multi-container orchestration
├── .env                            ← สร้างจาก .env.example (ไม่ commit)
├── .env.example                    ← Template ตัวแปรสภาพแวดล้อม
│
├── backend/                        ← Node.js + Express REST API (Port 3000)
│   ├── app.js                      ← Entry point, middleware, security setup
│   ├── Dockerfile
│   ├── package.json
│   ├── controllers/
│   │   ├── webhookController.js    ← จัดการ LINE webhook events ทั้งหมด
│   │   ├── adminController.js      ← Admin API handlers
│   │   ├── authController.js       ← Google OAuth authentication
│   │   └── liffController.js       ← LINE LIFF endpoints
│   ├── services/
│   │   ├── ticketService.js        ← CRUD Ticket + daily limit
│   │   ├── bookingService.js       ← ตรรกะการจองห้องประชุม + Google Calendar sync
│   │   ├── calendarService.js      ← Google Calendar API integration
│   │   ├── categoryService.js      ← จัดการหมวดหมู่และหมวดย่อย
│   │   └── sessionService.js       ← สถานะการสนทนา LINE bot
│   ├── routes/
│   │   ├── webhook.js              ← POST /webhook (LINE)
│   │   ├── api.js                  ← Admin API routes (JWT-protected)
│   │   ├── liff.js                 ← LIFF public endpoints + rate limiting
│   │   └── auth.js                 ← Google OAuth routes
│   ├── views/flex/                 ← LINE Flex Message templates
│   │   ├── mainMenu.js
│   │   ├── categoryMenu.js
│   │   ├── subcategoryMenu.js
│   │   ├── ticketConfirm.js
│   │   ├── ticketStatus.js
│   │   ├── bookingViews.js
│   │   └── ratingMenu.js
│   ├── config/
│   │   └── google-credentials.json ← Service account key (ไม่ commit)
│   └── prisma/
│       ├── schema.prisma           ← Data models
│       └── migrations/             ← 10 migration files
│
└── frontend/                       ← React Admin Dashboard (Port 8080)
    ├── Dockerfile                  ← Multi-stage: build → Nginx
    ├── nginx.conf                  ← Reverse proxy config
    ├── vite.config.js
    ├── .env.example
    └── src/
        ├── main.jsx                ← React entry point
        ├── App.jsx                 ← Admin Dashboard (Sidebar layout)
        ├── LoginPage.jsx           ← Google OAuth login
        ├── LiffApp.jsx             ← LIFF หน้าหลัก
        ├── LiffBooking.jsx         ← LIFF จองห้องประชุม
        ├── LiffCalendar.jsx        ← LIFF ดูปฏิทินห้องประชุม
        └── services/api.js         ← API client library
```

---

## Database Schema (Prisma)

| Model | คำอธิบาย |
|-------|----------|
| `Ticket` | Ticket แจ้งปัญหา IT (status, priority, assignee, cost, rating) |
| `UserSession` | สถานะการสนทนา LINE bot ต่อ user |
| `Category` / `Subcategory` | หมวดหมู่ปัญหา (Hardware/Software/Network/Account ฯลฯ) |
| `Assignee` | รายชื่อ IT staff สำหรับ assign ticket |
| `TicketCounter` | ตัวนับเลข Ticket (รูปแบบ HLP-0001) |
| `FaqItem` | คลังคำถามที่พบบ่อย + viewCount + resolvedCount |
| `Room` | ห้องประชุม + Google Calendar ID |
| `RoomBooking` | การจองห้องประชุม + Google Event ID |
| `BookingCounter` | ตัวนับเลขการจอง (รูปแบบ BK-0001) |
| `AllowedUser` | Whitelist อีเมลที่เข้าถึง Admin ได้ |
| `SystemConfig` | Key-value config (ข้อมูลติดต่อ IT, ฯลฯ) |

---

## ฟีเจอร์หลัก

### LINE OA (User)
```
User แตะ "แจ้งปัญหา IT"
  → เลือกหมวดหมู่ (Hardware / Software / Network / Account)
  → เลือกประเภทย่อย
  → พิมพ์หัวข้อปัญหา
  → เลือกสถานที่ (Quick Reply)
  → ระบุ Asset Tag
  → อธิบายปัญหา (ข้อความหรือรูปภาพ)
  → ได้รับ Ticket Confirmation Card พร้อมเลข HLP-XXXX

Admin Assign + ปิด Ticket
  → User ได้รับ LINE Notification
  → ระบบส่ง prompt ให้คะแนน (1–5 ดาว)
```

### Admin Dashboard (React — Sidebar Layout)
- จัดการ Ticket: ดู, กรอง, ค้นหา, assign, เปลี่ยนสถานะ, ปิด, export CSV
- บันทึกค่าใช้จ่ายซ่อม (จำนวน, VAT, vendor)
- สถิติ Real-time (pending / in-progress / completed)
- จัดการหมวดหมู่ & FAQ
- จัดการห้องประชุมและการจอง + Google Calendar sync
- ตั้งค่า Calendar ID ทุกห้องพร้อมกัน
- จัดการ IT Staff (Assignee)
- ควบคุมสิทธิ์เข้าถึง (AllowedUser whitelist)
- แก้ไขข้อมูลติดต่อ IT ที่แสดงใน LINE ได้จาก UI
- URL Hash navigation (รีเพจแล้วอยู่หน้าเดิม)

### Google Calendar Integration
- สร้าง Calendar ใหม่ผ่าน service account อัตโนมัติ
- Event format: `ชื่อห้อง : หัวข้อการจอง`
- Description: ผู้จอง / รายละเอียด / หมายเลขการจอง
- ยกเลิกการจองใน system → ลบ event ใน Calendar อัตโนมัติ

### Rate Limiting & Deduplication
- จำกัด Ticket ต่อ user: 3 ต่อวัน (ตั้งค่าได้ผ่าน `DAILY_TICKET_LIMIT`)
- LIFF write endpoints (ticket/booking): 20 requests / 5 นาที ต่อ IP
- Auth endpoints: 10 requests / 15 นาที
- Admin API: 300 requests / นาที

---

## API Endpoints

### Admin (ต้องใช้ JWT Token หรือ `ADMIN_SECRET`)

| Method | Path | คำอธิบาย |
|--------|------|----------|
| GET | `/api/tickets` | รายการ Ticket (รองรับ filter/search) |
| GET | `/api/tickets/:id` | ดู Ticket เดี่ยว |
| GET | `/api/tickets/export` | Export CSV |
| PATCH | `/api/tickets/:id/assign` | Assign IT Staff |
| PATCH | `/api/tickets/:id/status` | อัปเดตสถานะ |
| PATCH | `/api/tickets/:id/close` | ปิด Ticket |
| PATCH | `/api/tickets/:id/cost` | บันทึกค่าใช้จ่าย |
| GET | `/api/stats` | สถิติ Dashboard |
| GET/POST/PUT/DELETE | `/api/categories` | จัดการหมวดหมู่ |
| POST/PUT/DELETE | `/api/categories/:id/subcategories` | จัดการหมวดย่อย |
| GET/POST/PUT/DELETE | `/api/faq` | จัดการ FAQ |
| GET/POST/PUT/DELETE | `/api/rooms` | จัดการห้องประชุม |
| GET | `/api/bookings` | รายการการจอง |
| PATCH | `/api/bookings/:id/cancel` | ยกเลิกการจอง |
| GET/POST/DELETE | `/api/allowed-users` | จัดการ Whitelist |
| GET/POST/PUT/DELETE | `/api/assignees` | จัดการ IT Staff |
| GET | `/api/config` | ดึง System Config |
| PUT | `/api/config` | อัปเดต System Config |
| GET | `/api/calendar/test` | ทดสอบ Google credentials |

### Public

| Method | Path | คำอธิบาย |
|--------|------|----------|
| POST | `/webhook` | LINE Webhook (signature verified) |
| POST | `/api/auth/google` | Google OAuth callback |
| GET | `/api/liff/*` | LIFF endpoints |
| GET | `/api/line-image/:messageId` | Image proxy จาก LINE |
| GET | `/health` | Health check |

---

## Environment Variables

### `.env` (root)

```env
# MySQL
MYSQL_ROOT_PASSWORD=rootpassword
MYSQL_DATABASE=helpdesk
MYSQL_USER=helpdesk_user
MYSQL_PASSWORD=helpdesk_pass
DATABASE_URL="mysql://helpdesk_user:helpdesk_pass@db:3306/helpdesk"

# LINE Platform
LINE_CHANNEL_SECRET=your_channel_secret_here
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token_here
LIFF_ID=your_liff_id_here

# Security
ADMIN_SECRET=change_this_to_a_strong_secret
JWT_SECRET=change_this_to_a_random_secret_string
CORS_ORIGIN=https://your-domain.com          # เว้นว่างไว้ = same-origin only

# Google
GOOGLE_CLIENT_ID=your_google_oauth_client_id_here
GOOGLE_CREDENTIALS={"type":"service_account",...}   # Service Account JSON (stringify หรือ base64)
INITIAL_ADMIN_EMAIL=your_admin@gmail.com

# Optional
PORT=3000
NODE_ENV=production
DAILY_TICKET_LIMIT=3
MASTER_CALENDAR_ID=your_google_calendar_id
```

---

## Security

| Layer | มาตรการ |
|-------|---------|
| HTTP Headers | Helmet.js (XSS, HSTS, clickjacking protection) |
| CORS | จำกัดเฉพาะ `CORS_ORIGIN` ที่กำหนด |
| Rate Limiting | Auth 10/15min · LIFF write 20/5min · Admin 300/min |
| Auth | JWT + Google OAuth + AllowedUser whitelist |
| LINE Webhook | Signature verification (HMAC-SHA256) |
| File Upload | Validate MIME type (images only) + 10MB limit |
| Database | Prisma parameterized queries (SQL injection safe) |
| Secrets | `.env` gitignored, service account key gitignored |
| Network | MySQL port ปิดจาก external · Backend bind to 127.0.0.1 |

---

## Deploy บน Portainer

### 1. เตรียมเซิร์ฟเวอร์

```bash
git clone <repo-url> /opt/stacks/STD-Service
cd /opt/stacks/STD-Service
cp .env.example .env
nano .env   # ใส่ค่า secrets ทั้งหมด
```

### 2. สร้าง external network (ถ้ายังไม่มี)

```bash
docker network create management_xtech_net
```

### 3. Deploy ผ่าน Portainer Stacks

1. **Stacks** → **Add stack** → ตั้งชื่อ `helpdesk`
2. เลือก **Repository** หรือ **Upload** `docker-compose.yml`
3. **Environment variables** → Load จากไฟล์ `.env`
4. กด **Deploy the stack**

### 4. ตั้งค่า LINE Webhook

1. [LINE Developers Console](https://developers.line.biz/) → Channel → Messaging API
2. Webhook URL: `https://your-domain.com/webhook`
3. เปิด **Use webhook** → ปิด **Auto-reply messages**
4. กด **Verify**

> **หมายเหตุ:** LIFF channel ต้อง Publish (ไม่ใช่ Developing) ถึงจะใช้งานได้กับทุกคน

---

### Ports

| Service | Container Port | Host Port | หมายเหตุ |
|---------|---------------|-----------|---------|
| Frontend (Nginx) | 80 | **8080** | Public |
| Backend (Express) | 3000 | **127.0.0.1:3001** | Localhost debug only |
| Database (MySQL) | 3306 | — | Internal only (ไม่ expose) |

### Volumes

| Volume | เก็บข้อมูล |
|--------|-----------|
| `db_data` | MySQL database files |
| `uploads_data` | รูปภาพที่ user อัปโหลดผ่าน LIFF |

### Networks

| Network | ประเภท | คำอธิบาย |
|---------|--------|----------|
| `helpdesk-net` | bridge (internal) | การสื่อสารระหว่าง containers |
| `management_xtech_net` | external | เชื่อมต่อกับ infrastructure ภายนอก |

---

## Google Calendar Setup

1. สร้าง Service Account ใน Google Cloud Console
2. Enable **Google Calendar API** ในโปรเจกต์
3. ดาวน์โหลด JSON key → แปลง base64: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("key.json")) | clip`
4. ใส่ใน `GOOGLE_CREDENTIALS` ใน Portainer environment variables
5. Admin Dashboard → Settings → ห้องประชุม → กด **"สร้าง Calendar"** ต่อห้อง
6. ทดสอบ: `GET /api/calendar/test` (ใส่ header `x-admin-token`)

---

## การพัฒนาแบบ Local (ngrok)

```bash
cp .env.example .env        # ใส่ LINE credentials
docker compose up -d --build
ngrok http 3001             # นำ URL ไปตั้งเป็น webhook ใน LINE Console
```

---

## Troubleshooting

**Backend ไม่ start / database error**
```bash
docker compose logs backend
docker compose restart backend
```

**Migration ไม่รัน**
```bash
docker compose exec backend npx prisma migrate deploy
```

**ทดสอบ Google Calendar credentials**
```bash
curl -H "x-admin-token: YOUR_ADMIN_SECRET" http://localhost:3001/api/calendar/test
```

**Rebuild หลังแก้ code**
```bash
docker compose up -d --build
```
