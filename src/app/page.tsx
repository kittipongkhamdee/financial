import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { Logo } from "@/components/ui";

export default async function HomePage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: round }, { data: settings }] = await Promise.all([
    user
      ? supabase
          .from("asset_survey_profiles")
          .select("full_name, department, role")
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("asset_survey_rounds")
      .select("id, year, name, is_open")
      .eq("is_open", true)
      .order("year", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("asset_school_settings")
      .select("school_name, system_name, logo_path")
      .eq("id", true)
      .maybeSingle(),
  ]);

  const isStaff = profile?.role === "supply" || profile?.role === "admin";

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Logo path={settings?.logo_path ?? null} className="mt-0.5 h-9 w-9" />
          <div>
            <p className="font-display text-xs font-semibold tracking-wide text-sky-700">
              {settings?.system_name ?? "ระบบบริหารงบประมาณโรงเรียน"}
              {settings?.school_name ? ` · ${settings.school_name}` : ""} · งานพัสดุ
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold text-stone-900">
              {round?.name ?? "ยังไม่เปิดรอบสำรวจ"}
            </h1>
            {profile ? (
              <p className="mt-1 text-sm text-stone-600">
                {profile.full_name}
                {profile.department ? ` · ${profile.department}` : ""}
              </p>
            ) : null}
          </div>
        </div>
        {user ? (
          <form action="/auth/signout" method="post">
            <button className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-600">
              ออกจากระบบ
            </button>
          </form>
        ) : null}
      </header>

      {!round ? (
        <p className="mt-8 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ยังไม่มีรอบสำรวจที่เปิดอยู่ — ติดต่อเจ้าหน้าที่พัสดุเพื่อเปิดรอบปีการศึกษาใหม่
        </p>
      ) : (
        <section className="mt-6 space-y-3">
          <ModeCard
            href="/survey"
            badge="เปิดกล้องแล้วเริ่มได้เลย"
            title="สำรวจครุภัณฑ์"
            body="ไม่ต้องล็อกอิน ไม่ต้องสมัคร — เปิดกล้องก่อน ถ่ายรูปแล้วค่อยกรอกทีละคำถามชุดเล็ก ๆ เหมาะกับตอนเดินสำรวจในห้อง"
          />
          {isStaff ? (
            <ModeCard
              href="/review"
              badge="สำหรับเจ้าหน้าที่พัสดุ"
              title="ตรวจสอบครุภัณฑ์"
              body="ดูรายการที่ส่งเข้ามาทั้งหมด ออกหมายเลขครุภัณฑ์ อนุมัติหรือตีกลับให้แก้"
            />
          ) : null}
          {profile?.role === "admin" ? (
            <ModeCard
              href="/admin"
              badge="สำหรับแอดมิน"
              title="ตั้งค่าระบบ"
              body="เปิด-ปิดรอบสำรวจ จัดการอาคาร/หมวดหมู่/แหล่งงบ และสิทธิ์ผู้ใช้งาน"
            />
          ) : null}
        </section>
      )}

      {!user ? (
        <p className="mt-8 text-center text-sm">
          <Link href="/login" className="text-sky-700 underline">
            เจ้าหน้าที่พัสดุ / ผู้ดูแลระบบ — เข้าสู่ระบบด้วยอีเมล
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function ModeCard({
  href,
  badge,
  title,
  body,
}: {
  href: string;
  badge: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-stone-200 bg-white p-4 transition hover:border-sky-400 hover:shadow-sm"
    >
      <span className="font-display text-[11px] font-semibold tracking-wide text-sky-700">{badge}</span>
      <h2 className="mt-0.5 font-display text-base font-semibold text-stone-900">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-stone-600">{body}</p>
    </Link>
  );
}
