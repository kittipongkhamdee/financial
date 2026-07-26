"use client";

import { supabaseBrowser } from "./supabase/client";
import { PHOTO_BUCKET } from "./constants";
import { compressImage } from "./image";
import type {
  AssetItem,
  AssetItemDraft,
  AssetItemStatus,
  CategoryRow,
  Masters,
  MasterRow,
  SchoolSettings,
  SurveyProfile,
} from "./types";

/** ข้อความ error ที่อ่านรู้เรื่อง — ครูไม่ควรเห็น error code ของ Postgres */
export function humanizeError(error: unknown): string {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return "เกิดข้อผิดพลาดไม่ทราบสาเหตุ";
  if (e.code === "23505") return "หมายเลขครุภัณฑ์นี้มีอยู่ในระบบแล้ว — ตรวจสอบเลขอีกครั้ง";
  if (e.code === "23503") return "ลบไม่ได้ เพราะยังมีรายการครุภัณฑ์ผูกอยู่กับบัญชีนี้";
  if (e.code === "22023") return "ลบบัญชีตัวเองไม่ได้";
  if (e.code === "42501") return "ไม่มีสิทธิ์ทำรายการนี้ (อาจส่งให้พัสดุแล้ว หรือไม่ใช่แอดมิน)";
  if (e.message?.includes("Failed to fetch")) return "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ตรวจสอบสัญญาณอินเทอร์เน็ต";
  return e.message ?? "เกิดข้อผิดพลาดไม่ทราบสาเหตุ";
}

export async function fetchProfile(): Promise<SurveyProfile | null> {
  const supabase = supabaseBrowser();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("asset_survey_profiles")
    .select("user_id, full_name, department, role")
    .eq("user_id", user.id)
    .maybeSingle();

  return (data as SurveyProfile | null) ?? {
    user_id: user.id,
    full_name: user.email ?? "ผู้ใช้",
    department: null,
    role: "teacher",
  };
}

/** ดึง master data + รอบสำรวจที่เปิดอยู่ ครั้งเดียวต่อการเปิดหน้า */
export async function fetchMasters(): Promise<Masters> {
  const supabase = supabaseBrowser();
  const master = (table: string) =>
    supabase.from(table).select("id, name, sort_order, is_active").eq("is_active", true).order("sort_order");

  const [round, buildings, categories, budgetSources, units] = await Promise.all([
    supabase
      .from("asset_survey_rounds")
      .select("id, year, name, is_open")
      .eq("is_open", true)
      .order("year", { ascending: false })
      .limit(1)
      .maybeSingle(),
    master("asset_buildings"),
    supabase
      .from("asset_categories")
      .select("id, name, sort_order, is_active, useful_life_years, depreciation_rate_percent")
      .eq("is_active", true)
      .order("sort_order"),
    master("asset_budget_sources"),
    master("asset_units"),
  ]);

  return {
    round: (round.data as Masters["round"]) ?? null,
    buildings: buildings.data ?? [],
    categories: categories.data ?? [],
    budgetSources: budgetSources.data ?? [],
    units: units.data ?? [],
  };
}

export async function fetchMyItems(roundId: string): Promise<AssetItem[]> {
  const supabase = supabaseBrowser();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("asset_items")
    .select("*")
    .eq("round_id", roundId)
    .eq("surveyed_by", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as AssetItem[]) ?? [];
}

/**
 * รายการครุภัณฑ์สำหรับพิมพ์ทะเบียนคุมทรัพย์สิน — ไม่กรองตาม surveyed_by เอง
 * RLS จะจำกัดให้เห็นตามสิทธิ์จริงอยู่แล้ว (ครูเห็นเฉพาะของตัวเอง / งานพัสดุ-แอดมินเห็นทั้งหมด)
 */
export async function fetchRegisterItems(roundId: string): Promise<AssetItem[]> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase
    .from("asset_items")
    .select("*")
    .eq("round_id", roundId)
    .order("building")
    .order("room")
    .order("name");

  if (error) throw error;
  return (data as AssetItem[]) ?? [];
}

/**
 * คิวตรวจสอบของงานพัสดุ — ต้อง role supply/admin เท่านั้นถึงจะเห็นของทุกคน (RLS asset_is_staff())
 * ครูทั่วไปที่หลงเข้ามาจะเห็นแค่ของตัวเอง ไม่ใช่ error แต่หน้าจะกันไว้อีกชั้นด้วย role check
 */
export async function fetchReviewItems(roundId: string): Promise<AssetItem[]> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase
    .from("asset_items")
    .select("*")
    .eq("round_id", roundId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data as AssetItem[]) ?? [];
}

/** ชื่อครูผู้กรอก — asset_items.surveyed_by อ้างถึง auth.users ตรง ๆ ไม่ผ่าน FK ไปตาราง profiles จึงต้องดึงแยก */
export async function fetchProfilesByIds(
  ids: string[],
): Promise<Map<string, Pick<SurveyProfile, "full_name" | "department">>> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return new Map();

  const supabase = supabaseBrowser();
  const { data, error } = await supabase
    .from("asset_survey_profiles")
    .select("user_id, full_name, department")
    .in("user_id", uniqueIds);

  if (error) throw error;
  const rows = (data ?? []) as { user_id: string; full_name: string; department: string | null }[];
  return new Map(rows.map((p) => [p.user_id, { full_name: p.full_name, department: p.department }]));
}

/** งานพัสดุแก้ไขรายการของครูคนไหนก็ได้ (asset_items_staff_all policy) — ใช้แก้เลขครุภัณฑ์/ข้อมูลก่อนอนุมัติ */
export async function updateItemAsStaff(
  id: string,
  patch: Partial<AssetItemDraft>,
): Promise<AssetItem> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase
    .from("asset_items")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as AssetItem;
}

export async function approveItems(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = supabaseBrowser();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("เซสชันหมดอายุ — กรุณาเข้าสู่ระบบอีกครั้ง");

  const { error } = await supabase
    .from("asset_items")
    .update({ status: "approved", reject_reason: null, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .in("id", ids);

  if (error) throw error;
}

export async function rejectItem(id: string, reason: string): Promise<void> {
  const supabase = supabaseBrowser();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("เซสชันหมดอายุ — กรุณาเข้าสู่ระบบอีกครั้ง");

  const { error } = await supabase
    .from("asset_items")
    .update({
      status: "rejected",
      reject_reason: reason.trim(),
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
}

export async function insertItem(
  roundId: string,
  draft: AssetItemDraft,
  photoPath: string | null,
  status: AssetItemStatus = "draft",
): Promise<AssetItem> {
  const supabase = supabaseBrowser();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("เซสชันหมดอายุ — กรุณาเข้าสู่ระบบอีกครั้ง");

  const { data, error } = await supabase
    .from("asset_items")
    .insert({
      ...draft,
      asset_code: draft.asset_code?.trim() || null,
      round_id: roundId,
      photo_path: photoPath,
      surveyed_by: user.id,
      status,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as AssetItem;
}

export async function updateItem(
  id: string,
  patch: Partial<AssetItemDraft> & { photo_path?: string | null },
): Promise<AssetItem> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase
    .from("asset_items")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as AssetItem;
}

export async function deleteItem(id: string): Promise<void> {
  const supabase = supabaseBrowser();
  const { error } = await supabase.from("asset_items").delete().eq("id", id);
  if (error) throw error;
}

/** ส่งรายการที่ยังไม่ส่งทั้งหมดของรอบนี้ให้งานพัสดุตรวจสอบ */
export async function submitDrafts(roundId: string): Promise<number> {
  const supabase = supabaseBrowser();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("เซสชันหมดอายุ — กรุณาเข้าสู่ระบบอีกครั้ง");

  const { data, error } = await supabase
    .from("asset_items")
    .update({ status: "submitted", reject_reason: null })
    .eq("round_id", roundId)
    .eq("surveyed_by", user.id)
    .in("status", ["draft", "rejected"])
    .select("id");

  if (error) throw error;
  return data?.length ?? 0;
}

/** เตือนเลขซ้ำก่อนบันทึก (unique index เป็นด่านสุดท้าย) */
export async function findByAssetCode(
  roundId: string,
  assetCode: string,
): Promise<Pick<AssetItem, "id" | "name" | "room"> | null> {
  const code = assetCode.trim();
  if (!code) return null;

  const supabase = supabaseBrowser();
  const { data } = await supabase
    .from("asset_items")
    .select("id, name, room")
    .eq("round_id", roundId)
    .eq("asset_code", code)
    .limit(1)
    .maybeSingle();

  return (data as Pick<AssetItem, "id" | "name" | "room"> | null) ?? null;
}

/**
 * อัปโหลดรูปเข้า bucket ที่ทุกคนดูร่วมกันได้ แล้วคืน path ที่เก็บลง asset_items.photo_path
 * บีบอัด/ย่อรูปฝั่งเบราว์เซอร์ก่อนเสมอ — path ไม่แยกตามผู้กรอกแล้ว (ดูรูปของกันและกันได้)
 */
export async function uploadPhoto(file: File): Promise<string> {
  const supabase = supabaseBrowser();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("เซสชันหมดอายุ — กรุณาเข้าสู่ระบบอีกครั้ง");

  const { blob, ext, contentType } = await compressImage(file);
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
    cacheControl: "3600",
    upsert: false,
    contentType,
  });

  if (error) throw error;
  return path;
}

export async function removePhoto(path: string): Promise<void> {
  const supabase = supabaseBrowser();
  await supabase.storage.from(PHOTO_BUCKET).remove([path]);
}

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

/** ทิ้ง URL ที่ใช้ไม่ได้แล้ว (เช่นหมดอายุระหว่างเปิดหน้าไว้นาน) เพื่อขอใหม่ */
export function invalidatePhotoUrl(path: string) {
  signedUrlCache.delete(path);
}

/** signed URL อายุ 1 ชม. — cache ไว้ในหน่วยความจำ ไม่ต้องขอซ้ำทุกครั้งที่ re-render */
export async function signedPhotoUrl(path: string): Promise<string | null> {
  const hit = signedUrlCache.get(path);
  if (hit && hit.expiresAt > Date.now()) return hit.url;

  const supabase = supabaseBrowser();
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 3600);
  if (!data?.signedUrl) return null;

  signedUrlCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + 3_000_000 });
  return data.signedUrl;
}

/* -----------------------------------------------------------------------------
 * หน้า admin — จัดการ master data / รอบสำรวจ / สิทธิ์ผู้ใช้
 * RLS: master data + รอบสำรวจ เขียนได้ทั้ง supply/admin (asset_is_staff()),
 * ส่วนสิทธิ์ผู้ใช้ (asset_survey_profiles) แก้ role คนอื่นได้เฉพาะ admin เท่านั้น
 * -------------------------------------------------------------------------- */

export type MasterTable =
  | "asset_buildings"
  | "asset_categories"
  | "asset_budget_sources"
  | "asset_units";

/** เห็นทุกแถวรวมที่ปิดใช้งานแล้ว — ต่างจาก fetchMasters ที่กรองเฉพาะ is_active สำหรับฟอร์มครู */
export async function fetchAllMasterRows(table: MasterTable): Promise<(MasterRow | CategoryRow)[]> {
  const supabase = supabaseBrowser();
  const columns =
    table === "asset_categories"
      ? "id, name, sort_order, is_active, useful_life_years, depreciation_rate_percent"
      : "id, name, sort_order, is_active";
  const { data, error } = await supabase.from(table).select(columns).order("sort_order");
  if (error) throw error;
  return (data as (MasterRow | CategoryRow)[]) ?? [];
}

export async function createMasterRow(
  table: MasterTable,
  row: { name: string; sort_order: number; useful_life_years?: number | null; depreciation_rate_percent?: number | null },
): Promise<void> {
  const supabase = supabaseBrowser();
  const { error } = await supabase.from(table).insert(row);
  if (error) throw error;
}

export async function updateMasterRow(
  table: MasterTable,
  id: string,
  patch: Partial<{
    name: string;
    sort_order: number;
    is_active: boolean;
    useful_life_years: number | null;
    depreciation_rate_percent: number | null;
  }>,
): Promise<void> {
  const supabase = supabaseBrowser();
  const { error } = await supabase.from(table).update(patch).eq("id", id);
  if (error) throw error;
}

export type SurveyRoundRow = { id: string; year: number; name: string; is_open: boolean };

export async function fetchAllRounds(): Promise<SurveyRoundRow[]> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase
    .from("asset_survey_rounds")
    .select("id, year, name, is_open")
    .order("year", { ascending: false });
  if (error) throw error;
  return (data as SurveyRoundRow[]) ?? [];
}

export async function createRound(year: number, name: string, openNow: boolean): Promise<void> {
  const supabase = supabaseBrowser();
  if (openNow) {
    const { error: closeError } = await supabase
      .from("asset_survey_rounds")
      .update({ is_open: false })
      .eq("is_open", true);
    if (closeError) throw closeError;
  }
  const { error } = await supabase.from("asset_survey_rounds").insert({ year, name, is_open: openNow });
  if (error) throw error;
}

/** เปิดรอบนี้ — ปิดรอบอื่นที่เปิดค้างอยู่ทั้งหมดก่อน ให้เหลือรอบเปิดพร้อมกันแค่รอบเดียว */
export async function openRound(id: string): Promise<void> {
  const supabase = supabaseBrowser();
  const { error: closeError } = await supabase
    .from("asset_survey_rounds")
    .update({ is_open: false })
    .eq("is_open", true);
  if (closeError) throw closeError;

  const { error } = await supabase.from("asset_survey_rounds").update({ is_open: true }).eq("id", id);
  if (error) throw error;
}

export async function closeRound(id: string): Promise<void> {
  const supabase = supabaseBrowser();
  const { error } = await supabase.from("asset_survey_rounds").update({ is_open: false }).eq("id", id);
  if (error) throw error;
}

export type AdminUserRow = {
  user_id: string;
  email: string | null;
  full_name: string;
  department: string | null;
  role: SurveyProfile["role"];
  is_anonymous: boolean;
  created_at: string;
};

/** เห็นรายชื่อทุกคนเฉพาะตอนที่ตัวเองเป็น admin เท่านั้น (เช็คในฟังก์ชันฝั่ง DB อีกชั้น) */
export async function fetchAdminUsers(): Promise<AdminUserRow[]> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase.rpc("asset_admin_list_users");
  if (error) throw error;
  return (data as AdminUserRow[]) ?? [];
}

export async function updateUserRole(userId: string, role: SurveyProfile["role"]): Promise<void> {
  const supabase = supabaseBrowser();
  const { error } = await supabase.from("asset_survey_profiles").update({ role }).eq("user_id", userId);
  if (error) throw error;
}

/** ลบบัญชีถาวร — ต้อง admin เท่านั้น (เช็คในฟังก์ชันฝั่ง DB) ลบตัวเองไม่ได้
 *  ลบไม่ได้ถ้ามีรายการครุภัณฑ์ผูกอยู่ (asset_items.surveyed_by on delete restrict) */
export async function deleteUser(userId: string): Promise<void> {
  const supabase = supabaseBrowser();
  const { error } = await supabase.rpc("asset_admin_delete_user", { target_user_id: userId });
  if (error) throw error;
}

/* -----------------------------------------------------------------------------
 * ตั้งค่าระบบ — ชื่อโรงเรียน / ชื่อระบบ / โลโก้ (แถวเดียว อ่านได้ทุกคนแม้ยังไม่ล็อกอิน)
 * -------------------------------------------------------------------------- */

export const LOGO_BUCKET = "system-branding";

export async function fetchSchoolSettings(): Promise<SchoolSettings> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase
    .from("asset_school_settings")
    .select("school_name, system_name, logo_path")
    .eq("id", true)
    .maybeSingle();

  if (error) throw error;
  return (data as SchoolSettings | null) ?? { school_name: null, system_name: "ระบบบริหารงบประมาณโรงเรียน", logo_path: null };
}

/** ชื่อรอบสำรวจที่เปิดอยู่ — ใช้ได้แม้ยังไม่ล็อกอิน (หน้า login) ไม่มีรอบเปิดอยู่ก็คืน null */
export async function fetchOpenRoundName(): Promise<string | null> {
  const supabase = supabaseBrowser();
  const { data, error } = await supabase
    .from("asset_survey_rounds")
    .select("name")
    .eq("is_open", true)
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.name ?? null;
}

export async function updateSchoolSettings(
  patch: Partial<Pick<SchoolSettings, "school_name" | "system_name" | "logo_path">>,
): Promise<void> {
  const supabase = supabaseBrowser();
  const { error } = await supabase.from("asset_school_settings").update(patch).eq("id", true);
  if (error) throw error;
}

/** อัปโหลดโลโก้เข้า bucket สาธารณะ คืน public URL ไว้แสดงได้ทันทีไม่ต้องขอ signed URL */
export async function uploadLogo(file: File): Promise<{ path: string; url: string }> {
  const supabase = supabaseBrowser();
  const ext = file.name.split(".").pop() ?? "png";
  const path = `logo-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(LOGO_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

export function logoPublicUrl(path: string): string {
  const supabase = supabaseBrowser();
  return supabase.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
}
