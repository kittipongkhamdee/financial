-- =============================================================================
-- ปิดช่องตามคำเตือนของ database linter
--   1) ตั้ง search_path ให้ฟังก์ชัน trigger (function_search_path_mutable)
--   2) ถอนสิทธิ์เรียกฟังก์ชัน security definer ผ่าน REST /rpc ให้เหลือเท่าที่จำเป็น
-- =============================================================================

-- 1) trigger function ต้องล็อก search_path
create or replace function public.asset_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 2) ฟังก์ชัน trigger สร้างโปรไฟล์ — ไม่ควรเรียกจาก API ได้เลย
revoke all on function public.asset_handle_new_user() from public, anon, authenticated;
-- แต่ GoTrue เพิ่มผู้ใช้ในนาม supabase_auth_admin — ถ้าไม่ให้สิทธิ์ trigger จะพัง
-- และการสมัคร/เข้าสู่ระบบจะขึ้น "Database error"
grant execute on function public.asset_handle_new_user() to supabase_auth_admin;

-- ฟังก์ชันช่วยตรวจสิทธิ์ — RLS policy ต้องเรียกได้ในนาม authenticated
-- แต่ผู้ที่ยังไม่ล็อกอินไม่ต้องเรียก
revoke all on function public.asset_current_role() from public, anon;
revoke all on function public.asset_is_staff()     from public, anon;
grant execute on function public.asset_current_role() to authenticated;
grant execute on function public.asset_is_staff()     to authenticated;
