// Central place for Supabase env vars. NEXT_PUBLIC_* values are inlined into the
// browser bundle; SUPABASE_SECRET_KEY must only ever be read on the server.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

export function assertPublicEnv() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Add them to .env.local and restart `npm run dev`."
    )
  }
}
