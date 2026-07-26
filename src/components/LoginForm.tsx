"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Alert, ButtonLabel, Field, Logo, inputClass } from "@/components/ui";
import { fetchOpenRoundName } from "@/lib/data";
import { useSchoolSettings } from "@/lib/hooks";

type Mode = "guest" | "signin" | "signup";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get("next") || "/";
  const { settings } = useSchoolSettings();
  const [roundName, setRoundName] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchOpenRoundName().then((name) => {
      if (alive) setRoundName(name);
    });
    return () => {
      alive = false;
    };
  }, []);

  const [mode, setMode] = useState<Mode>("guest");
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

  /** เข้าใช้งานทั่วไป — ไม่ต้องสมัคร ไม่ต้องกรอกชื่อ */
  async function enterAsGuest() {
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.signInAnonymously();

    if (error) {
      setBusy(false);
      setError(
        error.message.toLowerCase().includes("anonymous")
          ? "ยังไม่ได้เปิดโหมดใช้งานทั่วไปในระบบ — แจ้งผู้ดูแลให้เปิด Anonymous sign-ins ที่ Supabase (Authentication → Sign In / Providers)"
          : error.message,
      );
      return;
    }
    // ไม่เซ็ต busy เป็น false ตรงนี้ — ปล่อยให้ปุ่มค้างสถานะ "กำลังเข้าใช้งาน" ต่อจนกว่าหน้าแรกจะขึ้นจริง
    // ไม่งั้นปุ่มจะดูเหมือนหยุดทำงานเฉย ๆ ระหว่างที่หน้าแรกยังโหลดข้อมูลอยู่
    done();
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
          <h1 className="mt-1 font-display text-2xl font-bold text-stone-900">สำรวจครุภัณฑ์</h1>
          <p className="mt-1 text-sm text-stone-600">
            {roundName ?? "ยังไม่มีรอบสำรวจที่เปิดอยู่"}
          </p>
        </div>
      </div>

      {mode === "guest" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <button
              type="button"
              onClick={enterAsGuest}
              disabled={busy}
              className="w-full rounded-xl bg-sky-700 py-4 text-base font-semibold text-white transition active:bg-sky-800 disabled:opacity-60"
            >
              <ButtonLabel busy={busy}>{busy ? "กำลังเข้าใช้งาน…" : "เข้าใช้งานทั่วไป"}</ButtonLabel>
            </button>
            <p className="mt-2.5 text-center text-xs leading-relaxed text-stone-500">
              ไม่ต้องสมัคร ไม่ต้องใส่รหัส กดแล้วกรอกแบบสำรวจได้เลย
              <br />
              รายการที่กรอกจะอยู่ในเบราว์เซอร์นี้จนกดส่งให้งานพัสดุ
            </p>
          </div>

          {error ? <Alert tone="error">{error}</Alert> : null}
          {notice ? <Alert tone="ok">{notice}</Alert> : null}

          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setError(null);
            }}
            className="w-full py-2 text-sm text-sky-700"
          >
            เจ้าหน้าที่พัสดุ / ผู้ดูแลระบบ — เข้าสู่ระบบด้วยอีเมล
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
        >
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

          <div className="flex flex-col gap-1 text-center text-sm">
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
              }}
              className="py-1 text-sky-700"
            >
              {mode === "signin" ? "ยังไม่มีบัญชี — สมัครใช้งาน" : "มีบัญชีแล้ว — เข้าสู่ระบบ"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("guest");
                setError(null);
                setNotice(null);
              }}
              className="py-1 text-stone-500"
            >
              ‹ กลับไปเข้าใช้งานทั่วไป
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
