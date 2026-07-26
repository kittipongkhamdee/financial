"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Alert, ButtonLabel, Field, Logo, inputClass } from "@/components/ui";
import { useSchoolSettings } from "@/lib/hooks";

type Mode = "signin" | "signup";

/** เข้าสู่ระบบสำหรับเจ้าหน้าที่พัสดุ/แอดมินเท่านั้น — ครูกรอกแบบสำรวจได้เลยที่ /survey ไม่ต้องล็อกอิน */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get("next") || "/";
  const { settings } = useSchoolSettings();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function done() {
    router.replace(nextPath);
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    const supabase = supabaseBrowser();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName.trim(), department: department.trim() } },
      });
      if (error) {
        setBusy(false);
        setError(error.message);
        return;
      }
      if (!data.session) {
        setBusy(false);
        setNotice("สมัครเรียบร้อย — กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ");
        setMode("signin");
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setBusy(false);
        setError(
          error.message === "Invalid login credentials"
            ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
            : error.message,
        );
        return;
      }
    }

    // ไม่เซ็ต busy เป็น false ตรงนี้ — ปล่อยให้ปุ่มค้างสถานะ "กำลังดำเนินการ" ต่อจนกว่าหน้าแรกจะขึ้นจริง
    done();
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-10">
      <div className="mb-6 flex items-start gap-3">
        <Logo path={settings?.logo_path ?? null} className="mt-0.5 h-10 w-10" />
        <div>
          <p className="font-display text-xs font-semibold tracking-wide text-sky-700">
            {settings?.system_name ?? "ระบบบริหารงบประมาณโรงเรียน"}
            {settings?.school_name ? ` · ${settings.school_name}` : ""}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-stone-900">เข้าสู่ระบบ</h1>
          <p className="mt-1 text-sm text-stone-600">สำหรับเจ้าหน้าที่พัสดุ / ผู้ดูแลระบบ</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <p className="font-display text-sm font-semibold text-stone-800">
          {mode === "signin" ? "เข้าสู่ระบบด้วยอีเมล" : "สร้างบัญชีเจ้าหน้าที่"}
        </p>

        {mode === "signup" ? (
          <>
            <Field label="ชื่อ–สกุล" required>
              <input
                className={inputClass}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="เช่น สมพร ใจดี"
                required
              />
            </Field>
            <Field label="กลุ่มสาระ / ฝ่าย">
              <input
                className={inputClass}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="เช่น งานพัสดุ"
              />
            </Field>
          </>
        ) : null}

        <Field label="อีเมล" required>
          <input
            type="email"
            autoComplete="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>

        <Field label="รหัสผ่าน" required>
          <input
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </Field>

        {error ? <Alert tone="error">{error}</Alert> : null}
        {notice ? <Alert tone="ok">{notice}</Alert> : null}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-sky-700 py-3 text-base font-semibold text-white transition active:bg-sky-800 disabled:opacity-60"
        >
          <ButtonLabel busy={busy}>
            {busy ? "กำลังดำเนินการ…" : mode === "signin" ? "เข้าสู่ระบบ" : "สมัครใช้งาน"}
          </ButtonLabel>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
          }}
          className="w-full py-1 text-center text-sm text-sky-700"
        >
          {mode === "signin" ? "ยังไม่มีบัญชี — สมัครใช้งาน" : "มีบัญชีแล้ว — เข้าสู่ระบบ"}
        </button>
      </form>
    </main>
  );
}
