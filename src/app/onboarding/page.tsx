"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { BarChart3, Check, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { currencySymbol, Field, NumberInput } from "@/components/app/common"
import { COUNTRY_DEFAULTS } from "@/lib/sample-data"
import { actions, useAppState, useHydrated } from "@/lib/store"
import type { Country } from "@/lib/types"
import { cn } from "@/lib/utils"

const STEPS = ["Your restaurant", "Food cost target", "Delivery apps"]

export default function OnboardingPage() {
  const hydrated = useHydrated()
  const { account, loggedIn, restaurant: r } = useAppState()
  const router = useRouter()
  const [step, setStep] = React.useState(0)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!hydrated) return
    if (!account || !loggedIn) router.replace("/login")
    else if (account.onboarded) router.replace("/dashboard")
  }, [hydrated, account, loggedIn, router])

  if (!hydrated || !account) return null

  const tax = COUNTRY_DEFAULTS[r.country].taxName
  const sym = currencySymbol(r.currency)

  async function finish() {
    setBusy(true)
    if (!r.name.trim()) actions.updateRestaurant({ name: "My restaurant" })
    await actions.completeOnboarding()
    router.push("/dashboard")
  }

  function next() {
    if (step === 0 && !r.name.trim()) return toast.error("Add your restaurant name to continue.")
    if (step < STEPS.length - 1) setStep(step + 1)
    else finish()
  }

  async function loadSample() {
    setBusy(true)
    const id = toast.loading("Loading the sample restaurant…")
    await actions.loadSampleData()
    toast.success("Sample restaurant loaded. Explore freely; you can clear it in Settings.", { id })
    router.push("/dashboard")
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-muted/30 px-4 py-10">
      <div className="mb-8 flex items-center gap-2 font-semibold">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <BarChart3 className="size-4" />
        </span>
        Set up your restaurant
      </div>

      <ol className="mb-6 flex w-full max-w-xl items-center gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                i < step && "border-primary bg-primary text-primary-foreground",
                i === step && "border-primary text-primary",
                i > step && "text-muted-foreground"
              )}
            >
              {i < step ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={cn("hidden text-sm sm:block", i === step ? "font-medium" : "text-muted-foreground")}>{s}</span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" />}
          </li>
        ))}
      </ol>

      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>{STEPS[step]}</CardTitle>
          <CardDescription>
            {step === 0 && "We use this to show prices in your currency and remove tax before calculating profit."}
            {step === 1 && "Dishes above this food cost % get flagged. Most restaurants aim for 28–35%."}
            {step === 2 && "Use the numbers from your contracts so delivery profit is accurate. You can change these later."}
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-5">
          {step === 0 && (
            <>
              <Field label="Restaurant name">
                <Input value={r.name} placeholder="e.g. The Copper Pot" onChange={(e) => actions.updateRestaurant({ name: e.target.value })} autoFocus />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Country">
                  <Select value={r.country} onValueChange={(v) => actions.setCountry(v as Country)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UK">United Kingdom</SelectItem>
                      <SelectItem value="AU">Australia</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Currency">
                  <Input value={r.currency === "GBP" ? "GBP (£)" : "AUD (A$)"} readOnly className="bg-muted/50" />
                </Field>
              </div>
              <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
                <div>
                  <div className="text-sm font-medium">My menu prices include {tax}</div>
                  <div className="text-xs text-muted-foreground">Turn off only if you enter prices before {tax}.</div>
                </div>
                <Switch checked={r.pricesIncludeTax} onCheckedChange={(v) => actions.updateRestaurant({ pricesIncludeTax: v })} />
              </div>
              <Field label={`${tax} rate`} hint={r.country === "UK" ? "Standard rate is 20%." : "GST is 10%."}>
                <NumberInput value={r.taxRate} suffix="%" step="0.5" min={0} onChange={(v) => actions.updateRestaurant({ taxRate: v })} className="max-w-40" />
              </Field>
            </>
          )}

          {step === 1 && (
            <div className="grid gap-6 py-2">
              <div className="text-center">
                <div className="text-5xl font-semibold tabular-nums">{r.targetFoodCostPct}%</div>
                <div className="mt-1 text-sm text-muted-foreground">target food cost</div>
              </div>
              <Slider value={[r.targetFoodCostPct]} min={15} max={50} step={1} onValueChange={([v]) => actions.updateRestaurant({ targetFoodCostPct: v })} />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>15%</span>
                <span>That means a {100 - r.targetFoodCostPct}% gross profit target</span>
                <span>50%</span>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-3">
              {r.platforms.map((p) => {
                const update = (patch: Partial<typeof p>) =>
                  actions.updateRestaurant({ platforms: r.platforms.map((x) => (x.id === p.id ? { ...x, ...patch } : x)) })
                return (
                  <div key={p.id} className={cn("rounded-lg border p-4", !p.enabled && "opacity-60")}>
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                      <Checkbox checked={p.enabled} onCheckedChange={(v) => update({ enabled: !!v })} />
                      I sell on {p.name}
                    </label>
                    {p.enabled && (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <Field label="Commission">
                          <NumberInput value={p.commissionPct} suffix="%" step="0.5" min={0} onChange={(v) => update({ commissionPct: v })} />
                        </Field>
                        <Field label="Fixed fee per order">
                          <NumberInput value={p.fixedFeePerOrder} prefix={sym} min={0} onChange={(v) => update({ fixedFeePerOrder: v })} />
                        </Field>
                      </div>
                    )}
                  </div>
                )
              })}
              <Field label="Packaging cost per delivery dish" hint="Box, bag, napkins. You can override it per dish in the recipe.">
                <NumberInput value={r.packagingCostDefault} prefix={sym} min={0} onChange={(v) => actions.updateRestaurant({ packagingCostDefault: v })} className="max-w-40" />
              </Field>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col-reverse gap-3 border-t sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={loadSample} className="text-primary" disabled={busy}>
            <Sparkles /> Load sample data
          </Button>
          <div className="flex w-full gap-2 sm:w-auto">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            <Button variant="ghost" onClick={() => (step < STEPS.length - 1 ? setStep(step + 1) : finish())}>
              Skip
            </Button>
            <Button onClick={next} className="flex-1 sm:flex-none" disabled={busy}>
              {step < STEPS.length - 1 ? "Next" : "Finish setup"}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
