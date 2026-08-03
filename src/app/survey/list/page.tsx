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
 * รายการครุภัณฑ์ที่สำรวจส่งมาแล้วทั้งหมด — เปิดสาธารณะ ไม่ต้องล็อกอิน เหมือน /survey
 * แยกกลุ่มอาคาร → ห้อง กดแก้ไขได้เฉพาะรายการที่ยังไม่ผ่านการอนุมัติจากพัสดุ (RLS บังคับ)
 */
export default function PublicItemListPage() {
  const { masters, error: mastersError } = useMasters();

  const [items, setItems] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [buildingFilter, setBuildingFilter] = useState("");
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (buildingFilter && i.building !== buildingFilter) return false;
      if (q && !i.name.toLowerCase().includes(q) && !(i.asset_code ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, buildingFilter, search]);

  const byBuilding = useMemo(() => {
    const buildings = new Map<string, Map<string, AssetItem[]>>();
    for (const item of filtered) {
      const rooms = buildings.get(item.building) ?? new Map<string, AssetItem[]>();
      const roomKey = `ชั้น ${item.floor ?? "-"} · ห้อง ${item.room}`;
      rooms.set(roomKey, [...(rooms.get(roomKey) ?? []), item]);
      buildings.set(item.building, rooms);
    }
    return [...buildings.entries()];
  }, [filtered]);

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
        {masters?.round ? masters.round.name : ""} · แยกตามอาคาร/ห้อง — กดแก้ไขได้ถ้ายังไม่ผ่านการอนุมัติ
      </p>

      {error ? (
        <div className="mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อหรือเลขครุภัณฑ์"
          className={`${inputClass} max-w-xs`}
        />
        <select
          value={buildingFilter}
          onChange={(e) => setBuildingFilter(e.target.value)}
          className={`${inputClass} max-w-[10rem]`}
        >
          <option value="">ทุกอาคาร</option>
          {(masters?.buildings ?? []).map((b) => (
            <option key={b.id} value={b.name}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-stone-500">กำลังโหลด…</p>
      ) : byBuilding.length === 0 ? (
        <p className="mt-6 rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
          ยังไม่มีรายการที่สำรวจส่งมา
        </p>
      ) : (
        <div className="mt-6 space-y-8">
          {byBuilding.map(([building, rooms]) => (
            <section key={building}>
              <h2 className="font-display text-base font-bold text-stone-900">{building}</h2>
              <div className="mt-3 space-y-5">
                {[...rooms.entries()].map(([roomLabel, roomItems]) => (
                  <div key={roomLabel}>
                    <h3 className="font-display text-sm font-semibold text-stone-700">
                      {roomLabel} <span className="font-normal text-stone-400">({roomItems.length})</span>
                    </h3>
                    <ul className="mt-2 space-y-2">
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
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Toast message={message} />
    </main>
  );
}
