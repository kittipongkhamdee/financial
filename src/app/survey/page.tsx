"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PhotoCapture } from "@/components/PhotoCapture";
import {
  Alert,
  ChipGroup,
  Field,
  PhotoThumb,
  QuantityStepper,
  Toast,
  inputClass,
  useToast,
} from "@/components/ui";
import { CONDITIONS, CURRENT_BE_YEAR, FLOORS } from "@/lib/constants";
import { findByAssetCode, humanizeError, insertItem, uploadPhoto } from "@/lib/data";
import { describeLocation, parseNumber, shiftAssetCodeSerial } from "@/lib/format";
import { useLastRoom, useMasters } from "@/lib/hooks";
import type { AssetCondition, AssetItem } from "@/lib/types";

type Draft = {
  building: string;
  floor: string;
  room: string;
  categoryId: string | null;
  name: string;
  quantity: number;
  unit: string;
  assetCode: string;
  untagged: boolean;
  acquiredYear: string;
  budgetSourceId: string | null;
  price: string;
  condition: AssetCondition | null;
  note: string;
};

const EMPTY_ITEM = {
  categoryId: null,
  name: "",
  quantity: 1,
  unit: "",
  assetCode: "",
  untagged: false,
  acquiredYear: "",
  budgetSourceId: null,
  price: "",
  condition: null,
  note: "",
} satisfies Omit<Draft, "building" | "floor" | "room">;

const STEP_TITLES = ["ถ่ายรูปครุภัณฑ์ก่อน", "ครุภัณฑ์อยู่ที่ไหน", "ครุภัณฑ์ชิ้นนี้คืออะไร", "สภาพการใช้งาน"];

/** 1b — ฟอร์มมือถือ ทีละขั้น ถ่ายรูปนำ */
export default function SurveyPage() {
  const router = useRouter();
  const { masters, error: mastersError } = useMasters();
  const { lastRoom, recentRooms, remember } = useLastRoom();
  const { message, show } = useToast();

  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState<File | null>(null);
  // เติมห้องล่าสุดให้อัตโนมัติ ครูที่กรอกต่อเนื่องจะไม่ต้องเลือกซ้ำ
  const [draft, setDraft] = useState<Draft>(() => ({
    building: lastRoom?.building ?? "",
    floor: lastRoom?.floor ?? "",
    room: lastRoom?.room ?? "",
    ...EMPTY_ITEM,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<string | null>(null);
  const [savedInRoom, setSavedInRoom] = useState<AssetItem[]>([]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  // เพิ่ม/ลดจำนวน → ขยับเลขวิ่งท้ายหมายเลขครุภัณฑ์ตามไปด้วย (ของหลายชิ้นมักได้เลขต่อเนื่องกัน)
  const setQuantity = (value: number) =>
    setDraft((d) => ({
      ...d,
      quantity: value,
      assetCode: shiftAssetCodeSerial(d.assetCode, value - d.quantity),
    }));

  const buildingNames = useMemo(() => masters?.buildings.map((b) => b.name) ?? [], [masters]);
  const unitNames = useMemo(() => masters?.units.map((u) => u.name) ?? [], [masters]);

  const stepValid = [
    photo !== null,
    draft.building.trim() !== "" && draft.room.trim() !== "",
    draft.name.trim() !== "" && draft.quantity > 0,
    draft.condition !== null,
  ][step];

  async function checkDuplicate(code: string) {
    if (!masters?.round || !code.trim()) {
      setDuplicate(null);
      return;
    }
    try {
      const existing = await findByAssetCode(masters.round.id, code);
      setDuplicate(
        existing ? `เลขนี้กรอกไว้แล้ว: ${existing.name} (ห้อง ${existing.room})` : null,
      );
    } catch {
      setDuplicate(null); // ตรวจไม่ได้ก็ปล่อยให้ unique index เป็นด่านสุดท้าย
    }
  }

  async function save(mode: "next" | "finish") {
    if (!masters?.round) {
      setError("ยังไม่มีรอบสำรวจที่เปิดอยู่");
      return;
    }
    if (!photo || !draft.condition) return;

    setBusy(true);
    setError(null);

    try {
      const photoPath = await uploadPhoto(photo);
      const item = await insertItem(
        masters.round.id,
        {
          building: draft.building.trim(),
          floor: draft.floor.trim() || null,
          room: draft.room.trim(),
          category_id: draft.categoryId,
          name: draft.name.trim(),
          quantity: draft.quantity,
          unit: draft.unit.trim() || null,
          asset_code: draft.assetCode.trim() || null,
          untagged: draft.untagged,
          condition: draft.condition,
          note: draft.note.trim() || null,
          acquired_year: parseNumber(draft.acquiredYear),
          budget_source_id: draft.budgetSourceId,
          price: parseNumber(draft.price),
        },
        photoPath,
      );

      remember({
        building: draft.building.trim(),
        floor: draft.floor.trim() || null,
        room: draft.room.trim(),
      });

      if (mode === "finish") {
        router.push("/items");
        return;
      }

      // เริ่มชิ้นถัดไปในห้องเดิม — เก็บอาคาร/ชั้น/ห้องไว้ ล้างที่เหลือ
      setSavedInRoom((prev) => [item, ...prev]);
      setPhoto(null);
      setDuplicate(null);
      setDraft((d) => ({ building: d.building, floor: d.floor, room: d.room, ...EMPTY_ITEM }));
      setStep(0);
      show(`บันทึกแล้ว — ${item.name}`);
    } catch (e) {
      setError(humanizeError(e));
    } finally {
      setBusy(false);
    }
  }

  if (mastersError) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-8">
        <Alert tone="error">{mastersError}</Alert>
      </main>
    );
  }

  if (!masters) {
    return <main className="flex-1 px-5 py-10 text-center text-sm text-stone-500">กำลังโหลด…</main>;
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-[#f5f3ef]/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          {step === 0 ? (
            <Link href="/" className="text-lg text-stone-500" aria-label="กลับหน้าแรก">
              ‹
            </Link>
          ) : (
            <button onClick={() => setStep(step - 1)} className="text-lg text-stone-500" aria-label="ย้อนกลับ">
              ‹
            </button>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold text-stone-900">{STEP_TITLES[step]}</p>
            <p className="truncate text-xs text-stone-500">
              {draft.room
                ? describeLocation(draft.building || "—", draft.floor || null, draft.room)
                : masters.round?.name}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-stone-900 px-2 py-0.5 font-display text-[11px] font-semibold text-white">
            {step + 1}/4
          </span>
        </div>
        <div className="mt-2 flex gap-1">
          {STEP_TITLES.map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= step ? "bg-sky-700" : "bg-stone-200"}`}
            />
          ))}
        </div>
      </header>

      <div className="flex-1 space-y-5 px-4 py-5">
        {step === 0 ? (
          <>
            <p className="text-sm leading-relaxed text-stone-600">
              ถ่ายให้เห็นตัวครุภัณฑ์และป้ายหมายเลขครุภัณฑ์ในรูปเดียวถ้าทำได้
            </p>
            <PhotoCapture file={photo} onPick={setPhoto} onClear={() => setPhoto(null)} />
            {savedInRoom.length > 0 ? (
              <div className="rounded-xl border border-stone-200 bg-white p-3">
                <p className="font-display text-xs font-semibold text-stone-700">
                  ห้อง {draft.room} · บันทึกแล้ว {savedInRoom.length} รายการ
                </p>
                <ul className="mt-2 space-y-2">
                  {savedInRoom.slice(0, 4).map((item) => (
                    <li key={item.id} className="flex items-center gap-2 text-sm text-stone-600">
                      <PhotoThumb path={item.photo_path} className="h-9 w-9" />
                      <span className="truncate">{item.name}</span>
                      <span className="ml-auto shrink-0 text-xs text-stone-400">
                        {item.quantity} {item.unit ?? ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Field label="อาคาร" required group>
              <ChipGroup
                options={buildingNames}
                value={draft.building}
                onChange={(v) => set("building", v)}
                allowOther
              />
            </Field>
            <Field label="ชั้น" group>
              <ChipGroup options={[...FLOORS]} value={draft.floor} onChange={(v) => set("floor", v)} />
            </Field>
            <Field
              label="เลขห้อง"
              required
              hint={
                recentRooms.length > 0 ? `ล่าสุดที่คุณกรอก: ${recentRooms.join(" · ")}` : undefined
              }
            >
              <input
                inputMode="numeric"
                className={inputClass}
                value={draft.room}
                onChange={(e) => set("room", e.target.value)}
                placeholder="เช่น 324"
              />
            </Field>
            {recentRooms.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {recentRooms.map((room) => (
                  <button
                    key={room}
                    type="button"
                    onClick={() => set("room", room)}
                    className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-600"
                  >
                    {room}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Field label="หมวดหมู่" group>
              <div className="flex flex-wrap gap-2">
                {masters.categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => set("categoryId", draft.categoryId === c.id ? null : c.id)}
                    className={
                      "rounded-full border px-3.5 py-2 text-sm transition " +
                      (draft.categoryId === c.id
                        ? "border-sky-700 bg-sky-700 font-medium text-white"
                        : "border-stone-300 bg-white text-stone-700")
                    }
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="ชื่อครุภัณฑ์" required>
              <input
                className={inputClass}
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="เช่น เครื่องคอมพิวเตอร์ตั้งโต๊ะ Dell OptiPlex"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="จำนวน" required group>
                <QuantityStepper value={draft.quantity} onChange={setQuantity} />
              </Field>
              <Field label="หน่วย" group>
                <ChipGroup options={unitNames.slice(0, 4)} value={draft.unit} onChange={(v) => set("unit", v)} allowOther />
              </Field>
            </div>

            <Field
              label="หมายเลขครุภัณฑ์ (พิมพ์จากป้าย)"
              hint='ยังไม่มีเลข? แตะ "ยังไม่ติดป้าย" แล้วพัสดุจะออกเลขให้ทีหลัง'
            >
              <input
                className={inputClass}
                value={draft.assetCode}
                disabled={draft.untagged}
                onChange={(e) => set("assetCode", e.target.value)}
                onBlur={(e) => checkDuplicate(e.target.value)}
                placeholder="7440-001-0001/2565"
              />
            </Field>

            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={draft.untagged}
                onChange={(e) => {
                  set("untagged", e.target.checked);
                  if (e.target.checked) {
                    set("assetCode", "");
                    setDuplicate(null);
                  }
                }}
                className="h-4 w-4 rounded border-stone-400"
              />
              ยังไม่ติดป้าย — ให้พัสดุออกเลขให้
            </label>

            {duplicate ? <Alert tone="warn">{duplicate}</Alert> : null}

            <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
              <p className="font-display text-sm font-medium text-stone-700">
                ข้อมูลเพิ่มเติม (ปี · แหล่งงบ · ราคา)
              </p>
              <div className="mt-3 space-y-3">
                <Field label={`ปีที่ได้มา (พ.ศ.)`}>
                  <input
                    inputMode="numeric"
                    className={inputClass}
                    value={draft.acquiredYear}
                    onChange={(e) => set("acquiredYear", e.target.value)}
                    placeholder={String(CURRENT_BE_YEAR)}
                  />
                </Field>
                <Field label="แหล่งงบประมาณ">
                  <select
                    className={inputClass}
                    value={draft.budgetSourceId ?? ""}
                    onChange={(e) => set("budgetSourceId", e.target.value || null)}
                  >
                    <option value="">— ไม่ระบุ —</option>
                    {masters.budgetSources.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="ราคา (บาท)">
                  <input
                    inputMode="decimal"
                    className={inputClass}
                    value={draft.price}
                    onChange={(e) => set("price", e.target.value)}
                    placeholder="22,000"
                  />
                </Field>
              </div>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <div className="space-y-2">
              {CONDITIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => set("condition", c.value)}
                  className={
                    "flex w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition " +
                    (draft.condition === c.value ? c.tone : "border-stone-200 bg-white")
                  }
                >
                  <span className="flex-1">
                    <span className="block font-display text-base font-semibold">{c.label}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-stone-600">{c.hint}</span>
                  </span>
                  {draft.condition === c.value ? <span aria-hidden>✓</span> : null}
                </button>
              ))}
            </div>

            <Field label="หมายเหตุ (ถ้ามี)">
              <textarea
                rows={2}
                className={inputClass}
                value={draft.note}
                onChange={(e) => set("note", e.target.value)}
                placeholder="เช่น จอมีเส้น พัดลมเสียงดัง"
              />
            </Field>

            <div className="rounded-xl border border-stone-200 bg-white p-3 text-sm text-stone-600">
              <p className="font-display font-semibold text-stone-800">สรุปรายการนี้</p>
              <p className="mt-1">
                {draft.name || "—"} · {draft.quantity} {draft.unit}
              </p>
              <p className="text-xs text-stone-500">
                {describeLocation(draft.building || "—", draft.floor || null, draft.room || "—")}
                {draft.assetCode ? ` · ${draft.assetCode}` : draft.untagged ? " · ยังไม่ติดป้าย" : ""}
              </p>
            </div>
          </>
        ) : null}

        {error ? <Alert tone="error">{error}</Alert> : null}
      </div>

      <footer className="sticky bottom-0 border-t border-stone-200 bg-white px-4 py-3">
        {step < 3 ? (
          <button
            disabled={!stepValid}
            onClick={() => setStep(step + 1)}
            className="w-full rounded-xl bg-sky-700 py-3.5 text-base font-semibold text-white transition active:bg-sky-800 disabled:bg-stone-300"
          >
            {step === 0 && !photo ? "ถ่ายรูปก่อนจึงไปต่อได้" : `ถัดไป — ${STEP_TITLES[step + 1]}`}
          </button>
        ) : (
          <div className="space-y-2">
            <button
              disabled={!stepValid || busy}
              onClick={() => save("next")}
              className="w-full rounded-xl bg-sky-700 py-3.5 text-base font-semibold text-white transition active:bg-sky-800 disabled:bg-stone-300"
            >
              {busy ? "กำลังบันทึก…" : "บันทึก + เพิ่มรายการถัดไป"}
            </button>
            <button
              disabled={!stepValid || busy}
              onClick={() => save("finish")}
              className="w-full rounded-xl border border-stone-300 py-3 text-base font-medium text-stone-700 disabled:opacity-50"
            >
              บันทึกแล้วจบการสำรวจห้องนี้
            </button>
          </div>
        )}
      </footer>

      <Toast message={message} />
    </main>
  );
}
