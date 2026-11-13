import { NextResponse, type NextRequest } from "next/server"
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server"

/**
 * Test-mode billing controls (mock checkout, end/restart trial, cancel).
 * Subscriptions are read-only for users under RLS, so writes go through the
 * secret key here. Replace with the Paddle webhook before launch, and keep this
 * disabled in production unless ENABLE_BILLING_TEST_CONTROLS=true.
 */
const TRIAL_DAYS = 14

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_BILLING_TEST_CONTROLS !== "true") {
    return NextResponse.json({ error: "Billing test controls are disabled in production." }, { status: 403 })
  }

  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 })

  const { action } = (await request.json().catch(() => ({}))) as { action?: string }
  const { data: restaurant, error: rErr } = await supabase.from("restaurants").select("id").eq("owner_id", user.id).single()
  if (rErr || !restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })

  const now = Date.now()
  let patch: Record<string, string>
  switch (action) {
    case "activate":
      patch = { status: "active" }
      break
    case "cancel":
      patch = { status: "canceled" }
      break
    case "end_trial":
      patch = { status: "trialing", trial_ends_at: new Date(now - 1000).toISOString() }
      break
    case "restart_trial":
      patch = { status: "trialing", trial_ends_at: new Date(now + TRIAL_DAYS * 86400000).toISOString() }
      break
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin()
    .from("subscriptions")
    .upsert({ restaurant_id: restaurant.id, ...patch, updated_at: new Date(now).toISOString() })
    .select("status, trial_ends_at")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
