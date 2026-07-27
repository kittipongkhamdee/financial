"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui";
import { CONDITION_LABEL } from "@/lib/constants";
import { calculateDepreciation, type DepreciationResult } from "@/lib/depreciation";
import { downloadCsv, rowsToCsv } from "@/lib/csv";
import { fetchRegisterItems, humanizeError } from "@/lib/data";
import { describeLocation, formatBaht, formatCount } from "@/lib/format";
import { useMasters, useProfile } from "@/lib/hooks";
import type { AssetItem, CategoryRow } from "@/lib/types";

const ORG_NAME_KEY = "asset-survey:org-name";

function useOrgName() {
  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    try {
      setOrgName(window.localStorage.getItem(ORG_NAME_KEY) ?? "");
    } catch {
      // ไม่มี localStorage ก็ปล่อยว่างไว้ ไม่ต้องพังหน้าจอ
    }
  }, []);

  function update(value: string) {
    setOrgName(value);
    try {
      window.localStorage.setItem(ORG_NAME_KEY, value);
    } catch {
      // เขียนไม่ได้ก็ไม่เป็นไร แค่ต้องพิมพ์ใหม่ครั้งหน้า
    }
  }

  return [orgName, update] as const;
}

type Row = {
  item: AssetItem;
  category: CategoryRow | null;
  depreciation: DepreciationResult | null;
};

export default function PrintRegisterPage() {
  const { masters, error: mastersError } = useMasters();
  const profile = useProfile();
  const [orgName, setOrgName] = useOrgName();

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

  const asOfYearBE = new Date().getFullYear() + 543;

  const rows: Row[] = useMemo(
    () =>
      items.map((item) => {
        const category = item.category_id ? (categoryById.get(item.category_id) ?? null) : null;
        const depreciation = calculateDepreciation(
          item.price,
          item.quantity,
          item.acquired_year,
          category,
          asOfYearBE,
        );
        return { item, category, depreciation };
      }),
    [items, categoryById, asOfYearBE],
  );

  const totals = rows.reduce(
    (sum, r) => ({
      cost: sum.cost + (r.depreciation?.cost ?? 0),
      accumulated: sum.accumulated + (r.depreciation?.accumulatedDepreciation ?? 0),
      net: sum.net + (r.depreciation?.netBookValue ?? 0),
    }),
    { cost: 0, accumulated: 0, net: 0 },
  );

  const printedAt = new Intl.DateTimeFormat("th-TH", { dateStyle: "long" }).format(new Date());

  function handleExportCsv() {
    const headers = [
      "ลำดับ",
      "รายการ",
      "หมวดหมู่",
      "หมายเลขครุภัณฑ์",
      "จำนวน",
      "หน่วย",
      "ที่ตั้ง",
      "สภาพ",
      "ปีที่ได้มา",
      "ราคาทุน (บาท)",
      "อายุใช้งาน (ปี)",
      "ค่าเสื่อม/ปี (บาท)",
      "ค่าเสื่อมสะสม (บาท)",
      "มูลค่าสุทธิ (บาท)",
    ];
    const dataRows = rows.map(({ item, category, depreciation }, i) => [
      i + 1,
      item.name,
      category?.name ?? "",
      item.asset_code ?? "ยังไม่ติดป้าย",
      item.quantity,
      item.unit ?? "",
      describeLocation(item.building, item.floor, item.room),
      CONDITION_LABEL[item.condition],
      item.acquired_year,
      depreciation ? depreciation.cost : item.price,
      category?.useful_life_years ?? null,
      depreciation ? depreciation.annualDepreciation : null,
      depreciation ? depreciation.accumulatedDepreciation : null,
      depreciation ? depreciation.netBookValue : null,
    ]);
    const csv = rowsToCsv(headers, dataRows);
    const roundName = masters?.round?.name ?? "ทะเบียนคุมทรัพย์สิน";
    downloadCsv(`${roundName}.csv`, csv);
  }

  if (mastersError) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
        <Alert tone="error">{mastersError}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-6 print:max-w-none print:px-0 print:py-0">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/review" className="text-sm text-sky-700">
          ‹ ตรวจสอบครุภัณฑ์
        </Link>
        <div className="flex items-center gap-2">
          <input
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="ชื่อโรงเรียน / หน่วยงาน (แสดงบนหัวกระดาษ)"
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
          />
          <Link
            href="/items/register"
            className="rounded-xl border border-sky-700 px-4 py-2 text-sm font-semibold text-sky-700"
          >
            การ์ดรายชิ้น (แบบราชการ)
          </Link>
          <button
            type="button"
            disabled={rows.length === 0}
            onClick={handleExportCsv}
            className="rounded-xl border border-sky-700 px-4 py-2 text-sm font-semibold text-sky-700 disabled:cursor-not-allowed disabled:border-stone-300 disabled:text-stone-400"
          >
            ส่งออก Excel
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white active:bg-sky-800"
          >
            พิมพ์ / ส่งออก PDF
          </button>
        </div>
      </div>

      {error ? (
        <div className="no-print mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      {loading ? (
        <p className="no-print mt-6 text-sm text-stone-500">กำลังโหลด…</p>
      ) : (
        <div className="mt-4 print:mt-0">
          <div className="text-center">
            <h1 className="font-display text-lg font-bold text-stone-900">ทะเบียนคุมทรัพย์สิน</h1>
            {orgName ? <p className="text-sm text-stone-700">{orgName}</p> : null}
            <p className="text-sm text-stone-600">
              {masters?.round ? masters.round.name : ""} · พิมพ์เมื่อ {printedAt}
              {profile ? ` · โดย ${profile.full_name}` : ""}
            </p>
          </div>

          <table className="mt-4 w-full border-collapse text-xs">
            <thead>
              <tr className="bg-stone-100 print:bg-transparent">
                {[
                  "ลำดับ",
                  "รายการ",
                  "หมวดหมู่",
                  "หมายเลขครุภัณฑ์",
                  "จำนวน",
                  "หน่วย",
                  "ที่ตั้ง",
                  "สภาพ",
                  "ปีที่ได้มา",
                  "ราคาทุน (บาท)",
                  "อายุใช้งาน (ปี)",
                  "ค่าเสื่อม/ปี (บาท)",
                  "ค่าเสื่อมสะสม (บาท)",
                  "มูลค่าสุทธิ (บาท)",
                ].map((h) => (
                  <th key={h} className="border border-stone-400 px-1.5 py-1 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ item, category, depreciation }, i) => (
                <tr key={item.id} className="break-inside-avoid">
                  <td className="border border-stone-300 px-1.5 py-1 text-right">{i + 1}</td>
                  <td className="border border-stone-300 px-1.5 py-1">{item.name}</td>
                  <td className="border border-stone-300 px-1.5 py-1">{category?.name ?? "—"}</td>
                  <td className="border border-stone-300 px-1.5 py-1">
                    {item.asset_code ?? "ยังไม่ติดป้าย"}
                  </td>
                  <td className="border border-stone-300 px-1.5 py-1 text-right">{item.quantity}</td>
                  <td className="border border-stone-300 px-1.5 py-1">{item.unit ?? "—"}</td>
                  <td className="border border-stone-300 px-1.5 py-1">
                    {describeLocation(item.building, item.floor, item.room)}
                  </td>
                  <td className="border border-stone-300 px-1.5 py-1">{CONDITION_LABEL[item.condition]}</td>
                  <td className="border border-stone-300 px-1.5 py-1 text-right">
                    {item.acquired_year ?? "—"}
                  </td>
                  <td className="border border-stone-300 px-1.5 py-1 text-right">
                    {depreciation ? formatBaht(depreciation.cost) : formatBaht(item.price)}
                  </td>
                  <td className="border border-stone-300 px-1.5 py-1 text-right">
                    {category?.useful_life_years ?? "—"}
                  </td>
                  <td className="border border-stone-300 px-1.5 py-1 text-right">
                    {depreciation ? formatBaht(depreciation.annualDepreciation) : "—"}
                  </td>
                  <td className="border border-stone-300 px-1.5 py-1 text-right">
                    {depreciation ? formatBaht(depreciation.accumulatedDepreciation) : "—"}
                  </td>
                  <td className="border border-stone-300 px-1.5 py-1 text-right">
                    {depreciation ? formatBaht(depreciation.netBookValue) : "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={14} className="border border-stone-300 px-1.5 py-3 text-center text-stone-500">
                    ไม่มีรายการ
                  </td>
                </tr>
              ) : null}
            </tbody>
            {rows.length > 0 ? (
              <tfoot>
                <tr className="bg-stone-100 font-semibold print:bg-transparent">
                  <td colSpan={9} className="border border-stone-400 px-1.5 py-1 text-right">
                    รวม {formatCount(rows.length)} รายการ
                  </td>
                  <td className="border border-stone-400 px-1.5 py-1 text-right">{formatBaht(totals.cost)}</td>
                  <td className="border border-stone-400 px-1.5 py-1"></td>
                  <td className="border border-stone-400 px-1.5 py-1 text-right">
                    {formatBaht(totals.accumulated)}
                  </td>
                  <td className="border border-stone-400 px-1.5 py-1 text-right">{formatBaht(totals.net)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>

          <p className="mt-2 text-[10px] text-stone-500 print:mt-4">
            หมายเหตุ: ค่าเสื่อมราคาคำนวณแบบเส้นตรงจากปีที่ได้มา (พ.ศ.) ถึงปีปัจจุบัน ตามอายุการใช้งาน/อัตราค่าเสื่อมราคาที่กำหนดในแต่ละหมวดหมู่ —
            รายการที่ไม่มีราคา ปีที่ได้มา หรือยังไม่ระบุหมวดหมู่ จะไม่แสดงค่าเสื่อมราคา
          </p>
        </div>
      )}
    </main>
  );
}
