-- =============================================================================
-- รองรับ "เข้าใช้งานทั่วไป" (anonymous sign-in)
--
-- ครูกดปุ่มเดียวเข้าใช้ได้เลย ไม่ต้องสมัคร ไม่ต้องกรอกชื่อ
-- ผู้ใช้แบบนี้ยังมี auth.uid() ของตัวเอง → RLS และโฟลเดอร์รูปยังแยกกันตามเดิม
--
-- ต้องเปิด Anonymous sign-ins ในแดชบอร์ด Supabase ด้วย
-- (Authentication → Sign In / Providers → Anonymous sign-ins)
-- =============================================================================

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
    case
      -- ผู้ใช้แบบทั่วไปไม่มีอีเมลและไม่ได้กรอกชื่อ
      when coalesce(new.is_anonymous, false) then 'ผู้กรอกทั่วไป'
      else coalesce(
        nullif(new.raw_user_meta_data ->> 'full_name', ''),
        split_part(coalesce(new.email, 'ผู้ใช้'), '@', 1)
      )
    end,
    nullif(new.raw_user_meta_data ->> 'department', '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- create or replace เขียนสิทธิ์ทับ — ต้องคืนสิทธิ์ให้ GoTrue เหมือนเดิม
revoke all on function public.asset_handle_new_user() from public, anon, authenticated;
grant execute on function public.asset_handle_new_user() to supabase_auth_admin;
