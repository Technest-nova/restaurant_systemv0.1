"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, Settings2, Truck } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { currencySymbol, EmptyState, Field, NumberInput, PageHeader, StatCard, useMoney } from "@/components/app/common"
import { aggregate, dishEconomics, fmtPct, ingredientMap, platformEconomics } from "@/lib/calc"
import { actions, useAppState } from "@/lib/store"
import type { Restaurant } from "@/lib/types"
import { cn } from "@/lib/utils"

export default function DeliveryPage() {
  const state = useAppState()
  const r = state.restaurant
  const money = useMoney()
  const [feesOpen, setFeesOpen] = React.useState(false)
  const [lossOnly, setLossOnly] = React.useState(false)
  const ings = React.useMemo(() => ingredientMap(state.ingredients), [state.ingredients])
  const platforms = r.platforms.filter((p) => p.enabled)
  const agg = React.useMemo(() => aggregate(state, { period: "last_4_weeks" }), [state])

  const rows = state.dishes
    .filter((d) => d.recipe.length > 0)
    .map((d) => {
      const inHouse = dishEconomics(d, r, ings)
      const per = platforms.map((p) => platformEconomics(d, p, r, ings))
      return { d, inHouse, per, anyLoss: per.some((x) => x.isLoss) }
    })
    .filter((x) => !lossOnly || x.anyLoss)
    .sort((a, b) => Math.min(...a.per.map((p) => p.profit)) - Math.min(...b.per.map((p) => p.profit)))

  const lossCount = rows.filter((x) => x.anyLoss).length
  const noRecipe = state.dishes.filter((d) => d.recipe.length === 0).length

  return (
    <>
      <PageHeader
        title="Delivery profit"
        description={`True profit per portion after commission, fixed fees (spread over ${r.avgDishesPerOrder} dishes per order) and packaging.`}
        actions={
          <Button variant="outline" onClick={() => setFeesOpen(true)}>
            <Settings2 /> Change platform fees
          </Button>
        }
      />

      {platforms.length === 0 ? (
        <EmptyState icon={Truck} title="No delivery apps turned on" description="Turn on the apps you sell on and enter their commission to see true delivery profit." action={{ label: "Set platform fees", onClick: () => setFeesOpen(true) }} />
      ) : state.dishes.filter((d) => d.recipe.length).length === 0 ? (
        <EmptyState icon={Truck} title="Add recipes first" description="We need each dish's food cost to work out its delivery profit." action={{ label: "Go to dishes", href: "/dishes" }} />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {platforms.map((p) => {
              let profit = 0
              let rev = 0
              let qty = 0
              for (const st of agg.dishes) {
                const c = st.byChannel[p.id]
                if (c) {
                  profit += c.profit
                  rev += c.netRevenue
                  qty += c.qty
                }
              }
              return (
                <StatCard
                  key={p.id}
                  label={`${p.name} · last 4 weeks`}
                  value={money(profit, 0)}
                  sub={qty ? `${qty} dishes · ${fmtPct(rev ? (profit / rev) * 100 : 0)} margin · ${p.commissionPct}% commission` : `${p.commissionPct}% commission · no sales yet`}
                  tone={profit < 0 ? "bad" : "default"}
                />
              )
            })}
            <StatCard
              label="Dishes losing money"
              value={String(state.dishes.filter((d) => d.recipe.length && platforms.some((p) => platformEconomics(d, p, r, ings).isLoss)).length)}
              sub="on at least one app"
              tone="bad"
              icon={AlertTriangle}
            />
          </div>

          <Tabs defaultValue="overview">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <TabsList>
                <TabsTrigger value="overview">All apps</TabsTrigger>
                {platforms.map((p) => (
                  <TabsTrigger key={p.id} value={p.id}>
                    {p.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={lossOnly} onCheckedChange={setLossOnly} /> Show loss-makers only {lossOnly && `(${lossCount})`}
              </label>
            </div>

            <TabsContent value="overview" className="mt-4">
              <Card className="gap-0 py-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Dish</TableHead>
                      <TableHead className="text-right">In-house profit</TableHead>
                      {platforms.map((p) => (
                        <TableHead key={p.id} className="text-right">
                          {p.name}
                        </TableHead>
                      ))}
                      <TableHead className="text-right">Break-even app price</TableHead>
                      <TableHead className="pr-4" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map(({ d, inHouse, per }) => {
                      const worstBe = Math.max(...per.map((x) => x.breakEvenPrice ?? 0))
                      const price = per[0]?.gross ?? 0
                      return (
                        <TableRow key={d.id}>
                          <TableCell className="pl-4">
                            <div className="font-medium">{d.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {money(d.menuPrice)} in-house · {money(price)} on apps
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{money(inHouse.gp)}</TableCell>
                          {per.map((x) => (
                            <TableCell key={x.platform.id} className="text-right">
                              <span className={cn("inline-flex items-center gap-1.5 tabular-nums", x.isLoss && "font-medium text-destructive")}>
                                {x.isLoss && <Badge variant="danger">Loss</Badge>}
                                {money(x.profit)}
                              </span>
                            </TableCell>
                          ))}
                          <TableCell className={cn("text-right tabular-nums", worstBe > price && "font-medium text-destructive")}>{money(worstBe)}</TableCell>
                          <TableCell className="pr-4 text-right">
                            <Button size="xs" variant="outline" asChild>
                              <Link href={`/dishes/${d.id}`}>Open dish</Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={platforms.length + 4} className="py-10 text-center text-muted-foreground">
                          No dishes lose money on delivery. 🎉
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            {platforms.map((p, idx) => (
              <TabsContent key={p.id} value={p.id} className="mt-4">
                <Card className="gap-0 py-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4">Dish</TableHead>
                        <TableHead className="text-right">App price</TableHead>
                        <TableHead className="text-right">Less tax</TableHead>
                        <TableHead className="text-right">Food cost</TableHead>
                        <TableHead className="text-right">Commission</TableHead>
                        <TableHead className="text-right">Fixed fee</TableHead>
                        <TableHead className="text-right">Packaging</TableHead>
                        <TableHead className="text-right">Profit</TableHead>
                        <TableHead className="text-right">Margin</TableHead>
                        <TableHead className="pr-4 text-right">Break-even price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map(({ d, per }) => {
                        const x = per[idx]
                        return (
                          <TableRow key={d.id}>
                            <TableCell className="pl-4 font-medium">
                              <Link href={`/dishes/${d.id}`} className="hover:underline">
                                {d.name}
                              </Link>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{money(x.gross)}</TableCell>
                            <TableCell className="text-right text-muted-foreground tabular-nums">−{money(x.gross - x.net)}</TableCell>
                            <TableCell className="text-right text-muted-foreground tabular-nums">−{money(x.cost)}</TableCell>
                            <TableCell className="text-right text-muted-foreground tabular-nums">−{money(x.commission)}</TableCell>
                            <TableCell className="text-right text-muted-foreground tabular-nums">−{money(x.fee)}</TableCell>
                            <TableCell className="text-right text-muted-foreground tabular-nums">−{money(x.packaging)}</TableCell>
                            <TableCell className={cn("text-right font-medium tabular-nums", x.isLoss && "text-destructive")}>{money(x.profit)}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmtPct(x.net ? (x.profit / x.net) * 100 : 0)}</TableCell>
                            <TableCell className="pr-4 text-right tabular-nums">{x.breakEvenPrice != null ? money(x.breakEvenPrice) : "n/a"}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </Card>
              </TabsContent>
            ))}
          </Tabs>

          {noRecipe > 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              {noRecipe} dish{noRecipe > 1 ? "es" : ""} without a recipe {noRecipe > 1 ? "are" : "is"} hidden. <Link href="/dishes" className="text-primary hover:underline">Add recipes</Link>
            </p>
          )}
        </>
      )}

      <FeesDialog open={feesOpen} onOpenChange={setFeesOpen} restaurant={r} />
    </>
  )
}

function FeesDialog({ open, onOpenChange, restaurant }: { open: boolean; onOpenChange: (o: boolean) => void; restaurant: Restaurant }) {
  const [d, setD] = React.useState(restaurant)
  React.useEffect(() => {
    if (open) setD(restaurant)
  }, [open, restaurant])
  const sym = currencySymbol(restaurant.currency)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Delivery platform fees</DialogTitle>
          <DialogDescription>Use the figures from your contracts. Every number on this page updates when you save.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {d.platforms.map((p) => {
            const upd = (patch: Partial<typeof p>) => setD({ ...d, platforms: d.platforms.map((x) => (x.id === p.id ? { ...x, ...patch } : x)) })
            return (
              <div key={p.id} className="grid grid-cols-[1fr_110px_120px] items-end gap-3 rounded-lg border p-3">
                <label className="flex items-center gap-2 self-center text-sm font-medium">
                  <Switch checked={p.enabled} onCheckedChange={(v) => upd({ enabled: v })} /> {p.name}
                </label>
                <Field label="Commission">
                  <NumberInput value={p.commissionPct} suffix="%" step="0.5" min={0} onChange={(v) => upd({ commissionPct: v })} />
                </Field>
                <Field label="Fee / order">
                  <NumberInput value={p.fixedFeePerOrder} prefix={sym} min={0} onChange={(v) => upd({ fixedFeePerOrder: v })} />
                </Field>
              </div>
            )
          })}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Default packaging">
              <NumberInput value={d.packagingCostDefault} prefix={sym} min={0} onChange={(v) => setD({ ...d, packagingCostDefault: v })} />
            </Field>
            <Field label="Dishes per order" hint="Spreads the fixed fee">
              <NumberInput value={d.avgDishesPerOrder} step="0.1" min={1} onChange={(v) => setD({ ...d, avgDishesPerOrder: Math.max(1, v) })} />
            </Field>
            <Field label="App price uplift" hint="Default markup">
              <NumberInput value={d.deliveryPriceUpliftPct} suffix="%" step="1" min={0} onChange={(v) => setD({ ...d, deliveryPriceUpliftPct: v })} />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              actions.updateRestaurant({
                platforms: d.platforms,
                packagingCostDefault: d.packagingCostDefault,
                avgDishesPerOrder: d.avgDishesPerOrder,
                deliveryPriceUpliftPct: d.deliveryPriceUpliftPct,
              })
              toast.success("Platform fees saved")
              onOpenChange(false)
            }}
          >
            Save fees
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
