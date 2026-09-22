# ระบบทะเบียนทรัพย์สิน (Asset Management) — Cloudflare Pages + D1

SPA แบบไม่มี build step (`index.html` + `js/`) ใช้ Cloudflare Pages Functions (`functions/api/*`) คุยกับ D1 (SQLite)

## เริ่มใช้งานในเครื่อง

```bash
npm install                # ติดตั้ง wrangler
npm run db:local           # สร้าง schema + seed ข้อมูลทดสอบลง D1 local
npm run dev                # http://localhost:8788
```

บัญชีทดสอบ: `admin / admin123` (ถูกบังคับเปลี่ยนรหัสผ่านครั้งแรก), `EMP001 / pass1234`, `EMP002 / pass5678`, `EMP003 / pass1234`, `EMP004 / pass1234`

## Deploy / อัปเกรดฐานข้อมูลเดิม

```bash
# 1. ตั้งค่า secret สำหรับเซ็น session token (แนะนำอย่างยิ่งสำหรับ production)
npx wrangler pages secret put AUTH_SECRET      # ใส่ค่าสุ่มยาว ๆ เช่น openssl rand -base64 48

# 2. ฐานข้อมูลใหม่
npm run db:schema:remote

# 2'. ฐานข้อมูลเดิม (สร้างก่อนเวอร์ชัน 1.1) — รันครั้งเดียว: ลบ PIN เก่า + เพิ่ม index
npm run db:migrate:remote

# 3. deploy
npm run deploy
```

ถ้าไม่ตั้ง `AUTH_SECRET` ระบบจะสุ่ม secret ให้เองครั้งแรกและเก็บไว้ใน `Settings._authSecret` (ใช้งานได้ แต่ควรตั้งค่าเองใน production)

## สถาปัตยกรรม backend

```
functions/
  _lib/               โค้ดใช้ร่วมกัน (ไม่ถูก route)
    auth.js           token HMAC-SHA256 (หมดอายุ 12 ชม.), requireAuth / requireAdmin / requirePermission
    password.js       PBKDF2-SHA256 100k รอบ — รหัสผ่านเดิมที่เป็น plain text จะถูก hash ให้อัตโนมัติเมื่อ login สำเร็จครั้งถัดไป
    ratelimit.js      จำกัดการ login ต่อ IP / ต่อ username (best-effort ต่อ isolate)
    validate.js       readJson, parsePagination, str/num/dateStr/oneOf, buildInsert/buildUpdate
    models.js         กติกา field ของแต่ละตาราง (allow-list + validation) ใช้ทั้ง list route และ item route
    response.js       json/ok/fail + HttpError
  api/
    _middleware.js    แปลง error เป็น JSON, security headers, log ทุก request
    auth/             POST login, GET ตรวจ session
    import/           POST นำเข้า Excel ทั้งชุดใน D1 batch (admin)
    assets/ assignments/ maintenance/ categories/ departments/ employees/ users/ settings/ logs/ dashboard/
```

### สิทธิ์ (บังคับที่ server ทุก endpoint)

| โมดูล | อ่าน | เขียน |
|---|---|---|
| assets | login | สิทธิ์ `assets` (PUT ยอมให้ `assignments`/`maintenance` ด้วย เพราะต้องอัปเดตสถานะ/ผู้ถือครอง) |
| assignments / maintenance / categories | login | สิทธิ์ชื่อเดียวกัน |
| departments / employees | login | สิทธิ์ `settings` |
| settings (orgName, orgSub) | public | สิทธิ์ `settings` |
| users | login (ไม่มี password ในผลลัพธ์) | admin เท่านั้น — ผู้ใช้แก้ชื่อ/รหัสผ่านตัวเองได้ |
| logs | login | login (ชื่อผู้ทำรายการมาจาก token ไม่ใช่จาก client) |
| import | — | admin |

admin มีสิทธิ์ทุกอย่าง; ลบ admin คนสุดท้าย / ลบตัวเอง / ลดสิทธิ์ตัวเองไม่ได้

## Frontend

- `js/api.js` — timeout 15 วิ, dedupe GET, ถ้า server ตอบ 401 จะ logout และพากลับหน้า login อัตโนมัติ, `API.checkSession()` ตรวจ token ตอนเปิดแอป
- `js/db.js` — cache ข้อมูลอ้างอิง (categories/departments/employees) พร้อม retry
- `js/app.js` — router, sidebar, บังคับเปลี่ยนรหัสผ่านครั้งแรก, auto-sync ทุก 15 วิ
- เปิด `?debug=1` เพื่อดู log `[API]` / `[Router]` ใน console บน production
