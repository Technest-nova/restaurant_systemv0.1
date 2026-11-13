"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { BarChart3 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { actions } from "@/lib/store"

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M22.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h6c-.3 1.4-1 2.5-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-7.8z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2.1v2.8C3.9 20.5 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.7 14.1c-.2-.7-.4-1.4-.4-2.1s.1-1.4.4-2.1V7.1H2.1C1.4 8.6 1 10.2 1 12s.4 3.4 1.1 4.9l3.6-2.8z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2C17.5 2.1 15 1 12 1 7.7 1 3.9 3.5 2.1 7.1l3.6 2.8C6.6 7.4 9.1 5.4 12 5.4z" />
    </svg>
  )
}

function AuthForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [tab, setTab] = React.useState(params.get("mode") === "signup" ? "signup" : "login")
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState("")
  const [resetOpen, setResetOpen] = React.useState(false)
  const [resetEmail, setResetEmail] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [confirmSent, setConfirmSent] = React.useState("")
  const next = (() => {
    const n = params.get("next")
    return n && n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard"
  })()

  React.useEffect(() => {
    const err = params.get("error")
    if (err) setError(err)
  }, [params])

  function validate(): boolean {
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid email address.")
      return false
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return false
    }
    setError("")
    return true
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setBusy(true)
    const res = await actions.signUp(email.trim(), password, name.trim())
    setBusy(false)
    if (!res.ok) return setError(res.error)
    if (res.needsConfirmation) {
      setConfirmSent(email.trim())
      return
    }
    toast.success("Account created. Your 14-day trial has started.")
    router.replace("/onboarding")
    router.refresh()
  }

  async function logIn(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setBusy(true)
    const res = await actions.logIn(email.trim(), password)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    router.replace(next)
    router.refresh()
  }

  async function google() {
    setBusy(true)
    const res = await actions.signInWithGoogle(next)
    if (!res.ok) {
      setBusy(false)
      setError(res.error)
    }
    // on success the browser is redirected to Google
  }

  async function sendReset() {
    if (!/^\S+@\S+\.\S+$/.test(resetEmail)) return toast.error("Enter a valid email address.")
    setBusy(true)
    const res = await actions.sendPasswordReset(resetEmail.trim())
    setBusy(false)
    if (!res.ok) return toast.error(res.error)
    setResetOpen(false)
    toast.success(`If an account exists for ${resetEmail}, a reset link is on its way.`)
  }

  if (confirmSent) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Check your email</CardTitle>
          <CardDescription>
            We sent a confirmation link to <strong>{confirmSent}</strong>. Click it to activate your account and start your 14-day trial.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          <Button variant="outline" onClick={() => { setConfirmSent(""); setTab("login") }}>
            Back to log in
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">{tab === "signup" ? "Start your free trial" : "Welcome back"}</CardTitle>
        <CardDescription>
          {tab === "signup" ? "14 days free. No card needed." : "Log in to see this week's numbers."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={(v) => { setTab(v); setError("") }}>
          <TabsList className="mb-4 w-full">
            <TabsTrigger value="login">Log in</TabsTrigger>
            <TabsTrigger value="signup">Sign up</TabsTrigger>
          </TabsList>

          <Button variant="outline" className="w-full" onClick={google} type="button" disabled={busy}>
            <GoogleIcon /> Continue with Google
          </Button>
          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <Separator className="flex-1" /> or <Separator className="flex-1" />
          </div>

          <TabsContent value="login">
            <form onSubmit={logIn} className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button type="button" className="text-xs text-primary hover:underline" onClick={() => { setResetEmail(email); setResetOpen(true) }}>
                    Forgot password?
                  </button>
                </div>
                <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>{busy ? "Logging in…" : "Log in"}</Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={signUp} className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="name">Your name</Label>
                <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="email2">Email</Label>
                <Input id="email2" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="password2">Password</Label>
                <Input id="password2" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <p className="text-xs text-muted-foreground">At least 8 characters.</p>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>{busy ? "Creating account…" : "Create account"}</Button>
              <p className="text-center text-xs text-muted-foreground">
                By signing up you agree to the Terms and Privacy Policy.
              </p>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset your password</DialogTitle>
            <DialogDescription>We&apos;ll email you a link to choose a new password.</DialogDescription>
          </DialogHeader>
          <Input type="email" placeholder="you@restaurant.co.uk" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} />
          <DialogFooter>
            <Button onClick={sendReset} disabled={busy}>
              Send reset link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-10">
      <Link href="/" className="mb-8 flex items-center gap-2 font-semibold">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <BarChart3 className="size-4" />
        </span>
        Restaurant Profit Analyzer
      </Link>
      <React.Suspense>
        <AuthForm />
      </React.Suspense>
    </div>
  )
}
