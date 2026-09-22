# ตรวจสอบและปรับปรุงระบบทั้งหมด — Security · Performance · Bug Fixes · Validation

วิเคราะห์โค้ดทุกไฟล์ในโปรเจกต์แล้วพบปัญหา 4 กลุ่มหลัก ดังนี้

---

## ปัญหาที่พบ (สรุป)

### 🔴 ความปลอดภัย (Security)
| # | ปัญหา | ไฟล์ |
|---|---|---|
| S1 | **Token ปลอม** — token เป็นแค่ `adm_` + base64 ตรวจสอบได้ง่าย ไม่มี server-side validation จริง | `auth/index.js`, `api.js` |
| S2 | **รหัสผ่านเก็บ plain text** ใน DB ไม่มี hashing ใดเลย | `auth/index.js`, `users/index.js` |
| S3 | **Settings API PUT** ตรวจสอบ token ด้วย `token === adminPin` (plain text PIN เป็น token ได้!) | `settings/index.js` |
| S4 | **Users GET ไม่มี auth guard** — ใครก็ดึงรายชื่อ user ทั้งหมดได้โดยไม่ต้อง login | `users/index.js` |
| S5 | **ไม่มี rate limiting** บน auth endpoint | `auth/index.js` |
| S6 | **ไม่มี CORS header** บน API responses — อาจถูก abuse จาก domain อื่น | ทุก function |

### 🟠 บัก / ปัญหาที่มีอยู่แล้ว (Bugs)
| # | ปัญหา | ไฟล์ |
|---|---|---|
| B1 | **`API.request()` ไม่มี timeout** — ถ้า Cloudflare D1 ช้า/หยุด UI จะค้างไม่มีกำหนด | `api.js` |
| B2 | **`syncDB()` ไม่ retry** — ถ้า network แว่บหน้าจะเด้งเป็น error ทันที | `db.js` |
| B3 | **`assignments/index.js` POST ไม่ validate** `assetId` required field | `assignments/index.js` |
| B4 | **`maintenance/index.js` POST ไม่ validate** `assetId` required field | `maintenance/index.js` |
| B5 | **`departments/index.js` POST ไม่ validate** `name` required field | `departments/index.js` |
| B6 | **`categories/index.js` POST ไม่ validate** `name`, `code` required fields | `categories/index.js` |
| B7 | **`employees/index.js` POST ไม่ validate** `name`, `id` required | `employees/index.js` |
| B8 | **`assets/index.js` GET** ไม่ validate limit (อาจ limit=9999 ได้) | `assets/index.js` |
| B9 | **`boot()` ใน `app.js`** ไม่จัดการกรณี syncDB fail — หน้าอาจค้าง | `app.js` |

### 🟡 ประสิทธิภาพ CRUD (Performance)
| # | ปัญหา | ไฟล์ |
|---|---|---|
| P1 | **dashboard API ดึงข้อมูลแบบ sequential** — ควรดึงพร้อมกัน (Promise.all) | `dashboard/index.js` |
| P2 | **settings/index.js PUT** วน loop UPDATE ทีละ key — ควรเป็น batch | `settings/index.js` |
| P3 | **`api.js` log()** สร้าง `Date.now()` id ซ้ำได้ถ้า concurrent — ควรเพิ่ม crypto random | `api.js` |
| P4 | **`api.js` ไม่มี request deduplication** — กด refresh เร็วๆ ส่ง request ซ้ำ | `api.js` |
| P5 | **`assignments/index.js` GET default limit=1000** — โหลดหนักโดยไม่จำเป็น | `assignments/index.js` |
| P6 | **`maintenance/index.js` GET default limit=1000** — เหมือนกัน | `maintenance/index.js` |

### 🔵 Console Logging & Error Clarity
| # | ปัญหา | ไฟล์ |
|---|---|---|
| L1 | **Backend error message** แค่ `err.message` ดิบๆ ไม่บอก endpoint, method, หรือ context | ทุก function |
| L2 | **Frontend console** ไม่ log detail ของ request (url, method, status) | `api.js` |
| L3 | **syncDB error** แค่ console.error ทั่วๆ ไม่บอกว่า endpoint ไหนล้มเหลว | `db.js` |

---

## Proposed Changes

### Backend Functions

#### [MODIFY] [assets/index.js](file:///c:/Users/Laptop-QSP/Desktop/system-assets/functions/api/assets/index.js)
- เพิ่ม `Authorization` guard บน POST/PUT/DELETE
- จำกัด limit สูงสุด 500
- เพิ่ม structured error logging พร้อม endpoint context

#### [MODIFY] [assignments/index.js](file:///c:/Users/Laptop-QSP/Desktop/system-assets/functions/api/assignments/index.js)
- Validate required field: `assetId`
- ลด default limit จาก 1000 → 200
- เพิ่ม auth guard

#### [MODIFY] [maintenance/index.js](file:///c:/Users/Laptop-QSP/Desktop/system-assets/functions/api/maintenance/index.js)
- Validate required field: `assetId`, `type`
- ลด default limit จาก 1000 → 200
- เพิ่ม auth guard

#### [MODIFY] [departments/index.js](file:///c:/Users/Laptop-QSP/Desktop/system-assets/functions/api/departments/index.js)
- Validate required field: `name`
- เพิ่ม auth guard (admin only) บน POST

#### [MODIFY] [categories/index.js](file:///c:/Users/Laptop-QSP/Desktop/system-assets/functions/api/categories/index.js)
- Validate required: `name`, `code`
- เพิ่ม auth guard

#### [MODIFY] [employees/index.js](file:///c:/Users/Laptop-QSP/Desktop/system-assets/functions/api/employees/index.js)
- Validate required: `id`, `name`
- เพิ่ม auth guard

#### [MODIFY] [users/index.js](file:///c:/Users/Laptop-QSP/Desktop/system-assets/functions/api/users/index.js)
- เพิ่ม auth guard บน GET endpoint (ต้องมี valid token)
- Response ต้องไม่ส่ง `password` กลับไปในทุกกรณี

#### [MODIFY] [settings/index.js](file:///c:/Users/Laptop-QSP/Desktop/system-assets/functions/api/settings/index.js)
- แก้บัก S3: ลบ `token === adminPin` ออก ใช้ `adm_` prefix check เท่านั้น
- เพิ่ม validation สำหรับ key allowlist

#### [MODIFY] [auth/index.js](file:///c:/Users/Laptop-QSP/Desktop/system-assets/functions/api/auth/index.js)
- เพิ่ม basic rate limit (Cloudflare-compatible: ใช้ KV หรือ header-based)
- Log failed login attempts พร้อม username และ IP
- ลบ fallback PIN ออก (หรือ warn clearly ใน console)

#### [MODIFY] [logs/index.js](file:///c:/Users/Laptop-QSP/Desktop/system-assets/functions/api/logs/index.js)
- เพิ่ม auth guard บน GET
- Validate required fields บน POST ได้แก่ `action`, `module`

#### [MODIFY] [dashboard/index.js](file:///c:/Users/Laptop-QSP/Desktop/system-assets/functions/api/dashboard/index.js)
- แยก query ที่รันอยู่ใน Promise.all แล้วออกให้ชัดเจน
- เพิ่ม auth guard

---

### Frontend

#### [MODIFY] [api.js](file:///c:/Users/Laptop-QSP/Desktop/system-assets/js/api.js)
- เพิ่ม **request timeout** (15 วินาที) ด้วย `AbortController`
- เพิ่ม **structured console logging** สำหรับ dev mode:
  - `[API] GET /api/assets → 200 (45ms)`
  - `[API ERROR] POST /api/assets → 409 | message: ...`
- เพิ่ม **in-flight request deduplication** สำหรับ GET
- ปรับ `log()` ให้ใช้ `crypto.randomUUID()` แทน Math.random

#### [MODIFY] [db.js](file:///c:/Users/Laptop-QSP/Desktop/system-assets/js/db.js)
- เพิ่ม **retry logic** (retry 1 ครั้ง หลังจาก 2 วินาที) ใน `syncDB()`
- เพิ่ม log แบบละเอียดเมื่อ sync fail: บอกว่า endpoint ไหนล้มเหลว

#### [MODIFY] [app.js](file:///c:/Users/Laptop-QSP/Desktop/system-assets/js/app.js)
- `boot()` ต้องจัดการ syncDB fail อย่าง graceful — แสดง retry button ถ้าล้มเหลว
- เพิ่ม `console.group` สำหรับ router transitions เพื่อ debug ได้ง่าย

---

## Open Questions

> [!IMPORTANT]
> **เรื่องรหัสผ่าน (Password Hashing):** ตอนนี้รหัสผ่านเก็บเป็น plain text ใน D1 ซึ่งเป็นความเสี่ยงสูงมาก การแก้ที่ถูกต้องคือใช้ bcrypt หรือ SHA-256 แต่ Cloudflare Workers ไม่มี `bcrypt` ในตัว — ต้องใช้ `crypto.subtle.digest('SHA-256', ...)` แทน
> 
> คำถาม: **ต้องการ migrate รหัสผ่านทุกตัวไปเป็น SHA-256 hash ไหม?** (จะทำให้ user ทุกคนต้อง reset รหัสผ่านครั้งหนึ่ง)

> [!IMPORTANT]
> **KV Rate Limiting:** การ rate limit บน auth endpoint ต้องใช้ Cloudflare KV binding ใหม่ซึ่งต้องตั้งค่าใน `wrangler.toml`
>
> คำถาม: **ต้องการเพิ่ม KV binding สำหรับ rate limiting ไหม?** หรือให้ใช้ IP-header based simple check แทน?

---

## Verification Plan
- Deploy แล้วทดสอบ:
  - POST `/api/assets` โดยไม่มี token → ต้องได้ 401
  - POST `/api/assignments` โดยไม่มี `assetId` → ต้องได้ 400 พร้อม message ชัดเจน
  - ดู browser console ขณะทำ CRUD → ต้องเห็น `[API]` log พร้อม endpoint, status, เวลา
  - ทดสอบ network timeout โดย throttle → ต้องเห็น error message ที่ชัดเจน ไม่ค้างตลอดไป
