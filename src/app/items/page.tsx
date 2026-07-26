"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ItemEditor } from "@/components/ItemEditor";
import { Alert, ButtonLabel, PhotoThumb, Toast, useToast } from "@/components/ui";
import { CONDITION_BADGE, CONDITION_LABEL, STATUS_BADGE, STATUS_LABEL } from "@/lib/constants";
import { deleteItem, fetchMyItems, humanizeError, removePhoto, submitDrafts, updateItem } from "@/lib/data";
import { formatBaht, formatCount } from "@/lib/format";
import { useMasters } from "@/lib/hooks";
import type { AssetItem } from "@/lib/types";

/** รายการของฉัน — ตรวจทาน แก้ไข แล้วส่งให้งานพัสดุ */
export default function ItemsPage() {
  const { masters, error: mastersError } = useMasters();
  const { message, show } = useToast();

  const [items, setItems] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
    setDeletingId(item.id);
    try {
      await deleteItem(item.id);
      if (item.photo_path) await removePhoto(item.photo_path);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      show("ลบแล้ว");
    } catch (e) {
      setError(humanizeError(e));
    } finally {
      setDeletingId(null);
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
    setSubmitBusy(true);
    setError(null);
    try {
      const count = await submitDrafts(masters.round.id);
      setItems(await fetchMyItems(masters.round.id));
      show(`ส่งให้งานพัสดุแล้ว ${count} รายการ`);
    } catch (e) {
      setError(humanizeError(e));
    } finally {
      setSubmitBusy(false);
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
      <div className="mt-1 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-stone-900">รายการของฉัน</h1>
          <p className="text-sm text-stone-600">
            {formatCount(items.length)} รายการ · มูลค่ารวม {formatBaht(totalValue)} บาท
          </p>
        </div>
        {items.length > 0 ? (
          <Link
            href="/items/print"
            className="shrink-0 rounded-xl border border-sky-700 px-3 py-2 text-sm font-semibold text-sky-700"
          >
            พิมพ์ทะเบียนคุมทรัพย์สิน
          </Link>
        ) : null}
      </div>

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
            disabled={submitBusy}
            onClick={handleSubmit}
            className="mt-2 rounded-xl bg-sky-700 px-5 py-2.5 font-semibold text-white transition active:bg-sky-800 disabled:bg-stone-300"
          >
            <ButtonLabel busy={submitBusy}>ส่งให้พัสดุตรวจสอบ</ButtonLabel>
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
                        updateFn={updateItem}
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
                            disabled={deletingId === item.id}
                            onClick={() => handleDelete(item)}
                            className="text-stone-400 hover:text-rose-600 disabled:opacity-50"
                          >
                            <ButtonLabel busy={deletingId === item.id}>ลบ</ButtonLabel>
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
