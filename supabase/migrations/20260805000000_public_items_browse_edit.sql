-- เปิดให้ทุกคนดูรายการครุภัณฑ์ที่สำรวจส่งมาแล้วทั้งหมด (แยกอาคาร/ห้อง) และแก้ไขได้เอง
-- ที่ /survey/list — เหมือนแบบสำรวจที่เปิดสาธารณะ ไม่ต้องล็อกอิน แก้ไขได้เฉพาะรายการที่
-- ยังไม่ผ่านการอนุมัติจากพัสดุ (submitted/rejected) กันคนทั่วไปเผลอแก้ของที่พัสดุยืนยันแล้ว
-- (ต้อง "ยกเลิกการอนุมัติ" ที่ /review ก่อน ถึงจะกลับมาแก้ไขได้อีกครั้ง)

drop policy if exists asset_items_select on public.asset_items;
create policy asset_items_select on public.asset_items
  for select to anon, authenticated
  using (true);

create policy asset_items_public_update on public.asset_items
  for update to anon, authenticated
  using (status in ('submitted', 'rejected'))
  with check (status in ('submitted', 'rejected'));

-- รูปครุภัณฑ์ — เปิดให้ดูได้ทุกคน (จำเป็นสำหรับหน้ารายการสาธารณะ) แทนที่/ลบยังสงวนไว้ให้
-- งานพัสดุ/แอดมินเท่านั้น (หน้าแก้ไขสาธารณะเปลี่ยนรูปได้ แต่ไม่ลบรูปเก่าออกจาก storage เอง)
drop policy if exists asset_photos_select on storage.objects;
create policy asset_photos_select on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'asset-photos');
