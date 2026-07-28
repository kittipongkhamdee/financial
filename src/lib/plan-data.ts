"use client";

import { supabaseBrowser } from "./supabase/client";
import type {
  PlanActivity,
  PlanAdminGroup,
  PlanBudgetYear,
  PlanOfficialRate,
  PlanProject,
  PlanProjectWithActivities,
  PlanRevenueLine,
  PlanRevenueLineDraft,
  PlanRevenueType,
} from "./plan-types";

/* -----------------------------------------------------------------------------
 * ปีงบประมาณ
 * -------------------------------------------------------------------------- */

export async function fetchPlanYears(): Promise<PlanBudgetYear[]> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase.from("plan_budget_years").select("*").order("year", { ascending: false });
  if (error) throw error;
  return (data as PlanBudgetYear[]) ?? [];
}

export async function fetchOpenPlanYear(): Promise<PlanBudgetYear | null> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase
    .from("plan_budget_years")
    .select("*")
    .eq("is_open", true)
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as PlanBudgetYear | null) ?? null;
}

export async function createPlanYear(year: number, name: string): Promise<void> {
  const supabase = supabaseBrowser();
  const { error: closeError } = await supabase.from("plan_budget_years").update({ is_open: false }).eq("is_open", true);
  if (closeError) throw closeError;
  const { error } = await supabase.from("plan_budget_years").insert({ year, name, is_open: true });
  if (error) throw error;
}

/* -----------------------------------------------------------------------------
 * 3.1 ประมาณการรายรับ
 * -------------------------------------------------------------------------- */

export async function fetchPlanRevenueTypes(): Promise<PlanRevenueType[]> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase
    .from("plan_revenue_types")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return (data as PlanRevenueType[]) ?? [];
}

export async function fetchPlanRevenueLines(budgetYearId: string): Promise<PlanRevenueLine[]> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase
    .from("plan_revenue_lines")
    .select("*")
    .eq("budget_year_id", budgetYearId)
    .order("sort_order");
  if (error) throw error;
  return (data as PlanRevenueLine[]) ?? [];
}

export async function createPlanRevenueLine(draft: PlanRevenueLineDraft): Promise<PlanRevenueLine> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase.from("plan_revenue_lines").insert(draft).select("*").single();
  if (error) throw error;
  return data as PlanRevenueLine;
}

export async function updatePlanRevenueLine(
  id: string,
  patch: Partial<Pick<PlanRevenueLineDraft, "level_label" | "student_count" | "rate_per_student" | "sort_order">>,
): Promise<PlanRevenueLine> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase.from("plan_revenue_lines").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data as PlanRevenueLine;
}

export async function deletePlanRevenueLine(id: string): Promise<void> {
  const supabase = supabaseBrowser();
  const { error } = await supabase.from("plan_revenue_lines").delete().eq("id", id);
  if (error) throw error;
}

/* -----------------------------------------------------------------------------
 * 3.2 ประมาณการรายจ่าย
 * -------------------------------------------------------------------------- */

export async function fetchPlanAdminGroups(): Promise<PlanAdminGroup[]> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase
    .from("plan_admin_groups")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return (data as PlanAdminGroup[]) ?? [];
}

/** โครงการ+กิจกรรมทั้งหมดของปีงบประมาณ — ดึง 2 ตารางแล้วประกอบเองฝั่ง client (ง่ายกว่า nested select) */
export async function fetchPlanProjectsWithActivities(budgetYearId: string): Promise<PlanProjectWithActivities[]> {
  const supabase = supabaseBrowser();
  const { data: projects, error: projErr } = await supabase
    .from("plan_projects")
    .select("*")
    .eq("budget_year_id", budgetYearId)
    .order("sort_order");
  if (projErr) throw projErr;

  const projectIds = ((projects as PlanProject[]) ?? []).map((p) => p.id);
  const activitiesByProject = new Map<string, PlanActivity[]>();
  if (projectIds.length > 0) {
    const { data: activities, error: actErr } = await supabase
      .from("plan_activities")
      .select("*")
      .in("project_id", projectIds)
      .order("sort_order");
    if (actErr) throw actErr;
    for (const a of (activities as PlanActivity[]) ?? []) {
      activitiesByProject.set(a.project_id, [...(activitiesByProject.get(a.project_id) ?? []), a]);
    }
  }

  return ((projects as PlanProject[]) ?? []).map((p) => ({
    ...p,
    activities: activitiesByProject.get(p.id) ?? [],
  }));
}

export async function createPlanProject(
  budgetYearId: string,
  adminGroupId: string,
  name: string,
  sortOrder: number,
): Promise<PlanProject> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase
    .from("plan_projects")
    .insert({ budget_year_id: budgetYearId, admin_group_id: adminGroupId, name, sort_order: sortOrder })
    .select("*")
    .single();
  if (error) throw error;
  return data as PlanProject;
}

export async function updatePlanProject(id: string, patch: Partial<Pick<PlanProject, "name" | "sort_order">>): Promise<void> {
  const supabase = supabaseBrowser();
  const { error } = await supabase.from("plan_projects").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deletePlanProject(id: string): Promise<void> {
  const supabase = supabaseBrowser();
  const { error } = await supabase.from("plan_projects").delete().eq("id", id);
  if (error) throw error;
}

export async function createPlanActivity(
  projectId: string,
  patch: { name: string | null; budget: number; responsible: string | null; sort_order: number },
): Promise<PlanActivity> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase
    .from("plan_activities")
    .insert({ project_id: projectId, ...patch })
    .select("*")
    .single();
  if (error) throw error;
  return data as PlanActivity;
}

export async function updatePlanActivity(
  id: string,
  patch: Partial<Pick<PlanActivity, "name" | "budget" | "responsible" | "sort_order">>,
): Promise<void> {
  const supabase = supabaseBrowser();
  const { error } = await supabase.from("plan_activities").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deletePlanActivity(id: string): Promise<void> {
  const supabase = supabaseBrowser();
  const { error } = await supabase.from("plan_activities").delete().eq("id", id);
  if (error) throw error;
}

/* -----------------------------------------------------------------------------
 * อัตราเงินอุดหนุนรายหัวทางการ (ประกาศ สพฐ.) — master data อ้างอิง
 * -------------------------------------------------------------------------- */

export async function fetchPlanOfficialRates(year?: number): Promise<PlanOfficialRate[]> {
  const supabase = supabaseBrowser();
  let query = supabase.from("plan_official_rates").select("*").order("sort_order");
  if (year !== undefined) query = query.eq("year", year);
  const { data, error } = await query;
  if (error) throw error;
  return (data as PlanOfficialRate[]) ?? [];
}

export async function fetchPlanOfficialRateYears(): Promise<number[]> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase.from("plan_official_rates").select("year").order("year", { ascending: false });
  if (error) throw error;
  return [...new Set(((data as { year: number }[]) ?? []).map((r) => r.year))];
}

export async function createPlanOfficialRate(
  draft: Pick<PlanOfficialRate, "year" | "revenue_type_id" | "level_label" | "rate_per_student" | "note" | "sort_order">,
): Promise<PlanOfficialRate> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase.from("plan_official_rates").insert(draft).select("*").single();
  if (error) throw error;
  return data as PlanOfficialRate;
}

export async function updatePlanOfficialRate(
  id: string,
  patch: Partial<Pick<PlanOfficialRate, "level_label" | "rate_per_student" | "note" | "sort_order">>,
): Promise<PlanOfficialRate> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase.from("plan_official_rates").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data as PlanOfficialRate;
}

export async function deletePlanOfficialRate(id: string): Promise<void> {
  const supabase = supabaseBrowser();
  const { error } = await supabase.from("plan_official_rates").delete().eq("id", id);
  if (error) throw error;
}

/**
 * นำเข้าอัตราทางการของปีนี้เป็นแถวประมาณการรายรับเริ่มต้น (จำนวนนักเรียน = 0 ให้กรอกเอง)
 * ข้ามระดับที่มีแถวอยู่แล้วในปีงบประมาณ+ประเภทนั้น กันสร้างซ้ำถ้ากดนำเข้าหลายครั้ง
 */
export async function importOfficialRatesAsRevenueLines(
  budgetYearId: string,
  year: number,
  revenueTypeId: string,
  existingLevelLabels: string[],
): Promise<number> {
  const rates = await fetchPlanOfficialRates(year);
  const toImport = rates.filter(
    (r) => r.revenue_type_id === revenueTypeId && !existingLevelLabels.includes(`${r.level_label}${r.note}`),
  );
  if (toImport.length === 0) return 0;

  const supabase = supabaseBrowser();
  const { error } = await supabase.from("plan_revenue_lines").insert(
    toImport.map((r) => ({
      budget_year_id: budgetYearId,
      revenue_type_id: revenueTypeId,
      level_label: r.note ? `${r.level_label}${r.note}` : r.level_label,
      student_count: 0,
      rate_per_student: r.rate_per_student,
      sort_order: r.sort_order,
    })),
  );
  if (error) throw error;
  return toImport.length;
}
