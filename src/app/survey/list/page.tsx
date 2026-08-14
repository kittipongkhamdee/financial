"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ItemEditor } from "@/components/ItemEditor";
import { Alert, PhotoThumb, Toast, inputClass, useToast } from "@/components/ui";
import { CONDITION_BADGE, CONDITION_LABEL, STATUS_BADGE, STATUS_LABEL } from "@/lib/constants";
import { fetchPublicItems, humanizeError, updatePublicItem } from "@/lib/data";
import { formatBaht } from "@/lib/format";
import { useMasters } from "@/lib/hooks";
import type { AssetItem } from "@/lib/types";

/**
 * รายการครุภัณฑ์ที่สำรวจส่งมาแล้ว — เปิดสาธารณะ ไม่ต้องล็อกอิน เหมือน /survey
 * ต้องเลือกอาคาร → ชั้น → ห้องก่อน ถึงจะเห็นรายการ (ไม่แสดงทุกรายการรวดเดียว)
 * กดแก้ไขได้เฉพาะรายการที่ยังไม่ผ่านการอนุมัติจากพัสดุ (RLS บังคับ)
 */
export default function PublicItemListPage() {
  const { masters, error: mastersError } = useMasters();

  const [items, setItems] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [building, setBuilding] = useState("");
  const [floor, setFloor] = useState("");
  const [room, setRoom] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const { message, show } = useToast();

  useEffect(() => {
    if (!masters?.round) return;
    setLoading(true);
    fetchPublicItems(masters.round.id)
      .then(setItems)
      .catch((e) => setError(humanizeError(e)))
      .finally(() => setLoading(false));
  }, [masters]);

  const categoryById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of masters?.categories ?? []) map.set(c.id, c.name);
    return map;
  }, [masters]);

  const floorOptions = useMemo(() => {
    if (!building) return [];
    const set = new Set(items.filter((i) => i.building === building).map((i) => i.floor ?? "-"));
    return [...set].sort();
  }, [items, building]);

  const roomOptions = useMemo(() => {
    if (!building || !floor) return [];
    const set = new Set(
      items.filter((i) => i.building === building && (i.floor ?? "-") === floor).map((i) => i.room),
    );
    return [...set].sort();
  }, [items, building, floor]);

  const roomItems = useMemo(() => {
    if (!building || !floor || !room) return [];
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (i.building !== building || (i.floor ?? "-") !== floor || i.room !== room) return false;
      if (q && !i.name.toLowerCase().includes(q) && !(i.asset_code ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, building, floor, room, search]);

  if (mastersError) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
        <Alert tone="error">{mastersError}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-6">
      <Link href="/" className="text-sm text-sky-700">
        ‹ หน้าแรก
      </Link>
      <h1 className="mt-1 font-display text-xl font-bold text-stone-900">รายการครุภัณฑ์ที่สำรวจแล้ว</h1>
      <p className="text-sm text-stone-600">
        {masters?.round ? masters.round.name : ""} · เลือกอาคาร/ชั้น/ห้องเพื่อดูรายการ — กดแก้ไขได้ถ้ายังไม่ผ่านการอนุมัติ
      </p>

      {error ? (
        <div className="mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-stone-500">กำลังโหลด…</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <select
              value={building}
              onChange={(e) => {
                setBuilding(e.target.value);
                setFloor("");
                setRoom("");
              }}
              className={`${inputClass} max-w-[12rem]`}
            >
              <option value="">— เลือกอาคาร —</option>
              {(masters?.buildings ?? []).map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>

            {building ? (
              <select
                value={floor}
                onChange={(e) => {
                  setFloor(e.target.value);
                  setRoom("");
                }}
                className={`${inputClass} max-w-[10rem]`}
              >
                <option value="">— เลือกชั้น —</option>
                {floorOptions.map((f) => (
                  <option key={f} value={f}>
                    ชั้น {f}
                  </option>
                ))}
              </select>
            ) : null}

            {building && floor ? (
              <select value={room} onChange={(e) => setRoom(e.target.value)} className={`${inputClass} max-w-[10rem]`}>
                <option value="">— เลือกห้อง —</option>
                {roomOptions.map((r) => (
                  <option key={r} value={r}>
                    ห้อง {r}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          {building && !floor ? (
            <p className="mt-2 text-xs text-stone-500">
              {floorOptions.length === 0 ? "ยังไม่มีรายการในอาคารนี้" : "เลือกชั้นเพื่อดูห้อง"}
            </p>
          ) : null}
          {building && floor && !room ? (
            <p className="mt-2 text-xs text-stone-500">
              {roomOptions.length === 0 ? "ยังไม่มีรายการในชั้นนี้" : "เลือกห้องเพื่อดูรายการ"}
            </p>
          ) : null}

          {building && floor && room ? (
            <div className="mt-6">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-sm font-semibold text-stone-700">
                  {building} · ชั้น {floor} · ห้อง {room}{" "}
                  <span className="font-normal text-stone-400">({roomItems.length})</span>
                </h2>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นหาชื่อหรือเลขครุภัณฑ์"
                  className={`${inputClass} max-w-[12rem] py-1.5 text-sm`}
                />
              </div>
              {roomItems.length === 0 ? (
                <p className="mt-3 rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
                  ไม่พบรายการที่ค้นหา
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {roomItems.map((item) => {
                    const editable = item.status === "submitted" || item.status === "rejected";

                    if (editingId === item.id && masters) {
                      return (
                        <li key={item.id}>
                          <ItemEditor
                            item={item}
                            masters={masters}
                            updateFn={updatePublicItem}
                            deleteOldPhotoOnReplace={false}
                            onCancel={() => setEditingId(null)}
                            onSaved={(updated) => {
                              setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
                              setEditingId(null);
                              show("แก้ไขแล้ว");
                            }}
                          />
                        </li>
                      );
                    }

                    return (
                      <li key={item.id} className="rounded-xl border border-stone-200 bg-white p-3">
                        <div className="flex items-start gap-3">
                          <PhotoThumb path={item.photo_path} className="h-16 w-16" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-stone-900">{item.name}</p>
                            <p className="text-xs text-stone-500">
                              {item.category_id ? categoryById.get(item.category_id) ?? "—" : "— ไม่ระบุหมวดหมู่ —"} ·{" "}
                              {item.quantity} {item.unit ?? ""}
                              {item.price !== null ? ` · ${formatBaht(item.price)} บาท` : ""}
                              {item.asset_code ? ` · เลข ${item.asset_code}` : ""}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <span className={`rounded-full px-2 py-0.5 text-xs ${CONDITION_BADGE[item.condition]}`}>
                                {CONDITION_LABEL[item.condition]}
                              </span>
                              <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[item.status]}`}>
                                {STATUS_LABEL[item.status]}
                              </span>
                            </div>
                            {item.note ? <p className="mt-1.5 text-xs text-stone-600">หมายเหตุ: {item.note}</p> : null}
                            {item.reject_reason ? (
                              <p className="mt-1.5 text-xs text-rose-700">เหตุผลตีกลับ: {item.reject_reason}</p>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-2.5">
                          {editable ? (
                            <button
                              type="button"
                              onClick={() => setEditingId(item.id)}
                              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700"
                            >
                              แก้ไข
                            </button>
                          ) : (
                            <p className="text-xs text-stone-400">
                              พัสดุอนุมัติแล้ว — แก้ไขไม่ได้แล้ว ติดต่อเจ้าหน้าที่พัสดุถ้าต้องแก้ไข
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}
        </>
      )}

      <Toast message={message} />
    </main>
  );
}
