import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="flex-1 px-5 py-10 text-center text-sm text-stone-500">กำลังโหลด…</main>}>
      <LoginForm />
    </Suspense>
  );
}
