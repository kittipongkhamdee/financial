"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui";
import { useProfile, useSchoolSettings } from "@/lib/hooks";

const NAV = [
  { href: "/dashboard", label: "แดชบอร์ด", icon: ChartIcon, roles: ["supply", "admin"] as const },
  { href: "/review", label: "ตรวจสอบครุภัณฑ์", icon: ClipboardIcon, roles: ["supply", "admin"] as const },
  { href: "/plan", label: "งานแผนงาน", icon: PlanIcon, roles: ["admin"] as const },
  { href: "/plan/approve", label: "อนุมัติเบิกจ่าย", icon: ApproveIcon, roles: ["director"] as const },
  { href: "/admin", label: "ตั้งค่าระบบ", icon: GearIcon, roles: ["admin"] as const },
];

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const profile = useProfile();
  const { settings } = useSchoolSettings();
  const [open, setOpen] = useState(false);

  const items = NAV.filter((n) => !profile || n.roles.includes(profile.role as never));
  const systemName = settings?.system_name ?? "ระบบบริหารงบประมาณโรงเรียน";

  return (
    <div className="flex min-h-full flex-1 bg-[#f4f5f7]">
      {/* แถบบนมือถือ — ปุ่มเปิด sidebar */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-sky-900/10 bg-sky-800 px-4 text-white md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="เปิดเมนู"
          className="rounded-md p-1.5 hover:bg-white/10"
        >
          <MenuIcon />
        </button>
        <Logo path={settings?.logo_path ?? null} className="h-6 w-6" />
        <span className="truncate font-display text-sm font-semibold tracking-wide">{systemName}</span>
      </header>

      {open ? (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setOpen(false)} aria-hidden />
      ) : null}

      <aside
        className={
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col bg-sky-800 text-white transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 " +
          (open ? "translate-x-0" : "-translate-x-full")
        }
      >
        <div className="flex items-center gap-2.5 border-b border-gold-400/30 px-5 py-5">
          <Logo path={settings?.logo_path ?? null} className="h-8 w-8" />
          <div className="min-w-0">
            <p className="truncate font-display text-xs font-semibold tracking-wide text-gold-200">{systemName}</p>
            <p className="truncate text-sm text-sky-100">{settings?.school_name || "งานพัสดุ · สำรวจครุภัณฑ์"}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-sky-100 transition hover:bg-white/10"
          >
            <HomeIcon />
            หน้าแรก
          </Link>
          {items.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={
                  "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition " +
                  (active
                    ? "bg-gold-400 font-semibold text-sky-900"
                    : "text-sky-100 hover:bg-white/10")
                }
              >
                <Icon />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-3 py-4">
          {profile ? (
            <p className="truncate px-3 pb-2 text-xs text-sky-200">
              {profile.full_name}
              {profile.department ? ` · ${profile.department}` : ""}
            </p>
          ) : null}
          <form action="/auth/signout" method="post">
            <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-sky-100 transition hover:bg-white/10">
              <LogoutIcon />
              ออกจากระบบ
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1 pt-14 md:pt-0">{children}</div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 11l9-8 9 8M5 10v10h14V10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 20V10M12 20V4M20 20v-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4V3a1 1 0 011-1h4a1 1 0 011 1v1M9 10h6M9 14h6M9 18h3" strokeLinecap="round" />
    </svg>
  );
}

function ApproveIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 12l2 2 4-4M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7l7-4z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlanIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h8M8 11h8M8 15h5" strokeLinecap="round" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path
        d="M19.4 13a7.97 7.97 0 000-2l2-1.5-2-3.4-2.4 1a8 8 0 00-1.7-1L15 3h-4l-.3 2.6a8 8 0 00-1.7 1l-2.4-1-2 3.4L6.6 11a7.97 7.97 0 000 2l-2 1.5 2 3.4 2.4-1a8 8 0 001.7 1L11 21h4l.3-2.6a8 8 0 001.7-1l2.4 1 2-3.4-2-1.5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
