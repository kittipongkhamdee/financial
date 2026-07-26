-- -----------------------------------------------------------------------------
-- ตั้งค่าระบบ: ชื่อโรงเรียน / ชื่อระบบ / โลโก้ — แถวเดียว (singleton) อ่านได้ทุกคน
-- (รวมถึงหน้า login ที่ยังไม่ล็อกอิน) แก้ได้เฉพาะ admin
-- -----------------------------------------------------------------------------
create table if not exists public.asset_school_settings (
  id          boolean primary key default true check (id),
  school_name text,
  system_name text not null default 'ระบบบริหารงบประมาณโรงเรียน',
  logo_path   text,
  updated_at  timestamptz not null default now()
);

insert into public.asset_school_settings (id) values (true) on conflict (id) do nothing;

drop trigger if exists asset_school_settings_touch on public.asset_school_settings;
create trigger asset_school_settings_touch
  before update on public.asset_school_settings
  for each row execute function public.asset_touch_updated_at();

alter table public.asset_school_settings enable row level security;

drop policy if exists asset_school_settings_select on public.asset_school_settings;
create policy asset_school_settings_select on public.asset_school_settings
  for select to anon, authenticated
  using (true);

drop policy if exists asset_school_settings_admin_write on public.asset_school_settings;
create policy asset_school_settings_admin_write on public.asset_school_settings
  for update to authenticated
  using (public.asset_current_role() = 'admin')
  with check (public.asset_current_role() = 'admin');

-- -----------------------------------------------------------------------------
-- Storage bucket สาธารณะสำหรับโลโก้ — ต้องดูได้ก่อนล็อกอิน (หน้า login) จึงเปิด public
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('system-branding', 'system-branding', true, 2097152,
        array['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists system_branding_select on storage.objects;
create policy system_branding_select on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'system-branding');

drop policy if exists system_branding_admin_write on storage.objects;
create policy system_branding_admin_write on storage.objects
  for all to authenticated
  using (bucket_id = 'system-branding' and public.asset_current_role() = 'admin')
  with check (bucket_id = 'system-branding' and public.asset_current_role() = 'admin');

-- -----------------------------------------------------------------------------
-- แอดมินลบบัญชีผู้ใช้ — auth.users แก้ตรงจาก client ไม่ได้ ต้องผ่านฟังก์ชัน security definer
-- ลบไม่ได้ตัวเอง และถ้ามีรายการครุภัณฑ์ผูกอยู่ (asset_items.surveyed_by on delete restrict)
-- จะลบไม่สำเร็จ — ให้จัดการรายการก่อนลบตัวคน
-- -----------------------------------------------------------------------------
create or replace function public.asset_admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.asset_current_role() <> 'admin' then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'cannot delete your own account' using errcode = '22023';
  end if;

  delete from auth.users where id = target_user_id;
end;
$$;

grant execute on function public.asset_admin_delete_user(uuid) to authenticated;
