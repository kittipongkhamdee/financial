"use client";

import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui";
import { humanizeError } from "@/lib/data";
import {
  fetchPlanAdminGroups,
  fetchPlanProjectsWithActivities,
  fetchPlanRevenueLines,
  fetchPlanRevenueTypes,
  fetchPlanYears,
} from "@/lib/plan-data";
import type { PlanAdminGroup, PlanBudgetYear, PlanProjectWithActivities, PlanRevenueLine, PlanRevenueType } from "@/lib/plan-types";
import { formatBaht } from "@/lib/format";

export default function PlanPrintPage() {
  return (
    <Suspense fallback={<main className="flex-1 px-5 py-10 text-center text-sm text-stone-500">กำลังโหลด…</main>}>
      <PlanPrintContent />
    </Suspense>
  );
}

function PlanPrintContent() {
  const params = useSearchParams();
  const yearId = params.get("year");

  const [year, setYear] = useState<PlanBudgetYear | null>(null);
  const [types, setTypes] = useState<PlanRevenueType[]>([]);
  const [lines, setLines] = useState<PlanRevenueLine[]>([]);
  const [groups, setGroups] = useState<PlanAdminGroup[]>([]);
  const [projects, setProjects] = useState<PlanProjectWithActivities[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!yearId) return;
    Promise.all([
      fetchPlanYears(),
      fetchPlanRevenueTypes(),
      fetchPlanRevenueLines(yearId),
      fetchPlanAdminGroups(),
      fetchPlanProjectsWithActivities(yearId),
    ])
      .then(([years, t, l, g, p]) => {
        setYear(years.find((y) => y.id === yearId) ?? null);
        setTypes(t);
        setLines(l);
        setGroups(g);
        setProjects(p);
      })
      .catch((e) => setError(humanizeError(e)))
      .finally(() => setLoading(false));
  }, [yearId]);

  const revenueTotal = useMemo(() => lines.reduce((sum, l) => sum + l.total, 0), [lines]);
  const expenseTotal = useMemo(
    () => projects.reduce((sum, p) => sum + p.activities.reduce((s, a) => s + a.budget, 0), 0),
    [projects],
  );
  const printedAt = new Intl.DateTimeFormat("th-TH", { dateStyle: "long" }).format(new Date());

  if (!yearId) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
        <Alert tone="error">ไม่ได้ระบุปีงบประมาณ</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-6 print:max-w-none print:px-0 print:py-0">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/plan" className="text-sm text-sky-700">
          ‹ งานแผนงาน
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
      ) : (
        <div className="mt-4 print:mt-0">
          <div className="text-center">
            <h1 className="font-display text-lg font-bold text-stone-900">ส่วนที่ 3</h1>
            <p className="font-display text-base font-semibold text-stone-900">ประมาณการงบประมาณรายรับ-รายจ่าย</p>
            <p className="mt-1 text-sm text-stone-600">
              {year?.name ?? ""} · พิมพ์เมื่อ {printedAt}
            </p>
          </div>

          <h2 className="mt-6 font-display text-base font-bold text-stone-900">3.1 การประมาณการรายรับ</h2>
          <table className="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr className="bg-stone-100 print:bg-transparent">
                {["ที่", "ประเภทรายรับ", "นักเรียน(คน)", "บาท/คน/ปี", "รวม"].map((h) => (
                  <th key={h} className="border border-stone-400 px-2 py-1 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {types.map((type, i) => {
                const typeLines = lines.filter((l) => l.revenue_type_id === type.id).sort((a, b) => a.sort_order - b.sort_order);
                const subtotal = typeLines.reduce((sum, l) => sum + l.total, 0);
                return (
                  <Fragment key={type.id}>
                    <tr className="break-inside-avoid">
                      <td className="border border-stone-300 px-2 py-1 align-top">{i + 1}</td>
                      <td className="border border-stone-300 px-2 py-1 font-medium" colSpan={4}>
                        {type.name}
                      </td>
                    </tr>
                    {typeLines.map((line) => (
                      <tr key={line.id} className="break-inside-avoid">
                        <td className="border border-stone-300 px-2 py-1"></td>
                        <td className="border border-stone-300 px-2 py-1">{line.level_label}</td>
                        <td className="border border-stone-300 px-2 py-1 text-right">{line.student_count}</td>
                        <td className="border border-stone-300 px-2 py-1 text-right">{formatBaht(line.rate_per_student)}</td>
                        <td className="border border-stone-300 px-2 py-1 text-right">{formatBaht(line.total)}</td>
                      </tr>
                    ))}
                    <tr className="break-inside-avoid font-semibold">
                      <td className="border border-stone-300 px-2 py-1"></td>
                      <td className="border border-stone-300 px-2 py-1 text-right" colSpan={3}>
                        รวม
                      </td>
                      <td className="border border-stone-300 px-2 py-1 text-right">{formatBaht(subtotal)}</td>
                    </tr>
                  </Fragment>
                );
              })}
              <tr className="bg-stone-100 font-bold print:bg-transparent">
                <td className="border border-stone-400 px-2 py-1 text-right" colSpan={4}>
                  รวมทั้งสิ้น
                </td>
                <td className="border border-stone-400 px-2 py-1 text-right">{formatBaht(revenueTotal)}</td>
              </tr>
            </tbody>
          </table>

          <h2 className="mt-8 font-display text-base font-bold text-stone-900">3.2 การประมาณการรายจ่าย</h2>
          {groups.map((group) => {
            const groupProjects = projects.filter((p) => p.admin_group_id === group.id).sort((a, b) => a.sort_order - b.sort_order);
            const groupTotal = groupProjects.reduce((sum, p) => sum + p.activities.reduce((s, a) => s + a.budget, 0), 0);
            return (
              <div key={group.id} className="mt-4">
                <h3 className="font-display text-sm font-bold text-stone-900">งบประมาณ{group.name}</h3>
                <table className="mt-1 w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-stone-100 print:bg-transparent">
                      {["ลำดับ", "โครงการ", "กิจกรรม", "งบประมาณ", "ผู้รับผิดชอบ"].map((h) => (
                        <th key={h} className="border border-stone-400 px-2 py-1 text-left font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groupProjects.map((project, i) => {
                      return project.activities.length === 0 ? (
                        <tr key={project.id} className="break-inside-avoid">
                          <td className="border border-stone-300 px-2 py-1 text-right">{i + 1}</td>
                          <td className="border border-stone-300 px-2 py-1">{project.name}</td>
                          <td className="border border-stone-300 px-2 py-1"></td>
                          <td className="border border-stone-300 px-2 py-1 text-right">0.00</td>
                          <td className="border border-stone-300 px-2 py-1"></td>
                        </tr>
                      ) : (
                        project.activities.map((activity, j) => (
                          <tr key={activity.id} className="break-inside-avoid">
                            {j === 0 ? (
                              <td className="border border-stone-300 px-2 py-1 text-right align-top" rowSpan={project.activities.length}>
                                {i + 1}
                              </td>
                            ) : null}
                            {j === 0 ? (
                              <td className="border border-stone-300 px-2 py-1 align-top" rowSpan={project.activities.length}>
                                {project.name}
                              </td>
                            ) : null}
                            <td className="border border-stone-300 px-2 py-1">{activity.name ?? "—"}</td>
                            <td className="border border-stone-300 px-2 py-1 text-right">{formatBaht(activity.budget)}</td>
                            <td className="border border-stone-300 px-2 py-1">{activity.responsible ?? "—"}</td>
                          </tr>
                        ))
                      );
                    })}
                    {groupProjects.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="border border-stone-300 px-2 py-2 text-center text-stone-400">
                          ไม่มีโครงการ
                        </td>
                      </tr>
                    ) : (
                      <tr className="bg-stone-100 font-bold print:bg-transparent">
                        <td colSpan={3} className="border border-stone-400 px-2 py-1 text-right">
                          รวมทั้งสิ้น
                        </td>
                        <td className="border border-stone-400 px-2 py-1 text-right">{formatBaht(groupTotal)}</td>
                        <td className="border border-stone-400 px-2 py-1"></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })}

          <div className="mt-4 rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 text-right print:border-2 print:bg-transparent">
            <span className="text-sm text-stone-700">รวมประมาณการรายจ่ายทั้งสิ้น </span>
            <span className="font-display text-base font-bold text-stone-900">{formatBaht(expenseTotal)}</span>
            <span className="text-sm text-stone-700"> บาท</span>
          </div>
        </div>
      )}
    </main>
  );
}
