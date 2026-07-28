"use client";

import { getSessionUser } from "./data";
import { supabaseBrowser } from "./supabase/client";
import type {
  PlanActivity,
  PlanAdminGroup,
  PlanBudgetYear,
  PlanDisbursementRequest,
  PlanDisbursementRequestWithContext,
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

/* -----------------------------------------------------------------------------
 * ขออนุมัติเบิกจ่ายงบประมาณต่อกิจกรรม
 * -------------------------------------------------------------------------- */

/** ยอดที่อนุมัติเบิกไปแล้วสะสม ต่อกิจกรรม — ใช้คำนวณ "คงเหลือ" = budget - ยอดนี้ */
export async function fetchApprovedDisbursementTotals(activityIds: string[]): Promise<Map<string, number>> {
  if (activityIds.length === 0) return new Map();
  const supabase = supabaseBrowser();
  const { data, error } = await supabase
    .from("plan_disbursement_requests")
    .select("activity_id, requested_amount")
    .in("activity_id", activityIds)
    .eq("status", "approved");
  if (error) throw error;
  const map = new Map<string, number>();
  for (const row of (data as { activity_id: string; requested_amount: number }[]) ?? []) {
    map.set(row.activity_id, (map.get(row.activity_id) ?? 0) + Number(row.requested_amount));
  }
  return map;
}

/**
 * คำขอเบิกจ่ายพร้อมบริบท (กิจกรรม/โครงการ/กลุ่มบริหาร) — filter ตามปีงบประมาณ และ/หรือสถานะ
 * ไม่ระบุ budgetYearId = ทุกปี (ใช้กับหน้าผู้อำนวยการที่อยากเห็นคำขอรอทั้งหมดไม่ว่าปีไหน)
 */
export async function fetchDisbursementRequests(filter?: {
  status?: PlanDisbursementRequest["status"];
  budgetYearId?: string;
}): Promise<PlanDisbursementRequestWithContext[]> {
  const supabase = supabaseBrowser();

  let projectsQuery = supabase.from("plan_projects").select("*");
  if (filter?.budgetYearId) projectsQuery = projectsQuery.eq("budget_year_id", filter.budgetYearId);
  const [{ data: projects, error: projErr }, { data: groups, error: groupErr }] = await Promise.all([
    projectsQuery,
    supabase.from("plan_admin_groups").select("*"),
  ]);
  if (projErr) throw projErr;
  if (groupErr) throw groupErr;

  const projectRows = (projects as PlanProject[]) ?? [];
  if (projectRows.length === 0) return [];

  const { data: activities, error: actErr } = await supabase
    .from("plan_activities")
    .select("*")
    .in(
      "project_id",
      projectRows.map((p) => p.id),
    );
  if (actErr) throw actErr;

  const activityRows = (activities as PlanActivity[]) ?? [];
  if (activityRows.length === 0) return [];

  let reqQuery = supabase
    .from("plan_disbursement_requests")
    .select("*")
    .in(
      "activity_id",
      activityRows.map((a) => a.id),
    )
    .order("requested_at", { ascending: false });
  if (filter?.status) reqQuery = reqQuery.eq("status", filter.status);
  const { data: requests, error: reqErr } = await reqQuery;
  if (reqErr) throw reqErr;

  const projectById = new Map(projectRows.map((p) => [p.id, p]));
  const groupById = new Map(((groups as PlanAdminGroup[]) ?? []).map((g) => [g.id, g]));
  const activityById = new Map(activityRows.map((a) => [a.id, a]));

  return ((requests as PlanDisbursementRequest[]) ?? []).flatMap((r) => {
    const activity = activityById.get(r.activity_id);
    const project = activity ? projectById.get(activity.project_id) : undefined;
    const group = project ? groupById.get(project.admin_group_id) : undefined;
    if (!activity || !project || !group) return [];
    return [{ ...r, requested_amount: Number(r.requested_amount), activity, project, group }];
  });
}

export async function fetchDisbursementRequestWithContext(id: string): Promise<PlanDisbursementRequestWithContext | null> {
  const supabase = supabaseBrowser();
  const { data: request, error } = await supabase.from("plan_disbursement_requests").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!request) return null;
  const r = request as PlanDisbursementRequest;

  const { data: activity, error: actErr } = await supabase.from("plan_activities").select("*").eq("id", r.activity_id).single();
  if (actErr) throw actErr;
  const act = activity as PlanActivity;

  const { data: project, error: projErr } = await supabase.from("plan_projects").select("*").eq("id", act.project_id).single();
  if (projErr) throw projErr;
  const proj = project as PlanProject;

  const { data: group, error: groupErr } = await supabase
    .from("plan_admin_groups")
    .select("*")
    .eq("id", proj.admin_group_id)
    .single();
  if (groupErr) throw groupErr;

  return { ...r, requested_amount: Number(r.requested_amount), activity: act, project: proj, group: group as PlanAdminGroup };
}

/** ชื่อผู้ใช้ตาม id — ใช้แสดงชื่อผู้ขอ/ผู้อนุมัติในเอกสารพิมพ์ */
export async function fetchProfileNamesByIds(ids: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return new Map();
  const supabase = supabaseBrowser();
  const { data, error } = await supabase.from("asset_survey_profiles").select("user_id, full_name").in("user_id", uniqueIds);
  if (error) throw error;
  return new Map(((data as { user_id: string; full_name: string }[]) ?? []).map((p) => [p.user_id, p.full_name]));
}

export async function createDisbursementRequest(
  activityId: string,
  requestedAmount: number,
  purpose: string | null,
): Promise<PlanDisbursementRequest> {
  const supabase = supabaseBrowser();
  const user = await getSessionUser();
  if (!user) throw new Error("เซสชันหมดอายุ — กรุณาเข้าสู่ระบบอีกครั้ง");
  const { data, error } = await supabase
    .from("plan_disbursement_requests")
    .insert({ activity_id: activityId, requested_amount: requestedAmount, purpose, requested_by: user.id })
    .select("*")
    .single();
  if (error) throw error;
  return data as PlanDisbursementRequest;
}

export async function deleteDisbursementRequest(id: string): Promise<void> {
  const supabase = supabaseBrowser();
  const { error } = await supabase.from("plan_disbursement_requests").delete().eq("id", id);
  if (error) throw error;
}

export async function approveDisbursementRequest(id: string): Promise<void> {
  const supabase = supabaseBrowser();
  const user = await getSessionUser();
  if (!user) throw new Error("เซสชันหมดอายุ — กรุณาเข้าสู่ระบบอีกครั้ง");
  const { error } = await supabase
    .from("plan_disbursement_requests")
    .update({ status: "approved", approved_by: user.id, approved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function rejectDisbursementRequest(id: string, reason: string): Promise<void> {
  const supabase = supabaseBrowser();
  const user = await getSessionUser();
  if (!user) throw new Error("เซสชันหมดอายุ — กรุณาเข้าสู่ระบบอีกครั้ง");
  const { error } = await supabase
    .from("plan_disbursement_requests")
    .update({ status: "rejected", approved_by: user.id, approved_at: new Date().toISOString(), reject_reason: reason })
    .eq("id", id);
  if (error) throw error;
}
