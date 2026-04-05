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
│   ├── app.js                      ← Entry point, middleware setup
│   ├── Dockerfile
│   ├── package.json
│   ├── controllers/
│   │   ├── webhookController.js    ← จัดการ LINE webhook events ทั้งหมด
│   │   ├── adminController.js      ← Admin API handlers
│   │   ├── authController.js       ← Google OAuth authentication
│   │   └── liffController.js       ← LINE LIFF endpoints
│   ├── services/
│   │   ├── ticketService.js        ← CRUD Ticket + daily limit
│   │   ├── bookingService.js       ← ตรรกะการจองห้องประชุม
│   │   ├── calendarService.js      ← Google Calendar API integration
│   │   ├── categoryService.js      ← จัดการหมวดหมู่และหมวดย่อย
│   │   └── sessionService.js       ← สถานะการสนทนา LINE bot
│   ├── routes/
│   │   ├── webhook.js              ← POST /webhook (LINE)
│   │   ├── api.js                  ← Admin API routes (JWT-protected)
│   │   ├── liff.js                 ← LIFF public endpoints
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
│       └── migrations/             ← 9 migration files
│
└── frontend/                       ← React Admin Dashboard (Port 8080)
    ├── Dockerfile                  ← Multi-stage: build → Nginx
    ├── nginx.conf                  ← Reverse proxy config
    ├── vite.config.js
    ├── .env.example
    └── src/
        ├── main.jsx                ← React entry point
        ├── App.jsx                 ← Admin Dashboard หลัก
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
| `AllowedUser` | Whitelist อีเมลที่เข้าถึง Admin ได้ |

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

### Admin Dashboard (React)
- จัดการ Ticket: ดู, กรอง, ค้นหา, assign, เปลี่ยนสถานะ, ปิด, export CSV
- บันทึกค่าใช้จ่ายซ่อม (จำนวน, VAT, vendor)
- สถิติ Real-time (pending / in-progress / completed)
- จัดการหมวดหมู่ & FAQ
- จัดการห้องประชุมและการจอง
- จัดการ IT Staff (Assignee)
- ควบคุมสิทธิ์เข้าถึง (AllowedUser whitelist)
- Google Calendar sync สำหรับห้องประชุม

### Rate Limiting & Deduplication
- จำกัด Ticket ต่อ user: 3 ต่อวัน (ตั้งค่าได้ผ่าน `DAILY_TICKET_LIMIT`)
- ป้องกัน double-submit: FAQ resolved (1 ชม.), Rating (24 ชม.), Booking confirm (30 วินาที)

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

# Google
GOOGLE_CLIENT_ID=your_google_oauth_client_id_here
GOOGLE_CREDENTIALS={"type":"service_account",...}   # Service Account JSON (stringify)
INITIAL_ADMIN_EMAIL=your_admin@gmail.com

# Optional
PORT=3000
NODE_ENV=production
DAILY_TICKET_LIMIT=3
MASTER_CALENDAR_ID=your_google_calendar_id
```

> `VITE_ADMIN_TOKEN` และ `VITE_GOOGLE_CLIENT_ID` ใน frontend จะถูก inject อัตโนมัติจาก `ADMIN_SECRET` และ `GOOGLE_CLIENT_ID` ผ่าน Docker build args

---

## Deploy บน Portainer

### วิธีที่ 1: Stacks (แนะนำ)

1. **เตรียม repository บนเซิร์ฟเวอร์**
   ```bash
   git clone <repo-url> /opt/stacks/STD-Service
   cd /opt/stacks/STD-Service
   cp .env.example .env
   nano .env   # ใส่ค่า secrets ทั้งหมด
   ```

2. **สร้าง external network** (ถ้ายังไม่มี)
   ```bash
   docker network create management_xtech_net
   ```

3. **เปิด Portainer** → ไปที่ **Stacks** → **Add stack**

4. ตั้งชื่อ stack เช่น `helpdesk`

5. เลือก **Repository** แล้วกรอก:
   - Repository URL: URL ของ Git repo
   - Compose path: `docker-compose.yml`

   **หรือ** เลือก **Upload** แล้วอัปโหลดไฟล์ `docker-compose.yml`

   **หรือ** เลือก **Web editor** แล้ว paste เนื้อหา `docker-compose.yml`

6. เลื่อนลงไปที่ **Environment variables** → คลิก **Load variables from .env file** แล้วอัปโหลดไฟล์ `.env`
   
   หรือกรอก Environment variables ด้วยตนเองทีละตัว

7. คลิก **Deploy the stack**

8. รอ Portainer build images และ start containers (~2-5 นาที)

9. ตรวจสอบ:
   - Admin Dashboard: `http://<server-ip>:8080`
   - Backend API:     `http://<server-ip>:3001/health`

---

### วิธีที่ 2: ผ่าน Portainer Agent (GitOps)

1. ใน Portainer ไปที่ **Stacks** → **Add stack**
2. เลือก **Git Repository**
3. กรอก Repository URL และ branch
4. เปิด **GitOps updates** เพื่อให้ auto-deploy เมื่อ push code ใหม่
5. ใส่ Environment variables
6. คลิก **Deploy the stack**

---

### ตั้งค่า LINE Webhook หลัง Deploy

1. เปิด [LINE Developers Console](https://developers.line.biz/)
2. เลือก Channel → **Messaging API**
3. Webhook URL: `https://your-domain.com/webhook`
   - ถ้าใช้ IP ตรงๆ: `http://<server-ip>:3001/webhook`
4. เปิด **Use webhook**
5. ปิด **Auto-reply messages**
6. คลิก **Verify** เพื่อทดสอบการเชื่อมต่อ

---

### Ports ที่ใช้งาน

| Service | Container Port | Host Port |
|---------|---------------|-----------|
| Frontend (Nginx) | 80 | **8080** |
| Backend (Express) | 3000 | **3001** |
| Database (MySQL) | 3306 | **3306** |

---

### Volumes ที่สร้าง

| Volume | เก็บข้อมูล |
|--------|-----------|
| `db_data` | MySQL database files |
| `uploads_data` | รูปภาพที่ user อัปโหลดผ่าน LIFF |

---

### Networks

| Network | ประเภท | คำอธิบาย |
|---------|--------|----------|
| `helpdesk-net` | bridge (internal) | การสื่อสารระหว่าง containers |
| `management_xtech_net` | external | เชื่อมต่อกับ infrastructure ภายนอก |

> ต้องสร้าง `management_xtech_net` ก่อน deploy: `docker network create management_xtech_net`

---

## การพัฒนาแบบ Local (ngrok)

```bash
# 1. ตั้งค่า environment
cp .env.example .env
# แก้ไข .env ใส่ LINE credentials

# 2. รัน Docker
docker compose up -d --build

# 3. เปิด ngrok เพื่อรับ webhook
ngrok http 3001

# 4. นำ URL จาก ngrok ไปตั้ง webhook ใน LINE Developers Console
# เช่น https://xxxx.ngrok-free.app/webhook
```

---

## Troubleshooting

**Backend ไม่ start / database error**
```bash
docker compose logs backend
# ถ้าเห็น "Can't reach database" → รอ MySQL healthy แล้ว restart backend
docker compose restart backend
```

**Migration ไม่รัน**
```bash
docker compose exec backend npx prisma migrate deploy
```

**ดู logs แบบ real-time**
```bash
docker compose logs -f backend
docker compose logs -f frontend
```

**Rebuild หลังแก้ code**
```bash
docker compose up -d --build
```
