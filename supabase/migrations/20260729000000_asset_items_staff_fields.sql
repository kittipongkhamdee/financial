-- ช่องข้อมูลที่ครูไม่มีให้ตอนสำรวจ (ฝั่งจัดซื้อ) — ให้เจ้าหน้าที่พัสดุ/แอดมินกรอกเพิ่มทีหลังในหน้าตรวจสอบครุภัณฑ์
-- ใช้ policy asset_items_staff_all เดิม (asset_is_staff()) ครอบคลุมสิทธิ์แก้ไขแล้ว ไม่ต้องเพิ่ม policy ใหม่
alter table public.asset_items
  add column if not exists vendor_name       text,
  add column if not exists vendor_address    text,
  add column if not exists vendor_phone      text,
  add column if not exists acquisition_method text,
  add column if not exists model             text,
  add column if not exists spec              text;

comment on column public.asset_items.acquisition_method is
  'วิธีการได้มา — ตกลงราคา/สอบราคา/ประกวดราคา/วิธีพิเศษ/รับบริจาค (ข้อความอิสระ ไม่บังคับ enum)';
