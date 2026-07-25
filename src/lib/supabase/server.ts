import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Supabase client ฝั่งเซิร์ฟเวอร์ (server component / route handler)
 * ต้อง await เพราะ cookies() ใน Next 16 เป็น async
 */
export async function supabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // เรียกจาก server component ที่เขียน cookie ไม่ได้ — proxy.ts จัดการ refresh token ให้แล้ว
          }
        },
      },
    },
  );
}
