"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Alert, Field, inputClass } from "@/components/ui";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get("next") || "/";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
      setBusy(false);
      if (error) {
        setError(error.message);
        return;
      }
      if (!data.session) {
        setNotice("สมัครเรียบร้อย — กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ");
        setMode("signin");
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) {
        setError(
          error.message === "Invalid login credentials"
            ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
            : error.message,
        );
        return;
      }
    }

    router.replace(nextPath);
    router.refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-10">
      <div className="mb-6">
        <p className="font-display text-xs font-semibold tracking-wide text-sky-700">
          ระบบบริหารงบประมาณโรงเรียน
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold text-stone-900">สำรวจครุภัณฑ์</h1>
        <p className="mt-1 text-sm text-stone-600">
          {mode === "signin" ? "เข้าสู่ระบบเพื่อเริ่มกรอกแบบสำรวจ" : "สร้างบัญชีสำหรับครูผู้กรอก"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
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
                placeholder="เช่น กลุ่มสาระวิทยาศาสตร์"
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
          {busy ? "กำลังดำเนินการ…" : mode === "signin" ? "เข้าสู่ระบบ" : "สมัครใช้งาน"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
          }}
          className="w-full py-1 text-sm text-sky-700"
        >
          {mode === "signin" ? "ยังไม่มีบัญชี — สมัครใช้งาน" : "มีบัญชีแล้ว — เข้าสู่ระบบ"}
        </button>
      </form>
    </main>
  );
}
