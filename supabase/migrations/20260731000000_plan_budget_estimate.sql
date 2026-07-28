-- =============================================================================
-- งานแผนงาน (เฟส 3) — เริ่มจากส่วนที่ 3 ประมาณการงบประมาณรายรับ-รายจ่าย
--
-- ตารางใช้ prefix plan_ แยกจาก asset_ ของเฟส 1 ตามธรรมเนียมเดิม (กันชื่อชน)
-- ผู้ใช้/บทบาทยังใช้ชุดเดียวกับทั้งระบบ (asset_survey_profiles) — สิทธิ์กรอก/แก้
-- ส่วนนี้ตอนนี้ให้เฉพาะ admin เท่านั้นก่อน (ยังไม่แยกสิทธิ์ตามกลุ่มบริหาร)
-- =============================================================================

create table if not exists public.plan_budget_years (
  id         uuid primary key default gen_random_uuid(),
  year       int  not null unique,   -- ปีงบประมาณ พ.ศ. เช่น 2569
  name       text not null,          -- เช่น "แผนปฏิบัติการประจำปีงบประมาณ 2569"
  is_open    boolean not null default true,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 3.1 ประมาณการรายรับ — ประเภทรายรับ × ระดับชั้น × จำนวนนักเรียน × อัตรา/คน/ปี
-- -----------------------------------------------------------------------------
create table if not exists public.plan_revenue_types (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,   -- เช่น "ค่าจัดการเรียนการสอน"
  sort_order int  not null default 0,
  is_active  boolean not null default true
);

create table if not exists public.plan_revenue_lines (
  id               uuid primary key default gen_random_uuid(),
  budget_year_id   uuid not null references public.plan_budget_years (id) on delete cascade,
  revenue_type_id  uuid not null references public.plan_revenue_types (id) on delete restrict,
  level_label      text not null,   -- เช่น "มัธยมศึกษาตอนต้น" / "มัธยมศึกษาปีที่ 1" — อิสระ เพราะแต่ละประเภทแบ่งระดับไม่เท่ากัน
  student_count    int  not null default 0 check (student_count >= 0),
  rate_per_student numeric(12, 2) not null default 0 check (rate_per_student >= 0),
  total            numeric(14, 2) generated always as (student_count * rate_per_student) stored,
  sort_order       int  not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists plan_revenue_lines_year_idx on public.plan_revenue_lines (budget_year_id, revenue_type_id, sort_order);

-- -----------------------------------------------------------------------------
-- 3.2 ประมาณการรายจ่าย — กลุ่มบริหาร → โครงการ → กิจกรรม (งบ + ผู้รับผิดชอบ)
-- -----------------------------------------------------------------------------
create table if not exists public.plan_admin_groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,   -- เช่น "กลุ่มบริหารวิชาการ"
  sort_order int  not null default 0,
  is_active  boolean not null default true
);

create table if not exists public.plan_projects (
  id             uuid primary key default gen_random_uuid(),
  budget_year_id uuid not null references public.plan_budget_years (id) on delete cascade,
  admin_group_id uuid not null references public.plan_admin_groups (id) on delete restrict,
  name           text not null,   -- โครงการ
  sort_order     int  not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists plan_projects_year_idx on public.plan_projects (budget_year_id, admin_group_id, sort_order);

create table if not exists public.plan_activities (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.plan_projects (id) on delete cascade,
  name         text,   -- กิจกรรม — เว้นว่างได้ถ้าโครงการไม่แยกย่อยกิจกรรม (งบอยู่ที่โครงการเลย)
  budget       numeric(12, 2) not null default 0 check (budget >= 0),
  responsible  text,   -- ผู้รับผิดชอบ (ข้อความอิสระ — กลุ่มสาระ/ฝ่ายชื่อไม่ตายตัว)
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists plan_activities_project_idx on public.plan_activities (project_id, sort_order);

drop trigger if exists plan_revenue_lines_touch on public.plan_revenue_lines;
create trigger plan_revenue_lines_touch
  before update on public.plan_revenue_lines
  for each row execute function public.asset_touch_updated_at();

drop trigger if exists plan_projects_touch on public.plan_projects;
create trigger plan_projects_touch
  before update on public.plan_projects
  for each row execute function public.asset_touch_updated_at();

drop trigger if exists plan_activities_touch on public.plan_activities;
create trigger plan_activities_touch
  before update on public.plan_activities
  for each row execute function public.asset_touch_updated_at();

-- -----------------------------------------------------------------------------
-- RLS — แอดมินเท่านั้น (ใช้ asset_current_role() เดิมจากเฟส 1 — role ชุดเดียวกันทั้งระบบ)
-- -----------------------------------------------------------------------------
alter table public.plan_budget_years  enable row level security;
alter table public.plan_revenue_types enable row level security;
alter table public.plan_revenue_lines enable row level security;
alter table public.plan_admin_groups  enable row level security;
alter table public.plan_projects      enable row level security;
alter table public.plan_activities    enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'plan_budget_years', 'plan_revenue_types', 'plan_revenue_lines',
    'plan_admin_groups', 'plan_projects', 'plan_activities'
  ] loop
    execute format('drop policy if exists plan_admin_all on public.%I', t);
    execute format(
      'create policy plan_admin_all on public.%I for all to authenticated
         using (public.asset_current_role() = ''admin'')
         with check (public.asset_current_role() = ''admin'')', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- ข้อมูลตั้งต้น — ตามเอกสารแผนปฏิบัติการประจำปีงบประมาณ 2569 ที่แนบมา
-- -----------------------------------------------------------------------------
insert into public.plan_budget_years (year, name, is_open) values
  (2569, 'แผนปฏิบัติการประจำปีงบประมาณ 2569', true)
on conflict (year) do nothing;

insert into public.plan_revenue_types (name, sort_order) values
  ('ค่าจัดการเรียนการสอน', 10),
  ('ค่ากิจกรรมพัฒนาผู้เรียน', 20),
  ('Topup นร.น้อยกว่า 300 คน', 30),
  ('ค่าอุปกรณ์การเรียน', 40),
  ('ค่าเครื่องแบบนักเรียน', 50),
  ('ค่าหนังสือเรียน', 60)
on conflict (name) do nothing;

insert into public.plan_admin_groups (name, sort_order) values
  ('กิจกรรมพัฒนาผู้เรียน', 10),
  ('กลุ่มบริหารวิชาการ', 20),
  ('กลุ่มบริหารงบประมาณ', 30),
  ('กลุ่มบริหารบุคคล', 40),
  ('กลุ่มบริหารทั่วไป', 50)
on conflict (name) do nothing;
