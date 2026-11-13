"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { assertPublicEnv, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env"

let client: SupabaseClient | null = null

/** Browser Supabase client (singleton). Session lives in cookies so middleware and server routes see it. */
export function supabaseBrowser(): SupabaseClient {
  if (!client) {
    assertPublicEnv()
    client = createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  }
  return client
}
