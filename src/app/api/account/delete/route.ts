import { NextResponse } from "next/server"
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server"

/** Permanently deletes the signed-in user. All restaurant data cascades from auth.users. */
export async function POST() {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 })

  const { error } = await supabaseAdmin().auth.admin.deleteUser(user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await supabase.auth.signOut()
  return NextResponse.json({ ok: true })
}
