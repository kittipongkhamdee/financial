"use client";

import { useState } from "react";
import { PhotoCapture } from "@/components/PhotoCapture";
import {
  Alert,
  ButtonLabel,
  Field,
  PhotoThumb,
  QuantityStepper,
  inputClass,
} from "@/components/ui";
import { CONDITIONS } from "@/lib/constants";
import { humanizeError, removePhoto, uploadPhoto } from "@/lib/data";
import { parseNumber } from "@/lib/format";
import {
  ACQUISITION_METHODS,
  type AcquisitionMethod,
  type AssetCondition,
  type AssetItem,
  type AssetItemDraft,
  type Masters,
  type StaffAssetFields,
} from "@/lib/types";

/**
 * ฟอร์มแก้ไขรายการครุภัณฑ์ — ใช้ร่วมกันทั้งหน้า "รายการของฉัน" (ครูแก้ของตัวเอง)
 * และหน้า "ตรวจสอบครุภัณฑ์" (พัสดุ/แอดมินแก้ของใครก็ได้) ต่างกันแค่ฟังก์ชัน updateFn ที่ส่งเข้ามา
 *
 * ช่องข้อมูลฝั่งจัดซื้อ (ผู้ขาย/ที่อยู่/โทรศัพท์/วิธีการได้มา/รุ่นแบบ/ลักษณะคุณสมบัติ)
 * แสดงให้ทุกคนเห็นเหมือนกัน — ครูกรอกได้ถ้ารู้ แต่ไม่บังคับ เว้นว่างไว้ให้พัสดุ/แอดมินเติมทีหลังก็ได้
 */
export function ItemEditor({
  item,
  masters,
  updateFn,
  onCancel,
  onSaved,
}: {
  item: AssetItem;
  masters: Masters;
  updateFn: (
    id: string,
    patch: Partial<AssetItemDraft & StaffAssetFields> & { photo_path?: string | null },
  ) => Promise<AssetItem>;
  onCancel: () => void;
  onSaved: (item: AssetItem) => void;
}) {
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity);
  const [unit, setUnit] = useState(item.unit ?? "");
  const [assetCode, setAssetCode] = useState(item.asset_code ?? "");
  const [condition, setCondition] = useState<AssetCondition>(item.condition);
  const [categoryId, setCategoryId] = useState(item.category_id ?? "");
  const [budgetSourceId, setBudgetSourceId] = useState(item.budget_source_id ?? "");
  const [acquiredYear, setAcquiredYear] = useState(item.acquired_year?.toString() ?? "");
  const [price, setPrice] = useState(item.price?.toString() ?? "");
  const [note, setNote] = useState(item.note ?? "");
  const [newPhoto, setNewPhoto] = useState<File | null>(null);
  const [model, setModel] = useState(item.model ?? "");
  const [spec, setSpec] = useState(item.spec ?? "");
  const [vendorName, setVendorName] = useState(item.vendor_name ?? "");
  const [vendorAddress, setVendorAddress] = useState(item.vendor_address ?? "");
  const [vendorPhone, setVendorPhone] = useState(item.vendor_phone ?? "");
  const [acquisitionMethod, setAcquisitionMethod] = useState(item.acquisition_method ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      let photoPath = item.photo_path;
      if (newPhoto) {
        photoPath = await uploadPhoto(newPhoto);
        if (item.photo_path) await removePhoto(item.photo_path);
      }

      const updated = await updateFn(item.id, {
        name: name.trim(),
        quantity,
        unit: unit.trim() || null,
        asset_code: assetCode.trim() || null,
        untagged: assetCode.trim() === "",
        condition,
        category_id: categoryId || null,
        budget_source_id: budgetSourceId || null,
        acquired_year: parseNumber(acquiredYear),
        price: parseNumber(price),
        note: note.trim() || null,
        photo_path: photoPath,
        model: model.trim() || null,
        spec: spec.trim() || null,
        vendor_name: vendorName.trim() || null,
        vendor_address: vendorAddress.trim() || null,
        vendor_phone: vendorPhone.trim() || null,
        acquisition_method: (acquisitionMethod || null) as AcquisitionMethod | null,
      });
      onSaved(updated);
    } catch (e) {
      setError(humanizeError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border-2 border-sky-300 bg-white p-4">
      <Field label="ชื่อครุภัณฑ์" required>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="จำนวน" required group>
          <QuantityStepper value={quantity} onChange={setQuantity} />
        </Field>
        <Field label="หน่วย">
          <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} />
        </Field>
      </div>

      <Field label="หมายเลขครุภัณฑ์" hint="เว้นว่าง = ยังไม่ติดป้าย">
        <input className={inputClass} value={assetCode} onChange={(e) => setAssetCode(e.target.value)} />
      </Field>

      <Field label="หมวดหมู่">
        <select className={inputClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">— ไม่ระบุ —</option>
          {masters.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="สภาพการใช้งาน" required group>
        <div className="flex flex-wrap gap-2">
          {CONDITIONS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCondition(c.value)}
              className={
                "rounded-full border px-3.5 py-2 text-sm " +
                (condition === c.value ? c.tone : "border-stone-300 bg-white text-stone-700")
              }
            >
              {c.label}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="ปีที่ได้มา (พ.ศ.)">
          <input className={inputClass} value={acquiredYear} onChange={(e) => setAcquiredYear(e.target.value)} />
        </Field>
        <Field label="ราคา (บาท)">
          <input className={inputClass} value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
      </div>

      <Field label="แหล่งงบประมาณ">
        <select className={inputClass} value={budgetSourceId} onChange={(e) => setBudgetSourceId(e.target.value)}>
          <option value="">— ไม่ระบุ —</option>
          {masters.budgetSources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="หมายเหตุ">
        <textarea rows={2} className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      <div className="space-y-3 rounded-xl border border-dashed border-stone-300 bg-stone-50 p-3">
        <p className="font-display text-xs font-semibold text-stone-500">
          ข้อมูลเพิ่มเติม (ถ้าทราบ) — ไม่บังคับ เว้นว่างไว้ให้พัสดุกรอกภายหลังได้
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="รุ่น/แบบ">
            <input className={inputClass} value={model} onChange={(e) => setModel(e.target.value)} />
          </Field>
          <Field label="ลักษณะ/คุณสมบัติ">
            <input className={inputClass} value={spec} onChange={(e) => setSpec(e.target.value)} />
          </Field>
        </div>

        <Field label="วิธีการได้มา">
          <select
            className={inputClass}
            value={acquisitionMethod}
            onChange={(e) => setAcquisitionMethod(e.target.value)}
          >
            <option value="">— ไม่ระบุ —</option>
            {ACQUISITION_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>

        <Field label="ชื่อผู้ขาย/ผู้รับจ้าง/ผู้บริจาค">
          <input className={inputClass} value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="ที่อยู่ผู้ขาย">
            <input className={inputClass} value={vendorAddress} onChange={(e) => setVendorAddress(e.target.value)} />
          </Field>
          <Field label="โทรศัพท์ผู้ขาย">
            <input className={inputClass} value={vendorPhone} onChange={(e) => setVendorPhone(e.target.value)} />
          </Field>
        </div>
      </div>

      <Field label={item.photo_path ? "เปลี่ยนรูป" : "เพิ่มรูป"} required={!item.photo_path} group>
        {item.photo_path && !newPhoto ? (
          <div className="flex items-center gap-3">
            <PhotoThumb path={item.photo_path} className="h-20 w-20" />
            <PhotoCapture file={null} onPick={setNewPhoto} onClear={() => setNewPhoto(null)} compact />
          </div>
        ) : (
          <PhotoCapture file={newPhoto} onPick={setNewPhoto} onClear={() => setNewPhoto(null)} compact />
        )}
      </Field>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={busy || name.trim() === ""}
          onClick={save}
          className="rounded-xl bg-sky-700 px-4 py-2.5 font-semibold text-white disabled:bg-stone-300"
        >
          <ButtonLabel busy={busy}>{busy ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}</ButtonLabel>
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-xl border border-stone-300 px-4 py-2.5 text-stone-700 disabled:opacity-50"
        >
          ยกเลิก
        </button>
      </div>
    </div>
  );
}
