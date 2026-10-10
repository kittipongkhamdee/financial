-- -----------------------------------------------------------------------------
-- ปิดระบบชั่วคราว (maintenance mode) — แอดมินกดเปิด/ปิดได้ที่ /admin
-- true = ทุกคนเจอข้อความ "ปิดระบบชั่วคราว" ใช้งานเมนูต่าง ๆ ไม่ได้ ยกเว้น admin
-- เก็บไว้ในตารางเดิม asset_school_settings (แถวเดียว) RLS เดิมครอบคลุมอยู่แล้ว:
-- select ให้ anon+authenticated (ต้องอ่านได้ก่อนล็อกอินเพื่อโชว์ข้อความปิดระบบ)
-- update เฉพาะ admin
-- -----------------------------------------------------------------------------
alter table public.asset_school_settings
  add column if not exists maintenance_mode boolean not null default false;
