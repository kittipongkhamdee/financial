"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PhotoCapture } from "@/components/PhotoCapture";
import {
  Alert,
  ButtonLabel,
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
import { ACQUISITION_METHODS, type AcquisitionMethod, type AssetCondition, type AssetItem } from "@/lib/types";

type Draft = {
  building: string;
  floor: string;
  room: string;
  categoryId: string | null;
  name: string;
  quantity: number;
  unit: string;
  untagged: boolean;
  acquiredYear: string;
  budgetSourceId: string | null;
  price: string;
  condition: AssetCondition | null;
  note: string;
  model: string;
  spec: string;
  acquisitionMethod: AcquisitionMethod | "";
  vendorName: string;
  vendorAddress: string;
  vendorPhone: string;
};

const EMPTY_ITEM = {
  categoryId: null,
  name: "",
  quantity: 1,
  unit: "",
  untagged: false,
  acquiredYear: "",
  budgetSourceId: null,
  price: "",
  condition: null,
  note: "",
  model: "",
  spec: "",
  acquisitionMethod: "",
  vendorName: "",
  vendorAddress: "",
  vendorPhone: "",
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
  // แต่ละชิ้นมีหมายเลขครุภัณฑ์เป็นของตัวเอง — จำนวนช่องกรอกจึงต้องตรงกับ "จำนวน"
  // touched แยกจาก value เพราะเลขที่ระบบเดาให้ยังไม่ถือว่าผู้ใช้ยืนยัน —
  // ถ้าแก้ช่องก่อนหน้า เลขเดาในช่องที่ยังไม่ touched จะขยับตามได้อีก
  const [codeEntries, setCodeEntries] = useState<{ value: string; touched: boolean }[]>([
    { value: "", touched: false },
  ]);
  const [duplicates, setDuplicates] = useState<(string | null)[]>([null]);
  const [savedInRoom, setSavedInRoom] = useState<AssetItem[]>([]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  // เพิ่ม/ลดจำนวน → ปรับจำนวนช่องกรอกหมายเลขครุภัณฑ์ให้ตรงกัน
  // ช่องใหม่ที่เพิ่มมาเดาเลขต่อเนื่องจากช่องสุดท้ายให้ก่อน แก้เองได้ภายหลัง
  function setQuantity(value: number) {
    set("quantity", value);
    setCodeEntries((entries) => {
      if (value === entries.length) return entries;
      if (value < entries.length) return entries.slice(0, value);
      const next = [...entries];
      for (let i = entries.length; i < value; i++) {
        const prevValue = next[i - 1]?.value ?? "";
        next.push({ value: prevValue.trim() ? shiftAssetCodeSerial(prevValue, 1) : "", touched: false });
      }
      return next;
    });
    setDuplicates((dups) =>
      value === dups.length
        ? dups
        : value < dups.length
          ? dups.slice(0, value)
          : [...dups, ...Array(value - dups.length).fill(null)],
    );
  }

  // แก้ช่องใดช่องหนึ่ง → ไล่เติมเลขต่อเนื่องให้ช่องถัดไปที่ผู้ใช้ยังไม่เคยแก้เอง
  // (ทับเลขเดาเดิมได้ แต่ไม่ทับช่องที่ผู้ใช้พิมพ์ยืนยันแล้ว)
  function updateAssetCode(index: number, value: string) {
    setCodeEntries((entries) => {
      const next = entries.map((e) => ({ ...e }));
      next[index] = { value, touched: true };
      for (let i = index + 1; i < next.length && !next[i].touched; i++) {
        next[i] = { value: value.trim() ? shiftAssetCodeSerial(next[i - 1].value, 1) : "", touched: false };
      }
      return next;
    });
    setDuplicates((dups) => dups.map((d, i) => (i === index ? null : d)));
  }

  const buildingNames = useMemo(() => masters?.buildings.map((b) => b.name) ?? [], [masters]);
  const unitNames = useMemo(() => masters?.units.map((u) => u.name) ?? [], [masters]);

  const stepValid = [
    photo !== null,
    draft.building.trim() !== "" && draft.room.trim() !== "",
    draft.name.trim() !== "" && draft.quantity > 0,
    draft.condition !== null,
  ][step];

  async function checkDuplicate(index: number, code: string) {
    const trimmed = code.trim();
    if (!trimmed) {
      setDuplicates((dups) => dups.map((d, i) => (i === index ? null : d)));
      return;
    }

    // ซ้ำกับชิ้นอื่นที่กรอกไว้ในหน้านี้เอง (ยังไม่ได้บันทึกลงระบบ)
    if (codeEntries.some((e, i) => i !== index && e.value.trim() === trimmed)) {
      setDuplicates((dups) => dups.map((d, i) => (i === index ? "ซ้ำกับชิ้นที่กรอกไว้ในหน้านี้เอง" : d)));
      return;
    }

    if (!masters?.round) return;
    try {
      const existing = await findByAssetCode(masters.round.id, trimmed);
      setDuplicates((dups) =>
        dups.map((d, i) =>
          i === index ? (existing ? `เลขนี้กรอกไว้แล้ว: ${existing.name} (ห้อง ${existing.room})` : null) : d,
        ),
      );
    } catch {
      // ตรวจไม่ได้ก็ปล่อยให้ unique index เป็นด่านสุดท้าย
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
      // ชื่อเดียวกันได้หลายชิ้น แต่ละชิ้นมีหมายเลขครุภัณฑ์ของตัวเอง → บันทึกแยกแถวตามจำนวนช่องที่กรอก
      // อัปโหลดรูปแยกชุดต่อชิ้น (ไม่ใช้ path เดียวกัน) เผื่อภายหลังลบชิ้นใดชิ้นหนึ่งจะไม่ลากรูปของชิ้นอื่นหายไปด้วย
      const codes = draft.untagged ? codeEntries.map(() => "") : codeEntries.map((e) => e.value);
      const created: AssetItem[] = [];

      for (const code of codes) {
        const photoPath = await uploadPhoto(photo);
        const trimmed = code.trim();
        const item = await insertItem(
          masters.round.id,
          {
            building: draft.building.trim(),
            floor: draft.floor.trim() || null,
            room: draft.room.trim(),
            category_id: draft.categoryId,
            name: draft.name.trim(),
            quantity: 1,
            unit: draft.unit.trim() || null,
            asset_code: trimmed || null,
            untagged: trimmed === "",
            condition: draft.condition,
            note: draft.note.trim() || null,
            acquired_year: parseNumber(draft.acquiredYear),
            budget_source_id: draft.budgetSourceId,
            price: parseNumber(draft.price),
            model: draft.model.trim() || null,
            spec: draft.spec.trim() || null,
            acquisition_method: draft.acquisitionMethod || null,
            vendor_name: draft.vendorName.trim() || null,
            vendor_address: draft.vendorAddress.trim() || null,
            vendor_phone: draft.vendorPhone.trim() || null,
          },
          photoPath,
          // ถ่ายรูปครบตั้งแต่ขั้นแรกของฟอร์มนี้แล้ว จึงส่งให้งานพัสดุทันที
          // ไม่ต้องแวะไปกดตรวจทาน/ส่งอีกรอบที่ "รายการของฉัน"
          "submitted",
        );
        created.push(item);
      }

      remember({
        building: draft.building.trim(),
        floor: draft.floor.trim() || null,
        room: draft.room.trim(),
      });

      if (mode === "finish") {
        // ไม่เซ็ต busy เป็น false ตรงนี้ — ปล่อยให้ปุ่มค้างสถานะ "กำลังบันทึก" ต่อจนกว่าหน้าแรกจะขึ้นจริง
        // ไม่งั้นปุ่มจะดูเหมือนหยุดทำงานเฉย ๆ ระหว่างที่หน้าแรกยังโหลดข้อมูลอยู่
        router.push("/");
        return;
      }

      // เริ่มชิ้นถัดไปในห้องเดิม — เก็บอาคาร/ชั้น/ห้องไว้ ล้างที่เหลือ
      setSavedInRoom((prev) => [...created, ...prev]);
      setPhoto(null);
      setDraft((d) => ({ building: d.building, floor: d.floor, room: d.room, ...EMPTY_ITEM }));
      setCodeEntries([{ value: "", touched: false }]);
      setDuplicates([null]);
      setStep(0);
      setBusy(false);
      show(
        created.length > 1
          ? `บันทึกแล้ว ${created.length} ชิ้น — ${draft.name}`
          : `บันทึกแล้ว — ${draft.name}`,
      );
    } catch (e) {
      setError(humanizeError(e));
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
              label={
                draft.quantity > 1
                  ? "หมายเลขครุภัณฑ์ (พิมพ์จากป้ายทีละชิ้น)"
                  : "หมายเลขครุภัณฑ์ (พิมพ์จากป้าย)"
              }
              hint='ยังไม่มีเลข? แตะ "ยังไม่ติดป้าย" แล้วพัสดุจะออกเลขให้ทีหลัง'
              group={draft.quantity > 1}
            >
              <div className="space-y-2">
                {codeEntries.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {draft.quantity > 1 ? (
                      <span className="w-5 shrink-0 text-center text-xs text-stone-400">{i + 1}</span>
                    ) : null}
                    <input
                      className={inputClass}
                      value={entry.value}
                      disabled={draft.untagged}
                      onChange={(e) => updateAssetCode(i, e.target.value)}
                      onBlur={(e) => checkDuplicate(i, e.target.value)}
                      placeholder="7440-001-0001/2565"
                    />
                  </div>
                ))}
              </div>
            </Field>

            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={draft.untagged}
                onChange={(e) => {
                  set("untagged", e.target.checked);
                  if (e.target.checked) {
                    setCodeEntries((entries) => entries.map(() => ({ value: "", touched: false })));
                    setDuplicates((dups) => dups.map(() => null));
                  }
                }}
                className="h-4 w-4 rounded border-stone-400"
              />
              ยังไม่ติดป้าย — ให้พัสดุออกเลขให้
            </label>

            {duplicates.some(Boolean) ? (
              <div className="space-y-1.5">
                {duplicates.map((msg, i) =>
                  msg ? (
                    <Alert key={i} tone="warn">
                      {draft.quantity > 1 ? `ชิ้นที่ ${i + 1}: ${msg}` : msg}
                    </Alert>
                  ) : null,
                )}
              </div>
            ) : null}

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

            <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-3">
              <p className="font-display text-sm font-medium text-stone-700">
                ข้อมูลเพิ่มเติม (ถ้าทราบ)
              </p>
              <p className="mt-0.5 text-xs text-stone-500">ไม่บังคับ — เว้นว่างไว้ให้พัสดุกรอกภายหลังได้</p>
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="รุ่น/แบบ">
                    <input className={inputClass} value={draft.model} onChange={(e) => set("model", e.target.value)} />
                  </Field>
                  <Field label="ลักษณะ/คุณสมบัติ">
                    <input className={inputClass} value={draft.spec} onChange={(e) => set("spec", e.target.value)} />
                  </Field>
                </div>
                <Field label="วิธีการได้มา">
                  <select
                    className={inputClass}
                    value={draft.acquisitionMethod}
                    onChange={(e) => set("acquisitionMethod", e.target.value as AcquisitionMethod | "")}
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
                  <input
                    className={inputClass}
                    value={draft.vendorName}
                    onChange={(e) => set("vendorName", e.target.value)}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="ที่อยู่ผู้ขาย">
                    <input
                      className={inputClass}
                      value={draft.vendorAddress}
                      onChange={(e) => set("vendorAddress", e.target.value)}
                    />
                  </Field>
                  <Field label="โทรศัพท์ผู้ขาย">
                    <input
                      className={inputClass}
                      value={draft.vendorPhone}
                      onChange={(e) => set("vendorPhone", e.target.value)}
                    />
                  </Field>
                </div>
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
                {codeEntries.some((e) => e.value.trim())
                  ? ` · ${codeEntries.map((e) => e.value).filter((v) => v.trim()).join(", ")}`
                  : draft.untagged
                    ? " · ยังไม่ติดป้าย"
                    : ""}
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
              <ButtonLabel busy={busy}>{busy ? "กำลังบันทึก…" : "บันทึก + เพิ่มรายการถัดไป"}</ButtonLabel>
            </button>
            <button
              disabled={!stepValid || busy}
              onClick={() => save("finish")}
              className="w-full rounded-xl border border-stone-300 py-3 text-base font-medium text-stone-700 disabled:opacity-50"
            >
              <ButtonLabel busy={busy}>{busy ? "กำลังบันทึก…" : "บันทึกแล้วจบการสำรวจห้องนี้"}</ButtonLabel>
            </button>
          </div>
        )}
      </footer>

      <Toast message={message} />
    </main>
  );
}
