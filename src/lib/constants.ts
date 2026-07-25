import type { AssetCondition, AssetItemStatus } from "./types";

export const PHOTO_BUCKET = "asset-photos";

/** ชั้นที่เลือกได้ในฟอร์ม — โรงเรียนส่วนใหญ่ไม่เกิน 5 ชั้น */
export const FLOORS = ["1", "2", "3", "4", "5"] as const;

export const CONDITIONS: {
  value: AssetCondition;
  label: string;
  hint: string;
  tone: string;
}[] = [
  {
    value: "usable",
    label: "ใช้งานได้",
    hint: "ปกติ ใช้สอนได้ตามเดิม",
    tone: "border-emerald-600 bg-emerald-50 text-emerald-900",
  },
  {
    value: "damaged",
    label: "ชำรุด",
    hint: "ใช้ไม่ได้/ใช้ได้บางส่วน — พัสดุจะตามซ่อม",
    tone: "border-amber-600 bg-amber-50 text-amber-900",
  },
  {
    value: "disposal",
    label: "รอจำหน่าย",
    hint: "ซ่อมไม่คุ้ม เสนอจำหน่ายออกจากทะเบียน",
    tone: "border-rose-600 bg-rose-50 text-rose-900",
  },
];

export const CONDITION_LABEL: Record<AssetCondition, string> = {
  usable: "ใช้งานได้",
  damaged: "ชำรุด",
  disposal: "รอจำหน่าย",
};

export const CONDITION_BADGE: Record<AssetCondition, string> = {
  usable: "bg-emerald-100 text-emerald-800",
  damaged: "bg-amber-100 text-amber-800",
  disposal: "bg-rose-100 text-rose-800",
};

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
