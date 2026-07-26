"use client";

import { supabaseBrowser } from "./supabase/client";
import { PHOTO_BUCKET } from "./constants";
import { compressImage } from "./image";
import type { AssetItem, AssetItemDraft, AssetItemStatus, Masters, SurveyProfile } from "./types";

/** ข้อความ error ที่อ่านรู้เรื่อง — ครูไม่ควรเห็น error code ของ Postgres */
export function humanizeError(error: unknown): string {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return "เกิดข้อผิดพลาดไม่ทราบสาเหตุ";
  if (e.code === "23505") return "หมายเลขครุภัณฑ์นี้มีอยู่ในระบบแล้ว — ตรวจสอบเลขอีกครั้ง";
  if (e.code === "42501") return "ไม่มีสิทธิ์แก้ไขรายการนี้ (อาจส่งให้พัสดุแล้ว)";
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
