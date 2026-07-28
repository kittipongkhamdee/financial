-- เปิดหน้า "คำขอเบิกจ่าย" ให้ทุกคนใช้งานได้แบบสาธารณะ ไม่ต้องล็อกอิน
-- (เหมือนแบบสำรวจ /survey) — เปลี่ยนจาก "แอดมินกรอกแทน" เป็นกรอกเองได้ทุกคน
-- ใช้ชื่อที่พิมพ์เอง (requester_name) แทนการอ้างอิงบัญชีผู้ใช้ เพราะไม่มีบัญชีให้ยึด

alter table plan_disbursement_requests
  alter column requested_by drop not null,
  add column if not exists requester_name text not null default '';

drop policy if exists plan_director_select on plan_budget_years;
drop policy if exists plan_director_select on plan_admin_groups;
drop policy if exists plan_director_select on plan_projects;
drop policy if exists plan_director_select on plan_activities;
drop policy if exists plan_director_select on plan_disbursement_requests;

-- ทุกคนอ่านข้อมูลที่จำเป็นสำหรับกรอกฟอร์มได้ (ปีงบ/กลุ่มบริหาร/โครงการ/กิจกรรม/คำขอ)
create policy plan_public_select on plan_budget_years for select to anon, authenticated using (true);
create policy plan_public_select on plan_admin_groups for select to anon, authenticated using (true);
create policy plan_public_select on plan_projects for select to anon, authenticated using (true);
create policy plan_public_select on plan_activities for select to anon, authenticated using (true);
create policy plan_public_select on plan_disbursement_requests for select to anon, authenticated using (true);

-- ทุกคนสร้างคำขอใหม่ได้ (สถานะต้องเป็น pending เท่านั้น ห้ามส่งค่าที่ข้ามขั้นตอนอนุมัติมาเอง)
create policy plan_public_insert on plan_disbursement_requests
  for insert to anon, authenticated
  with check (status = 'pending' and approved_by is null and approved_at is null and reject_reason is null);
