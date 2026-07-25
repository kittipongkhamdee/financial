"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Alert, PhotoThumb, Toast, inputClass, useToast } from "@/components/ui";
import {
  CONDITIONS,
  CONDITION_BADGE,
  CONDITION_LABEL,
  CURRENT_BE_YEAR,
  FLOORS,
  STATUS_BADGE,
  STATUS_LABEL,
} from "@/lib/constants";
import {
  fetchMyItems,
  humanizeError,
  insertItem,
  submitDrafts,
  uploadPhoto,
} from "@/lib/data";
import { formatBaht, formatCount, parseNumber, shiftAssetCodeSerial } from "@/lib/format";
import { useLastRoom, useMasters, useProfile } from "@/lib/hooks";
import type { AssetCondition, AssetItem } from "@/lib/types";

type Row = {
  key: string;
  name: string;
  categoryId: string | null;
  quantity: number;
  unit: string;
  assetCode: string;
  condition: AssetCondition;
  acquiredYear: string;
  price: string;
  file: File | null;
};

/** แถวว่างใหม่ — carry คือค่าที่สืบทอดจากแถวก่อนหน้า (หมวดหมู่/หน่วย/ปี) */
function blankRow(carry?: Partial<Omit<Row, "key">>): Row {
  return {
    key: crypto.randomUUID(),
    name: "",
    categoryId: null,
    quantity: 1,
    unit: "",
    assetCode: "",
    condition: "usable",
    acquiredYear: "",
    price: "",
    file: null,
    ...carry,
  };
}

/** 1d — โหมดกรอกเร็วบนคอมพิวเตอร์: ล็อกห้องไว้ที่หัวจอ แล้วรูดกรอกทีละแถว */
export default function EntryPage() {
  const { masters, error: mastersError } = useMasters();
  const { lastRoom, remember } = useLastRoom();
  const profile = useProfile();
  const { message, show } = useToast();

  // เริ่มจากห้องล่าสุดที่กรอกไว้ ครูที่กรอกต่อเนื่องจะไม่ต้องเลือกซ้ำ
  const [building, setBuilding] = useState(lastRoom?.building ?? "");
  const [floor, setFloor] = useState(lastRoom?.floor ?? "");
  const [room, setRoom] = useState(lastRoom?.room ?? "");
  const [rows, setRows] = useState<Row[]>([blankRow()]);
  const [saved, setSaved] = useState<AssetItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const nameRefs = useRef(new Map<string, HTMLInputElement>());
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    if (!masters?.round) return;
    fetchMyItems(masters.round.id)
      .then(setSaved)
      .catch((e) => setError(humanizeError(e)));
  }, [masters]);

  useEffect(() => {
    if (!pendingFocus.current) return;
    nameRefs.current.get(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  }, [rows]);

  const roomReady = building.trim() !== "" && room.trim() !== "";

  const updateRow = useCallback((key: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }, []);

  const addRow = useCallback((carry?: Partial<Omit<Row, "key">>) => {
    const row = blankRow(carry);
    pendingFocus.current = row.key;
    setRows((prev) => [...prev, row]);
  }, []);

  const duplicateLast = useCallback(() => {
    setRows((prev) => {
      const last = prev[prev.length - 1];
      if (!last) return prev;
      // ทำซ้ำทุกช่องยกเว้นเลขครุภัณฑ์กับรูป — สองอย่างนี้ต้องต่างกันทุกชิ้น
      const copy: Row = { ...last, key: crypto.randomUUID(), assetCode: "", file: null };
      pendingFocus.current = copy.key;
      return [...prev, copy];
    });
  }, []);

  // ทางลัดคีย์บอร์ด: Enter = แถวใหม่ · Ctrl/⌘+D = ทำซ้ำแถวบน
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const last = rows[rows.length - 1];
      addRow(last?.categoryId ? { categoryId: last.categoryId, unit: last.unit } : undefined);
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      duplicateLast();
    }
  }

  /** ลากรูปหลายไฟล์มาวางทีเดียว → จับคู่ตามลำดับแถวที่ยังไม่มีรูป */
  function attachFiles(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;

    setRows((prev) => {
      const next = [...prev];
      let cursor = 0;
      for (let i = 0; i < next.length && cursor < images.length; i++) {
        if (!next[i].file) next[i] = { ...next[i], file: images[cursor++] };
      }
      while (cursor < images.length) {
        next.push({ ...blankRow(), file: images[cursor++] });
      }
      return next;
    });
    show(`แนบรูปแล้ว ${images.length} ไฟล์`);
  }

  const filledRows = useMemo(() => rows.filter((r) => r.name.trim() !== ""), [rows]);

  async function saveAll() {
    if (!masters?.round) {
      setError("ยังไม่มีรอบสำรวจที่เปิดอยู่");
      return;
    }
    if (!roomReady || filledRows.length === 0) return;

    setBusy(true);
    setError(null);

    const created: AssetItem[] = [];
    const failed: { row: Row; reason: string }[] = [];

    for (const row of filledRows) {
      try {
        const photoPath = row.file ? await uploadPhoto(row.file) : null;
        const item = await insertItem(
          masters.round.id,
          {
            building: building.trim(),
            floor: floor.trim() || null,
            room: room.trim(),
            category_id: row.categoryId,
            name: row.name.trim(),
            quantity: row.quantity,
            unit: row.unit.trim() || null,
            asset_code: row.assetCode.trim() || null,
            untagged: row.assetCode.trim() === "",
            condition: row.condition,
            note: null,
            acquired_year: parseNumber(row.acquiredYear),
            budget_source_id: null,
            price: parseNumber(row.price),
          },
          photoPath,
        );
        created.push(item);
      } catch (e) {
        failed.push({ row, reason: humanizeError(e) });
      }
    }

    if (created.length > 0) {
      remember({ building: building.trim(), floor: floor.trim() || null, room: room.trim() });
      setSaved((prev) => [...created, ...prev]);
      show(`บันทึกลงระบบแล้ว ${created.length} รายการ`);
    }

    // เก็บเฉพาะแถวที่บันทึกไม่ผ่านไว้ให้แก้ต่อ
    setRows(failed.length > 0 ? failed.map((f) => f.row) : [blankRow()]);
    setError(
      failed.length > 0
        ? `บันทึกไม่ผ่าน ${failed.length} แถว: ${failed.map((f) => `${f.row.name || "(ไม่มีชื่อ)"} — ${f.reason}`).join(" · ")}`
        : null,
    );
    setBusy(false);
  }

  async function handleSubmit() {
    if (!masters?.round) return;
    const drafts = saved.filter((i) => i.status === "draft" || i.status === "rejected");
    const missingPhoto = drafts.filter((i) => !i.photo_path);

    if (missingPhoto.length > 0) {
      setError(
        `ยังมี ${missingPhoto.length} รายการที่ไม่มีรูป — ลากรูปมาจับคู่ให้ครบก่อนส่งให้พัสดุ (${missingPhoto
          .slice(0, 3)
          .map((i) => i.name)
          .join(", ")}${missingPhoto.length > 3 ? " …" : ""})`,
      );
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const count = await submitDrafts(masters.round.id);
      setSaved(await fetchMyItems(masters.round.id));
      show(`ส่งให้งานพัสดุแล้ว ${count} รายการ`);
    } catch (e) {
      setError(humanizeError(e));
    } finally {
      setBusy(false);
    }
  }

  const totalValue = saved.reduce((sum, i) => sum + (i.price ?? 0) * i.quantity, 0);
  const draftCount = saved.filter((i) => i.status === "draft" || i.status === "rejected").length;

  if (mastersError) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8">
        <Alert tone="error">{mastersError}</Alert>
      </main>
    );
  }

  if (!masters) {
    return <main className="flex-1 px-5 py-10 text-center text-sm text-stone-500">กำลังโหลด…</main>;
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6" onKeyDown={handleKeyDown}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/" className="text-sm text-sky-700">
            ‹ หน้าแรก
          </Link>
          <h1 className="mt-1 font-display text-xl font-bold text-stone-900">
            โหมดกรอกเร็ว · {masters.round?.name}
          </h1>
          <p className="text-sm text-stone-600">
            ผู้กรอก: {profile?.full_name ?? "—"}
            {profile?.department ? ` · ${profile.department}` : ""}
          </p>
        </div>
        <p className="max-w-xs rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs leading-relaxed text-stone-600">
          <kbd className="rounded bg-stone-100 px-1 font-display">Enter</kbd> = แถวใหม่ ·{" "}
          <kbd className="rounded bg-stone-100 px-1 font-display">Ctrl/⌘ + D</kbd> = ทำซ้ำแถวบนแล้วแก้เฉพาะเลขครุภัณฑ์
        </p>
      </header>

      {/* ห้องที่ล็อกไว้ — ค่าเหล่านี้ถูกใส่ให้ทุกแถวอัตโนมัติ */}
      <section className="mt-5 rounded-xl border border-sky-200 bg-sky-50/60 p-4">
        <p className="font-display text-xs font-semibold tracking-wide text-sky-800">กำลังกรอกห้อง</p>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-stone-600">อาคาร</span>
            <select className={inputClass} value={building} onChange={(e) => setBuilding(e.target.value)}>
              <option value="">— เลือก —</option>
              {masters.buildings.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-stone-600">ชั้น</span>
            <select className={inputClass} value={floor} onChange={(e) => setFloor(e.target.value)}>
              <option value="">—</option>
              {FLOORS.map((f) => (
                <option key={f} value={f}>
                  ชั้น {f}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-stone-600">เลขห้อง</span>
            <input
              className={`${inputClass} w-32`}
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="124"
            />
          </label>
          <p className="pb-2 text-xs text-stone-500">ค่าเหล่านี้ถูกใส่ให้ทุกแถวอัตโนมัติ</p>
        </div>
        {!roomReady ? (
          <p className="mt-2 text-xs text-rose-700">เลือกอาคารและเลขห้องก่อนจึงบันทึกได้</p>
        ) : null}
      </section>

      {/* ตารางกรอก */}
      <section className="mt-4 overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left font-display text-xs text-stone-600">
              <th className="w-10 px-3 py-2">#</th>
              <th className="px-3 py-2">ชื่อครุภัณฑ์ *</th>
              <th className="w-40 px-3 py-2">หมวดหมู่</th>
              <th className="w-20 px-3 py-2">จำนวน</th>
              <th className="w-24 px-3 py-2">หน่วย</th>
              <th className="w-44 px-3 py-2">หมายเลขครุภัณฑ์</th>
              <th className="w-32 px-3 py-2">สภาพ</th>
              <th className="w-24 px-3 py-2">ปี พ.ศ.</th>
              <th className="w-28 px-3 py-2">ราคา</th>
              <th className="w-16 px-3 py-2">รูป</th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.key} className="border-b border-stone-100 last:border-0">
                <td className="px-3 py-1.5 text-stone-400">{index + 1}</td>
                <td className="px-3 py-1.5">
                  <input
                    ref={(el) => {
                      if (el) nameRefs.current.set(row.key, el);
                      else nameRefs.current.delete(row.key);
                    }}
                    className="w-full rounded border border-transparent px-2 py-1.5 outline-none hover:border-stone-200 focus:border-sky-600"
                    value={row.name}
                    onChange={(e) => updateRow(row.key, { name: e.target.value })}
                    placeholder="พิมพ์ชื่อครุภัณฑ์…"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <select
                    className="w-full rounded border border-transparent px-1 py-1.5 outline-none hover:border-stone-200 focus:border-sky-600"
                    value={row.categoryId ?? ""}
                    onChange={(e) => updateRow(row.key, { categoryId: e.target.value || null })}
                  >
                    <option value="">เลือก</option>
                    {masters.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="number"
                    min={1}
                    className="w-full rounded border border-transparent px-2 py-1.5 text-center outline-none hover:border-stone-200 focus:border-sky-600"
                    value={row.quantity}
                    onChange={(e) => {
                      const nextQty = Math.max(1, Number(e.target.value) || 1);
                      updateRow(row.key, {
                        quantity: nextQty,
                        assetCode: shiftAssetCodeSerial(row.assetCode, nextQty - row.quantity),
                      });
                    }}
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    list="asset-units"
                    className="w-full rounded border border-transparent px-2 py-1.5 outline-none hover:border-stone-200 focus:border-sky-600"
                    value={row.unit}
                    onChange={(e) => updateRow(row.key, { unit: e.target.value })}
                    placeholder="เครื่อง"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    className="w-full rounded border border-transparent px-2 py-1.5 font-display outline-none hover:border-stone-200 focus:border-sky-600"
                    value={row.assetCode}
                    onChange={(e) => updateRow(row.key, { assetCode: e.target.value })}
                    placeholder="ยังไม่ติดป้าย"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <select
                    className="w-full rounded border border-transparent px-1 py-1.5 outline-none hover:border-stone-200 focus:border-sky-600"
                    value={row.condition}
                    onChange={(e) => updateRow(row.key, { condition: e.target.value as AssetCondition })}
                  >
                    {CONDITIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-1.5">
                  <input
                    className="w-full rounded border border-transparent px-2 py-1.5 text-center outline-none hover:border-stone-200 focus:border-sky-600"
                    value={row.acquiredYear}
                    onChange={(e) => updateRow(row.key, { acquiredYear: e.target.value })}
                    placeholder={String(CURRENT_BE_YEAR)}
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    className="w-full rounded border border-transparent px-2 py-1.5 text-right outline-none hover:border-stone-200 focus:border-sky-600"
                    value={row.price}
                    onChange={(e) => updateRow(row.key, { price: e.target.value })}
                    placeholder="—"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <RowPhoto file={row.file} onClear={() => updateRow(row.key, { file: null })} />
                </td>
                <td className="px-2 py-1.5">
                  {rows.length > 1 ? (
                    <button
                      type="button"
                      aria-label="ลบแถว"
                      onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                      className="text-stone-400 hover:text-rose-600"
                    >
                      ✕
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <datalist id="asset-units">
          {masters.units.map((u) => (
            <option key={u.id} value={u.name} />
          ))}
        </datalist>

        <div className="flex flex-wrap items-center gap-3 border-t border-stone-200 bg-stone-50 px-3 py-2 text-sm">
          <button type="button" onClick={() => addRow()} className="text-sky-700">
            + เพิ่มแถว (Enter)
          </button>
          <button type="button" onClick={duplicateLast} className="text-sky-700">
            ทำซ้ำแถวบน (Ctrl/⌘+D)
          </button>
          <span className="ml-auto text-xs text-stone-500">
            กรอกชื่อแล้ว {filledRows.length} / {rows.length} แถว
          </span>
        </div>
      </section>

      {/* โซนลากรูป */}
      <section
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          attachFiles(Array.from(e.dataTransfer.files));
        }}
        className={
          "mt-4 rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm transition " +
          (dragOver ? "border-sky-600 bg-sky-50 text-sky-800" : "border-stone-300 bg-white text-stone-500")
        }
      >
        <p className="font-medium">ลากรูปหลายไฟล์มาวางตรงนี้ → ระบบจับคู่ตามลำดับแถวที่ยังไม่มีรูป</p>
        <label className="mt-1 inline-block cursor-pointer text-sky-700">
          หรือกดเพื่อเลือกไฟล์
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              attachFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </label>
        <p className="mt-1 text-xs text-stone-400">
          ถ่ายรูปทั้งห้องจากมือถือก่อน แล้วส่งเข้าคอมมาลากวางทีเดียว — ไฟล์ที่เกินจำนวนแถวจะสร้างแถวใหม่ให้
        </p>
      </section>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || !roomReady || filledRows.length === 0}
          onClick={saveAll}
          className="rounded-xl bg-sky-700 px-5 py-2.5 font-semibold text-white transition active:bg-sky-800 disabled:bg-stone-300"
        >
          {busy ? "กำลังบันทึก…" : `บันทึกลงระบบ ${filledRows.length} รายการ`}
        </button>
        <Link href="/items" className="text-sm text-sky-700">
          ดูรายการทั้งหมดของฉัน ›
        </Link>
      </div>

      {error ? (
        <div className="mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      {/* รายการที่บันทึกแล้วในรอบนี้ */}
      <section className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-base font-semibold text-stone-900">
            บันทึกไว้ในระบบแล้ว {formatCount(saved.length)} รายการ
          </h2>
          <p className="text-sm text-stone-600">
            มูลค่ารวม <span className="font-display font-semibold text-stone-900">{formatBaht(totalValue)}</span> บาท
          </p>
        </div>

        {saved.length > 0 ? (
          <>
            <div className="mt-3 overflow-x-auto rounded-xl border border-stone-200 bg-white">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-left font-display text-xs text-stone-600">
                    <th className="w-16 px-3 py-2">รูป</th>
                    <th className="px-3 py-2">ชื่อครุภัณฑ์</th>
                    <th className="w-28 px-3 py-2">ห้อง</th>
                    <th className="w-20 px-3 py-2">จำนวน</th>
                    <th className="w-44 px-3 py-2">หมายเลข</th>
                    <th className="w-28 px-3 py-2">สภาพ</th>
                    <th className="w-32 px-3 py-2">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {saved.map((item) => (
                    <tr key={item.id} className="border-b border-stone-100 last:border-0">
                      <td className="px-3 py-2">
                        <PhotoThumb path={item.photo_path} className="h-10 w-10" />
                      </td>
                      <td className="px-3 py-2 text-stone-900">{item.name}</td>
                      <td className="px-3 py-2 text-stone-600">
                        {item.building}/{item.floor ?? "-"}/{item.room}
                      </td>
                      <td className="px-3 py-2 text-stone-600">
                        {item.quantity} {item.unit ?? ""}
                      </td>
                      <td className="px-3 py-2 font-display text-xs text-stone-600">
                        {item.asset_code ?? <span className="text-amber-700">ยังไม่ติดป้าย</span>}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${CONDITION_BADGE[item.condition]}`}>
                          {CONDITION_LABEL[item.condition]}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[item.status]}`}>
                          {STATUS_LABEL[item.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {draftCount > 0 ? (
              <button
                type="button"
                disabled={busy}
                onClick={handleSubmit}
                className="mt-3 rounded-xl border border-sky-700 px-5 py-2.5 font-semibold text-sky-800 transition hover:bg-sky-50 disabled:opacity-50"
              >
                ส่งให้พัสดุตรวจสอบ ({draftCount} รายการ)
              </button>
            ) : null}
          </>
        ) : (
          <p className="mt-2 text-sm text-stone-500">ยังไม่มีรายการที่บันทึกในรอบนี้</p>
        )}
      </section>

      <Toast message={message} />
    </main>
  );
}

/** thumbnail ของไฟล์ที่ยังไม่อัปโหลด (blob URL) */
function RowPhoto({ file, onClear }: { file: File | null; onClear: () => void }) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  if (!url) return <span className="text-stone-300">—</span>;

  return (
    <button type="button" onClick={onClear} title="กดเพื่อลบรูปนี้" className="block h-10 w-10 overflow-hidden rounded">
      {/* eslint-disable-next-line @next/next/no-img-element -- blob URL ของไฟล์ที่ยังไม่อัปโหลด */}
      <img src={url} alt="รูปที่แนบ" className="h-full w-full object-cover" />
    </button>
  );
}
