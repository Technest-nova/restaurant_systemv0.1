import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { assertPublicEnv, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env"

/** Server client bound to the signed-in user's cookies (RLS applies). */
export async function supabaseServer(): Promise<SupabaseClient> {
  assertPublicEnv()
  const cookieStore = await cookies()
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          /* called from a Server Component: middleware refreshes the session instead */
        }
      },
    },
  })
}

/** Admin client using the secret key. Bypasses RLS: server-only, never expose to the browser. */
export function supabaseAdmin(): SupabaseClient {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !key) throw new Error("Missing SUPABASE_SECRET_KEY on the server (.env).")
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
