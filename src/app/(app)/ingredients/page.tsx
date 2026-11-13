"use client"

import * as React from "react"
import { FileUp, Pencil, Plus, Search, ShoppingBasket, Trash2 } from "lucide-react"
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
import { currencySymbol, EmptyState, Field, NumberInput, PageHeader, useMoney } from "@/components/app/common"
import { costPerPackUnit, fmtDate } from "@/lib/calc"
import { parseIngredients } from "@/lib/csv"
import { actions, useAppState } from "@/lib/store"
import type { Ingredient, PackUnit } from "@/lib/types"

type Draft = Omit<Ingredient, "id" | "updatedAt"> & { id?: string }
const EMPTY: Draft = { name: "", category: "", packSize: 1, unit: "kg", packPrice: 0, supplier: "" }
const UNITS: PackUnit[] = ["kg", "g", "l", "ml", "each"]

export default function IngredientsPage() {
  const { ingredients, dishes, restaurant } = useAppState()
  const money = useMoney()
  const [q, setQ] = React.useState("")
  const [cat, setCat] = React.useState("all")
  const [draft, setDraft] = React.useState<Draft | null>(null)
  const [importOpen, setImportOpen] = React.useState(false)
  const [toDelete, setToDelete] = React.useState<Ingredient | null>(null)

  const categories = React.useMemo(() => [...new Set(ingredients.map((i) => i.category))].sort(), [ingredients])
  const rows = ingredients
    .filter((i) => (cat === "all" || i.category === cat) && (i.name + i.supplier).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))

  const usedIn = (id: string) => dishes.filter((d) => d.recipe.some((l) => l.ingredientId === id)).length

  function save() {
    if (!draft) return
    if (!draft.name.trim()) return toast.error("Name is required")
    if (!(draft.packSize > 0)) return toast.error("Pack size must be above 0")
    actions.upsertIngredient({ ...draft, name: draft.name.trim(), category: draft.category.trim() || "Other" })
    toast.success(draft.id ? "Ingredient updated. Recipe costs refreshed." : "Ingredient added")
    setDraft(null)
  }

  return (
    <>
      <PageHeader
        title="Ingredients"
        description="Your price list. Update a price here and every recipe that uses it is re-costed instantly."
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileUp /> Import CSV
            </Button>
            <Button onClick={() => setDraft({ ...EMPTY })}>
              <Plus /> Add ingredient
            </Button>
          </>
        }
      />

      {ingredients.length === 0 ? (
        <EmptyState
          icon={ShoppingBasket}
          title="Add your ingredients"
          description="Start with the 20–30 ingredients you buy most. Type them in, or import ingredients.csv from your supplier price list."
          action={{ label: "Add first ingredient", onClick: () => setDraft({ ...EMPTY }) }}
        />
      ) : (
        <Card className="gap-0 py-0">
          <div className="flex flex-wrap items-center gap-2 border-b p-4">
            <div className="relative w-full max-w-xs">
              <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <Input placeholder="Search name or supplier" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
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
            <span className="ml-auto text-sm text-muted-foreground">{rows.length} ingredients</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Pack size</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Pack price</TableHead>
                <TableHead className="text-right">Cost per unit</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Last updated</TableHead>
                <TableHead className="pr-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="pl-4 font-medium">{i.name}</TableCell>
                  <TableCell className="text-muted-foreground">{i.category}</TableCell>
                  <TableCell className="text-right tabular-nums">{i.packSize}</TableCell>
                  <TableCell>{i.unit}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(i.packPrice)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(costPerPackUnit(i), i.unit === "each" ? 3 : 2)}
                    <span className="text-muted-foreground"> / {i.unit}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{i.supplier || "–"}</TableCell>
                  <TableCell className="text-muted-foreground">{fmtDate(i.updatedAt)}</TableCell>
                  <TableCell className="pr-4 text-right">
                    <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => setDraft({ ...i })}>
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={() => setToDelete(i)}>
                      <Trash2 className="text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                    No ingredients match your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit ingredient" : "Add ingredient"}</DialogTitle>
            <DialogDescription>Enter the price you pay for one pack, as on your supplier invoice.</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="grid gap-4">
              <Field label="Name">
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Category">
                  <Input list="ing-cats" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="e.g. Meat" />
                  <datalist id="ing-cats">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Supplier">
                  <Input value={draft.supplier} onChange={(e) => setDraft({ ...draft, supplier: e.target.value })} />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Pack size">
                  <NumberInput value={draft.packSize} step="0.001" min={0} onChange={(v) => setDraft({ ...draft, packSize: v })} />
                </Field>
                <Field label="Unit">
                  <Select value={draft.unit} onValueChange={(v) => setDraft({ ...draft, unit: v as PackUnit })}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Pack price">
                  <NumberInput value={draft.packPrice} prefix={currencySymbol(restaurant.currency)} min={0} onChange={(v) => setDraft({ ...draft, packPrice: v })} />
                </Field>
              </div>
              <p className="rounded-md bg-muted px-3 py-2 text-sm">
                Cost per {draft.unit}:{" "}
                <strong className="tabular-nums">{money(draft.packSize > 0 ? draft.packPrice / draft.packSize : 0, 3)}</strong>
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {toDelete?.name}?</DialogTitle>
            <DialogDescription>
              {toDelete && usedIn(toDelete.id) > 0
                ? `It's used in ${usedIn(toDelete.id)} recipe(s). Those recipe lines will be removed and the dishes re-costed.`
                : "This can't be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (toDelete) actions.deleteIngredient(toDelete.id)
                toast.success("Ingredient deleted")
                setToDelete(null)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CsvImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import ingredients"
        description="Columns: name, category, pack_size, unit (kg, g, l, ml, each), pack_price, supplier. Existing names are updated."
        templateHref="/templates/ingredients-template.csv"
        templateName="ingredients.csv"
        parse={parseIngredients}
        onConfirm={(rows) => actions.importIngredients(rows)}
      />
    </>
  )
}
