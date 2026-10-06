import type { AssetItemStatus } from "./types";

export const PHOTO_BUCKET = "asset-photos";

/** ชั้นที่เลือกได้ในฟอร์ม — โรงเรียนส่วนใหญ่ไม่เกิน 5 ชั้น */
export const FLOORS = ["1", "2", "3", "4", "5"] as const;

/**
 * สภาพครุภัณฑ์ย้ายไปเป็น master data ที่ตาราง asset_conditions แล้ว (ไม่ใช่ enum คงที่
 * อีกต่อไป) — ดึงรายการจริงผ่าน masters.conditions แทน ใช้แค่ map สี badge_color → class
 * สำหรับแสดงผล โดยมี fallback เผื่อเจอสีที่ยังไม่รู้จัก (เช่นแอดมินเพิ่มสีใหม่ทีหลัง)
 */
const CONDITION_COLOR_BADGE: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-800",
  slate: "bg-slate-100 text-slate-700",
  amber: "bg-amber-100 text-amber-800",
  navy: "bg-indigo-100 text-indigo-900",
  red: "bg-rose-100 text-rose-800",
};

const CONDITION_COLOR_TONE: Record<string, string> = {
  emerald: "border-emerald-600 bg-emerald-50 text-emerald-900",
  slate: "border-slate-500 bg-slate-50 text-slate-900",
  amber: "border-amber-600 bg-amber-50 text-amber-900",
  navy: "border-indigo-700 bg-indigo-50 text-indigo-900",
  red: "border-rose-600 bg-rose-50 text-rose-900",
};

export function conditionBadgeClass(color: string | null): string {
  return (color && CONDITION_COLOR_BADGE[color]) || "bg-stone-100 text-stone-700";
}

export function conditionToneClass(color: string | null): string {
  return (color && CONDITION_COLOR_TONE[color]) || "border-stone-600 bg-stone-50 text-stone-900";
}

export const STATUS_LABEL: Record<AssetItemStatus, string> = {
  draft: "ยังไม่ส่ง",
  submitted: "ส่งให้พัสดุแล้ว",
  approved: "พัสดุอนุมัติแล้ว",
  rejected: "ตีกลับให้แก้",
};

export const STATUS_BADGE: Record<AssetItemStatus, string> = {
  draft: "bg-stone-200 text-stone-700",
  submitted: "bg-sky-100 text-sky-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
};

/** ปีที่ได้มา กรอกเป็น พ.ศ. */
export const CURRENT_BE_YEAR = new Date().getFullYear() + 543;
