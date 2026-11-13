"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, Banknote, Percent, TrendingUp, Truck, Upload } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyState, PageHeader, StatCard, useMoney } from "@/components/app/common"
import { aggregate, fmtDate, fmtPct, PERIOD_LABELS, type PeriodKey } from "@/lib/calc"
import { problemDishes } from "@/lib/insights"
import { useAppState } from "@/lib/store"

export default function DashboardPage() {
  const state = useAppState()
  const money = useMoney()
  const [period, setPeriod] = React.useState<PeriodKey>("last_week")
  const agg = React.useMemo(() => aggregate(state, { period }), [state, period])
  const problems = React.useMemo(() => problemDishes(state, { period }), [state, period])
  const r = state.restaurant

  const checklist = [
    { done: !!r.name, label: "Restaurant details saved", href: "/settings" },
    { done: state.ingredients.length > 0, label: "Add ingredients", href: "/ingredients" },
    { done: state.dishes.some((d) => d.recipe.length > 0), label: "Build your first recipe", href: "/dishes" },
    { done: state.imports.length > 0, label: "Upload a sales CSV", href: "/import" },
    { done: state.sales.length > 0 && agg.unmatchedNames.length === 0, label: "Match all POS items to dishes", href: "/matching" },
    { done: !!r.reportEmail, label: "Set your weekly email", href: "/settings" },
  ]
  const doneCount = checklist.filter((c) => c.done).length
  const top = agg.dishes.slice(0, 3)
  const deliveryMargin = agg.totals.deliveryNetRevenue > 0 ? (agg.totals.deliveryProfit / agg.totals.deliveryNetRevenue) * 100 : 0

  return (
    <>
      <PageHeader
        title={`Good to see you${state.account?.name ? `, ${state.account.name.split(" ")[0]}` : ""}`}
        description={agg.range ? `${fmtDate(agg.range.start)} – ${fmtDate(agg.range.end)} · all figures exclude ${r.country === "UK" ? "VAT" : "GST"}` : "Your weekly profit overview"}
        actions={
          <>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PERIOD_LABELS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild>
              <Link href="/import">
                <Upload /> Upload sales
              </Link>
            </Button>
          </>
        }
      />

      {doneCount < checklist.length && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Setup checklist</CardTitle>
            <CardDescription>
              {doneCount} of {checklist.length} done. Finish these to get accurate numbers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={(doneCount / checklist.length) * 100} className="mb-4" />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {checklist.map((c) => (
                <Link
                  key={c.label}
                  href={c.href}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent"
                >
                  {c.done ? <CheckCircle2 className="size-4 text-success" /> : <Circle className="size-4 text-muted-foreground" />}
                  <span className={c.done ? "text-muted-foreground line-through" : ""}>{c.label}</span>
                  {!c.done && <ArrowRight className="ml-auto size-3.5 text-muted-foreground" />}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {state.sales.length === 0 ? (
        <EmptyState
          icon={Upload}
          title="No sales data yet"
          description="Upload last week's sales export from Square or our CSV template. Your dashboard fills in straight away."
          action={{ label: "Upload sales CSV", href: "/import" }}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Net revenue" value={money(agg.totals.netRevenue, 0)} sub={`${agg.totals.qty.toLocaleString()} dishes sold`} icon={Banknote} />
            <StatCard
              label="Gross profit"
              value={money(agg.totals.grossProfit, 0)}
              sub={`${fmtPct(agg.totals.netRevenue ? (agg.totals.grossProfit / agg.totals.netRevenue) * 100 : 0)} margin after food & delivery costs`}
              tone={agg.totals.grossProfit < 0 ? "bad" : "default"}
              icon={TrendingUp}
            />
            <StatCard
              label="Food cost %"
              value={fmtPct(agg.totals.foodCostPct)}
              sub={
                <span className="inline-flex items-center gap-1">
                  {agg.totals.foodCostPct > r.targetFoodCostPct ? (
                    <AlertTriangle className="size-3 text-warning" />
                  ) : (
                    <CheckCircle2 className="size-3 text-success" />
                  )}
                  Target {r.targetFoodCostPct}%
                </span>
              }
              icon={Percent}
            />
            <StatCard
              label="Delivery profit"
              value={money(agg.totals.deliveryProfit, 0)}
              sub={`${fmtPct(deliveryMargin)} of delivery revenue`}
              tone={agg.totals.deliveryProfit < 0 ? "bad" : "default"}
              icon={Truck}
            />
          </div>

          {agg.unmatchedNames.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
              <span className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-warning" />
                {agg.unmatchedNames.length} POS item name{agg.unmatchedNames.length > 1 ? "s are" : " is"} not linked to a dish, so{" "}
                {agg.unmatchedNames.reduce((s, u) => s + u.qty, 0)} sales are left out of these numbers.
              </span>
              <Button size="sm" variant="outline" asChild>
                <Link href="/matching">Match items</Link>
              </Button>
            </div>
          )}

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top 3 earners</CardTitle>
                <CardDescription>Dishes that made the most profit this period</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {top.length === 0 && <p className="text-sm text-muted-foreground">No matched sales in this period.</p>}
                {top.map((st, i) => (
                  <Link key={st.dish.id} href={`/dishes/${st.dish.id}`} className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent">
                    <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{st.dish.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {st.qty} sold · {money(st.unitProfit)} profit each
                      </div>
                    </div>
                    <div className="text-right font-semibold tabular-nums">{money(st.profit, 0)}</div>
                  </Link>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>3 problem dishes</CardTitle>
                <CardDescription>Fix these first for the biggest profit gain</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {problems.length === 0 && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="size-4 text-success" /> No problem dishes this period.
                  </p>
                )}
                {problems.map((p) => (
                  <Link key={p.stats.dish.id} href={`/dishes/${p.stats.dish.id}`} className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{p.stats.dish.name}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {p.reasons.map((x) => (
                          <Badge key={x} variant="danger">
                            {x}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <span className="text-xs whitespace-nowrap text-primary">Open →</span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              { href: "/menu-engineering", t: "Menu Engineering", d: "See every dish's class and the action to take." },
              { href: "/delivery", t: "Delivery Profit", d: "True profit per dish on each delivery app." },
              { href: "/simulator", t: "Price Simulator", d: "Test a price change before you make it." },
            ].map((x) => (
              <Link key={x.href} href={x.href} className="rounded-xl border bg-card p-4 transition-colors hover:bg-accent">
                <div className="flex items-center justify-between font-medium">
                  {x.t} <ArrowRight className="size-4 text-muted-foreground" />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{x.d}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  )
}
