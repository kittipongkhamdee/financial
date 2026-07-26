-- หน้า login (ก่อนล็อกอิน) ต้องรู้ชื่อรอบสำรวจที่เปิดอยู่ เพื่อแสดงแทนข้อความตายตัว
-- "แบบสำรวจครุภัณฑ์รายห้อง ปีการศึกษา 2569" — เปิดให้ role anon เห็นเฉพาะรอบที่เปิดอยู่เท่านั้น
-- (ไม่ใช่ทุกรอบย้อนหลัง) ส่วน authenticated ยังเห็นทุกรอบเหมือนเดิมตาม policy เดิม
drop policy if exists asset_survey_rounds_anon_select on public.asset_survey_rounds;
create policy asset_survey_rounds_anon_select on public.asset_survey_rounds
  for select to anon
  using (is_open = true);
