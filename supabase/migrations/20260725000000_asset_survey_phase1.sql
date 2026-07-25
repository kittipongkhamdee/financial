-- =============================================================================
-- เฟส 1 — สำรวจครุภัณฑ์โดยครู (งานพัสดุ)
--
-- ตารางทั้งหมดใช้ prefix `asset_` เพื่อไม่ให้ชนกับตารางเดิมใน schema public
-- รันได้ซ้ำโดยไม่พัง (idempotent)
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- enum
-- -----------------------------------------------------------------------------
do $$ begin
  create type asset_condition as enum ('usable', 'damaged', 'disposal');
exception when duplicate_object then null; end $$;

do $$ begin
  create type asset_item_status as enum ('draft', 'submitted', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type asset_user_role as enum ('teacher', 'supply', 'admin');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- ฟังก์ชันช่วย
-- -----------------------------------------------------------------------------
create or replace function public.asset_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- โปรไฟล์ผู้ใช้ + สิทธิ์
--   teacher = ครูผู้กรอก · supply = เจ้าหน้าที่พัสดุ · admin = ผู้ดูแลระบบ
-- -----------------------------------------------------------------------------
create table if not exists public.asset_survey_profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null,
  department text,
  role       asset_user_role not null default 'teacher',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists asset_survey_profiles_touch on public.asset_survey_profiles;
create trigger asset_survey_profiles_touch
  before update on public.asset_survey_profiles
  for each row execute function public.asset_touch_updated_at();

-- สร้างโปรไฟล์ให้ผู้ใช้ใหม่อัตโนมัติ (ชื่อมาจาก user_metadata.full_name ตอนสมัคร)
create or replace function public.asset_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.asset_survey_profiles (user_id, full_name, department)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, 'ผู้ใช้'), '@', 1)),
    nullif(new.raw_user_meta_data ->> 'department', '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists asset_on_auth_user_created on auth.users;
create trigger asset_on_auth_user_created
  after insert on auth.users
  for each row execute function public.asset_handle_new_user();

-- สิทธิ์ปัจจุบันของผู้เรียก — security definer เพื่อให้เรียกจาก policy ได้โดยไม่วน RLS
create or replace function public.asset_current_role()
returns asset_user_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.asset_survey_profiles where user_id = auth.uid()),
    'teacher'::asset_user_role
  );
$$;

create or replace function public.asset_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.asset_current_role() in ('supply', 'admin');
$$;

-- -----------------------------------------------------------------------------
-- ข้อมูลตั้งต้น (master data) — แก้ไขให้ตรงกับโรงเรียนได้
-- -----------------------------------------------------------------------------
create table if not exists public.asset_buildings (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int  not null default 0,
  is_active  boolean not null default true
);

create table if not exists public.asset_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int  not null default 0,
  is_active  boolean not null default true
);

create table if not exists public.asset_budget_sources (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int  not null default 0,
  is_active  boolean not null default true
);

create table if not exists public.asset_units (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int  not null default 0,
  is_active  boolean not null default true
);

-- รอบการสำรวจ (ปีการศึกษา) — ปิดรอบแล้วครูจะกรอกเพิ่มไม่ได้
create table if not exists public.asset_survey_rounds (
  id         uuid primary key default gen_random_uuid(),
  year       int  not null,
  name       text not null,
  is_open    boolean not null default true,
  created_at timestamptz not null default now(),
  unique (year)
);

-- -----------------------------------------------------------------------------
-- รายการครุภัณฑ์ที่ครูกรอก — ใช้ร่วมกันทั้งฟอร์มมือถือ (1b) และโหมดกรอกเร็ว (1d)
-- -----------------------------------------------------------------------------
create table if not exists public.asset_items (
  id               uuid primary key default gen_random_uuid(),
  round_id         uuid not null references public.asset_survey_rounds (id) on delete restrict,

  -- ตำแหน่ง
  building         text not null,
  floor            text,
  room             text not null,

  -- ตัวครุภัณฑ์
  category_id      uuid references public.asset_categories (id) on delete set null,
  name             text not null,
  quantity         int  not null default 1 check (quantity > 0),
  unit             text,
  asset_code       text,
  untagged         boolean not null default false,   -- ยังไม่ติดป้าย พัสดุออกเลขให้ทีหลัง

  -- สภาพ
  condition        asset_condition not null,
  note             text,

  -- งบประมาณ
  acquired_year    int check (acquired_year is null or acquired_year between 2400 and 2700),
  budget_source_id uuid references public.asset_budget_sources (id) on delete set null,
  price            numeric(12, 2) check (price is null or price >= 0),

  -- หลักฐาน
  photo_path       text,

  -- สายงาน
  status           asset_item_status not null default 'draft',
  reject_reason    text,
  reviewed_by      uuid references auth.users (id) on delete set null,
  reviewed_at      timestamptz,

  surveyed_by      uuid not null default auth.uid() references auth.users (id) on delete restrict,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

drop trigger if exists asset_items_touch on public.asset_items;
create trigger asset_items_touch
  before update on public.asset_items
  for each row execute function public.asset_touch_updated_at();

create index if not exists asset_items_surveyed_by_idx on public.asset_items (surveyed_by, created_at desc);
create index if not exists asset_items_room_idx        on public.asset_items (round_id, building, floor, room);
create index if not exists asset_items_status_idx      on public.asset_items (status);

-- หมายเลขครุภัณฑ์ต้องไม่ซ้ำภายในรอบเดียวกัน (ช่องว่างถือว่ายังไม่กรอก)
create unique index if not exists asset_items_code_unique
  on public.asset_items (round_id, asset_code)
  where asset_code is not null and asset_code <> '';

-- -----------------------------------------------------------------------------
-- RLS
--   ครู  : เห็น/แก้ของตัวเอง และแก้ได้เฉพาะที่ยังไม่ส่ง (draft/rejected)
--   พัสดุ: เห็นทุกแถว แก้ได้ทุกแถว
-- -----------------------------------------------------------------------------
alter table public.asset_survey_profiles enable row level security;
alter table public.asset_buildings       enable row level security;
alter table public.asset_categories      enable row level security;
alter table public.asset_budget_sources  enable row level security;
alter table public.asset_units           enable row level security;
alter table public.asset_survey_rounds   enable row level security;
alter table public.asset_items           enable row level security;

-- โปรไฟล์
drop policy if exists asset_profiles_select on public.asset_survey_profiles;
create policy asset_profiles_select on public.asset_survey_profiles
  for select to authenticated
  using (user_id = auth.uid() or public.asset_is_staff());

drop policy if exists asset_profiles_update_self on public.asset_survey_profiles;
create policy asset_profiles_update_self on public.asset_survey_profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and role = public.asset_current_role());  -- เปลี่ยนสิทธิ์ตัวเองไม่ได้

drop policy if exists asset_profiles_admin_all on public.asset_survey_profiles;
create policy asset_profiles_admin_all on public.asset_survey_profiles
  for all to authenticated
  using (public.asset_current_role() = 'admin')
  with check (public.asset_current_role() = 'admin');

-- master data + รอบสำรวจ: ทุกคนที่ล็อกอินอ่านได้ · พัสดุ/แอดมินแก้ได้
do $$
declare t text;
begin
  foreach t in array array[
    'asset_buildings', 'asset_categories', 'asset_budget_sources',
    'asset_units', 'asset_survey_rounds'
  ] loop
    execute format('drop policy if exists asset_master_select on public.%I', t);
    execute format(
      'create policy asset_master_select on public.%I for select to authenticated using (true)', t);
    execute format('drop policy if exists asset_master_write on public.%I', t);
    execute format(
      'create policy asset_master_write on public.%I for all to authenticated
         using (public.asset_is_staff()) with check (public.asset_is_staff())', t);
  end loop;
end $$;

-- รายการครุภัณฑ์
drop policy if exists asset_items_select on public.asset_items;
create policy asset_items_select on public.asset_items
  for select to authenticated
  using (surveyed_by = auth.uid() or public.asset_is_staff());

drop policy if exists asset_items_insert on public.asset_items;
create policy asset_items_insert on public.asset_items
  for insert to authenticated
  with check (
    surveyed_by = auth.uid()
    and exists (select 1 from public.asset_survey_rounds r where r.id = round_id and r.is_open)
  );

drop policy if exists asset_items_update_own on public.asset_items;
-- แก้ได้เฉพาะแถวที่ยังไม่ส่ง (draft/rejected) — with check เผื่อการเปลี่ยนสถานะเป็น submitted
create policy asset_items_update_own on public.asset_items
  for update to authenticated
  using (surveyed_by = auth.uid() and status in ('draft', 'rejected'))
  with check (surveyed_by = auth.uid() and status in ('draft', 'rejected', 'submitted'));

drop policy if exists asset_items_delete_own on public.asset_items;
create policy asset_items_delete_own on public.asset_items
  for delete to authenticated
  using (surveyed_by = auth.uid() and status in ('draft', 'rejected'));

drop policy if exists asset_items_staff_all on public.asset_items;
create policy asset_items_staff_all on public.asset_items
  for all to authenticated
  using (public.asset_is_staff())
  with check (public.asset_is_staff());

-- -----------------------------------------------------------------------------
-- Storage — รูปถ่ายครุภัณฑ์ (bucket ปิด เข้าถึงผ่าน signed URL)
--   path: {user_id}/{item_uuid}.jpg  → policy ตรวจโฟลเดอร์ชั้นแรก
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('asset-photos', 'asset-photos', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

drop policy if exists asset_photos_insert on storage.objects;
create policy asset_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'asset-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists asset_photos_select on storage.objects;
create policy asset_photos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'asset-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.asset_is_staff())
  );

drop policy if exists asset_photos_update on storage.objects;
create policy asset_photos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'asset-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.asset_is_staff())
  );

drop policy if exists asset_photos_delete on storage.objects;
create policy asset_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'asset-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.asset_is_staff())
  );

-- -----------------------------------------------------------------------------
-- ข้อมูลตั้งต้น — ปรับให้ตรงกับโรงเรียนจริงได้ทีหลัง
-- -----------------------------------------------------------------------------
insert into public.asset_survey_rounds (year, name, is_open)
values (2569, 'สำรวจครุภัณฑ์ ปีการศึกษา 2569', true)
on conflict (year) do nothing;

insert into public.asset_buildings (name, sort_order) values
  ('อาคาร 1', 10), ('อาคาร 2', 20), ('อาคาร 3', 30), ('อาคาร 4', 40),
  ('โรงฝึกงาน', 50), ('โรงอาหาร', 60), ('หอประชุม', 70)
on conflict (name) do nothing;

insert into public.asset_categories (name, sort_order) values
  ('ครุภัณฑ์สำนักงาน', 10), ('คอมพิวเตอร์', 20), ('โฆษณาและเผยแพร่', 30),
  ('งานบ้านงานครัว', 40), ('ไฟฟ้าและวิทยุ', 50), ('โต๊ะ–เก้าอี้', 60),
  ('สื่อการสอน', 70), ('การศึกษา', 80), ('วิทยาศาสตร์และการแพทย์', 90), ('อื่น ๆ', 999)
on conflict (name) do nothing;

insert into public.asset_budget_sources (name, sort_order) values
  ('เงินอุดหนุน', 10), ('เงินรายได้สถานศึกษา', 20), ('เงินงบประมาณ (งบลงทุน)', 30),
  ('เงินบริจาค', 40), ('ผ้าป่า/ศิษย์เก่า', 50), ('อื่น ๆ', 999)
on conflict (name) do nothing;

insert into public.asset_units (name, sort_order) values
  ('เครื่อง', 10), ('ตัว', 20), ('ชุด', 30), ('อัน', 40),
  ('หลัง', 50), ('ชิ้น', 60), ('คัน', 70), ('ใบ', 80)
on conflict (name) do nothing;
