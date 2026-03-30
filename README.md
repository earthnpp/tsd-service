# IT Helpdesk — LINE OA + Admin Dashboard

MVC architecture บน Docker: Node.js + MySQL + React

## โครงสร้าง

```
STD-Service/
├── docker-compose.yml
├── .env                    ← สร้างจาก .env.example
├── backend/                ← Node.js + Express (Controller + Model)
│   ├── app.js
│   ├── controllers/        ← webhookController, adminController
│   ├── services/           ← ticketService, sessionService
│   ├── views/flex/         ← Line Flex Message templates (View)
│   ├── routes/             ← webhook.js, api.js
│   └── prisma/             ← MySQL schema + migrations
└── frontend/               ← React Admin Dashboard (View)
    └── src/
        ├── App.jsx
        └── services/api.js
```

## เริ่มต้นใช้งาน

### 1. ตั้งค่า Environment
```bash
cp .env.example .env
# แก้ไข .env ใส่ LINE_CHANNEL_SECRET และ LINE_CHANNEL_ACCESS_TOKEN
cp frontend/.env.example frontend/.env
# ใส่ VITE_ADMIN_TOKEN ให้ตรงกับ ADMIN_SECRET ใน .env
```

### 2. รัน Docker
```bash
docker compose up -d --build
```

### 3. ตรวจสอบ
- Admin Dashboard: http://localhost:8080
- Backend API:     http://localhost:3000/health
- Database:        localhost:3306

### 4. ตั้งค่า LINE Webhook
- เปิด LINE Developers Console
- Webhook URL: `https://your-domain.com/webhook`
- เปิด "Use webhook" และปิด "Auto-reply messages"
- ใช้ ngrok สำหรับ local dev: `ngrok http 3000`

## LINE OA User Flow

```
User → แตะ "แจ้งปัญหา IT"
     → เลือกหมวด (Hardware/Software/Network/Account)
     → เลือกประเภทย่อย
     → พิมพ์หัวข้อ
     → เลือกสถานที่ (Quick Reply)
     → ระบุ Asset Tag
     → อธิบายปัญหา (หรือส่งรูป)
     → ได้รับ Ticket Confirmation Card

Admin → เปิด Dashboard → assign → ปิด Ticket + ใส่ resolution
     → User ได้รับ Line notification + prompt ให้คะแนน
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /webhook | LINE webhook |
| GET | /api/tickets | ดึงรายการ ticket |
| GET | /api/tickets/:id | ดึง ticket เดี่ยว |
| PATCH | /api/tickets/:id/assign | มอบหมาย IT staff |
| PATCH | /api/tickets/:id/close | ปิด ticket |
| GET | /api/stats | สถิติ dashboard |
