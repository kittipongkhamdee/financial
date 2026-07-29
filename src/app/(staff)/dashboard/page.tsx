"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui";
import { STATUS_LABEL } from "@/lib/constants";
import { calculateDepreciation } from "@/lib/depreciation";
import { fetchReviewItems, humanizeError } from "@/lib/data";
import { formatBaht, formatCount } from "@/lib/format";
import { useMasters, useProfile } from "@/lib/hooks";
import type { AssetItem, AssetItemStatus, CategoryRow } from "@/lib/types";
import {
  fetchApprovedDisbursementTotals,
  fetchOpenPlanYear,
  fetchPlanProjectsWithActivities,
} from "@/lib/plan-data";
import type { PlanBudgetYear, PlanProjectWithActivities } from "@/lib/plan-types";

/** แดชบอร์ดสรุปภาพรวม — ความคืบหน้ารายอาคาร + มูลค่าสินทรัพย์รวมตามหมวดหมู่ */
export default function DashboardPage() {
  const { masters, error: mastersError } = useMasters();
  const profile = useProfile();

  const [items, setItems] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [planYear, setPlanYear] = useState<PlanBudgetYear | null>(null);
  const [planProjects, setPlanProjects] = useState<PlanProjectWithActivities[]>([]);
  const [planSpent, setPlanSpent] = useState<Map<string, number>>(new Map());
  const [planLoading, setPlanLoading] = useState(true);
  const [planError, setPlanError] = useState<string | null>(null);

  const isStaff = profile ? profile.role === "supply" || profile.role === "admin" : null;

  useEffect(() => {
    if (!masters?.round || isStaff !== true) return;
    setLoading(true);
    fetchReviewItems(masters.round.id)
      .then(setItems)
      .catch((e) => setError(humanizeError(e)))
      .finally(() => setLoading(false));
  }, [masters, isStaff]);

  useEffect(() => {
    if (isStaff !== true) return;
    setPlanLoading(true);
    fetchOpenPlanYear()
      .then(async (year) => {
        setPlanYear(year);
        if (!year) {
          setPlanProjects([]);
          setPlanSpent(new Map());
          return;
        }
        const projects = await fetchPlanProjectsWithActivities(year.id);
        setPlanProjects(projects);
        const activityIds = projects.flatMap((p) => p.activities.map((a) => a.id));
        setPlanSpent(await fetchApprovedDisbursementTotals(activityIds));
      })
      .catch((e) => setPlanError(humanizeError(e)))
      .finally(() => setPlanLoading(false));
  }, [isStaff]);

  const planSummary = useMemo(() => {
    let totalBudget = 0;
    let totalSpent = 0;
    let inProgress = 0;
    for (const project of planProjects) {
      const projectBudget = project.activities.reduce((sum, a) => sum + a.budget, 0);
      const projectSpent = project.activities.reduce((sum, a) => sum + (planSpent.get(a.id) ?? 0), 0);
      totalBudget += projectBudget;
      totalSpent += projectSpent;
      if (projectSpent > 0) inProgress += 1;
    }
    return {
      projectCount: planProjects.length,
      inProgress,
      totalBudget,
      remaining: totalBudget - totalSpent,
    };
  }, [planProjects, planSpent]);

  const asOfYearBE = new Date().getFullYear() + 543;

  const categoryById = useMemo(() => {
    const map = new Map<string, CategoryRow>();
    for (const c of masters?.categories ?? []) map.set(c.id, c);
    return map;
  }, [masters]);

  const withCost = useMemo(
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
        const cost = depreciation?.cost ?? (item.price ?? 0) * item.quantity;
        const netBookValue = depreciation?.netBookValue ?? cost;
        return { item, category, cost, netBookValue };
      }),
    [items, categoryById, asOfYearBE],
  );

  const rooms = useMemo(
    () => new Set(items.map((i) => `${i.building}·${i.room}`)),
    [items],
  );

  const byStatus = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const i of items) acc[i.status] = (acc[i.status] ?? 0) + 1;
    return acc;
  }, [items]);

  const totalCost = withCost.reduce((sum, r) => sum + r.cost, 0);
  const approvedCost = withCost
    .filter((r) => r.item.status === "approved")
    .reduce((sum, r) => sum + r.cost, 0);

  const byBuilding = useMemo(() => {
    type Row = {
      building: string;
      rooms: Set<string>;
      total: number;
      submitted: number;
      approved: number;
      rejected: number;
      cost: number;
    };
    const map = new Map<string, Row>();
    for (const { item, cost } of withCost) {
      const row =
        map.get(item.building) ??
        ({ building: item.building, rooms: new Set(), total: 0, submitted: 0, approved: 0, rejected: 0, cost: 0 } as Row);
      row.rooms.add(item.room);
      row.total += 1;
      row.cost += cost;
      if (item.status === "submitted") row.submitted += 1;
      if (item.status === "approved") row.approved += 1;
      if (item.status === "rejected") row.rejected += 1;
      map.set(item.building, row);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [withCost]);

  const byCategory = useMemo(() => {
    type Row = { name: string; count: number; cost: number; netBookValue: number };
    const map = new Map<string, Row>();
    for (const { item, category, cost, netBookValue } of withCost) {
      const key = category?.name ?? "— ไม่ระบุหมวดหมู่ —";
      const row = map.get(key) ?? { name: key, count: 0, cost: 0, netBookValue: 0 };
      row.count += item.quantity;
      row.cost += cost;
      row.netBookValue += netBookValue;
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => b.cost - a.cost);
  }, [withCost]);

  if (profile && !isStaff) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
        <Alert tone="error">หน้านี้สำหรับเจ้าหน้าที่พัสดุหรือแอดมินเท่านั้น</Alert>
      </main>
    );
  }

  if (mastersError) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
        <Alert tone="error">{mastersError}</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-6">
      <h1 className="font-display text-xl font-bold text-stone-900">แดชบอร์ด</h1>
      <p className="text-sm text-stone-600">{masters?.round ? masters.round.name : ""} · ภาพรวมทั้งโรงเรียน</p>

      {error ? (
        <div className="mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      <section className="mt-6">
        <h2 className="font-display text-sm font-semibold text-stone-800">
          งานแผนงาน {planYear ? `· ${planYear.name}` : ""}
        </h2>
        {planError ? (
          <div className="mt-2">
            <Alert tone="error">{planError}</Alert>
          </div>
        ) : planLoading ? (
          <p className="mt-2 text-sm text-stone-500">กำลังโหลด…</p>
        ) : !planYear ? (
          <p className="mt-2 rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
            ยังไม่มีปีงบประมาณที่เปิดอยู่
          </p>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="จำนวนโครงการ" value={formatCount(planSummary.projectCount)} unit="โครงการ" />
            <Stat label="ดำเนินการแล้ว" value={formatCount(planSummary.inProgress)} unit="โครงการ" />
            <Stat label="งบประมาณทั้งหมด" value={formatBaht(planSummary.totalBudget)} unit="บาท" />
            <Stat label="คงเหลือ" value={formatBaht(planSummary.remaining)} unit="บาท" />
          </div>
        )}
      </section>

      {loading ? (
        <p className="mt-6 text-sm text-stone-500">กำลังโหลด…</p>
      ) : (
        <>
          <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="รายการทั้งหมด" value={formatCount(items.length)} unit="รายการ" />
            <Stat label="ห้องที่สำรวจแล้ว" value={formatCount(rooms.size)} unit="ห้อง" />
            <Stat label="มูลค่าทุนรวม" value={formatBaht(totalCost)} unit="บาท" />
            <Stat label="มูลค่าที่อนุมัติแล้ว" value={formatBaht(approvedCost)} unit="บาท" />
          </section>

          <section className="mt-4 rounded-xl border border-stone-200 bg-white p-4">
            <h2 className="font-display text-sm font-semibold text-stone-800">สถานะรายการ</h2>
            <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-stone-600">
              {(Object.keys(STATUS_LABEL) as AssetItemStatus[])
                .filter((s) => byStatus[s])
                .map((s) => (
                  <li key={s}>
                    {STATUS_LABEL[s]} <span className="font-semibold text-stone-900">{byStatus[s]}</span>
                  </li>
                ))}
              {items.length === 0 ? <li className="text-stone-400">ยังไม่มีรายการ</li> : null}
            </ul>
          </section>

          <section className="mt-6">
            <h2 className="font-display text-sm font-semibold text-stone-800">ความคืบหน้ารายอาคาร</h2>
            <div className="mt-2 overflow-x-auto rounded-xl border border-stone-200 bg-white">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs text-stone-500">
                    <th className="px-3 py-2 font-medium">อาคาร</th>
                    <th className="px-3 py-2 font-medium">ห้องที่สำรวจแล้ว</th>
                    <th className="px-3 py-2 font-medium">รายการ</th>
                    <th className="px-3 py-2 font-medium">รอตรวจสอบ</th>
                    <th className="px-3 py-2 font-medium">อนุมัติแล้ว</th>
                    <th className="px-3 py-2 font-medium">ตีกลับ</th>
                    <th className="px-3 py-2 text-right font-medium">มูลค่าทุน (บาท)</th>
                  </tr>
                </thead>
                <tbody>
                  {byBuilding.map((row) => (
                    <tr key={row.building} className="border-b border-stone-100 last:border-0">
                      <td className="px-3 py-2 font-medium text-stone-900">{row.building}</td>
                      <td className="px-3 py-2">{row.rooms.size}</td>
                      <td className="px-3 py-2">{row.total}</td>
                      <td className="px-3 py-2 text-sky-700">{row.submitted || "—"}</td>
                      <td className="px-3 py-2 text-emerald-700">{row.approved || "—"}</td>
                      <td className="px-3 py-2 text-rose-700">{row.rejected || "—"}</td>
                      <td className="px-3 py-2 text-right">{formatBaht(row.cost)}</td>
                    </tr>
                  ))}
                  {byBuilding.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-4 text-center text-stone-400">
                        ยังไม่มีรายการ
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-6">
            <h2 className="font-display text-sm font-semibold text-stone-800">มูลค่าสินทรัพย์ตามหมวดหมู่</h2>
            <div className="mt-2 overflow-x-auto rounded-xl border border-stone-200 bg-white">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs text-stone-500">
                    <th className="px-3 py-2 font-medium">หมวดหมู่</th>
                    <th className="px-3 py-2 font-medium">จำนวน</th>
                    <th className="px-3 py-2 text-right font-medium">มูลค่าทุน (บาท)</th>
                    <th className="px-3 py-2 text-right font-medium">มูลค่าสุทธิ (บาท)</th>
                  </tr>
                </thead>
                <tbody>
                  {byCategory.map((row) => (
                    <tr key={row.name} className="border-b border-stone-100 last:border-0">
                      <td className="px-3 py-2 font-medium text-stone-900">{row.name}</td>
                      <td className="px-3 py-2">{formatCount(row.count)}</td>
                      <td className="px-3 py-2 text-right">{formatBaht(row.cost)}</td>
                      <td className="px-3 py-2 text-right">{formatBaht(row.netBookValue)}</td>
                    </tr>
                  ))}
                  {byCategory.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-stone-400">
                        ยังไม่มีรายการ
                      </td>
                    </tr>
                  ) : null}
                </tbody>
                {byCategory.length > 0 ? (
                  <tfoot>
                    <tr className="bg-stone-50 font-semibold">
                      <td className="px-3 py-2">รวม</td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2 text-right">{formatBaht(totalCost)}</td>
                      <td className="px-3 py-2 text-right">
                        {formatBaht(withCost.reduce((sum, r) => sum + r.netBookValue, 0))}
                      </td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          </section>

          <p className="mt-3 text-xs text-stone-400">
            มูลค่าทุนคำนวณจากราคา × จำนวนของทุกรายการในระบบ (รวมทุกสถานะ แม้ที่ยังรอตรวจสอบหรือถูกตีกลับ)
            ส่วนมูลค่าสุทธิหักค่าเสื่อมราคาแบบเส้นตรงแล้ว — รายการที่ไม่มีราคา/ปีที่ได้มา/หมวดหมู่ครบจะนับมูลค่าสุทธิเท่ากับมูลค่าทุน
            (คำนวณค่าเสื่อมไม่ได้) ดูมูลค่าเฉพาะที่ยืนยันแล้วได้ที่การ์ด &ldquo;มูลค่าที่อนุมัติแล้ว&rdquo;
          </p>
        </>
      )}
    </main>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-3 py-3">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-1 font-display text-lg font-bold leading-tight text-stone-900">{value}</p>
      <p className="text-xs text-stone-400">{unit}</p>
    </div>
  );
}
