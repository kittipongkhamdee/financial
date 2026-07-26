/** ชนิดข้อมูลกลางของเฟส 1 — ตรงกับ supabase/migrations/20260725000000_asset_survey_phase1.sql */

export type AssetCondition = "usable" | "damaged" | "disposal";
export type AssetItemStatus = "draft" | "submitted" | "approved" | "rejected";
export type AssetUserRole = "teacher" | "supply" | "admin";

export type MasterRow = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

/** หมวดครุภัณฑ์ — มีอายุการใช้งาน/อัตราค่าเสื่อมราคาตามตาราง สพฐ. ไว้คำนวณค่าเสื่อมราคา */
export type CategoryRow = MasterRow & {
  useful_life_years: number | null;
  depreciation_rate_percent: number | null;
};

export type SurveyRound = {
  id: string;
  year: number;
  name: string;
  is_open: boolean;
};

export type SurveyProfile = {
  user_id: string;
  full_name: string;
  department: string | null;
  role: AssetUserRole;
};

export type AssetItem = {
  id: string;
  round_id: string;
  building: string;
  floor: string | null;
  room: string;
  category_id: string | null;
  name: string;
  quantity: number;
  unit: string | null;
  asset_code: string | null;
  untagged: boolean;
  condition: AssetCondition;
  note: string | null;
  acquired_year: number | null;
  budget_source_id: string | null;
  price: number | null;
  photo_path: string | null;
  status: AssetItemStatus;
  reject_reason: string | null;
  surveyed_by: string;
  created_at: string;
  updated_at: string;
};

/** ข้อมูลที่ฟอร์ม (ทั้ง 1b และ 1d) ส่งเข้ามาเพื่อบันทึก */
export type AssetItemDraft = {
  building: string;
  floor: string | null;
  room: string;
  category_id: string | null;
  name: string;
  quantity: number;
  unit: string | null;
  asset_code: string | null;
  untagged: boolean;
  condition: AssetCondition;
  note: string | null;
  acquired_year: number | null;
  budget_source_id: string | null;
  price: number | null;
};

/** ตำแหน่งที่จำไว้ให้ครูไม่ต้องเลือกซ้ำทุกรายการ */
export type RoomLocation = {
  building: string;
  floor: string | null;
  room: string;
};

export type Masters = {
  round: SurveyRound | null;
  buildings: MasterRow[];
  categories: CategoryRow[];
  budgetSources: MasterRow[];
  units: MasterRow[];
};

/** ตั้งค่าระบบ — ชื่อโรงเรียน/ชื่อระบบ/โลโก้ อ่านได้ทุกคนแม้ยังไม่ล็อกอิน แก้ได้เฉพาะ admin */
export type SchoolSettings = {
  school_name: string | null;
  system_name: string;
  logo_path: string | null;
};
