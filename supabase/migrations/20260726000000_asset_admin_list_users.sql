-- ฟังก์ชันสำหรับหน้า admin: ดึงรายชื่อผู้ใช้พร้อมอีเมล (ตาราง auth.users อ่านตรงจาก client ไม่ได้)
-- security definer + เช็ค asset_current_role() = 'admin' ในตัวมันเอง — ถ้าคนเรียกไม่ใช่แอดมินจะได้แถวว่าง
create or replace function public.asset_admin_list_users()
returns table (
  user_id      uuid,
  email        text,
  full_name    text,
  department   text,
  role         asset_user_role,
  is_anonymous boolean,
  created_at   timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, u.email, p.full_name, p.department, p.role, u.is_anonymous, p.created_at
  from public.asset_survey_profiles p
  join auth.users u on u.id = p.user_id
  where public.asset_current_role() = 'admin'
  order by u.is_anonymous asc, p.full_name asc;
$$;

grant execute on function public.asset_admin_list_users() to authenticated;
