-- =============================================================================
-- ขออนุมัติเบิกจ่ายงบประมาณต่อโครงการ/กิจกรรม
--
-- workflow: แอดมิน/งานแผนงานกรอกคำขอแทนผู้รับผิดชอบ (ยังไม่แยกบัญชีตามกลุ่มบริหาร)
-- → สถานะ "รออนุมัติ" → ผู้อำนวยการ (role ใหม่ director) อนุมัติ/ไม่อนุมัติในระบบ
-- → อนุมัติแล้วหักยอด "คงเหลือ" ของกิจกรรมนั้นจริง (คำนวณสดจากผลรวมคำขอที่อนุมัติแล้ว)
-- พิมพ์เอกสารออกไปเซ็นชื่อจริงนอกระบบ ไม่อัปโหลดสแกนกลับเข้าระบบ
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'asset_user_role' and e.enumlabel = 'director'
  ) then
    alter type public.asset_user_role add value 'director';
  end if;
end $$;

do $$ begin
  create type public.plan_disbursement_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.plan_disbursement_requests (
  id                uuid primary key default gen_random_uuid(),
  activity_id       uuid not null references public.plan_activities (id) on delete restrict,
  requested_amount  numeric(12, 2) not null check (requested_amount > 0),
  purpose           text,
  requested_by      uuid not null references auth.users (id) on delete restrict,
  requested_at      timestamptz not null default now(),
  status            plan_disbursement_status not null default 'pending',
  approved_by       uuid references auth.users (id) on delete set null,
  approved_at       timestamptz,
  reject_reason     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists plan_disbursement_requests_activity_idx on public.plan_disbursement_requests (activity_id, status);

drop trigger if exists plan_disbursement_requests_touch on public.plan_disbursement_requests;
create trigger plan_disbursement_requests_touch
  before update on public.plan_disbursement_requests
  for each row execute function public.asset_touch_updated_at();

alter table public.plan_disbursement_requests enable row level security;

-- แอดมิน/งานแผนงาน สร้าง/แก้/ลบคำขอได้ทุกสถานะ (ยังเป็นคนกรอกแทนผู้รับผิดชอบทุกคน)
drop policy if exists plan_admin_all on public.plan_disbursement_requests;
create policy plan_admin_all on public.plan_disbursement_requests
  for all to authenticated
  using (public.asset_current_role() = 'admin')
  with check (public.asset_current_role() = 'admin');

-- ผู้อำนวยการเห็นคำขอทั้งหมด เพื่อตรวจก่อนอนุมัติ
drop policy if exists plan_director_select on public.plan_disbursement_requests;
create policy plan_director_select on public.plan_disbursement_requests
  for select to authenticated
  using (public.asset_current_role() = 'director');

-- ผู้อำนวยการอนุมัติ/ไม่อนุมัติได้เฉพาะคำขอที่ยังรออยู่ — เปลี่ยนได้แค่เป็น approved/rejected เท่านั้น
drop policy if exists plan_director_approve on public.plan_disbursement_requests;
create policy plan_director_approve on public.plan_disbursement_requests
  for update to authenticated
  using (public.asset_current_role() = 'director' and status = 'pending')
  with check (public.asset_current_role() = 'director' and status in ('approved', 'rejected') and approved_by = auth.uid());

-- -----------------------------------------------------------------------------
-- ผู้อำนวยการต้องอ่านข้อมูลโครงการ/กิจกรรม/กลุ่มบริหาร/ปีงบประมาณได้ ถึงจะเห็นบริบท
-- ของคำขอที่กำลังอนุมัติ (เดิมมีแค่ admin อ่านได้)
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['plan_budget_years', 'plan_admin_groups', 'plan_projects', 'plan_activities'] loop
    execute format('drop policy if exists plan_director_select on public.%I', t);
    execute format(
      'create policy plan_director_select on public.%I for select to authenticated
         using (public.asset_current_role() = ''director'')', t);
  end loop;
end $$;

-- ผู้อำนวยการเห็นชื่อผู้ขอ/ผู้อนุมัติในคำขอเบิกจ่ายได้ (ไม่ใช้ asset_is_staff() เพราะฟังก์ชันนั้น
-- ให้สิทธิ์กว้างกว่านี้ทั่วทั้งระบบครุภัณฑ์ — ผู้อำนวยการควรเห็นได้แค่ชื่อคน ไม่ใช่แก้ไขอะไรได้)
drop policy if exists asset_profiles_director_select on public.asset_survey_profiles;
create policy asset_profiles_director_select on public.asset_survey_profiles
  for select to authenticated
  using (public.asset_current_role() = 'director');
