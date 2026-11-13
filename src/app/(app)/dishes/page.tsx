"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChefHat, FileUp, Plus, Search } from "lucide-react"
import { toast } from "sonner"
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
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CsvImportDialog } from "@/components/app/csv-import-dialog"
import { currencySymbol, EmptyState, Field, FlagBadge, NumberInput, PageHeader, useMoney } from "@/components/app/common"
import { dishEconomics, fmtPct, foodCostFlag, ingredientMap } from "@/lib/calc"
import { parseDishes } from "@/lib/csv"
import { actions, useAppState } from "@/lib/store"
import { cn } from "@/lib/utils"

export default function DishesPage() {
  const { dishes, ingredients, restaurant: r } = useAppState()
  const money = useMoney()
  const router = useRouter()
  const [q, setQ] = React.useState("")
  const [cat, setCat] = React.useState("all")
  const [addOpen, setAddOpen] = React.useState(false)
  const [importOpen, setImportOpen] = React.useState(false)
  const [draft, setDraft] = React.useState({ name: "", category: "", menuPrice: 0 })

  const ings = React.useMemo(() => ingredientMap(ingredients), [ingredients])
  const categories = React.useMemo(() => [...new Set(dishes.map((d) => d.category))].sort(), [dishes])
  const rows = dishes
    .filter((d) => (cat === "all" || d.category === cat) && d.name.toLowerCase().includes(q.toLowerCase()))
    .map((d) => ({ d, e: dishEconomics(d, r, ings) }))
    .sort((a, b) => a.d.category.localeCompare(b.d.category) || a.d.name.localeCompare(b.d.name))

  const withRecipe = rows.filter((x) => x.e.hasRecipe)
  const avgGp = withRecipe.length ? withRecipe.reduce((s, x) => s + x.e.gpPct, 0) / withRecipe.length : 0

  function create() {
    if (!draft.name.trim()) return toast.error("Dish name is required")
    if (!(draft.menuPrice > 0)) return toast.error("Menu price must be above 0")
    const id = actions.upsertDish({
      name: draft.name.trim(),
      category: draft.category.trim() || "Other",
      menuPrice: draft.menuPrice,
      deliveryPrice: null,
      packagingCost: null,
      recipe: [],
    })
    setAddOpen(false)
    router.push(`/dishes/${id}`)
  }

  return (
    <>
      <PageHeader
        title="Dishes & recipes"
        description={`Menu prices as customers pay them (${r.pricesIncludeTax ? `incl. ${r.country === "UK" ? "VAT" : "GST"}` : "ex. tax"}). GP is calculated after removing tax.`}
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileUp /> Import CSV
            </Button>
            <Button
              onClick={() => {
                setDraft({ name: "", category: "", menuPrice: 0 })
                setAddOpen(true)
              }}
            >
              <Plus /> Add dish
            </Button>
          </>
        }
      />

      {dishes.length === 0 ? (
        <EmptyState
          icon={ChefHat}
          title="Add your first dish"
          description={
            ingredients.length === 0
              ? "Add a few ingredients first, then build a recipe to see its cost, GP and GP % live."
              : "Add a dish and link its ingredients. You'll see cost, GP and GP % straight away, even before any sales data."
          }
          action={ingredients.length === 0 ? { label: "Go to ingredients", href: "/ingredients" } : { label: "Add dish", onClick: () => setAddOpen(true) }}
        />
      ) : (
        <Card className="gap-0 py-0">
          <div className="flex flex-wrap items-center gap-2 border-b p-4">
            <div className="relative w-full max-w-xs">
              <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <Input placeholder="Search dishes" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
            <Select value={cat} onValueChange={setCat}>
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
            <span className="ml-auto text-sm text-muted-foreground">
              Avg GP {fmtPct(avgGp)} · target {100 - r.targetFoodCostPct}%
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Dish</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Menu price</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">GP</TableHead>
                <TableHead className="text-right">GP %</TableHead>
                <TableHead>vs target</TableHead>
                <TableHead className="pr-4 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ d, e }) => (
                <TableRow key={d.id} className="cursor-pointer" onClick={() => router.push(`/dishes/${d.id}`)}>
                  <TableCell className="pl-4 font-medium">{d.name}</TableCell>
                  <TableCell className="text-muted-foreground">{d.category}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(d.menuPrice)}</TableCell>
                  <TableCell className="text-right tabular-nums">{e.hasRecipe ? money(e.cost) : "–"}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", e.gp < 0 && "text-destructive")}>{e.hasRecipe ? money(e.gp) : "–"}</TableCell>
                  <TableCell className="text-right tabular-nums">{e.hasRecipe ? fmtPct(e.gpPct) : "–"}</TableCell>
                  <TableCell>
                    <FlagBadge flag={foodCostFlag(e.foodCostPct, r.targetFoodCostPct, e.hasRecipe)} foodCostPct={e.hasRecipe ? e.foodCostPct : undefined} />
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <Button variant="outline" size="sm" asChild onClick={(ev) => ev.stopPropagation()}>
                      <Link href={`/dishes/${d.id}`}>Open recipe</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    No dishes match your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add dish</DialogTitle>
            <DialogDescription>Next you&apos;ll add its ingredients in the recipe builder.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Dish name">
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <Input list="dish-cats" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="e.g. Mains" />
                <datalist id="dish-cats">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="Menu price">
                <NumberInput value={draft.menuPrice} prefix={currencySymbol(r.currency)} min={0} onChange={(v) => setDraft({ ...draft, menuPrice: v })} />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create}>Create & open recipe</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CsvImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import dishes"
        description="Columns: name, category, menu_price. Existing dishes with the same name get their price updated."
        templateHref="/templates/dishes-template.csv"
        templateName="dishes.csv"
        parse={parseDishes}
        onConfirm={(rows) => actions.importDishes(rows)}
      />
    </>
  )
}
