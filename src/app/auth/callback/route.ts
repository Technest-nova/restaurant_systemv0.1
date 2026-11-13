import { NextResponse, type NextRequest } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"
import { supabaseServer } from "@/lib/supabase/server"

/**
 * Landing point for every email/OAuth link:
 *  - Google OAuth and PKCE email links arrive with ?code=
 *  - Email templates using {{ .TokenHash }} arrive with ?token_hash=&type=
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const rawNext = searchParams.get("next") ?? "/dashboard"
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard"

  const supabase = await supabaseServer()
  let error: string | null = null

  if (code) {
    const res = await supabase.auth.exchangeCodeForSession(code)
    error = res.error?.message ?? null
  } else if (tokenHash && type) {
    const res = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    error = res.error?.message ?? null
  } else {
    error = searchParams.get("error_description") ?? "Missing sign-in code"
  }

  if (error) {
    const url = new URL("/login", origin)
    url.searchParams.set("error", error)
    return NextResponse.redirect(url)
  }
  return NextResponse.redirect(new URL(type === "recovery" ? "/reset-password" : next, origin))
}
