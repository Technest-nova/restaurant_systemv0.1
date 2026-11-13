"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, EyeOff, Link2, Plus, Sparkles, Undo2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState, PageHeader, useMoney } from "@/components/app/common"
import { round2, suggestDish } from "@/lib/calc"
import { actions, useAppState } from "@/lib/store"

export default function MatchingPage() {
  const state = useAppState()
  const money = useMoney()
  const router = useRouter()
  const [choice, setChoice] = React.useState<Record<string, string>>({})

  const names = React.useMemo(() => {
    const m = new Map<string, { name: string; qty: number; gross: number; inHouseQty: number; inHouseGross: number }>()
    for (const s of state.sales) {
      const x = m.get(s.posName) ?? { name: s.posName, qty: 0, gross: 0, inHouseQty: 0, inHouseGross: 0 }
      x.qty += s.quantity
      x.gross += s.grossSales
      if (s.channel === "in_house") {
        x.inHouseQty += s.quantity
        x.inHouseGross += s.grossSales
      }
      m.set(s.posName, x)
    }
    return [...m.values()].sort((a, b) => b.qty - a.qty)
  }, [state.sales])

  const unmatched = names.filter((n) => !state.mappings[n.name])
  const matched = names.filter((n) => state.mappings[n.name])
  const dishName = (id: string) => (id === "ignored" ? null : state.dishes.find((d) => d.id === id)?.name ?? "Deleted dish")
  const sortedDishes = [...state.dishes].sort((a, b) => a.name.localeCompare(b.name))

  function match(name: string, dishId: string) {
    actions.setMapping(name, dishId)
    toast.success(`"${name}" linked to ${dishName(dishId)}. Future imports will use this match.`)
  }

  function create(n: (typeof names)[number]) {
    const price = n.inHouseQty > 0 ? n.inHouseGross / n.inHouseQty : n.gross / Math.max(1, n.qty)
    const id = actions.upsertDish({ name: n.name, category: "Other", menuPrice: round2(price), deliveryPrice: null, packagingCost: null, recipe: [] })
    actions.setMapping(n.name, id)
    toast.success(`Created "${n.name}". Add its recipe so we can cost it.`)
    router.push(`/dishes/${id}`)
  }

  function acceptAll() {
    let count = 0
    for (const n of unmatched) {
      const s = suggestDish(n.name, state.dishes)
      if (s && s.score >= 0.5) {
        actions.setMapping(n.name, s.dish.id)
        count++
      }
    }
    toast.success(count ? `Matched ${count} item${count > 1 ? "s" : ""} using suggestions` : "No confident suggestions to accept")
  }

  return (
    <>
      <PageHeader
        title="Item matching"
        description="Link each POS item name to a dish once. We remember it for every future import."
        actions={
          unmatched.length > 1 && (
            <Button variant="outline" onClick={acceptAll}>
              <Sparkles /> Accept confident suggestions
            </Button>
          )
        }
      />

      {names.length === 0 ? (
        <EmptyState icon={Link2} title="Nothing to match yet" description="Upload a sales CSV first. Any item names we don't recognise will show up here." action={{ label: "Import sales", href: "/import" }} />
      ) : (
        <div className="grid gap-6">
          <Card className="gap-0 pb-0">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                Needs matching <Badge variant={unmatched.length ? "warning" : "success"}>{unmatched.length}</Badge>
              </CardTitle>
              <CardDescription>Sales for these names are left out of your profit numbers until they&apos;re matched or ignored.</CardDescription>
            </CardHeader>
            {unmatched.length === 0 ? (
              <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4 text-success" /> All POS items are matched. Nice.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">POS item name</TableHead>
                    <TableHead className="text-right">Sold</TableHead>
                    <TableHead className="text-right">Gross sales</TableHead>
                    <TableHead>Match to dish</TableHead>
                    <TableHead className="pr-6 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unmatched.map((n) => {
                    const s = suggestDish(n.name, state.dishes)
                    const selected = choice[n.name] ?? s?.dish.id ?? ""
                    return (
                      <TableRow key={n.name}>
                        <TableCell className="pl-6 font-medium">{n.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{n.qty.toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(n.gross, 0)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Select value={selected} onValueChange={(v) => setChoice({ ...choice, [n.name]: v })}>
                              <SelectTrigger className="w-56">
                                <SelectValue placeholder="Choose a dish" />
                              </SelectTrigger>
                              <SelectContent className="max-h-72">
                                {sortedDishes.map((d) => (
                                  <SelectItem key={d.id} value={d.id}>
                                    {d.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {s && selected === s.dish.id && !choice[n.name] && (
                              <Badge variant="secondary" className="hidden xl:inline-flex">
                                <Sparkles /> Suggested
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="pr-6 text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" disabled={!selected} onClick={() => match(n.name, selected)}>
                              <Link2 /> Match
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => create(n)}>
                              <Plus /> Create dish
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                actions.setMapping(n.name, "ignored")
                                toast(`"${n.name}" will be ignored`)
                              }}
                            >
                              <EyeOff /> Ignore
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </Card>

          {matched.length > 0 && (
            <Card className="gap-0 pb-0">
              <CardHeader className="border-b">
                <CardTitle>Remembered matches</CardTitle>
                <CardDescription>Applied automatically to every import.</CardDescription>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">POS item name</TableHead>
                    <TableHead>Linked to</TableHead>
                    <TableHead className="text-right">Sold</TableHead>
                    <TableHead className="pr-6 text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matched.map((n) => {
                    const target = dishName(state.mappings[n.name])
                    return (
                      <TableRow key={n.name}>
                        <TableCell className="pl-6">{n.name}</TableCell>
                        <TableCell>{target ? <span className="font-medium">{target}</span> : <Badge variant="outline">Ignored</Badge>}</TableCell>
                        <TableCell className="text-right tabular-nums">{n.qty.toLocaleString()}</TableCell>
                        <TableCell className="pr-6 text-right">
                          <Button size="xs" variant="ghost" onClick={() => actions.setMapping(n.name, null)}>
                            <Undo2 /> Unlink
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      )}
    </>
  )
}
