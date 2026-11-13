"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CreditCard, Database, ExternalLink, Lock, Mail, Send, Sparkles, Store, Truck, Wrench } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckoutDialog } from "@/components/app/checkout-dialog"
import { currencySymbol, Field, NumberInput, PageHeader, useMoney } from "@/components/app/common"
import { fmtDate, fmtMoney, fmtPct } from "@/lib/calc"
import { PLAN } from "@/lib/config"
import { weeklyEmailNumbers } from "@/lib/insights"
import { COUNTRY_DEFAULTS } from "@/lib/sample-data"
import { actions, hasAccess, trialDaysLeft, useAppState } from "@/lib/store"
import type { Country, Restaurant, Weekday } from "@/lib/types"

const DAYS: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function SettingsInner() {
  const state = useAppState()
  const params = useSearchParams()
  const access = hasAccess(state.account)
  const [tab, setTab] = React.useState(params.get("tab") ?? "restaurant")
  React.useEffect(() => {
    const t = params.get("tab")
    if (t) setTab(t)
  }, [params])

  if (!access) {
    return (
      <>
        <PageHeader title="Billing" />
        <BillingPanel locked />
      </>
    )
  }

  return (
    <>
      <PageHeader title="Settings & billing" description="Restaurant details, delivery apps, your weekly email and your subscription." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start sm:w-fit">
          <TabsTrigger value="restaurant">
            <Store /> Restaurant
          </TabsTrigger>
          <TabsTrigger value="platforms">
            <Truck /> Platforms
          </TabsTrigger>
          <TabsTrigger value="email">
            <Mail /> Weekly email
          </TabsTrigger>
          <TabsTrigger value="billing">
            <CreditCard /> Billing
          </TabsTrigger>
          <TabsTrigger value="data">
            <Database /> Data
          </TabsTrigger>
        </TabsList>
        <TabsContent value="restaurant">
          <RestaurantPanel />
        </TabsContent>
        <TabsContent value="platforms">
          <PlatformsPanel />
        </TabsContent>
        <TabsContent value="email">
          <EmailPanel />
        </TabsContent>
        <TabsContent value="billing">
          <BillingPanel />
        </TabsContent>
        <TabsContent value="data">
          <DataPanel />
        </TabsContent>
      </Tabs>
    </>
  )
}

function useDraft() {
  const { restaurant } = useAppState()
  const [d, setD] = React.useState<Restaurant>(restaurant)
  React.useEffect(() => setD(restaurant), [restaurant])
  const dirty = JSON.stringify(d) !== JSON.stringify(restaurant)
  return { d, setD, dirty, restaurant }
}

function RestaurantPanel() {
  const { d, setD, dirty } = useDraft()
  const tax = COUNTRY_DEFAULTS[d.country].taxName
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Restaurant details</CardTitle>
        <CardDescription>One site per account in this version.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Field label="Restaurant name">
          <Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Country">
            <Select
              value={d.country}
              onValueChange={(v) => {
                const c = COUNTRY_DEFAULTS[v as Country]
                setD({ ...d, country: v as Country, currency: c.currency, taxRate: c.taxRate })
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UK">United Kingdom (GBP)</SelectItem>
                <SelectItem value="AU">Australia (AUD)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={`${tax} rate`}>
            <NumberInput value={d.taxRate} suffix="%" step="0.5" min={0} onChange={(v) => setD({ ...d, taxRate: v })} />
          </Field>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
          <div>
            <div className="text-sm font-medium">Menu prices include {tax}</div>
            <div className="text-xs text-muted-foreground">We remove {tax} before calculating profit.</div>
          </div>
          <Switch checked={d.pricesIncludeTax} onCheckedChange={(v) => setD({ ...d, pricesIncludeTax: v })} />
        </div>
        <Field label={`Target food cost: ${d.targetFoodCostPct}%`} hint={`GP target ${100 - d.targetFoodCostPct}%`}>
          <Slider value={[d.targetFoodCostPct]} min={15} max={50} step={1} onValueChange={([v]) => setD({ ...d, targetFoodCostPct: v })} className="py-2" />
        </Field>
      </CardContent>
      <CardFooter className="justify-end border-t">
        <Button
          disabled={!dirty}
          onClick={() => {
            actions.updateRestaurant(d)
            toast.success("Restaurant details saved")
          }}
        >
          Save
        </Button>
      </CardFooter>
    </Card>
  )
}

function PlatformsPanel() {
  const { d, setD, dirty } = useDraft()
  const sym = currencySymbol(d.currency)
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Delivery platforms</CardTitle>
        <CardDescription>Commission is charged on the price the customer pays.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {d.platforms.map((p) => {
          const upd = (patch: Partial<typeof p>) => setD({ ...d, platforms: d.platforms.map((x) => (x.id === p.id ? { ...x, ...patch } : x)) })
          return (
            <div key={p.id} className="grid grid-cols-[1fr_120px_130px] items-end gap-3 rounded-lg border p-3">
              <label className="flex items-center gap-2 self-center text-sm font-medium">
                <Switch checked={p.enabled} onCheckedChange={(v) => upd({ enabled: v })} /> {p.name}
              </label>
              <Field label="Commission">
                <NumberInput value={p.commissionPct} suffix="%" step="0.5" min={0} onChange={(v) => upd({ commissionPct: v })} />
              </Field>
              <Field label="Fixed fee / order">
                <NumberInput value={p.fixedFeePerOrder} prefix={sym} min={0} onChange={(v) => upd({ fixedFeePerOrder: v })} />
              </Field>
            </div>
          )
        })}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Packaging per dish">
            <NumberInput value={d.packagingCostDefault} prefix={sym} min={0} onChange={(v) => setD({ ...d, packagingCostDefault: v })} />
          </Field>
          <Field label="Avg dishes per order">
            <NumberInput value={d.avgDishesPerOrder} step="0.1" min={1} onChange={(v) => setD({ ...d, avgDishesPerOrder: Math.max(1, v) })} />
          </Field>
          <Field label="App price uplift">
            <NumberInput value={d.deliveryPriceUpliftPct} suffix="%" step="1" min={0} onChange={(v) => setD({ ...d, deliveryPriceUpliftPct: v })} />
          </Field>
        </div>
      </CardContent>
      <CardFooter className="justify-end border-t">
        <Button
          disabled={!dirty}
          onClick={() => {
            actions.updateRestaurant(d)
            toast.success("Platforms saved")
          }}
        >
          Save
        </Button>
      </CardFooter>
    </Card>
  )
}

function EmailPanel() {
  const state = useAppState()
  const { d, setD, dirty } = useDraft()
  const money = useMoney()
  const n = weeklyEmailNumbers(state)
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Weekly profit email</CardTitle>
          <CardDescription>5 key numbers and a link back to upload next week&apos;s sales.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field label="Send on">
            <Select value={d.reportDay} onValueChange={(v) => setD({ ...d, reportDay: v as Weekday })}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((x) => (
                  <SelectItem key={x} value={x}>
                    {x}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Send to">
            <Input type="email" value={d.reportEmail} onChange={(e) => setD({ ...d, reportEmail: e.target.value })} />
          </Field>
        </CardContent>
        <CardFooter className="justify-between gap-2 border-t">
          <Button
            variant="outline"
            onClick={() => {
              if (!/^\S+@\S+\.\S+$/.test(d.reportEmail)) return toast.error("Enter a valid email first")
              toast.success(`Test email sent to ${d.reportEmail} (mock)`)
            }}
          >
            <Send /> Send test
          </Button>
          <Button
            disabled={!dirty}
            onClick={() => {
              actions.updateRestaurant({ reportDay: d.reportDay, reportEmail: d.reportEmail })
              toast.success("Email settings saved")
            }}
          >
            Save
          </Button>
        </CardFooter>
      </Card>

      <Card className="bg-muted/30">
        <CardHeader>
          <CardDescription>Preview</CardDescription>
          <CardTitle>Your week at {state.restaurant.name || "your restaurant"}</CardTitle>
          {n.range && (
            <CardDescription>
              {fmtDate(n.range.start)} – {fmtDate(n.range.end)}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          {state.sales.length === 0 ? (
            <p className="text-muted-foreground">Upload sales to see real numbers here.</p>
          ) : (
            <>
              <EmailRow n={1} label="Net revenue" value={money(n.netRevenue, 0)} />
              <EmailRow n={2} label="Gross profit" value={money(n.grossProfit, 0)} />
              <EmailRow n={3} label="Food cost" value={`${fmtPct(n.foodCostPct)} (target ${state.restaurant.targetFoodCostPct}%)`} />
              <EmailRow n={4} label="Delivery profit" value={money(n.deliveryProfit, 0)} />
              <EmailRow n={5} label="Dish to fix" value={n.worstDish ? `${n.worstDish.name}: ${n.worstDish.reason}` : "None 🎉"} />
              <Button className="mt-3 w-fit" size="sm">
                Upload this week&apos;s sales →
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function EmailRow({ n, label, value }: { n: number; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-md border bg-card px-3 py-2">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">{n}</span>
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto text-right font-medium">{value}</span>
    </div>
  )
}

function BillingPanel({ locked = false }: { locked?: boolean }) {
  const { account, restaurant } = useAppState()
  const router = useRouter()
  const [checkout, setCheckout] = React.useState(false)
  const [portal, setPortal] = React.useState(false)
  if (!account) return null
  const days = trialDaysLeft(account)
  const price = PLAN.monthly[restaurant.currency]
  const keepUntil = new Date(new Date(account.trialEndsAt).getTime() + 30 * 86400000).toISOString()
  const statusBadge =
    account.subscriptionStatus === "active" ? (
      <Badge variant="success">Active</Badge>
    ) : account.subscriptionStatus === "trialing" && days > 0 ? (
      <Badge variant="secondary">Free trial · {days} days left</Badge>
    ) : account.subscriptionStatus === "canceled" ? (
      <Badge variant="danger">Cancelled</Badge>
    ) : (
      <Badge variant="danger">Trial ended</Badge>
    )

  return (
    <div className="grid max-w-2xl gap-6">
      {locked && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <div>
            <div className="font-medium">Your free trial has ended</div>
            <div className="text-muted-foreground">
              Subscribe to keep using the app. Your recipes and sales data are kept until {fmtDate(keepUntil)}.
            </div>
          </div>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {PLAN.name} {statusBadge}
          </CardTitle>
          <CardDescription>
            {fmtMoney(price, restaurant.currency, { decimals: 0 })} per month · billed through Paddle
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Account</span>
            <span>{account.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{account.subscriptionStatus === "trialing" ? "Trial ends" : "Trial ended"}</span>
            <span>{fmtDate(account.trialEndsAt)}</span>
          </div>
        </CardContent>
        <CardFooter className="flex-wrap justify-end gap-2 border-t">
          {account.subscriptionStatus === "active" ? (
            <Button variant="outline" onClick={() => setPortal(true)}>
              <ExternalLink /> Manage subscription
            </Button>
          ) : (
            <Button onClick={() => setCheckout(true)}>
              <CreditCard /> Subscribe
            </Button>
          )}
        </CardFooter>
      </Card>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Wrench className="size-4" /> Test controls (mock only)
          </CardTitle>
          <CardDescription>Simulate billing states to test the trial lock. Remove when Paddle is connected.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => { actions.endTrialNow(); toast("Trial ended") }}>
            End trial now
          </Button>
          <Button size="sm" variant="outline" onClick={() => { actions.restartTrial(); toast("Trial restarted"); router.push("/dashboard") }}>
            Restart 14-day trial
          </Button>
          <Button size="sm" variant="outline" onClick={() => { actions.setSubscription("canceled"); toast("Subscription cancelled") }}>
            Cancel subscription
          </Button>
        </CardContent>
      </Card>

      <CheckoutDialog
        open={checkout}
        onOpenChange={(o) => {
          setCheckout(o)
        }}
      />

      <Dialog open={portal} onOpenChange={setPortal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Paddle customer portal</DialogTitle>
            <DialogDescription>
              In production this opens Paddle&apos;s hosted portal, where the owner updates their card, downloads invoices or cancels.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => {
                actions.setSubscription("canceled")
                setPortal(false)
                toast("Subscription cancelled")
              }}
            >
              Cancel subscription
            </Button>
            <Button variant="outline" onClick={() => setPortal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DataPanel() {
  const state = useAppState()
  const router = useRouter()
  const [confirm, setConfirm] = React.useState<null | "clear" | "reset">(null)
  return (
    <div className="grid max-w-2xl gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Sample data</CardTitle>
          <CardDescription>
            Loads a {state.restaurant.country === "AU" ? "Sydney" : "UK"} restaurant with 31 ingredients, 13 recipes and 8 weeks of sales. Replaces your current ingredients, dishes and sales.
          </CardDescription>
        </CardHeader>
        <CardFooter className="border-t">
          <Button
            variant="outline"
            onClick={() => {
              actions.loadSampleData()
              toast.success("Sample data loaded")
              router.push("/dashboard")
            }}
          >
            <Sparkles /> Load sample restaurant
          </Button>
        </CardFooter>
      </Card>
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>
            {state.ingredients.length} ingredients · {state.dishes.length} dishes · {state.sales.length.toLocaleString()} sales rows · stored in this browser
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex-wrap gap-2 border-t">
          <Button variant="outline" onClick={() => setConfirm("clear")}>
            Clear ingredients, dishes & sales
          </Button>
          <Button variant="destructive" onClick={() => setConfirm("reset")}>
            Delete account (reset app)
          </Button>
        </CardFooter>
      </Card>
      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm === "reset" ? "Delete account and all data?" : "Clear all business data?"}</DialogTitle>
            <DialogDescription>This can&apos;t be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm === "reset") {
                  actions.resetEverything()
                  router.push("/")
                } else {
                  actions.clearBusinessData()
                  toast.success("Data cleared")
                }
                setConfirm(null)
              }}
            >
              Yes, continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <React.Suspense>
      <SettingsInner />
    </React.Suspense>
  )
}
