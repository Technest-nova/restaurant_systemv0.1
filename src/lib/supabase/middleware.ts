import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env"

const PROTECTED = ["/dashboard", "/ingredients", "/dishes", "/import", "/matching", "/menu-engineering", "/delivery", "/simulator", "/settings", "/onboarding"]

/** Refreshes the auth cookie on every request and guards app routes server-side. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return response

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  // Do not run code between createServerClient and getUser(): it refreshes the session.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isProtected = PROTECTED.some((p) => path === p || path.startsWith(p + "/"))

  const redirect = (to: string) => {
    const url = request.nextUrl.clone()
    url.pathname = to
    url.search = ""
    if (to === "/login") url.searchParams.set("next", path)
    const res = NextResponse.redirect(url)
    response.cookies.getAll().forEach((c) => res.cookies.set(c))
    return res
  }

  if (!user && isProtected) return redirect("/login")
  if (user && path === "/login") return redirect("/dashboard")
  return response
}
