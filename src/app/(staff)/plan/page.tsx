"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, ButtonLabel, Toast, inputClass, useToast } from "@/components/ui";
import { CURRENT_BE_YEAR } from "@/lib/constants";
import { humanizeError } from "@/lib/data";
import {
  createPlanActivity,
  createPlanOfficialRate,
  createPlanProject,
  createPlanRevenueLine,
  createPlanYear,
  deletePlanActivity,
  deletePlanOfficialRate,
  deletePlanProject,
  deletePlanRevenueLine,
  fetchPlanAdminGroups,
  fetchPlanOfficialRates,
  fetchPlanProjectsWithActivities,
  fetchPlanRevenueLines,
  fetchPlanRevenueTypes,
  fetchPlanYears,
  importOfficialRatesAsRevenueLines,
  updatePlanActivity,
  updatePlanOfficialRate,
  updatePlanProject,
  updatePlanRevenueLine,
} from "@/lib/plan-data";
import type {
  PlanAdminGroup,
  PlanBudgetYear,
  PlanOfficialRate,
  PlanProjectWithActivities,
  PlanRevenueLine,
  PlanRevenueType,
} from "@/lib/plan-types";
import { useProfile } from "@/lib/hooks";
import { formatBaht } from "@/lib/format";

const TABS = [
  { key: "revenue", label: "3.1 ประมาณการรายรับ" },
  { key: "expense", label: "3.2 ประมาณการรายจ่าย" },
  { key: "rates", label: "อัตราทางการ (สพฐ.)" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function PlanPage() {
  const profile = useProfile();
  const { message, show } = useToast();
  const [tab, setTab] = useState<TabKey>("revenue");
  const [error, setError] = useState<string | null>(null);

  const [years, setYears] = useState<PlanBudgetYear[]>([]);
  const [yearId, setYearId] = useState<string | null>(null);
  const [loadingYears, setLoadingYears] = useState(true);

  const isAdmin = profile ? profile.role === "admin" : null;

  useEffect(() => {
    if (isAdmin !== true) return;
    fetchPlanYears()
      .then((rows) => {
        setYears(rows);
        const open = rows.find((r) => r.is_open) ?? rows[0] ?? null;
        setYearId(open?.id ?? null);
      })
      .catch((e) => setError(humanizeError(e)))
      .finally(() => setLoadingYears(false));
  }, [isAdmin]);

  async function handleNewYear() {
    const yearStr = prompt("ปีงบประมาณใหม่ (พ.ศ.)", String(CURRENT_BE_YEAR + 1));
    if (!yearStr) return;
    const year = Number(yearStr);
    if (!year) return;
    try {
      await createPlanYear(year, `แผนปฏิบัติการประจำปีงบประมาณ ${year}`);
      const rows = await fetchPlanYears();
      setYears(rows);
      setYearId(rows.find((r) => r.is_open)?.id ?? null);
      show("สร้างปีงบประมาณใหม่แล้ว");
    } catch (e) {
      setError(humanizeError(e));
    }
  }

  if (profile && !isAdmin) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
        <Alert tone="error">หน้านี้สำหรับแอดมินเท่านั้น</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-stone-900">งานแผนงาน — ประมาณการงบประมาณรายรับ-รายจ่าย</h1>
          <p className="text-sm text-stone-600">ส่วนที่ 3 ของแผนปฏิบัติการประจำปี</p>
        </div>
        {yearId ? (
          <Link
            href={`/plan/print?year=${yearId}`}
            className="shrink-0 rounded-xl border border-sky-700 px-3 py-2 text-sm font-semibold text-sky-700"
          >
            พิมพ์สรุป
          </Link>
        ) : null}
      </div>

      {error ? (
        <div className="mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      {loadingYears ? (
        <p className="mt-6 text-sm text-stone-500">กำลังโหลด…</p>
      ) : years.length === 0 ? (
        <p className="mt-6 rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
          ยังไม่มีปีงบประมาณ —{" "}
          <button type="button" onClick={handleNewYear} className="text-sky-700 underline">
            สร้างปีงบประมาณแรก
          </button>
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <select
              value={yearId ?? ""}
              onChange={(e) => setYearId(e.target.value)}
              className={`${inputClass} max-w-xs`}
            >
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name} {y.is_open ? "(เปิดอยู่)" : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleNewYear}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-700"
            >
              + ปีงบประมาณใหม่
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={
                  "rounded-full border px-3.5 py-2 text-sm transition " +
                  (tab === t.key
                    ? "border-sky-700 bg-sky-700 font-medium text-white"
                    : "border-stone-300 bg-white text-stone-700")
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-6">
            {yearId ? (
              tab === "revenue" ? (
                <RevenuePanel
                  budgetYearId={yearId}
                  budgetYear={years.find((y) => y.id === yearId)?.year ?? null}
                  onError={setError}
                  onDone={show}
                />
              ) : tab === "expense" ? (
                <ExpensePanel budgetYearId={yearId} onError={setError} onDone={show} />
              ) : (
                <OfficialRatesPanel onError={setError} onDone={show} />
              )
            ) : null}
          </div>
        </>
      )}

      <Toast message={message} />
    </main>
  );
}

/* ---------- 3.1 ประมาณการรายรับ ---------- */

function RevenuePanel({
  budgetYearId,
  budgetYear,
  onError,
  onDone,
}: {
  budgetYearId: string;
  budgetYear: number | null;
  onError: (e: string | null) => void;
  onDone: (m: string) => void;
}) {
  const [types, setTypes] = useState<PlanRevenueType[]>([]);
  const [lines, setLines] = useState<PlanRevenueLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    Promise.all([fetchPlanRevenueTypes(), fetchPlanRevenueLines(budgetYearId)])
      .then(([t, l]) => {
        setTypes(t);
        setLines(l);
      })
      .catch((e) => onError(humanizeError(e)))
      .finally(() => setLoading(false));
  }

  useEffect(reload, [budgetYearId]);

  async function handleAddLine(revenueTypeId: string) {
    setBusyId(`new-${revenueTypeId}`);
    onError(null);
    try {
      const nextSort = (Math.max(0, ...lines.filter((l) => l.revenue_type_id === revenueTypeId).map((l) => l.sort_order)) || 0) + 10;
      await createPlanRevenueLine({
        budget_year_id: budgetYearId,
        revenue_type_id: revenueTypeId,
        level_label: "ระดับใหม่",
        student_count: 0,
        rate_per_student: 0,
        sort_order: nextSort,
      });
      reload();
    } catch (e) {
      onError(humanizeError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function handleUpdate(id: string, patch: Partial<Pick<PlanRevenueLine, "level_label" | "student_count" | "rate_per_student">>) {
    setBusyId(id);
    onError(null);
    try {
      const updated = await updatePlanRevenueLine(id, patch);
      setLines((prev) => prev.map((l) => (l.id === id ? updated : l)));
    } catch (e) {
      onError(humanizeError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("ลบแถวนี้?")) return;
    setBusyId(id);
    onError(null);
    try {
      await deletePlanRevenueLine(id);
      setLines((prev) => prev.filter((l) => l.id !== id));
      onDone("ลบแล้ว");
    } catch (e) {
      onError(humanizeError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function handleImportOfficialRate(revenueTypeId: string) {
    if (!budgetYear) return;
    setBusyId(`import-${revenueTypeId}`);
    onError(null);
    try {
      const existing = lines
        .filter((l) => l.revenue_type_id === revenueTypeId)
        .map((l) => l.level_label);
      const count = await importOfficialRatesAsRevenueLines(budgetYearId, budgetYear, revenueTypeId, existing);
      reload();
      onDone(count > 0 ? `นำเข้าอัตราทางการแล้ว ${count} ระดับ` : "ไม่มีอัตราทางการใหม่ให้นำเข้า (มีครบแล้ว หรือยังไม่มีอัตราปีนี้)");
    } catch (e) {
      onError(humanizeError(e));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="text-sm text-stone-500">กำลังโหลด…</p>;

  const grandTotal = lines.reduce((sum, l) => sum + l.total, 0);

  return (
    <div className="space-y-4">
      {types.map((type) => {
        const typeLines = lines.filter((l) => l.revenue_type_id === type.id).sort((a, b) => a.sort_order - b.sort_order);
        const subtotal = typeLines.reduce((sum, l) => sum + l.total, 0);
        return (
          <div key={type.id} className="rounded-xl border border-stone-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-sm font-semibold text-stone-800">{type.name}</p>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  disabled={busyId === `import-${type.id}` || !budgetYear}
                  onClick={() => handleImportOfficialRate(type.id)}
                  title="นำเข้าระดับ+อัตราจากตารางอัตราทางการ (สพฐ.) ของปีนี้ — จำนวนนักเรียนต้องกรอกเอง"
                  className="rounded-lg border border-sky-700 px-2.5 py-1 text-xs text-sky-700 disabled:opacity-50"
                >
                  <ButtonLabel busy={busyId === `import-${type.id}`}>นำเข้าจากอัตราทางการ</ButtonLabel>
                </button>
                <button
                  type="button"
                  disabled={busyId === `new-${type.id}`}
                  onClick={() => handleAddLine(type.id)}
                  className="rounded-lg border border-stone-300 px-2.5 py-1 text-xs text-stone-700 disabled:opacity-50"
                >
                  <ButtonLabel busy={busyId === `new-${type.id}`}>+ เพิ่มระดับ</ButtonLabel>
                </button>
              </div>
            </div>
            {typeLines.length === 0 ? (
              <p className="mt-2 text-xs text-stone-400">ยังไม่มีรายการ</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-stone-500">
                      <th className="py-1 pr-2 font-medium">ระดับชั้น</th>
                      <th className="py-1 pr-2 font-medium">นักเรียน (คน)</th>
                      <th className="py-1 pr-2 font-medium">บาท/คน/ปี</th>
                      <th className="py-1 pr-2 text-right font-medium">รวม</th>
                      <th className="py-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {typeLines.map((line) => (
                      <tr key={line.id} className="border-t border-stone-100">
                        <td className="py-1.5 pr-2">
                          <input
                            defaultValue={line.level_label}
                            disabled={busyId === line.id}
                            onBlur={(e) =>
                              e.target.value.trim() !== line.level_label &&
                              handleUpdate(line.id, { level_label: e.target.value.trim() })
                            }
                            className={`${inputClass} py-1 text-sm`}
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            defaultValue={line.student_count}
                            disabled={busyId === line.id}
                            inputMode="numeric"
                            onBlur={(e) => {
                              const n = Number(e.target.value);
                              if (Number.isFinite(n) && n !== line.student_count) handleUpdate(line.id, { student_count: n });
                            }}
                            className={`${inputClass} w-24 py-1 text-sm`}
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            defaultValue={line.rate_per_student}
                            disabled={busyId === line.id}
                            inputMode="decimal"
                            onBlur={(e) => {
                              const n = Number(e.target.value);
                              if (Number.isFinite(n) && n !== line.rate_per_student) handleUpdate(line.id, { rate_per_student: n });
                            }}
                            className={`${inputClass} w-28 py-1 text-sm`}
                          />
                        </td>
                        <td className="py-1.5 pr-2 text-right font-medium text-stone-900">{formatBaht(line.total)}</td>
                        <td className="py-1.5 text-right">
                          <button
                            type="button"
                            disabled={busyId === line.id}
                            onClick={() => handleDelete(line.id)}
                            className="text-xs text-stone-400 hover:text-rose-600 disabled:opacity-50"
                          >
                            ลบ
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-stone-200 font-semibold">
                      <td colSpan={3} className="py-1.5 pr-2 text-right text-xs text-stone-600">
                        รวม
                      </td>
                      <td className="py-1.5 pr-2 text-right">{formatBaht(subtotal)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        );
      })}

      <div className="rounded-xl border border-sky-200 bg-sky-50/60 px-4 py-3 text-right">
        <span className="text-sm text-stone-700">รวมประมาณการรายรับทั้งสิ้น </span>
        <span className="font-display text-lg font-bold text-stone-900">{formatBaht(grandTotal)}</span>
        <span className="text-sm text-stone-700"> บาท</span>
      </div>
    </div>
  );
}

/* ---------- 3.2 ประมาณการรายจ่าย ---------- */

function ExpensePanel({
  budgetYearId,
  onError,
  onDone,
}: {
  budgetYearId: string;
  onError: (e: string | null) => void;
  onDone: (m: string) => void;
}) {
  const [groups, setGroups] = useState<PlanAdminGroup[]>([]);
  const [projects, setProjects] = useState<PlanProjectWithActivities[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    Promise.all([fetchPlanAdminGroups(), fetchPlanProjectsWithActivities(budgetYearId)])
      .then(([g, p]) => {
        setGroups(g);
        setProjects(p);
      })
      .catch((e) => onError(humanizeError(e)))
      .finally(() => setLoading(false));
  }

  useEffect(reload, [budgetYearId]);

  async function handleAddProject(groupId: string) {
    const name = prompt("ชื่อโครงการใหม่");
    if (!name?.trim()) return;
    setBusyId(`newproj-${groupId}`);
    onError(null);
    try {
      const groupProjects = projects.filter((p) => p.admin_group_id === groupId);
      const nextSort = (Math.max(0, ...groupProjects.map((p) => p.sort_order)) || 0) + 10;
      await createPlanProject(budgetYearId, groupId, name.trim(), nextSort);
      reload();
      onDone("เพิ่มโครงการแล้ว");
    } catch (e) {
      onError(humanizeError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function handleRenameProject(id: string, name: string) {
    setBusyId(id);
    onError(null);
    try {
      await updatePlanProject(id, { name: name.trim() });
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name: name.trim() } : p)));
    } catch (e) {
      onError(humanizeError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteProject(id: string) {
    if (!confirm("ลบโครงการนี้ทั้งหมด (รวมกิจกรรมย่อย)?")) return;
    setBusyId(id);
    onError(null);
    try {
      await deletePlanProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      onDone("ลบแล้ว");
    } catch (e) {
      onError(humanizeError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function handleAddActivity(projectId: string) {
    setBusyId(`newact-${projectId}`);
    onError(null);
    try {
      const project = projects.find((p) => p.id === projectId);
      const nextSort = (Math.max(0, ...(project?.activities.map((a) => a.sort_order) ?? [])) || 0) + 10;
      await createPlanActivity(projectId, { name: "กิจกรรมใหม่", budget: 0, responsible: null, sort_order: nextSort });
      reload();
    } catch (e) {
      onError(humanizeError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function handleUpdateActivity(
    id: string,
    projectId: string,
    patch: Partial<Pick<PlanProjectWithActivities["activities"][number], "name" | "budget" | "responsible">>,
  ) {
    setBusyId(id);
    onError(null);
    try {
      await updatePlanActivity(id, patch);
      setProjects((prev) =>
        prev.map((p) =>
          p.id !== projectId ? p : { ...p, activities: p.activities.map((a) => (a.id === id ? { ...a, ...patch } : a)) },
        ),
      );
    } catch (e) {
      onError(humanizeError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteActivity(id: string, projectId: string) {
    if (!confirm("ลบกิจกรรมนี้?")) return;
    setBusyId(id);
    onError(null);
    try {
      await deletePlanActivity(id);
      setProjects((prev) =>
        prev.map((p) => (p.id !== projectId ? p : { ...p, activities: p.activities.filter((a) => a.id !== id) })),
      );
      onDone("ลบแล้ว");
    } catch (e) {
      onError(humanizeError(e));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="text-sm text-stone-500">กำลังโหลด…</p>;

  const grandTotal = projects.reduce((sum, p) => sum + p.activities.reduce((s, a) => s + a.budget, 0), 0);

  return (
    <div className="space-y-5">
      {groups.map((group) => {
        const groupProjects = projects.filter((p) => p.admin_group_id === group.id).sort((a, b) => a.sort_order - b.sort_order);
        const groupTotal = groupProjects.reduce((sum, p) => sum + p.activities.reduce((s, a) => s + a.budget, 0), 0);
        return (
          <div key={group.id} className="rounded-xl border border-stone-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-sm font-semibold text-stone-800">{group.name}</p>
              <button
                type="button"
                disabled={busyId === `newproj-${group.id}`}
                onClick={() => handleAddProject(group.id)}
                className="shrink-0 rounded-lg border border-stone-300 px-2.5 py-1 text-xs text-stone-700 disabled:opacity-50"
              >
                <ButtonLabel busy={busyId === `newproj-${group.id}`}>+ เพิ่มโครงการ</ButtonLabel>
              </button>
            </div>

            <div className="mt-2 space-y-3">
              {groupProjects.map((project) => {
                const projectTotal = project.activities.reduce((s, a) => s + a.budget, 0);
                return (
                  <div key={project.id} className="rounded-lg border border-stone-100 bg-stone-50/60 p-2.5">
                    <div className="flex items-center gap-2">
                      <input
                        defaultValue={project.name}
                        disabled={busyId === project.id}
                        onBlur={(e) => e.target.value.trim() !== project.name && handleRenameProject(project.id, e.target.value)}
                        className={`${inputClass} flex-1 py-1.5 text-sm font-medium`}
                      />
                      <span className="shrink-0 text-sm font-semibold text-stone-700">{formatBaht(projectTotal)}</span>
                      <button
                        type="button"
                        disabled={busyId === project.id}
                        onClick={() => handleDeleteProject(project.id)}
                        className="shrink-0 text-xs text-stone-400 hover:text-rose-600 disabled:opacity-50"
                      >
                        ลบโครงการ
                      </button>
                    </div>

                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full min-w-[480px] text-sm">
                        <thead>
                          <tr className="text-left text-xs text-stone-500">
                            <th className="py-1 pr-2 font-medium">กิจกรรม</th>
                            <th className="py-1 pr-2 font-medium">งบประมาณ</th>
                            <th className="py-1 pr-2 font-medium">ผู้รับผิดชอบ</th>
                            <th className="py-1"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {project.activities.map((activity) => (
                            <tr key={activity.id} className="border-t border-stone-200">
                              <td className="py-1.5 pr-2">
                                <input
                                  defaultValue={activity.name ?? ""}
                                  disabled={busyId === activity.id}
                                  placeholder="(ไม่มี — งบอยู่ที่โครงการ)"
                                  onBlur={(e) => {
                                    const v = e.target.value.trim() || null;
                                    if (v !== activity.name) handleUpdateActivity(activity.id, project.id, { name: v });
                                  }}
                                  className={`${inputClass} py-1 text-sm`}
                                />
                              </td>
                              <td className="py-1.5 pr-2">
                                <input
                                  defaultValue={activity.budget}
                                  disabled={busyId === activity.id}
                                  inputMode="decimal"
                                  onBlur={(e) => {
                                    const n = Number(e.target.value);
                                    if (Number.isFinite(n) && n !== activity.budget) handleUpdateActivity(activity.id, project.id, { budget: n });
                                  }}
                                  className={`${inputClass} w-28 py-1 text-sm`}
                                />
                              </td>
                              <td className="py-1.5 pr-2">
                                <input
                                  defaultValue={activity.responsible ?? ""}
                                  disabled={busyId === activity.id}
                                  onBlur={(e) => {
                                    const v = e.target.value.trim() || null;
                                    if (v !== activity.responsible) handleUpdateActivity(activity.id, project.id, { responsible: v });
                                  }}
                                  className={`${inputClass} py-1 text-sm`}
                                />
                              </td>
                              <td className="py-1.5 text-right">
                                <button
                                  type="button"
                                  disabled={busyId === activity.id}
                                  onClick={() => handleDeleteActivity(activity.id, project.id)}
                                  className="text-xs text-stone-400 hover:text-rose-600 disabled:opacity-50"
                                >
                                  ลบ
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === `newact-${project.id}`}
                      onClick={() => handleAddActivity(project.id)}
                      className="mt-1.5 text-xs text-sky-700 disabled:opacity-50"
                    >
                      <ButtonLabel busy={busyId === `newact-${project.id}`}>+ เพิ่มกิจกรรม</ButtonLabel>
                    </button>
                  </div>
                );
              })}
              {groupProjects.length === 0 ? <p className="text-xs text-stone-400">ยังไม่มีโครงการ</p> : null}
            </div>

            <p className="mt-2 text-right text-sm font-semibold text-stone-700">รวม {formatBaht(groupTotal)} บาท</p>
          </div>
        );
      })}

      <div className="rounded-xl border border-sky-200 bg-sky-50/60 px-4 py-3 text-right">
        <span className="text-sm text-stone-700">รวมประมาณการรายจ่ายทั้งสิ้น </span>
        <span className="font-display text-lg font-bold text-stone-900">{formatBaht(grandTotal)}</span>
        <span className="text-sm text-stone-700"> บาท</span>
      </div>
    </div>
  );
}

/* ---------- อัตราทางการ (สพฐ.) — master data อ้างอิง ---------- */

function OfficialRatesPanel({
  onError,
  onDone,
}: {
  onError: (e: string | null) => void;
  onDone: (m: string) => void;
}) {
  const [types, setTypes] = useState<PlanRevenueType[]>([]);
  const [rates, setRates] = useState<PlanOfficialRate[]>([]);
  const [year, setYear] = useState(CURRENT_BE_YEAR);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    Promise.all([fetchPlanRevenueTypes(), fetchPlanOfficialRates(year)])
      .then(([t, r]) => {
        setTypes(t);
        setRates(r);
      })
      .catch((e) => onError(humanizeError(e)))
      .finally(() => setLoading(false));
  }

  useEffect(reload, [year]);

  async function handleAdd(revenueTypeId: string) {
    setBusyId(`new-${revenueTypeId}`);
    onError(null);
    try {
      const nextSort = (Math.max(0, ...rates.filter((r) => r.revenue_type_id === revenueTypeId).map((r) => r.sort_order)) || 0) + 10;
      await createPlanOfficialRate({
        year,
        revenue_type_id: revenueTypeId,
        level_label: "ระดับใหม่",
        rate_per_student: 0,
        note: "",
        sort_order: nextSort,
      });
      reload();
    } catch (e) {
      onError(humanizeError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function handleUpdate(id: string, patch: Partial<Pick<PlanOfficialRate, "level_label" | "rate_per_student" | "note">>) {
    setBusyId(id);
    onError(null);
    try {
      const updated = await updatePlanOfficialRate(id, patch);
      setRates((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (e) {
      onError(humanizeError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("ลบแถวนี้?")) return;
    setBusyId(id);
    onError(null);
    try {
      await deletePlanOfficialRate(id);
      setRates((prev) => prev.filter((r) => r.id !== id));
      onDone("ลบแล้ว");
    } catch (e) {
      onError(humanizeError(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
        ตารางอ้างอิงอัตราเงินอุดหนุนรายหัวตามประกาศ สพฐ. — แยกจากตัวเลขจริงที่กรอกในแท็บ
        &ldquo;ประมาณการรายรับ&rdquo; ใช้เป็นค่าเริ่มต้นตอนขึ้นปีงบประมาณใหม่ผ่านปุ่ม
        &ldquo;นำเข้าจากอัตราทางการ&rdquo; เท่านั้น แก้ที่นี่ไม่กระทบตัวเลขที่กรอกไปแล้ว
      </div>

      <label className="flex items-center gap-2 text-sm text-stone-700">
        ปีงบประมาณของอัตรา (พ.ศ.)
        <input
          value={year}
          inputMode="numeric"
          onChange={(e) => setYear(Number(e.target.value) || year)}
          className={`${inputClass} w-28 py-1.5 text-sm`}
        />
      </label>

      {loading ? (
        <p className="text-sm text-stone-500">กำลังโหลด…</p>
      ) : (
        types.map((type) => {
          const typeRates = rates.filter((r) => r.revenue_type_id === type.id).sort((a, b) => a.sort_order - b.sort_order);
          return (
            <div key={type.id} className="rounded-xl border border-stone-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-sm font-semibold text-stone-800">{type.name}</p>
                <button
                  type="button"
                  disabled={busyId === `new-${type.id}`}
                  onClick={() => handleAdd(type.id)}
                  className="shrink-0 rounded-lg border border-stone-300 px-2.5 py-1 text-xs text-stone-700 disabled:opacity-50"
                >
                  <ButtonLabel busy={busyId === `new-${type.id}`}>+ เพิ่มระดับ</ButtonLabel>
                </button>
              </div>
              {typeRates.length === 0 ? (
                <p className="mt-2 text-xs text-stone-400">ยังไม่มีอัตราปีนี้</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead>
                      <tr className="text-left text-xs text-stone-500">
                        <th className="py-1 pr-2 font-medium">ระดับชั้น</th>
                        <th className="py-1 pr-2 font-medium">บาท/คน/ปี</th>
                        <th className="py-1 pr-2 font-medium">หมายเหตุ</th>
                        <th className="py-1"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {typeRates.map((rate) => (
                        <tr key={rate.id} className="border-t border-stone-100">
                          <td className="py-1.5 pr-2">
                            <input
                              defaultValue={rate.level_label}
                              disabled={busyId === rate.id}
                              onBlur={(e) =>
                                e.target.value.trim() !== rate.level_label &&
                                handleUpdate(rate.id, { level_label: e.target.value.trim() })
                              }
                              className={`${inputClass} py-1 text-sm`}
                            />
                          </td>
                          <td className="py-1.5 pr-2">
                            <input
                              defaultValue={rate.rate_per_student}
                              disabled={busyId === rate.id}
                              inputMode="decimal"
                              onBlur={(e) => {
                                const n = Number(e.target.value);
                                if (Number.isFinite(n) && n !== rate.rate_per_student) handleUpdate(rate.id, { rate_per_student: n });
                              }}
                              className={`${inputClass} w-28 py-1 text-sm`}
                            />
                          </td>
                          <td className="py-1.5 pr-2">
                            <input
                              defaultValue={rate.note}
                              disabled={busyId === rate.id}
                              placeholder="เช่น (สถานประกอบการ)"
                              onBlur={(e) =>
                                e.target.value.trim() !== rate.note && handleUpdate(rate.id, { note: e.target.value.trim() })
                              }
                              className={`${inputClass} py-1 text-sm`}
                            />
                          </td>
                          <td className="py-1.5 text-right">
                            <button
                              type="button"
                              disabled={busyId === rate.id}
                              onClick={() => handleDelete(rate.id)}
                              className="text-xs text-stone-400 hover:text-rose-600 disabled:opacity-50"
                            >
                              ลบ
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
