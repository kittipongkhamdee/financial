-- รายชื่อผู้ขออนุมัติเบิกจ่าย — แอดมินจัดการรายชื่อ (เพิ่ม/แก้ไข/ปิดใช้งาน) ผู้กรอกคำขอ
-- (สาธารณะ ไม่ล็อกอิน) เลือกจากดรอปดาวน์นี้แทนพิมพ์ชื่อเองอิสระ กันพิมพ์ชื่อผิด/สะกดไม่ตรงกัน

create table if not exists plan_requesters (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table plan_requesters enable row level security;

create policy plan_admin_all on plan_requesters
  for all to authenticated
  using (asset_current_role() = 'admin')
  with check (asset_current_role() = 'admin');

create policy plan_public_select on plan_requesters
  for select to anon, authenticated
  using (true);
