"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { AlertTriangle, ArrowLeft, Calculator, Plus, Save, Trash2, Truck } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
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
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { currencySymbol, EmptyState, Field, FlagBadge, NumberInput, useMoney } from "@/components/app/common"
import {
  compatibleUnits,
  dishDeliveryPrice,
  dishEconomics,
  fmtPct,
  foodCostFlag,
  ingredientMap,
  lineCost,
  platformEconomics,
  uid,
} from "@/lib/calc"
import { actions, useAppState } from "@/lib/store"
import type { Dish, PackUnit } from "@/lib/types"
import { cn } from "@/lib/utils"

export default function RecipeBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { dishes, ingredients, restaurant: r } = useAppState()
  const money = useMoney()
  const sym = currencySymbol(r.currency)
  const saved = dishes.find((d) => d.id === id)
  const [draft, setDraft] = React.useState<Dish | null>(saved ?? null)
  const [deleteOpen, setDeleteOpen] = React.useState(false)

  React.useEffect(() => {
    if (saved && (!draft || draft.id !== saved.id)) setDraft(saved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.id])

  const ings = React.useMemo(() => ingredientMap(ingredients), [ingredients])
  const grouped = React.useMemo(() => {
    const g = new Map<string, typeof ingredients>()
    for (const i of [...ingredients].sort((a, b) => a.name.localeCompare(b.name))) {
      g.set(i.category, [...(g.get(i.category) ?? []), i])
    }
    return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [ingredients])

  if (!saved || !draft) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Dish not found"
        description="It may have been deleted."
        action={{ label: "Back to dishes", href: "/dishes" }}
      />
    )
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const eco = dishEconomics(draft, r, ings)
  const flag = foodCostFlag(eco.foodCostPct, r.targetFoodCostPct, eco.hasRecipe)
  const targetPrice = eco.cost > 0 ? (eco.cost / (r.targetFoodCostPct / 100)) * (r.pricesIncludeTax ? 1 + r.taxRate / 100 : 1) : 0
  const platforms = r.platforms.filter((p) => p.enabled)

  const update = (patch: Partial<Dish>) => setDraft({ ...draft, ...patch })
  const updateLine = (lineId: string, patch: Partial<Dish["recipe"][number]>) =>
    update({ recipe: draft.recipe.map((l) => (l.id === lineId ? { ...l, ...patch } : l)) })

  function addLine() {
    const first = ingredients.find((i) => !draft!.recipe.some((l) => l.ingredientId === i.id)) ?? ingredients[0]
    if (!first) return toast.error("Add ingredients first")
    const unit: PackUnit = first.unit === "kg" ? "g" : first.unit === "l" ? "ml" : first.unit
    update({ recipe: [...draft!.recipe, { id: uid("ln"), ingredientId: first.id, quantity: unit === "each" ? 1 : 100, unit, wastePct: 0 }] })
  }

  function save() {
    if (!draft!.name.trim()) return toast.error("Dish name is required")
    actions.upsertDish(draft!)
    toast.success("Recipe saved")
  }

  return (
    <>
      <div className="mb-4">
        <Link href="/dishes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Dishes
        </Link>
      </div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{draft.name || "Untitled dish"}</h1>
          <FlagBadge flag={flag} foodCostPct={eco.hasRecipe ? eco.foodCostPct : undefined} />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/simulator?dish=${draft.id}`}>
              <Calculator /> Simulate price
            </Link>
          </Button>
          <Button variant="ghost" onClick={() => setDeleteOpen(true)} aria-label="Delete dish">
            <Trash2 className="text-destructive" />
          </Button>
          <Button onClick={save} disabled={!dirty}>
            <Save /> {dirty ? "Save" : "Saved"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Dish details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Name">
                <Input value={draft.name} onChange={(e) => update({ name: e.target.value })} />
              </Field>
              <Field label="Category">
                <Input value={draft.category} onChange={(e) => update({ category: e.target.value })} />
              </Field>
              <Field label="Menu price" hint={r.pricesIncludeTax ? `Incl. ${r.country === "UK" ? "VAT" : "GST"}` : "Ex. tax"}>
                <NumberInput value={draft.menuPrice} prefix={sym} min={0} onChange={(v) => update({ menuPrice: v })} />
              </Field>
              <Field label="Delivery app price" hint={draft.deliveryPrice == null ? `Auto: +${r.deliveryPriceUpliftPct}%` : "Custom"}>
                <NumberInput
                  value={draft.deliveryPrice ?? dishDeliveryPrice(draft, r)}
                  prefix={sym}
                  min={0}
                  onChange={(v) => update({ deliveryPrice: v })}
                />
              </Field>
            </CardContent>
          </Card>

          <Card className="gap-0 pb-0">
            <CardHeader className="border-b">
              <CardTitle>Recipe</CardTitle>
              <CardDescription>Quantity per portion. Waste % covers trim, shrink and spillage.</CardDescription>
            </CardHeader>
            {draft.recipe.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={Plus}
                  title="No ingredients yet"
                  description={ingredients.length ? "Add the ingredients that go into one portion." : "You need ingredients in your price list first."}
                  action={ingredients.length ? { label: "Add first line", onClick: addLine } : { label: "Add ingredients", href: "/ingredients" }}
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Ingredient</TableHead>
                    <TableHead className="w-28">Quantity</TableHead>
                    <TableHead className="w-24">Unit</TableHead>
                    <TableHead className="w-24">Waste %</TableHead>
                    <TableHead className="text-right">Line cost</TableHead>
                    <TableHead className="w-12 pr-6" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draft.recipe.map((l) => {
                    const ing = ings.get(l.ingredientId)
                    const lc = lineCost(l, ings)
                    const units = ing ? compatibleUnits(ing.unit) : (["g"] as PackUnit[])
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="pl-6">
                          <Select
                            value={l.ingredientId}
                            onValueChange={(v) => {
                              const ni = ings.get(v)
                              const ok = ni && compatibleUnits(ni.unit).includes(l.unit)
                              updateLine(l.id, { ingredientId: v, unit: ok ? l.unit : ni ? compatibleUnits(ni.unit)[0] : l.unit })
                            }}
                          >
                            <SelectTrigger className="w-full min-w-48">
                              <SelectValue placeholder="Pick ingredient" />
                            </SelectTrigger>
                            <SelectContent className="max-h-80">
                              {grouped.map(([cat, list]) => (
                                <SelectGroup key={cat}>
                                  <SelectLabel>{cat}</SelectLabel>
                                  {list.map((i) => (
                                    <SelectItem key={i.id} value={i.id}>
                                      {i.name}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <NumberInput value={l.quantity} step="0.01" min={0} onChange={(v) => updateLine(l.id, { quantity: v })} />
                        </TableCell>
                        <TableCell>
                          <Select value={l.unit} onValueChange={(v) => updateLine(l.id, { unit: v as PackUnit })}>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {units.map((u) => (
                                <SelectItem key={u} value={u}>
                                  {u}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <NumberInput value={l.wastePct} step="1" min={0} suffix="%" onChange={(v) => updateLine(l.id, { wastePct: v })} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {lc.error ? <span className="text-xs text-destructive">{lc.error}</span> : money(lc.cost)}
                        </TableCell>
                        <TableCell className="pr-6">
                          <Button variant="ghost" size="icon-sm" aria-label="Remove line" onClick={() => update({ recipe: draft.recipe.filter((x) => x.id !== l.id) })}>
                            <Trash2 />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="pl-6" colSpan={4}>
                      <Button variant="outline" size="sm" onClick={addLine}>
                        <Plus /> Add line
                      </Button>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{money(eco.cost)}</TableCell>
                    <TableCell className="pr-6" />
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </Card>
        </div>

        {/* live panel */}
        <div className="grid content-start gap-6 lg:sticky lg:top-6">
          <Card>
            <CardHeader>
              <CardTitle>Live cost & GP</CardTitle>
              <CardDescription>In-house, per portion</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <Row label="Menu price" value={money(draft.menuPrice)} />
              {r.pricesIncludeTax && <Row label={`Less ${r.country === "UK" ? "VAT" : "GST"} (${r.taxRate}%)`} value={`− ${money(draft.menuPrice - eco.net)}`} muted />}
              <Row label="Net price" value={money(eco.net)} />
              <Row label="Food cost" value={`− ${money(eco.cost)}`} muted />
              <Separator />
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-muted-foreground">Gross profit</div>
                  <div className={cn("text-3xl font-semibold tabular-nums", eco.gp < 0 && "text-destructive")}>{money(eco.gp)}</div>
                </div>
                <div className="text-right">
                  <div className="text-muted-foreground">GP %</div>
                  <div className="text-3xl font-semibold tabular-nums">{fmtPct(eco.gpPct)}</div>
                </div>
              </div>
              <div className="rounded-md bg-muted px-3 py-2 text-xs">
                Food cost {fmtPct(eco.foodCostPct)} vs target {r.targetFoodCostPct}%.
                {eco.hasRecipe && eco.foodCostPct > r.targetFoodCostPct && (
                  <>
                    {" "}
                    To hit target, price at <strong>{money(targetPrice)}</strong> or cut cost to{" "}
                    <strong>{money((eco.net * r.targetFoodCostPct) / 100)}</strong>.
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="size-4" /> Delivery
              </CardTitle>
              <CardDescription>Profit per portion on each app</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <Field label="Packaging cost" hint={draft.packagingCost == null ? "Using your default" : "Custom for this dish"}>
                <NumberInput value={draft.packagingCost ?? r.packagingCostDefault} prefix={sym} min={0} onChange={(v) => update({ packagingCost: v })} />
              </Field>
              {platforms.length === 0 && <p className="text-muted-foreground">No delivery apps enabled in Settings.</p>}
              {platforms.map((p) => {
                const pe = platformEconomics(draft, p, r, ings)
                return (
                  <div key={p.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <span>{p.name}</span>
                    <span className="flex items-center gap-2">
                      {pe.isLoss && <Badge variant="danger">Loss</Badge>}
                      <span className={cn("font-medium tabular-nums", pe.isLoss && "text-destructive")}>{money(pe.profit)}</span>
                    </span>
                  </div>
                )
              })}
              <Link href="/delivery" className="text-xs text-primary hover:underline">
                See the full breakdown →
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {saved.name}?</DialogTitle>
            <DialogDescription>Its recipe is removed and POS items linked to it become unmatched again.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                actions.deleteDish(saved.id)
                toast.success("Dish deleted")
                router.push("/dishes")
              }}
            >
              Delete dish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={cn("flex justify-between", muted && "text-muted-foreground")}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
