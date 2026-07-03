import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/login", "/register", "/onboarding", "/widget", "/v/", "/", "/forgot-password", "/reset-password", "/admin-login", "/admin"];
const AUTH_ROUTES = ["/login", "/register"];

export async function proxy(request: NextRequest) {
  const hostname = request.headers.get('host') ?? '';
  const { pathname } = request.nextUrl;

  // Rewrite call.kothabot.ai.bd/{slug} → /v/{slug}
  if (hostname.startsWith('call.')) {
    if (
      pathname !== '/' &&
      !pathname.startsWith('/v/') &&
      !pathname.startsWith('/api/') &&
      !pathname.startsWith('/_next/') &&
      !pathname.startsWith('/favicon')
    ) {
      const slug = pathname.replace(/^\//, '');
      if (slug) {
        const url = request.nextUrl.clone();
        url.pathname = `/v/${slug}`;
        return NextResponse.rewrite(url);
      }
    }
    // For the call. subdomain, skip auth checks — public pages
    return NextResponse.next({ request });
  }

  // Also make /v/* routes public (no auth required)
  if (pathname.startsWith('/v/')) {
    return NextResponse.next({ request });
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  let supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect authenticated users away from auth pages (and the root "/", which
  // now renders the login page directly) straight to their dashboard.
  if (user && (pathname === "/" || AUTH_ROUTES.some((r) => pathname.startsWith(r)))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Redirect unauthenticated users to login
  if (!user && !PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Enforce billing lock for unpaid (past_due) subscriptions on dashboard pages
  if (user) {
    const isDashboardRoute = !PUBLIC_ROUTES.some((r) => pathname.startsWith(r)) && 
                             !pathname.startsWith('/admin') && 
                             !pathname.startsWith('/billing');
                             
    if (isDashboardRoute) {
      const { data: shop } = await supabase
        .from("shops")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (shop?.id) {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("status")
          .eq("shop_id", shop.id)
          .maybeSingle();

        if (sub?.status === 'past_due') {
          return NextResponse.redirect(new URL("/billing?pay=true", request.url));
        }
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
