-- จัดหมวดครุภัณฑ์ให้ตรงกับ "ตารางกำหนดอายุการใช้งานและอัตราค่าเสื่อมราคาทรัพย์สินของ สพฐ."
-- (คู่มือทะเบียนคุมทรัพย์สินและการตรวจสอบพัสดุประจำปี) เพื่อให้ระบบพร้อมคำนวณค่าเสื่อมราคาต่อได้
-- โดยไม่ต้องแก้ข้อมูลย้อนหลัง — ยังไม่มีรายการครุภัณฑ์ใดอ้างอิง category_id อยู่ ณ ตอนย้าย

alter table public.asset_categories
  add column if not exists useful_life_years        int,
  add column if not exists depreciation_rate_percent numeric(5, 2);

delete from public.asset_categories
where name in ('โต๊ะ–เก้าอี้', 'สื่อการสอน');

insert into public.asset_categories (name, sort_order, useful_life_years, depreciation_rate_percent) values
  ('ครุภัณฑ์สำนักงาน',            10,  8, 12.50),
  ('ครุภัณฑ์คอมพิวเตอร์',          20,  3, 33.33),
  ('ครุภัณฑ์การศึกษา',            30,  2, 50.00),
  ('ครุภัณฑ์งานบ้านงานครัว',       40,  5, 20.00),
  ('ครุภัณฑ์ไฟฟ้าและวิทยุ',        50,  5, 20.00),
  ('ครุภัณฑ์โฆษณาและเผยแพร่',      60,  5, 20.00),
  ('ครุภัณฑ์ยานพาหนะและขนส่ง',     70,  5, 20.00),
  ('ครุภัณฑ์ดนตรี',               80,  3, 33.33),
  ('ครุภัณฑ์กีฬา',                90,  2, 50.00),
  ('ครุภัณฑ์สนาม',                100, 2, 50.00),
  ('ครุภัณฑ์การเกษตร',            110, 3, 33.33),
  ('ครุภัณฑ์วิทยาศาสตร์และการแพทย์', 120, 5, 20.00),
  ('ครุภัณฑ์สำรวจ',               130, 8, 12.50),
  ('ครุภัณฑ์โรงงาน',              140, 3, 33.33),
  ('ครุภัณฑ์ก่อสร้าง',            150, 3, 33.33),
  ('ครุภัณฑ์อาวุธ',               160, 10, 10.00)
on conflict (name) do update set
  sort_order                = excluded.sort_order,
  useful_life_years         = excluded.useful_life_years,
  depreciation_rate_percent = excluded.depreciation_rate_percent;

update public.asset_categories set sort_order = 999 where name = 'อื่น ๆ';
