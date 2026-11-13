"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BarChart3 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { actions, useAppState, useHydrated } from "@/lib/store"

export default function ResetPasswordPage() {
  const router = useRouter()
  const hydrated = useHydrated()
  const { loggedIn } = useAppState()
  const [password, setPassword] = React.useState("")
  const [confirm, setConfirm] = React.useState("")
  const [error, setError] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) return setError("Password must be at least 8 characters.")
    if (password !== confirm) return setError("Passwords don't match.")
    setBusy(true)
    const res = await actions.updatePassword(password)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    toast.success("Password updated")
    router.replace("/dashboard")
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-10">
      <Link href="/" className="mb-8 flex items-center gap-2 font-semibold">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <BarChart3 className="size-4" />
        </span>
        Restaurant Profit Analyzer
      </Link>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Choose a new password</CardTitle>
          <CardDescription>
            {hydrated && !loggedIn ? "This reset link has expired or was already used. Request a new one from the login page." : "At least 8 characters."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hydrated && !loggedIn ? (
            <Button asChild className="w-full">
              <Link href="/login">Back to log in</Link>
            </Button>
          ) : (
            <form onSubmit={submit} className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="pw">New password</Label>
                <Input id="pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pw2">Confirm password</Label>
                <Input id="pw2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy || !hydrated}>
                {busy ? "Saving…" : "Update password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
