"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ItemEditor } from "@/components/ItemEditor";
import { Alert, ButtonLabel, PhotoThumb, Toast, inputClass, useToast } from "@/components/ui";
import {
  CONDITION_BADGE,
  CONDITION_LABEL,
  STATUS_BADGE,
  STATUS_LABEL,
} from "@/lib/constants";
import {
  approveItems,
  deleteItem,
  fetchProfilesByIds,
  fetchReviewItems,
  humanizeError,
  rejectItem,
  removePhoto,
  updateItemAsStaff,
} from "@/lib/data";
import { describeLocation, formatBaht, formatCount } from "@/lib/format";
import { useMasters, useProfile } from "@/lib/hooks";
import type { AssetItem, AssetItemStatus } from "@/lib/types";

const TABS: { value: AssetItemStatus; label: string }[] = [
  { value: "submitted", label: "รอตรวจสอบ" },
  { value: "approved", label: "อนุมัติแล้ว" },
  { value: "rejected", label: "ตีกลับ" },
];

type ProfileInfo = { full_name: string; department: string | null };

export default function ReviewPage() {
  const { masters, error: mastersError } = useMasters();
  const profile = useProfile();
  const { message, show } = useToast();

  const [items, setItems] = useState<AssetItem[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const [tab, setTab] = useState<AssetItemStatus>("submitted");
  const [buildingFilter, setBuildingFilter] = useState("");
  const [search, setSearch] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const isStaff = profile ? profile.role === "supply" || profile.role === "admin" : null;

  useEffect(() => {
    if (!masters?.round || isStaff !== true) return;
    setLoading(true);
    fetchReviewItems(masters.round.id)
      .then(async (rows) => {
        setItems(rows);
        setProfiles(await fetchProfilesByIds(rows.map((r) => r.surveyed_by)));
      })
      .catch((e) => setError(humanizeError(e)))
      .finally(() => setLoading(false));
  }, [masters, isStaff]);

  function setBusy(id: string, busy: boolean) {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleApprove(ids: string[]) {
    ids.forEach((id) => setBusy(id, true));
    try {
      await approveItems(ids);
      setItems((prev) =>
        prev.map((i) => (ids.includes(i.id) ? { ...i, status: "approved", reject_reason: null } : i)),
      );
      show(ids.length > 1 ? `อนุมัติแล้ว ${ids.length} รายการ` : "อนุมัติแล้ว");
    } catch (e) {
      setError(humanizeError(e));
    } finally {
      ids.forEach((id) => setBusy(id, false));
    }
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) return;
    setBusy(id, true);
    try {
      await rejectItem(id, rejectReason);
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: "rejected", reject_reason: rejectReason.trim() } : i)),
      );
      setRejectingId(null);
      setRejectReason("");
      show("ตีกลับแล้ว");
    } catch (e) {
      setError(humanizeError(e));
    } finally {
      setBusy(id, false);
    }
  }

  async function handleDelete(item: AssetItem) {
    if (!confirm(`ลบ "${item.name}" ออกจากระบบถาวร?`)) return;
    setBusy(item.id, true);
    try {
      await deleteItem(item.id);
      if (item.photo_path) await removePhoto(item.photo_path);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      show("ลบแล้ว");
    } catch (e) {
      setError(humanizeError(e));
    } finally {
      setBusy(item.id, false);
    }
  }

  async function handleCodeChange(item: AssetItem, value: string) {
    const trimmed = value.trim();
    if (trimmed === (item.asset_code ?? "")) return;
    setBusy(item.id, true);
    try {
      const updated = await updateItemAsStaff(item.id, {
        asset_code: trimmed || null,
        untagged: trimmed === "",
      });
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
    } catch (e) {
      setError(humanizeError(e));
    } finally {
      setBusy(item.id, false);
    }
  }

  const categoryById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of masters?.categories ?? []) map.set(c.id, c.name);
    return map;
  }, [masters]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (i.status !== tab) return false;
      if (buildingFilter && i.building !== buildingFilter) return false;
      if (q && !i.name.toLowerCase().includes(q) && !(i.asset_code ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, tab, buildingFilter, search]);

  const byRoom = useMemo(() => {
    const groups = new Map<string, AssetItem[]>();
    for (const item of filtered) {
      const key = `${item.building} · ชั้น ${item.floor ?? "-"} · ห้อง ${item.room}`;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return [...groups.entries()];
  }, [filtered]);

  const counts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const i of items) acc[i.status] = (acc[i.status] ?? 0) + 1;
    return acc;
  }, [items]);

  if (profile && !isStaff) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
        <Alert tone="error">หน้านี้สำหรับเจ้าหน้าที่พัสดุหรือแอดมินเท่านั้น</Alert>
        <Link href="/" className="mt-3 inline-block text-sm text-sky-700">
          ‹ กลับหน้าแรก
        </Link>
      </main>
    );
  }

  if (mastersError) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
        <Alert tone="error">{mastersError}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-6">
      <Link href="/" className="text-sm text-sky-700">
        ‹ หน้าแรก
      </Link>
      <h1 className="mt-1 font-display text-xl font-bold text-stone-900">ตรวจสอบครุภัณฑ์</h1>
      <p className="text-sm text-stone-600">{masters?.round ? masters.round.name : ""} · รายการของทุกคนในรอบนี้</p>

      {error ? (
        <div className="mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={
              "rounded-full border px-3.5 py-2 text-sm transition " +
              (tab === t.value
                ? "border-sky-700 bg-sky-700 font-medium text-white"
                : "border-stone-300 bg-white text-stone-700")
            }
          >
            {t.label} <span className="opacity-70">({counts[t.value] ?? 0})</span>
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
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
      ) : filtered.length === 0 ? (
        <p className="mt-6 rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
          ไม่มีรายการในหมวดนี้
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {byRoom.map(([roomLabel, roomItems]) => (
            <section key={roomLabel}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-sm font-semibold text-stone-700">
                  {roomLabel} <span className="font-normal text-stone-400">({roomItems.length})</span>
                </h2>
                {tab === "submitted" ? (
                  <button
                    type="button"
                    disabled={roomItems.some((i) => busyIds.has(i.id))}
                    onClick={() => handleApprove(roomItems.map((i) => i.id))}
                    className="rounded-full border border-emerald-600 px-3 py-1 text-xs font-medium text-emerald-700 disabled:opacity-50"
                  >
                    <ButtonLabel busy={roomItems.some((i) => busyIds.has(i.id))}>อนุมัติทั้งห้อง</ButtonLabel>
                  </button>
                ) : null}
              </div>
              <ul className="mt-2 space-y-2">
                {roomItems.map((item) => {
                  const teacher = profiles.get(item.surveyed_by);
                  const busy = busyIds.has(item.id);

                  if (editingId === item.id && masters) {
                    return (
                      <li key={item.id}>
                        <ItemEditor
                          item={item}
                          masters={masters}
                          updateFn={updateItemAsStaff}
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
                            {item.acquired_year ? ` · ได้มาปี ${item.acquired_year}` : ""}
                          </p>
                          <p className="mt-1 text-xs text-stone-500">
                            ครูผู้กรอก: {teacher?.full_name ?? "ไม่ทราบ"}
                            {teacher?.department ? ` (${teacher.department})` : ""} ·{" "}
                            {new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "short" }).format(
                              new Date(item.created_at),
                            )}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className={`rounded-full px-2 py-0.5 text-xs ${CONDITION_BADGE[item.condition]}`}>
                              {CONDITION_LABEL[item.condition]}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[item.status]}`}>
                              {STATUS_LABEL[item.status]}
                            </span>
                          </div>
                          {item.note ? <p className="mt-1.5 text-xs text-stone-600">หมายเหตุครู: {item.note}</p> : null}
                          {item.reject_reason ? (
                            <p className="mt-1.5 text-xs text-rose-700">เหตุผลตีกลับ: {item.reject_reason}</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <input
                          defaultValue={item.asset_code ?? ""}
                          disabled={busy}
                          onBlur={(e) => handleCodeChange(item, e.target.value)}
                          placeholder="ออกหมายเลขครุภัณฑ์"
                          className={`${inputClass} max-w-[12rem] py-1.5 text-sm`}
                        />

                        {tab === "submitted" ? (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleApprove([item.id])}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:bg-stone-300"
                            >
                              <ButtonLabel busy={busy}>อนุมัติ</ButtonLabel>
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                setRejectingId(rejectingId === item.id ? null : item.id);
                                setRejectReason("");
                              }}
                              className="rounded-lg border border-rose-400 px-3 py-1.5 text-sm font-medium text-rose-700 disabled:opacity-50"
                            >
                              ตีกลับ
                            </button>
                          </>
                        ) : null}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setEditingId(item.id)}
                          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 disabled:opacity-50"
                        >
                          แก้ไข
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleDelete(item)}
                          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-500 hover:border-rose-400 hover:text-rose-600 disabled:opacity-50"
                        >
                          <ButtonLabel busy={busy}>ลบ</ButtonLabel>
                        </button>
                      </div>

                      {rejectingId === item.id ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <input
                            autoFocus
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="เหตุผลที่ตีกลับ เช่น รูปไม่ชัด ราคาไม่ตรงใบเสร็จ"
                            className={`${inputClass} max-w-sm py-1.5 text-sm`}
                          />
                          <button
                            type="button"
                            disabled={!rejectReason.trim() || busy}
                            onClick={() => handleReject(item.id)}
                            className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white disabled:bg-stone-300"
                          >
                            <ButtonLabel busy={busy}>ยืนยันตีกลับ</ButtonLabel>
                          </button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Toast message={message} />
    </main>
  );
}
