-- =============================================================================
-- แบบสำรวจแบบเปิดสาธารณะ ไม่ต้องล็อกอิน/เข้าใช้งานทั่วไปอีกต่อไป (แบบ Google Form)
--
-- เดิมครูต้อง "เข้าใช้งานทั่วไป" (anonymous sign-in) ก่อนกรอก ทำให้ asset_items ผูก
-- surveyed_by ไว้ และมีหน้า "รายการของฉัน" ให้ครูย้อนมาดู/แก้ไขรายการของตัวเอง
--
-- ตอนนี้เปลี่ยนแนวคิด: ข้อมูลที่กรอกไม่เกี่ยวข้องกับตัวครูผู้ตอบ เปิดลิงก์แล้วกรอกได้เลย
-- ไม่มีขั้นตอนเข้าระบบใด ๆ — เจ้าหน้าที่พัสดุ/แอดมินเท่านั้นที่ยังต้องล็อกอินด้วยอีเมล
-- =============================================================================

-- surveyed_by ไม่บังคับกรอกอีกต่อไป (ไม่มี auth.uid() ให้ใช้ตอนไม่ได้ล็อกอิน)
-- คงคอลัมน์และข้อมูลเก่าไว้เฉย ๆ เผื่ออ้างอิงย้อนหลัง แค่เลิกผูกกับผู้กรอกใหม่
alter table public.asset_items alter column surveyed_by drop not null;
alter table public.asset_items alter column surveyed_by drop default;

-- master data (อาคาร/หมวดหมู่/แหล่งงบ/หน่วยนับ) — ให้อ่านได้แม้ไม่ได้ล็อกอิน (แบบฟอร์มต้องใช้)
do $$
declare t text;
begin
  foreach t in array array[
    'asset_buildings', 'asset_categories', 'asset_budget_sources', 'asset_units'
  ] loop
    execute format('drop policy if exists asset_master_select on public.%I', t);
    execute format(
      'create policy asset_master_select on public.%I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

-- รายการครุภัณฑ์ — เลิก select/update/delete ตามเจ้าของ (ไม่มีเจ้าของอีกต่อไป)
-- เหลือแค่งานพัสดุ/แอดมินเห็น–แก้ได้ทุกแถว ส่วนการเพิ่มรายการใหม่เปิดให้ทุกคน (รวมไม่ล็อกอิน) ทำได้
drop policy if exists asset_items_select on public.asset_items;
create policy asset_items_select on public.asset_items
  for select to authenticated
  using (public.asset_is_staff());

drop policy if exists asset_items_insert on public.asset_items;
create policy asset_items_insert on public.asset_items
  for insert to anon, authenticated
  with check (
    exists (select 1 from public.asset_survey_rounds r where r.id = round_id and r.is_open)
  );

drop policy if exists asset_items_update_own on public.asset_items;
drop policy if exists asset_items_delete_own on public.asset_items;

-- -----------------------------------------------------------------------------
-- Storage — อัปโหลดรูปได้แม้ไม่ได้ล็อกอิน แต่ดู/แทนที่/ลบสงวนไว้ให้งานพัสดุ/แอดมินเท่านั้น
-- -----------------------------------------------------------------------------
drop policy if exists asset_photos_insert on storage.objects;
create policy asset_photos_insert on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'asset-photos');

drop policy if exists asset_photos_select on storage.objects;
create policy asset_photos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'asset-photos' and public.asset_is_staff());

drop policy if exists asset_photos_update on storage.objects;
create policy asset_photos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'asset-photos' and public.asset_is_staff())
  with check (bucket_id = 'asset-photos' and public.asset_is_staff());

drop policy if exists asset_photos_delete on storage.objects;
create policy asset_photos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'asset-photos' and public.asset_is_staff());
