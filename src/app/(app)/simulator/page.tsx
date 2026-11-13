"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { Calculator, NotebookPen, Plus, RotateCcw, Save, Trash2, X } from "lucide-react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { currencySymbol, EmptyState, NumberInput, PageHeader, useMoney } from "@/components/app/common"
import { aggregate, fmtDate, ingredientMap, netOfTax, dishFoodCost, platformEconomics, round2, type IngredientMap } from "@/lib/calc"
import { actions, useAppState } from "@/lib/store"
import type { Channel, Dish, Restaurant } from "@/lib/types"
import { cn } from "@/lib/utils"

interface SimRow {
  dishId: string
  newPrice: number
  weeklyQty: Partial<Record<Channel, number>>
  volumePct: number
}

function weeklyProfit(dish: Dish, price: number, mix: Partial<Record<Channel, number>>, volumeFactor: number, r: Restaurant, ings: IngredientMap) {
  const d = { ...dish, menuPrice: price }
  const cost = dishFoodCost(d, ings)
  let total = 0
  for (const [ch, q] of Object.entries(mix)) {
    if (!q) continue
    let unit: number
    if (ch === "in_house") unit = netOfTax(price, r) - cost
    else {
      const p = r.platforms.find((x) => x.id === ch)
      if (!p) continue
      unit = platformEconomics(d, p, r, ings).profit
    }
    total += unit * q * volumeFactor
  }
  return total
}

function SimulatorInner() {
  const state = useAppState()
  const r = state.restaurant
  const money = useMoney()
  const params = useSearchParams()
  const ings = React.useMemo(() => ingredientMap(state.ingredients), [state.ingredients])
  const agg = React.useMemo(() => aggregate(state, { period: "last_4_weeks" }), [state])

  const baseRow = React.useCallback(
    (dishId: string): SimRow | null => {
      const dish = state.dishes.find((d) => d.id === dishId)
      if (!dish) return null
      const st = agg.dishes.find((x) => x.dish.id === dishId)
      const weeklyQty: Partial<Record<Channel, number>> = {}
      if (st) for (const [ch, v] of Object.entries(st.byChannel)) weeklyQty[ch as Channel] = round2((v?.qty ?? 0) / agg.weeks)
      else weeklyQty.in_house = 0
      return { dishId, newPrice: round2(dish.menuPrice * 1.05), weeklyQty, volumePct: 0 }
    },
    [state.dishes, agg]
  )

  const [rows, setRows] = React.useState<SimRow[]>([])
  const [initialised, setInitialised] = React.useState(false)
  const [picker, setPicker] = React.useState("")
  const [noteOpen, setNoteOpen] = React.useState(false)
  const [noteTitle, setNoteTitle] = React.useState("")

  React.useEffect(() => {
    if (initialised || state.dishes.length === 0) return
    const ids = (params.get("dish") ?? "").split(",").filter(Boolean)
    const fromQuery = ids.map(baseRow).filter(Boolean) as SimRow[]
    if (fromQuery.length) setRows(fromQuery)
    else {
      // default: the 3 best sellers
      setRows(agg.dishes.slice(0, 3).map((s) => baseRow(s.dish.id)!).filter(Boolean))
    }
    setInitialised(true)
  }, [initialised, state.dishes.length, params, baseRow, agg.dishes])

  const computed = rows
    .map((row) => {
      const dish = state.dishes.find((d) => d.id === row.dishId)
      if (!dish) return null
      const qty = Object.values(row.weeklyQty).reduce((s, q) => s + (q ?? 0), 0)
      const before = weeklyProfit(dish, dish.menuPrice, row.weeklyQty, 1, r, ings)
      const afterAtSameVolume = weeklyProfit(dish, row.newPrice, row.weeklyQty, 1, r, ings)
      const after = weeklyProfit(dish, row.newPrice, row.weeklyQty, 1 + row.volumePct / 100, r, ings)
      // volume change at which profit stays the same
      const breakEvenVol = afterAtSameVolume > 0 ? (before / afterAtSameVolume - 1) * 100 : null
      return { row, dish, qty, before, after, delta: after - before, breakEvenVol }
    })
    .filter(Boolean) as {
    row: SimRow
    dish: Dish
    qty: number
    before: number
    after: number
    delta: number
    breakEvenVol: number | null
  }[]

  const totals = computed.reduce((s, c) => ({ before: s.before + c.before, after: s.after + c.after }), { before: 0, after: 0 })
  const delta = totals.after - totals.before
  const update = (dishId: string, patch: Partial<SimRow>) => setRows((rs) => rs.map((x) => (x.dishId === dishId ? { ...x, ...patch } : x)))
  const available = state.dishes.filter((d) => !rows.some((x) => x.dishId === d.id)).sort((a, b) => a.name.localeCompare(b.name))

  function saveNote() {
    const lines = computed.map(
      (c) =>
        `${c.dish.name}: ${money(c.dish.menuPrice)} → ${money(c.row.newPrice)}, volume ${c.row.volumePct > 0 ? "+" : ""}${c.row.volumePct}%, weekly profit ${money(c.before)} → ${money(c.after)} (${c.delta >= 0 ? "+" : ""}${money(c.delta)})`
    )
    lines.push(`Total weekly profit: ${money(totals.before)} → ${money(totals.after)} (${delta >= 0 ? "+" : ""}${money(delta)}/week, ${money(delta * 52, 0)}/year)`)
    actions.addNote(noteTitle.trim() || `Price scenario ${new Date().toLocaleDateString("en-GB")}`, lines.join("\n"))
    toast.success("Scenario saved as a note")
    setNoteOpen(false)
    setNoteTitle("")
  }

  if (state.dishes.length === 0)
    return (
      <>
        <PageHeader title="Price simulator" />
        <EmptyState icon={Calculator} title="Add dishes first" description="The simulator uses your recipe costs and recent sales to project weekly profit." action={{ label: "Go to dishes", href: "/dishes" }} />
      </>
    )

  return (
    <>
      <PageHeader
        title="Price simulator"
        description="Test a new price and an expected change in how many you sell. Weekly sales are averaged over the last 4 weeks, across all channels."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setRows((rs) => rs.map((x) => baseRow(x.dishId)!).filter(Boolean))
                toast("Reset to current prices")
              }}
              disabled={!rows.length}
            >
              <RotateCcw /> Reset
            </Button>
            <Button onClick={() => setNoteOpen(true)} disabled={!rows.length}>
              <Save /> Save scenario as note
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="gap-1 py-5">
          <CardContent className="px-5">
            <div className="text-sm text-muted-foreground">Weekly profit now</div>
            <div className="text-2xl font-semibold tabular-nums">{money(totals.before)}</div>
          </CardContent>
        </Card>
        <Card className="gap-1 py-5">
          <CardContent className="px-5">
            <div className="text-sm text-muted-foreground">Weekly profit after</div>
            <div className="text-2xl font-semibold tabular-nums">{money(totals.after)}</div>
          </CardContent>
        </Card>
        <Card className={cn("gap-1 py-5", delta >= 0 ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5")}>
          <CardContent className="px-5">
            <div className="text-sm text-muted-foreground">Change</div>
            <div className={cn("text-2xl font-semibold tabular-nums", delta >= 0 ? "text-success" : "text-destructive")}>
              {delta >= 0 ? "+" : ""}
              {money(delta)} / week
            </div>
            <div className="text-xs text-muted-foreground">
              {delta >= 0 ? "+" : ""}
              {money(delta * 52, 0)} a year
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 pb-0">
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={picker} onValueChange={setPicker}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Choose a dish to add" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {available.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              disabled={!picker}
              onClick={() => {
                const row = baseRow(picker)
                if (row) setRows((rs) => [...rs, row])
                setPicker("")
              }}
            >
              <Plus /> Add dish
            </Button>
          </div>
        </CardHeader>
        {computed.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Add a dish to start simulating.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Dish</TableHead>
                <TableHead className="text-right">Current price</TableHead>
                <TableHead className="w-32">New price</TableHead>
                <TableHead className="w-28">Sold / week</TableHead>
                <TableHead className="w-64">Expected volume change</TableHead>
                <TableHead className="text-right">Profit / week before</TableHead>
                <TableHead className="text-right">After</TableHead>
                <TableHead className="w-10 pr-6" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {computed.map(({ row, dish, qty, before, after, delta: dd, breakEvenVol }) => (
                <TableRow key={row.dishId}>
                  <TableCell className="pl-6">
                    <div className="font-medium">{dish.name}</div>
                    {breakEvenVol != null && row.newPrice !== dish.menuPrice && (
                      <div className="text-xs whitespace-normal text-muted-foreground">
                        {breakEvenVol < 0
                          ? `Profit holds even if volume falls ${Math.abs(breakEvenVol).toFixed(0)}%`
                          : `Needs ${breakEvenVol.toFixed(0)}% more volume to match today`}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{money(dish.menuPrice)}</TableCell>
                  <TableCell>
                    <NumberInput value={row.newPrice} prefix={currencySymbol(r.currency)} min={0} onChange={(v) => update(row.dishId, { newPrice: v })} />
                  </TableCell>
                  <TableCell>
                    <NumberInput
                      value={round2(qty)}
                      step="1"
                      min={0}
                      onChange={(v) => {
                        // scale the channel mix to the new total
                        const factor = qty > 0 ? v / qty : 0
                        const mix: Partial<Record<Channel, number>> =
                          qty > 0 ? Object.fromEntries(Object.entries(row.weeklyQty).map(([c, q]) => [c, (q ?? 0) * factor])) : { in_house: v }
                        update(row.dishId, { weeklyQty: mix })
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Slider value={[row.volumePct]} min={-50} max={50} step={1} onValueChange={([v]) => update(row.dishId, { volumePct: v })} />
                      <span className="w-12 text-right text-sm tabular-nums">
                        {row.volumePct > 0 ? "+" : ""}
                        {row.volumePct}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{money(before)}</TableCell>
                  <TableCell className="text-right">
                    <div className="font-medium tabular-nums">{money(after)}</div>
                    <div className={cn("text-xs tabular-nums", dd >= 0 ? "text-success" : "text-destructive")}>
                      {dd >= 0 ? "+" : ""}
                      {money(dd)}
                    </div>
                  </TableCell>
                  <TableCell className="pr-6">
                    <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={() => setRows((rs) => rs.filter((x) => x.dishId !== row.dishId))}>
                      <X />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="pl-6" colSpan={5}>
                  Total
                </TableCell>
                <TableCell className="text-right tabular-nums">{money(totals.before)}</TableCell>
                <TableCell className="text-right tabular-nums">{money(totals.after)}</TableCell>
                <TableCell className="pr-6" />
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </Card>

      {state.notes.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <NotebookPen className="size-4" /> Saved scenarios
            </CardTitle>
            <CardDescription>Notes you saved from the simulator</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {state.notes.map((n) => (
              <div key={n.id} className="rounded-lg border p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{n.title}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(n.createdAt)}</div>
                  </div>
                  <Button variant="ghost" size="icon-xs" aria-label="Delete note" onClick={() => actions.deleteNote(n.id)}>
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
                <pre className="font-sans text-sm whitespace-pre-wrap text-muted-foreground">{n.body}</pre>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save scenario as note</DialogTitle>
            <DialogDescription>Keeps a record of these prices and the projected profit.</DialogDescription>
          </DialogHeader>
          <Input placeholder="e.g. Burger price rise, January" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveNote}>Save note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default function SimulatorPage() {
  return (
    <React.Suspense>
      <SimulatorInner />
    </React.Suspense>
  )
}
