"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useSchoolSettings } from "@/lib/hooks";

/** หน้าที่ต้องเข้าได้เสมอแม้ปิดระบบ — ไม่งั้นแอดมินจะล็อกอิน/ออกจากระบบเพื่อมาเปิดกลับไม่ได้ */
const BYPASS_PREFIXES = ["/login", "/auth"];

/**
 * ครอบทุกหน้า (วางที่ root layout) — ถ้าแอดมินกดปิดระบบไว้ที่ /admin จะบังคับทุกคนเห็น
 * ข้อความ "ปิดระบบชั่วคราว" แทนเนื้อหาจริง ยกเว้น admin เอง (ไม่งั้นจะไม่มีใครเปิดกลับได้)
 *
 * เช็คสิทธิ์ผู้ใช้ด้วย onAuthStateChange แทนการ fetch ครั้งเดียวตอน mount เพราะ component นี้
 * อยู่ที่ root layout ซึ่งไม่ remount ตอนย้ายหน้าแบบ client-side (เช่นหลังล็อกอินจาก /login
 * ไป /dashboard) ถ้าเช็คครั้งเดียวจะเห็นสถานะ "ยังไม่ล็อกอิน" ค้างอยู่
 */
export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { settings } = useSchoolSettings();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;
    const supabase = supabaseBrowser();

    async function checkRole(userId: string | undefined) {
      if (!userId) {
        if (alive) {
          setIsAdmin(false);
          setChecked(true);
        }
        return;
      }
      const { data } = await supabase
        .from("asset_survey_profiles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      if (alive) {
        setIsAdmin(data?.role === "admin");
        setChecked(true);
      }
    }

    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => checkRole(data.session?.user.id));
    const { data: sub } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      checkRole(session?.user.id);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const bypass = BYPASS_PREFIXES.some((p) => pathname?.startsWith(p));
  // ยังไม่รู้สถานะปิดระบบ/สิทธิ์ผู้ใช้ — แสดงเนื้อหาไปก่อน กันหน้าขึ้นช้าตอนปกติ (ปิดระบบนาน ๆ ครั้ง
  // ยอมให้เห็นเนื้อหาจริงแวบหนึ่งก่อนสลับเป็นข้อความปิดระบบได้)
  const blocked = !bypass && checked && settings?.maintenance_mode === true && !isAdmin;

  if (!blocked) return <>{children}</>;

  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="font-display text-2xl font-bold text-stone-900">ปิดระบบชั่วคราว</p>
      <p className="text-sm text-stone-600">ระบบอยู่ระหว่างปรับปรุง ขออภัยในความไม่สะดวก</p>
    </main>
  );
}
