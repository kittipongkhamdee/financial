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

/** ตัวเลือกวิธีการได้มา ตามแบบฟอร์มทะเบียนคุมทรัพย์สินของราชการ */
export const ACQUISITION_METHODS = [
  "ตกลงราคา",
  "สอบราคา",
  "ประกวดราคา",
  "วิธีพิเศษ",
  "รับบริจาค",
] as const;
export type AcquisitionMethod = (typeof ACQUISITION_METHODS)[number];

/** ข้อมูลฝั่งจัดซื้อที่ครูไม่มีให้ตอนสำรวจ — เจ้าหน้าที่พัสดุ/แอดมินกรอกเพิ่มทีหลังในหน้าตรวจสอบครุภัณฑ์ */
export type StaffAssetFields = {
  vendor_name: string | null;
  vendor_address: string | null;
  vendor_phone: string | null;
  acquisition_method: AcquisitionMethod | null;
  model: string | null;
  spec: string | null;
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
  surveyed_by: string | null;
  created_at: string;
  updated_at: string;
} & StaffAssetFields;

/**
 * ข้อมูลที่ฟอร์ม (ทั้ง 1b และ 1d) ส่งเข้ามาเพื่อบันทึก
 * ฟิลด์จาก StaffAssetFields เป็น optional ทั้งหมด — ครูกรอกได้ถ้ารู้ แต่ไม่บังคับ
 * เว้นว่างไว้ให้พัสดุ/แอดมินเติมทีหลังในหน้าตรวจสอบครุภัณฑ์ก็ได้
 */
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
} & Partial<StaffAssetFields>;

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
