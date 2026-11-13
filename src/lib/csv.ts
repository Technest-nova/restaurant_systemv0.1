import Papa from "papaparse"
import type { Channel, Country, Ingredient, PackUnit } from "./types"

export interface ParseError {
  line: number // 1-based line number in the file (header = 1)
  message: string
  raw: Record<string, string>
}

export interface ParseResult<T> {
  headers: string[]
  preview: Record<string, string>[]
  rows: T[]
  errors: ParseError[]
  totalRows: number
}

export interface ParsedSale {
  date: string
  posName: string
  channel: Channel
  quantity: number
  grossSales: number
}

function parseCsv(text: string) {
  const res = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })
  return { data: res.data, headers: res.meta.fields ?? [] }
}

function findCol(headers: string[], ...names: string[]): string | undefined {
  const lower = headers.map((h) => h.toLowerCase().replace(/[\s_-]+/g, " ").trim())
  for (const n of names) {
    const idx = lower.indexOf(n.toLowerCase())
    if (idx >= 0) return headers[idx]
  }
  return undefined
}

export function parseMoney(v: string | undefined): number {
  if (v == null) return NaN
  const t = String(v).replace(/[£$€,\s]|A\$|AUD|GBP/gi, "").replace(/^\((.*)\)$/, "-$1")
  if (t === "") return NaN
  return Number(t)
}

/** Accepts yyyy-mm-dd, dd/mm/yyyy (UK/AU), d/m/yy, and ISO datetimes. */
export function parseDate(v: string | undefined, country: Country = "UK"): string | null {
  if (!v) return null
  const s = v.trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return iso(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (m) {
    let a = +m[1]
    let b = +m[2]
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]
    // UK & AU are day-first. If that's impossible, fall back to month-first.
    if (country && b > 12 && a <= 12) [a, b] = [b, a]
    return iso(y, b, a)
  }
  return null
}

function iso(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCMonth() !== mo - 1) return null
  return dt.toISOString().slice(0, 10)
}

export function parseChannel(v: string | undefined): Channel {
  const t = (v ?? "").toLowerCase()
  if (t.includes("deliveroo")) return "deliveroo"
  if (t.includes("uber")) return "uber_eats"
  if (t.includes("just eat") || t.includes("just_eat") || t.includes("justeat")) return "just_eat"
  return "in_house"
}

/* ───────────── sales: generic template ───────────── */

export const GENERIC_SALES_HEADERS = ["date", "item_name", "channel", "quantity", "gross_sales"]

export function parseGenericSales(text: string, country: Country): ParseResult<ParsedSale> {
  const { data, headers } = parseCsv(text)
  const cDate = findCol(headers, "date")
  const cItem = findCol(headers, "item name", "item")
  const cCh = findCol(headers, "channel")
  const cQty = findCol(headers, "quantity", "qty")
  const cGross = findCol(headers, "gross sales", "gross")
  const errors: ParseError[] = []
  const rows: ParsedSale[] = []
  const missing = [
    !cDate && "date",
    !cItem && "item_name",
    !cQty && "quantity",
    !cGross && "gross_sales",
  ].filter(Boolean)
  if (missing.length) {
    errors.push({ line: 1, message: `Missing column(s): ${missing.join(", ")}. Use the template headers: ${GENERIC_SALES_HEADERS.join(",")}`, raw: {} })
    return { headers, preview: data.slice(0, 20), rows, errors, totalRows: data.length }
  }
  data.forEach((raw, i) => {
    const line = i + 2
    const date = parseDate(raw[cDate!], country)
    const name = (raw[cItem!] ?? "").trim()
    const qty = Number(String(raw[cQty!] ?? "").trim())
    const gross = parseMoney(raw[cGross!])
    const problems: string[] = []
    if (!date) problems.push(`invalid date "${raw[cDate!] ?? ""}"`)
    if (!name) problems.push("item_name is empty")
    if (!Number.isFinite(qty) || qty <= 0) problems.push(`quantity "${raw[cQty!] ?? ""}" must be a number above 0`)
    if (!Number.isFinite(gross) || gross < 0) problems.push(`gross_sales "${raw[cGross!] ?? ""}" is not a valid amount`)
    if (problems.length) errors.push({ line, message: problems.join("; "), raw })
    else rows.push({ date: date!, posName: name, channel: parseChannel(cCh ? raw[cCh] : ""), quantity: qty, grossSales: gross })
  })
  return { headers, preview: data.slice(0, 20), rows, errors, totalRows: data.length }
}

/* ───────────── sales: Square "Item sales" export ───────────── */

export function parseSquareSales(text: string, country: Country): ParseResult<ParsedSale> {
  const { data, headers } = parseCsv(text)
  const cDate = findCol(headers, "date")
  const cItem = findCol(headers, "item", "item name")
  const cQty = findCol(headers, "qty", "quantity", "count")
  const cGross = findCol(headers, "gross sales")
  const cCh = findCol(headers, "channel", "dining option", "source")
  const cType = findCol(headers, "event type")
  const errors: ParseError[] = []
  const rows: ParsedSale[] = []
  const missing = [!cDate && "Date", !cItem && "Item", !cQty && "Qty", !cGross && "Gross Sales"].filter(Boolean)
  if (missing.length) {
    errors.push({ line: 1, message: `This doesn't look like a Square Item Sales export. Missing: ${missing.join(", ")}`, raw: {} })
    return { headers, preview: data.slice(0, 20), rows, errors, totalRows: data.length }
  }
  data.forEach((raw, i) => {
    const line = i + 2
    if (cType && /refund/i.test(raw[cType] ?? "")) return // refunds are skipped in the MVP
    const date = parseDate(raw[cDate!], country)
    const name = (raw[cItem!] ?? "").trim()
    const qty = Number(String(raw[cQty!] ?? "").replace(/,/g, "").trim())
    const gross = parseMoney(raw[cGross!])
    const problems: string[] = []
    if (!date) problems.push(`invalid date "${raw[cDate!] ?? ""}"`)
    if (!name) problems.push("Item is empty")
    if (!Number.isFinite(qty) || qty <= 0) problems.push(`Qty "${raw[cQty!] ?? ""}" must be above 0`)
    if (!Number.isFinite(gross)) problems.push(`Gross Sales "${raw[cGross!] ?? ""}" is not a valid amount`)
    if (problems.length) errors.push({ line, message: problems.join("; "), raw })
    else rows.push({ date: date!, posName: name, channel: parseChannel(cCh ? raw[cCh] : ""), quantity: qty, grossSales: gross })
  })
  return { headers, preview: data.slice(0, 20), rows, errors, totalRows: data.length }
}

/* ───────────── ingredients.csv ───────────── */

export const INGREDIENT_HEADERS = ["name", "category", "pack_size", "unit", "pack_price", "supplier"]
const UNITS: PackUnit[] = ["kg", "g", "l", "ml", "each"]

export function parseIngredients(text: string): ParseResult<Omit<Ingredient, "id" | "updatedAt">> {
  const { data, headers } = parseCsv(text)
  const errors: ParseError[] = []
  const rows: Omit<Ingredient, "id" | "updatedAt">[] = []
  const c = {
    name: findCol(headers, "name"),
    category: findCol(headers, "category"),
    size: findCol(headers, "pack size"),
    unit: findCol(headers, "unit"),
    price: findCol(headers, "pack price", "price"),
    supplier: findCol(headers, "supplier"),
  }
  if (!c.name || !c.size || !c.unit || !c.price) {
    errors.push({ line: 1, message: `Missing columns. Expected: ${INGREDIENT_HEADERS.join(",")}`, raw: {} })
    return { headers, preview: data.slice(0, 20), rows, errors, totalRows: data.length }
  }
  data.forEach((raw, i) => {
    const unitRaw = (raw[c.unit!] ?? "").trim().toLowerCase()
    const unit = (unitRaw === "litre" || unitRaw === "liter" ? "l" : unitRaw === "pcs" || unitRaw === "unit" ? "each" : unitRaw) as PackUnit
    const size = Number(raw[c.size!])
    const price = parseMoney(raw[c.price!])
    const name = (raw[c.name!] ?? "").trim()
    const p: string[] = []
    if (!name) p.push("name is empty")
    if (!UNITS.includes(unit)) p.push(`unit "${unitRaw}" must be one of ${UNITS.join(", ")}`)
    if (!(size > 0)) p.push("pack_size must be above 0")
    if (!(price >= 0)) p.push("pack_price is not a valid amount")
    if (p.length) errors.push({ line: i + 2, message: p.join("; "), raw })
    else
      rows.push({
        name,
        category: (c.category ? raw[c.category] : "")?.trim() || "Other",
        packSize: size,
        unit,
        packPrice: price,
        supplier: (c.supplier ? raw[c.supplier] : "")?.trim() ?? "",
      })
  })
  return { headers, preview: data.slice(0, 20), rows, errors, totalRows: data.length }
}

/* ───────────── dishes.csv ───────────── */

export const DISH_HEADERS = ["name", "category", "menu_price"]

export function parseDishes(text: string): ParseResult<{ name: string; category: string; menuPrice: number }> {
  const { data, headers } = parseCsv(text)
  const errors: ParseError[] = []
  const rows: { name: string; category: string; menuPrice: number }[] = []
  const cName = findCol(headers, "name", "dish")
  const cCat = findCol(headers, "category")
  const cPrice = findCol(headers, "menu price", "price")
  if (!cName || !cPrice) {
    errors.push({ line: 1, message: `Missing columns. Expected: ${DISH_HEADERS.join(",")}`, raw: {} })
    return { headers, preview: data.slice(0, 20), rows, errors, totalRows: data.length }
  }
  data.forEach((raw, i) => {
    const name = (raw[cName] ?? "").trim()
    const price = parseMoney(raw[cPrice])
    const p: string[] = []
    if (!name) p.push("name is empty")
    if (!(price > 0)) p.push("menu_price must be above 0")
    if (p.length) errors.push({ line: i + 2, message: p.join("; "), raw })
    else rows.push({ name, category: (cCat ? raw[cCat] : "")?.trim() || "Other", menuPrice: price })
  })
  return { headers, preview: data.slice(0, 20), rows, errors, totalRows: data.length }
}

/* ───────────── helpers ───────────── */

export function errorsToCsv(errors: ParseError[]): string {
  const keys = Array.from(new Set(errors.flatMap((e) => Object.keys(e.raw))))
  return Papa.unparse(errors.map((e) => ({ line: e.line, error: e.message, ...Object.fromEntries(keys.map((k) => [k, e.raw[k] ?? ""])) })))
}

export function downloadText(filename: string, text: string, type = "text/csv") {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
