/** ชนิดข้อมูลงานแผนงาน (เฟส 3 บางส่วน) — ตรงกับ supabase/migrations/20260731000000_plan_budget_estimate.sql */

export type PlanBudgetYear = {
  id: string;
  year: number;
  name: string;
  is_open: boolean;
};

export type PlanRevenueType = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

export type PlanRevenueLine = {
  id: string;
  budget_year_id: string;
  revenue_type_id: string;
  level_label: string;
  student_count: number;
  rate_per_student: number;
  total: number;
  sort_order: number;
};

export type PlanRevenueLineDraft = {
  budget_year_id: string;
  revenue_type_id: string;
  level_label: string;
  student_count: number;
  rate_per_student: number;
  sort_order?: number;
};

export type PlanAdminGroup = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

export type PlanProject = {
  id: string;
  budget_year_id: string;
  admin_group_id: string;
  name: string;
  sort_order: number;
};

export type PlanActivity = {
  id: string;
  project_id: string;
  name: string | null;
  budget: number;
  responsible: string | null;
  sort_order: number;
};

/** โครงการพร้อมกิจกรรมย่อย — ใช้แสดงผล/พิมพ์ */
export type PlanProjectWithActivities = PlanProject & { activities: PlanActivity[] };

/**
 * อัตราเงินอุดหนุนรายหัวทางการ (ประกาศ สพฐ.) — master data อ้างอิง แยกจากตัวเลขจริง
 * ที่โรงเรียนกรอกใน PlanRevenueLine ใช้เป็นค่าเริ่มต้นตอนตั้งปีงบประมาณใหม่
 */
export type PlanOfficialRate = {
  id: string;
  year: number;
  revenue_type_id: string;
  level_label: string;
  rate_per_student: number;
  note: string;
  sort_order: number;
};

export type PlanDisbursementStatus = "pending" | "approved" | "rejected";

/** คำขออนุมัติเบิกจ่ายงบประมาณต่อกิจกรรม — เปิดให้ทุกคนกรอกเอง (ไม่ต้องล็อกอิน) ผู้อำนวยการอนุมัติ */
export type PlanDisbursementRequest = {
  id: string;
  activity_id: string;
  requested_amount: number;
  purpose: string | null;
  requester_name: string;
  requested_by: string | null;
  requested_at: string;
  status: PlanDisbursementStatus;
  approved_by: string | null;
  approved_at: string | null;
  reject_reason: string | null;
};

/** คำขอพร้อมบริบท (กิจกรรม/โครงการ/กลุ่มบริหาร) — ใช้แสดงผล/พิมพ์ */
export type PlanDisbursementRequestWithContext = PlanDisbursementRequest & {
  activity: PlanActivity;
  project: PlanProject;
  group: PlanAdminGroup;
};
