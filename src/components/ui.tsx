"use client";

import { useEffect, useState, type ReactNode } from "react";
import { signedPhotoUrl } from "@/lib/data";

/* ---------- ฟอร์ม ---------- */

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-1.5 text-sm font-medium text-stone-700">
        {label}
        {required ? <span className="text-rose-600">*</span> : <span className="text-xs font-normal text-stone-400">ไม่บังคับ</span>}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs leading-relaxed text-stone-500">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-base text-stone-900 " +
  "outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100 disabled:bg-stone-100";

/** ตัวเลือกแบบชิป — แตะเลือกง่ายบนมือถือ ไม่ต้องเปิด dropdown */
export function ChipGroup({
  options,
  value,
  onChange,
  allowOther,
}: {
  options: string[];
  value: string | null;
  onChange: (value: string) => void;
  allowOther?: boolean;
}) {
  const [otherMode, setOtherMode] = useState(false);
  const isOther = value !== null && value !== "" && !options.includes(value);

  if (otherMode || isOther) {
    return (
      <div className="flex gap-2">
        <input
          autoFocus={otherMode}
          className={inputClass}
          value={isOther ? value : ""}
          placeholder="พิมพ์ชื่อเอง"
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="shrink-0 rounded-lg border border-stone-300 px-3 text-sm text-stone-600"
          onClick={() => {
            setOtherMode(false);
            onChange("");
          }}
        >
          กลับไปเลือก
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={
            "rounded-full border px-3.5 py-2 text-sm transition " +
            (value === option
              ? "border-sky-700 bg-sky-700 font-medium text-white"
              : "border-stone-300 bg-white text-stone-700 hover:border-stone-400")
          }
        >
          {option}
        </button>
      ))}
      {allowOther ? (
        <button
          type="button"
          onClick={() => setOtherMode(true)}
          className="rounded-full border border-dashed border-stone-400 px-3.5 py-2 text-sm text-stone-600"
        >
          + อื่น ๆ
        </button>
      ) : null}
    </div>
  );
}

/** ปุ่ม − 1 + สำหรับจำนวน — นิ้วโป้งเดียวกดได้ */
export function QuantityStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label="ลดจำนวน"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="h-12 w-12 rounded-lg border border-stone-300 bg-white text-xl text-stone-700 active:bg-stone-100"
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        value={value}
        onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))}
        className="h-12 w-20 rounded-lg border border-stone-300 text-center text-lg font-semibold text-stone-900 outline-none focus:border-sky-600"
      />
      <button
        type="button"
        aria-label="เพิ่มจำนวน"
        onClick={() => onChange(value + 1)}
        className="h-12 w-12 rounded-lg border border-stone-300 bg-white text-xl text-stone-700 active:bg-stone-100"
      >
        +
      </button>
    </div>
  );
}

/* ---------- รูปถ่าย ---------- */

/** thumbnail จาก path ใน storage — ขอ signed URL เองแล้ว cache ไว้ */
export function PhotoThumb({
  path,
  className = "h-12 w-12",
}: {
  path: string | null;
  className?: string;
}) {
  if (!path) {
    return (
      <div className={`${className} grid shrink-0 place-items-center rounded-md bg-stone-100 text-xs text-stone-400`}>
        —
      </div>
    );
  }
  // key={path} ให้ state ของ signed URL รีเซ็ตเองเมื่อเปลี่ยนรูป
  return <SignedPhoto key={path} path={path} className={className} />;
}

function SignedPhoto({ path, className }: { path: string; className: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    signedPhotoUrl(path).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [path]);

  return (
    <div className={`${className} shrink-0 overflow-hidden rounded-md bg-stone-100`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL ของ Supabase หมดอายุ ไม่เหมาะกับ next/image optimizer
        <img src={url} alt="รูปครุภัณฑ์" className="h-full w-full object-cover" />
      ) : null}
    </div>
  );
}

/* ---------- แจ้งเตือน ---------- */

export function Alert({ tone, children }: { tone: "error" | "warn" | "ok"; children: ReactNode }) {
  const tones = {
    error: "border-rose-300 bg-rose-50 text-rose-900",
    warn: "border-amber-300 bg-amber-50 text-amber-900",
    ok: "border-emerald-300 bg-emerald-50 text-emerald-900",
  };
  return (
    <div className={`rounded-lg border px-3 py-2.5 text-sm ${tones[tone]}`} role="status">
      {children}
    </div>
  );
}

/** แถบยืนยันลอยล่างจอ ("บันทึกแล้ว") — หายเองใน 2.5 วิ */
export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
      <div className="rounded-full bg-stone-900/92 px-5 py-2.5 text-sm font-medium text-white shadow-lg">
        {message}
      </div>
    </div>
  );
}

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 2500);
    return () => clearTimeout(timer);
  }, [message]);

  return { message, show: setMessage };
}
