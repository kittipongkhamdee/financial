import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/", "/survey", "/login", "/auth"];

/**
 * Next 16 เรียก middleware ว่า proxy — หน้าที่คือต่ออายุ session ของ Supabase
 * และกันคนที่ยังไม่ล็อกอินออกจากหน้าที่ต้องล็อกอิน (เฉพาะฝั่งเจ้าหน้าที่พัสดุ/แอดมิน
 * เท่านั้น — แบบสำรวจ (/, /survey) เปิดสาธารณะ ไม่ต้องล็อกอินเหมือน Google Form)
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // ต่อ Supabase ไม่ได้ (เน็ตหลุด/ค่า env ผิด) → ถือว่ายังไม่ล็อกอิน ดีกว่าโชว์ 500 ให้ครู
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // ล็อกอินอยู่แล้ว (เจ้าหน้าที่พัสดุ/แอดมิน) ไม่ต้องเห็นหน้า /login อีก
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico)$).*)"],
};
