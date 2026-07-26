import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { Logo } from "@/components/ui";
import { formatBaht, formatCount } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/constants";
import type { AssetItemStatus } from "@/lib/types";

export default async function HomePage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: round }, { data: settings }] = await Promise.all([
    supabase
      .from("asset_survey_profiles")
      .select("full_name, department, role")
      .eq("user_id", user!.id)
      .maybeSingle(),
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

  const { data: items } = round
    ? await supabase
        .from("asset_items")
        .select("status, price, quantity, room")
        .eq("round_id", round.id)
        .eq("surveyed_by", user!.id)
    : { data: [] };

  const rows = items ?? [];
  const byStatus = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const totalValue = rows.reduce((sum, r) => sum + (r.price ?? 0) * (r.quantity ?? 1), 0);
  const rooms = new Set(rows.map((r) => r.room)).size;

  const isGuest = user!.is_anonymous === true;
  const unsent = (byStatus.draft ?? 0) + (byStatus.rejected ?? 0);

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
            <p className="mt-1 text-sm text-stone-600">
              {isGuest ? "โหมดใช้งานทั่วไป — ไม่ต้องล็อกอิน" : profile?.full_name ?? "ครูผู้กรอก"}
              {!isGuest && profile?.department ? ` · ${profile.department}` : ""}
            </p>
          </div>
        </div>
        <form action="/auth/signout" method="post">
          <button className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-600">
            {isGuest ? "ออกจากโหมดนี้" : "ออกจากระบบ"}
          </button>
        </form>
      </header>

      {isGuest ? (
        <p className="mt-4 rounded-xl border border-stone-200 bg-white px-4 py-3 text-xs leading-relaxed text-stone-600">
          กรอกทีละรายการแล้วส่งให้งานพัสดุทันที ไม่ต้องกดส่งซ้ำภายหลัง
          {unsent > 0 ? (
            <>
              {" "}
              — ยังมี <strong className="text-stone-900">{unsent}</strong> รายการค้างส่ง (ถูกตีกลับให้แก้)
            </>
          ) : null}
          <br />
          การเข้าใช้งานแบบนี้ผูกกับเบราว์เซอร์นี้เท่านั้น — ถ้าออกจากโหมดนี้หรือล้างข้อมูลเบราว์เซอร์
          จะย้อนดูประวัติของตัวเองไม่ได้ (แต่รายการที่ส่งแล้วปลอดภัย เจ้าหน้าที่พัสดุเห็นได้เสมอ) เจ้าหน้าที่พัสดุ{" "}
          <Link href="/login" className="text-sky-700 underline">
            เข้าสู่ระบบด้วยอีเมล
          </Link>{" "}
          เพื่อดูรายการของทุกคน
        </p>
      ) : null}

      {!round ? (
        <p className="mt-8 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ยังไม่มีรอบสำรวจที่เปิดอยู่ — ติดต่อเจ้าหน้าที่พัสดุเพื่อเปิดรอบปีการศึกษาใหม่
        </p>
      ) : (
        <>
          <section className="mt-6 grid grid-cols-3 gap-3">
            <Stat label="รายการที่กรอกแล้ว" value={formatCount(rows.length)} unit="รายการ" />
            <Stat label="ห้องที่สำรวจแล้ว" value={formatCount(rooms)} unit="ห้อง" />
            <Stat label="มูลค่ารวม" value={formatBaht(totalValue)} unit="บาท" />
          </section>

          <section className="mt-6 space-y-3">
            <ModeCard
              href="/survey"
              badge="สำหรับมือถือ"
              title="กรอกทีละขั้น — ถ่ายรูปนำ"
              body="เปิดกล้องก่อน ถ่ายรูปแล้วค่อยกรอกทีละคำถามชุดเล็ก ๆ เหมาะกับตอนเดินสำรวจในห้อง"
            />
            <ModeCard
              href="/items"
              badge="ประวัติของฉัน"
              title="รายการของฉัน"
              body="ดูรายการที่ส่งแล้ว พิมพ์ทะเบียนคุมทรัพย์สิน หรือแก้ไขรายการที่ถูกตีกลับให้แก้"
            />
            {profile?.role === "supply" || profile?.role === "admin" ? (
              <ModeCard
                href="/review"
                badge="สำหรับเจ้าหน้าที่พัสดุ"
                title="ตรวจสอบครุภัณฑ์"
                body="ดูรายการที่ครูส่งมาจากทุกคน ออกหมายเลขครุภัณฑ์ อนุมัติหรือตีกลับให้แก้"
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

          {rows.length > 0 ? (
            <section className="mt-6 rounded-xl border border-stone-200 bg-white p-4">
              <h2 className="font-display text-sm font-semibold text-stone-800">สถานะรายการของฉัน</h2>
              <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-stone-600">
                {(Object.keys(STATUS_LABEL) as AssetItemStatus[])
                  .filter((s) => byStatus[s])
                  .map((s) => (
                    <li key={s}>
                      {STATUS_LABEL[s]} <span className="font-semibold text-stone-900">{byStatus[s]}</span>
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-3 py-3">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-1 font-display text-xl font-bold leading-tight text-stone-900">{value}</p>
      <p className="text-xs text-stone-400">{unit}</p>
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
