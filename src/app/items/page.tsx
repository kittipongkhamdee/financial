"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PhotoCapture } from "@/components/PhotoCapture";
import {
  Alert,
  Field,
  PhotoThumb,
  QuantityStepper,
  Toast,
  inputClass,
  useToast,
} from "@/components/ui";
import {
  CONDITIONS,
  CONDITION_BADGE,
  CONDITION_LABEL,
  STATUS_BADGE,
  STATUS_LABEL,
} from "@/lib/constants";
import {
  deleteItem,
  fetchMyItems,
  humanizeError,
  removePhoto,
  submitDrafts,
  updateItem,
  uploadPhoto,
} from "@/lib/data";
import { formatBaht, formatCount, parseNumber } from "@/lib/format";
import { useMasters } from "@/lib/hooks";
import type { AssetCondition, AssetItem, Masters } from "@/lib/types";

/** รายการของฉัน — ตรวจทาน แก้ไข แล้วส่งให้งานพัสดุ */
export default function ItemsPage() {
  const { masters, error: mastersError } = useMasters();
  const { message, show } = useToast();

  const [items, setItems] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!masters?.round) return;
    fetchMyItems(masters.round.id)
      .then(setItems)
      .catch((e) => setError(humanizeError(e)))
      .finally(() => setLoading(false));
  }, [masters]);

  const byRoom = useMemo(() => {
    const groups = new Map<string, AssetItem[]>();
    for (const item of items) {
      const key = `${item.building} · ชั้น ${item.floor ?? "-"} · ห้อง ${item.room}`;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return [...groups.entries()];
  }, [items]);

  const drafts = items.filter((i) => i.status === "draft" || i.status === "rejected");
  const missingPhoto = drafts.filter((i) => !i.photo_path);
  const totalValue = items.reduce((sum, i) => sum + (i.price ?? 0) * i.quantity, 0);

  async function handleDelete(item: AssetItem) {
    if (!confirm(`ลบ "${item.name}" ออกจากรายการ?`)) return;
    setBusy(true);
    try {
      await deleteItem(item.id);
      if (item.photo_path) await removePhoto(item.photo_path);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      show("ลบแล้ว");
    } catch (e) {
      setError(humanizeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    if (!masters?.round) return;
    if (missingPhoto.length > 0) {
      setError(
        `ยังมี ${missingPhoto.length} รายการที่ไม่มีรูป — เพิ่มรูปให้ครบก่อนส่งให้พัสดุ`,
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const count = await submitDrafts(masters.round.id);
      setItems(await fetchMyItems(masters.round.id));
      show(`ส่งให้งานพัสดุแล้ว ${count} รายการ`);
    } catch (e) {
      setError(humanizeError(e));
    } finally {
      setBusy(false);
    }
  }

  if (mastersError) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
        <Alert tone="error">{mastersError}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">
      <Link href="/" className="text-sm text-sky-700">
        ‹ หน้าแรก
      </Link>
      <h1 className="mt-1 font-display text-xl font-bold text-stone-900">รายการของฉัน</h1>
      <p className="text-sm text-stone-600">
        {formatCount(items.length)} รายการ · มูลค่ารวม {formatBaht(totalValue)} บาท
      </p>

      {error ? (
        <div className="mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      {drafts.length > 0 ? (
        <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/60 p-4">
          <p className="text-sm text-stone-700">
            ยังไม่ส่ง {drafts.length} รายการ
            {missingPhoto.length > 0 ? ` · ไม่มีรูป ${missingPhoto.length} รายการ` : ""}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={handleSubmit}
            className="mt-2 rounded-xl bg-sky-700 px-5 py-2.5 font-semibold text-white transition active:bg-sky-800 disabled:bg-stone-300"
          >
            ส่งให้พัสดุตรวจสอบ
          </button>
        </div>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-stone-500">กำลังโหลด…</p>
      ) : items.length === 0 ? (
        <p className="mt-6 rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
          ยังไม่มีรายการ — เริ่มกรอกได้จาก{" "}
          <Link href="/survey" className="text-sky-700 underline">
            ฟอร์มมือถือ
          </Link>{" "}
          หรือ{" "}
          <Link href="/entry" className="text-sky-700 underline">
            โหมดกรอกเร็ว
          </Link>
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {byRoom.map(([roomLabel, roomItems]) => (
            <section key={roomLabel}>
              <h2 className="font-display text-sm font-semibold text-stone-700">
                {roomLabel} <span className="font-normal text-stone-400">({roomItems.length})</span>
              </h2>
              <ul className="mt-2 space-y-2">
                {roomItems.map((item) =>
                  editing === item.id && masters ? (
                    <li key={item.id}>
                      <ItemEditor
                        item={item}
                        masters={masters}
                        onCancel={() => setEditing(null)}
                        onSaved={(updated) => {
                          setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
                          setEditing(null);
                          show("แก้ไขแล้ว");
                        }}
                      />
                    </li>
                  ) : (
                    <li
                      key={item.id}
                      className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-3"
                    >
                      <PhotoThumb path={item.photo_path} className="h-14 w-14" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-stone-900">{item.name}</p>
                        <p className="text-xs text-stone-500">
                          {item.quantity} {item.unit ?? ""} ·{" "}
                          {item.asset_code ?? <span className="text-amber-700">ยังไม่ติดป้าย</span>}
                          {item.price !== null ? ` · ${formatBaht(item.price)} บาท` : ""}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className={`rounded-full px-2 py-0.5 text-xs ${CONDITION_BADGE[item.condition]}`}>
                            {CONDITION_LABEL[item.condition]}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[item.status]}`}>
                            {STATUS_LABEL[item.status]}
                          </span>
                          {!item.photo_path ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                              ไม่มีรูป
                            </span>
                          ) : null}
                        </div>
                        {item.reject_reason ? (
                          <p className="mt-1.5 text-xs text-rose-700">พัสดุตีกลับ: {item.reject_reason}</p>
                        ) : null}
                      </div>
                      {item.status === "draft" || item.status === "rejected" ? (
                        <div className="flex shrink-0 flex-col gap-1 text-xs">
                          <button onClick={() => setEditing(item.id)} className="text-sky-700">
                            แก้ไข
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => handleDelete(item)}
                            className="text-stone-400 hover:text-rose-600"
                          >
                            ลบ
                          </button>
                        </div>
                      ) : null}
                    </li>
                  ),
                )}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Toast message={message} />
    </main>
  );
}

function ItemEditor({
  item,
  masters,
  onCancel,
  onSaved,
}: {
  item: AssetItem;
  masters: Masters;
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

      const updated = await updateItem(item.id, {
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
        <Field label="จำนวน" required>
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

      <Field label="สภาพการใช้งาน" required>
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

      <Field label={item.photo_path ? "เปลี่ยนรูป" : "เพิ่มรูป"} required={!item.photo_path}>
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
          {busy ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-xl border border-stone-300 px-4 py-2.5 text-stone-700">
          ยกเลิก
        </button>
      </div>
    </div>
  );
}
