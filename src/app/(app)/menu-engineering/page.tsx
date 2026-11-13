"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Calculator, Grid2x2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState, PageHeader, useMoney } from "@/components/app/common"
import { MatrixChart } from "@/components/app/matrix-chart"
import { aggregate, fmtPct, MENU_CLASS_INFO, menuEngineering, PERIOD_LABELS, type MenuClass, type PeriodKey } from "@/lib/calc"
import { useAppState } from "@/lib/store"
import { cn } from "@/lib/utils"

const ORDER: MenuClass[] = ["Star", "Plowhorse", "Puzzle", "Dog"]

export default function MenuEngineeringPage() {
  const state = useAppState()
  const money = useMoney()
  const router = useRouter()
  const [period, setPeriod] = React.useState<PeriodKey>("last_4_weeks")
  const [category, setCategory] = React.useState("all")
  const [channel, setChannel] = React.useState("all")
  const [classFilter, setClassFilter] = React.useState<MenuClass | "all">("all")
  const [selected, setSelected] = React.useState<Set<string>>(new Set())

  const agg = React.useMemo(() => aggregate(state, { period, category, channel }), [state, period, category, channel])
  const me = React.useMemo(() => menuEngineering(agg.dishes), [agg])
  const categories = [...new Set(state.dishes.map((d) => d.category))].sort()
  const rows = me.items
    .filter((i) => classFilter === "all" || i.menuClass === classFilter)
    .sort((a, b) => ORDER.indexOf(a.menuClass) - ORDER.indexOf(b.menuClass) || b.profit - a.profit)

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  if (state.sales.length === 0)
    return (
      <>
        <PageHeader title="Menu engineering" />
        <EmptyState icon={Grid2x2} title="Needs sales data" description="The matrix compares how popular each dish is with how much profit it makes. Upload a sales CSV to see it." action={{ label: "Import sales", href: "/import" }} />
      </>
    )

  return (
    <>
      <PageHeader
        title="Menu engineering"
        description="Each dish is placed by popularity and profit per dish. The dashed lines are your menu's averages."
        actions={
          selected.size > 0 && (
            <Button onClick={() => router.push(`/simulator?dish=${[...selected].join(",")}`)}>
              <Calculator /> Send {selected.size} to simulator
            </Button>
          )
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
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
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All channels</SelectItem>
            <SelectItem value="in_house">In-house only</SelectItem>
            <SelectItem value="delivery">All delivery apps</SelectItem>
            {state.restaurant.platforms.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ORDER.map((c) => {
          const items = me.items.filter((i) => i.menuClass === c)
          const active = classFilter === c
          return (
            <button
              key={c}
              onClick={() => setClassFilter(active ? "all" : c)}
              className={cn("rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent", active && "ring-2 ring-primary")}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="size-2.5 rounded-full" style={{ background: MENU_CLASS_INFO[c].color }} />
                {c}s
                <span className="ml-auto text-2xl font-semibold tabular-nums">{items.length}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{MENU_CLASS_INFO[c].meaning}</p>
            </button>
          )
        })}
      </div>

      {me.items.length === 0 ? (
        <EmptyState icon={Grid2x2} title="No matched sales for these filters" description="Try a longer period or a different channel." />
      ) : (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Popularity × profit</CardTitle>
              <CardDescription>
                Popular = at least {fmtPct(me.popThresholdPct)} of items sold · Average profit per dish {money(me.avgUnitProfit)}. Click a dot to open the dish.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MatrixChart
                points={me.items.map((i) => ({ id: i.dish.id, name: i.dish.name, popularityPct: i.popularityPct, unitProfit: i.unitProfit, qty: i.qty, menuClass: i.menuClass }))}
                popThresholdPct={me.popThresholdPct}
                avgUnitProfit={me.avgUnitProfit}
                currency={state.restaurant.currency}
                onSelect={(id) => router.push(`/dishes/${id}`)}
              />
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 pl-4" />
                  <TableHead>Dish</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-right">Sold</TableHead>
                  <TableHead className="text-right">Popularity</TableHead>
                  <TableHead className="text-right">Profit / dish</TableHead>
                  <TableHead className="text-right">Total profit</TableHead>
                  <TableHead>Recommended action</TableHead>
                  <TableHead className="pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((i) => (
                  <TableRow key={i.dish.id} data-state={selected.has(i.dish.id) ? "selected" : undefined}>
                    <TableCell className="pl-4">
                      <Checkbox checked={selected.has(i.dish.id)} onCheckedChange={() => toggle(i.dish.id)} aria-label={`Select ${i.dish.name}`} />
                    </TableCell>
                    <TableCell className="font-medium">{i.dish.name}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <span className="size-2.5 rounded-full" style={{ background: MENU_CLASS_INFO[i.menuClass].color }} />
                        {i.menuClass}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{i.qty.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtPct(i.popularityPct)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", i.unitProfit < 0 && "text-destructive")}>{money(i.unitProfit)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", i.profit < 0 && "text-destructive")}>{money(i.profit, 0)}</TableCell>
                    <TableCell className="max-w-xs text-sm whitespace-normal text-muted-foreground">{MENU_CLASS_INFO[i.menuClass].action}</TableCell>
                    <TableCell className="pr-4 text-right whitespace-nowrap">
                      <Button size="xs" variant="outline" asChild>
                        <Link href={`/dishes/${i.dish.id}`}>Open</Link>
                      </Button>{" "}
                      <Button size="xs" variant="ghost" asChild>
                        <Link href={`/simulator?dish=${i.dish.id}`}>Simulate</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </>
  )
}
