// Central place for Supabase env vars. NEXT_PUBLIC_* values are inlined into the
// browser bundle; SUPABASE_SECRET_KEY must only ever be read on the server.
// Fallbacks so a deploy without env vars still works. Both values are public by design
// (the publishable key ships to every browser and is protected by RLS). Never put the secret key here.
const DEFAULT_URL = "https://pnlsyhwebejjmyvugowq.supabase.co"
const DEFAULT_PUBLISHABLE_KEY = "sb_publishable_EZuXD2mG1nsfnGaL7NR0qQ_4fsHmsFw"

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_PUBLISHABLE_KEY

export function assertPublicEnv() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Add them to .env.local and restart `npm run dev`."
    )
  }
}
