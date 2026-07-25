-- =============================================================================
-- เปิดให้ทุกคนเห็นรูปครุภัณฑ์ร่วมกัน — เลิกแยกสิทธิ์ตามโฟลเดอร์ผู้กรอก
--
-- เดิม policy ผูกสิทธิ์กับโฟลเดอร์ {user_id}/ นำหน้าชื่อไฟล์ ตอนนี้เปิดกว้าง
-- ทั้ง bucket ให้ผู้ใช้ที่ล็อกอินแล้ว (รวมโหมดใช้งานทั่วไป) ดู/แทนที่/ลบรูปของ
-- กันและกันได้ทั้งหมด — ไฟล์ใหม่จะไม่มี {user_id}/ นำหน้าอีกต่อไป (path แบบ
-- ราบ {uuid}.jpg) ส่วนไฟล์เก่าที่ยังมี {user_id}/ นำหน้าอยู่ก็อ่าน/แก้ได้ตามปกติ
-- เพราะ policy ใหม่ไม่ได้กรองด้วย path
-- =============================================================================

drop policy if exists asset_photos_insert on storage.objects;
create policy asset_photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'asset-photos');

drop policy if exists asset_photos_select on storage.objects;
create policy asset_photos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'asset-photos');

drop policy if exists asset_photos_update on storage.objects;
create policy asset_photos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'asset-photos')
  with check (bucket_id = 'asset-photos');

drop policy if exists asset_photos_delete on storage.objects;
create policy asset_photos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'asset-photos');
