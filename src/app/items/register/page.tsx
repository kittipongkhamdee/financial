"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui";
import { CONDITION_LABEL } from "@/lib/constants";
import { calculateDepreciation, type DepreciationResult } from "@/lib/depreciation";
import { fetchRegisterItems, humanizeError } from "@/lib/data";
import { describeLocation, formatBaht } from "@/lib/format";
import { useMasters, useProfile, useSchoolSettings } from "@/lib/hooks";
import type { AssetItem, CategoryRow } from "@/lib/types";

/** ประเภทเงินตามแบบฟอร์มทางการมีแค่ 4 ช่อง ส่วนแหล่งงบของเราเป็นรายการเปิด — เดาช่องที่ใกล้เคียงที่สุดจากชื่อ */
function matchFundType(budgetSourceName: string | null): "budget" | "offBudget" | "donation" | "other" {
  if (!budgetSourceName) return "other";
  const s = budgetSourceName;
  if (s.includes("บริจาค") || s.includes("ช่วยเหลือ") || s.includes("ผ้าป่า") || s.includes("ศิษย์เก่า")) return "donation";
  if (s.includes("รายได้สถานศึกษา") || s.includes("นอกงบประมาณ")) return "offBudget";
  if (s.includes("งบประมาณ") || s.includes("อุดหนุน")) return "budget";
  return "other";
}

function Checkbox({ checked, label }: { checked: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`inline-flex h-3.5 w-3.5 items-center justify-center border border-stone-700 text-[9px] leading-none ${checked ? "bg-stone-900 text-white" : ""}`}
      >
        {checked ? "✓" : ""}
      </span>
      {label}
    </span>
  );
}

function Blank({ value, minWidth = "3rem" }: { value: string | null; minWidth?: string }) {
  return (
    <span className="inline-block border-b border-dotted border-stone-500 px-1" style={{ minWidth }}>
      {value || " "}
    </span>
  );
}

export default function RegisterCardsPage() {
  const { masters, error: mastersError } = useMasters();
  const profile = useProfile();
  const { settings } = useSchoolSettings();

  const [items, setItems] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!masters?.round) return;
    fetchRegisterItems(masters.round.id)
      .then(setItems)
      .catch((e) => setError(humanizeError(e)))
      .finally(() => setLoading(false));
  }, [masters]);

  const categoryById = useMemo(() => {
    const map = new Map<string, CategoryRow>();
    for (const c of masters?.categories ?? []) map.set(c.id, c);
    return map;
  }, [masters]);

  const budgetSourceById = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of masters?.budgetSources ?? []) map.set(b.id, b.name);
    return map;
  }, [masters]);

  const asOfYearBE = new Date().getFullYear() + 543;

  if (mastersError) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
        <Alert tone="error">{mastersError}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-6 print:max-w-none print:px-0 print:py-0">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/items/print" className="text-sm text-sky-700">
          ‹ ตารางสรุป
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white active:bg-sky-800"
        >
          พิมพ์ / ส่งออก PDF
        </button>
      </div>

      {error ? (
        <div className="no-print mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      {loading ? (
        <p className="no-print mt-6 text-sm text-stone-500">กำลังโหลด…</p>
      ) : items.length === 0 ? (
        <p className="no-print mt-6 rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
          ไม่มีรายการ
        </p>
      ) : (
        items.map((item) => {
          const category = item.category_id ? (categoryById.get(item.category_id) ?? null) : null;
          const depreciation: DepreciationResult | null = calculateDepreciation(
            item.price,
            item.quantity,
            item.acquired_year,
            category,
            asOfYearBE,
          );
          const budgetSourceName = item.budget_source_id ? (budgetSourceById.get(item.budget_source_id) ?? null) : null;
          const fundType = matchFundType(budgetSourceName);
          const cost = depreciation?.cost ?? (item.price ?? 0) * item.quantity;

          return (
            <article key={item.id} className="register-page mt-6 bg-white p-4 text-xs leading-relaxed first:mt-0 print:mt-0 print:p-0">
              <h1 className="text-center font-display text-base font-bold text-stone-900">ทะเบียนคุมทรัพย์สิน</h1>

              <div className="mt-2 flex justify-end text-right">
                <div>
                  <p>
                    ส่วนราชการ <Blank value={null} minWidth="12rem" />
                  </p>
                  <p className="mt-1">
                    หน่วยงาน <Blank value={settings?.school_name ?? null} minWidth="12rem" />
                  </p>
                </div>
              </div>

              <p className="mt-2">
                ประเภท <Blank value={category?.name ?? null} minWidth="8rem" /> รหัส{" "}
                <Blank value={item.asset_code} minWidth="7rem" /> ลักษณะ/คุณสมบัติ{" "}
                <Blank value={item.note} minWidth="10rem" /> รุ่น/แบบ <Blank value={null} minWidth="8rem" />
              </p>

              <p className="mt-1.5">
                สถานที่ตั้ง/หน่วยงานที่รับผิดชอบ{" "}
                <Blank value={describeLocation(item.building, item.floor, item.room)} minWidth="14rem" /> ชื่อผู้ขาย/ผู้รับจ้าง/ผู้บริจาค{" "}
                <Blank value={null} minWidth="10rem" />
              </p>
              <p className="mt-1.5">
                ที่อยู่ <Blank value={null} minWidth="24rem" /> โทรศัพท์ <Blank value={null} minWidth="8rem" />
              </p>

              <p className="mt-2 flex flex-wrap items-center gap-3">
                <span className="shrink-0">ประเภทเงิน</span>
                <Checkbox checked={fundType === "budget"} label="เงินงบประมาณ" />
                <Checkbox checked={fundType === "offBudget"} label="เงินนอกงบประมาณ" />
                <Checkbox checked={fundType === "donation"} label="เงินบริจาค/เงินช่วยเหลือ" />
                <Checkbox checked={fundType === "other"} label="อื่น ๆ" />
                {budgetSourceName ? <span className="text-stone-500">(แหล่งงบ: {budgetSourceName})</span> : null}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-3">
                <span className="shrink-0">วิธีการได้มา</span>
                <Checkbox checked={false} label="ตกลงราคา" />
                <Checkbox checked={false} label="สอบราคา" />
                <Checkbox checked={false} label="ประกวดราคา" />
                <Checkbox checked={false} label="วิธีพิเศษ" />
                <Checkbox checked={false} label="รับบริจาค" />
              </p>

              <table className="mt-2 w-full border-collapse text-center text-[9.5px]">
                <thead>
                  <tr>
                    {[
                      "วัน เดือน ปี",
                      "ที่เอกสาร",
                      "รายการ",
                      "จำนวนหน่วย",
                      "ราคาต่อหน่วย/ชุด/กลุ่ม",
                      "มูลค่ารวม",
                      "อายุใช้งาน",
                      "อัตราค่าเสื่อมราคา",
                      "ค่าเสื่อมราคาประจำปี",
                      "ค่าเสื่อมราคาสะสม",
                      "มูลค่าสุทธิ",
                      "หมายเหตุ",
                    ].map((h) => (
                      <th key={h} className="border border-stone-500 px-1 py-1 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-stone-400 px-1 py-1">{item.acquired_year ?? "—"}</td>
                    <td className="border border-stone-400 px-1 py-1"></td>
                    <td className="border border-stone-400 px-1 py-1 text-left">{item.name}</td>
                    <td className="border border-stone-400 px-1 py-1">
                      {item.quantity} {item.unit ?? ""}
                    </td>
                    <td className="border border-stone-400 px-1 py-1">{formatBaht(item.price)}</td>
                    <td className="border border-stone-400 px-1 py-1">{formatBaht(cost)}</td>
                    <td className="border border-stone-400 px-1 py-1">{category?.useful_life_years ?? "—"}</td>
                    <td className="border border-stone-400 px-1 py-1">
                      {category?.depreciation_rate_percent != null ? `${category.depreciation_rate_percent}%` : "—"}
                    </td>
                    <td className="border border-stone-400 px-1 py-1">
                      {depreciation ? formatBaht(depreciation.annualDepreciation) : "—"}
                    </td>
                    <td className="border border-stone-400 px-1 py-1">
                      {depreciation ? formatBaht(depreciation.accumulatedDepreciation) : "—"}
                    </td>
                    <td className="border border-stone-400 px-1 py-1">
                      {depreciation ? formatBaht(depreciation.netBookValue) : "—"}
                    </td>
                    <td className="border border-stone-400 px-1 py-1 text-left">
                      สภาพ: {CONDITION_LABEL[item.condition]}
                      {item.note ? ` · ${item.note}` : ""}
                    </td>
                  </tr>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 12 }).map((__, j) => (
                        <td key={j} className="border border-stone-300 px-1 py-2.5"></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              <h2 className="mt-4 text-center font-display text-sm font-bold text-stone-900">ประวัติการซ่อมบำรุง</h2>
              <table className="mt-2 w-full border-collapse text-center text-[9.5px]">
                <thead>
                  <tr>
                    {["ครั้งที่", "วัน เดือน ปี", "รายการ", "จำนวนเงิน", "หมายเหตุ"].map((h) => (
                      <th key={h} className="border border-stone-500 px-1 py-1 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 5 }).map((__, j) => (
                        <td key={j} className="border border-stone-300 px-1 py-2.5"></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="no-print mt-2 text-[10px] text-stone-400">
                {profile ? `จัดทำโดย ${profile.full_name} · ` : ""}
                {new Intl.DateTimeFormat("th-TH", { dateStyle: "long" }).format(new Date())}
              </p>
            </article>
          );
        })
      )}
    </main>
  );
}
