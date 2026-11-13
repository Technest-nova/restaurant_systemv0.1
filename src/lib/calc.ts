import type {
  AppState,
  BaseUnit,
  Channel,
  DeliveryPlatform,
  Dish,
  Ingredient,
  PackUnit,
  Restaurant,
  SaleRow,
} from "./types"

/* ───────────── units ───────────── */

export function baseUnitOf(unit: PackUnit): BaseUnit {
  if (unit === "kg" || unit === "g") return "g"
  if (unit === "l" || unit === "ml") return "ml"
  return "each"
}

export function toBase(qty: number, unit: PackUnit): number {
  if (unit === "kg" || unit === "l") return qty * 1000
  return qty
}

/** Cost per pack unit as shown in the Ingredients table (e.g. £/kg). */
export function costPerPackUnit(ing: Ingredient): number {
  return ing.packSize > 0 ? ing.packPrice / ing.packSize : 0
}

export function costPerBaseUnit(ing: Ingredient): number {
  const base = toBase(ing.packSize, ing.unit)
  return base > 0 ? ing.packPrice / base : 0
}

export function compatibleUnits(unit: PackUnit): PackUnit[] {
  const b = baseUnitOf(unit)
  if (b === "g") return ["g", "kg"]
  if (b === "ml") return ["ml", "l"]
  return ["each"]
}

/* ───────────── tax ───────────── */

export function netOfTax(gross: number, r: Restaurant): number {
  return r.pricesIncludeTax ? gross / (1 + r.taxRate / 100) : gross
}

export function taxFactor(r: Restaurant): number {
  return r.pricesIncludeTax ? 1 / (1 + r.taxRate / 100) : 1
}

/* ───────────── dish economics ───────────── */

export type IngredientMap = Map<string, Ingredient>

export function ingredientMap(ings: Ingredient[]): IngredientMap {
  return new Map(ings.map((i) => [i.id, i]))
}

export function lineCost(
  line: { ingredientId: string; quantity: number; unit: PackUnit; wastePct: number },
  ings: IngredientMap
): { cost: number; error?: string } {
  const ing = ings.get(line.ingredientId)
  if (!ing) return { cost: 0, error: "Ingredient missing" }
  if (baseUnitOf(ing.unit) !== baseUnitOf(line.unit))
    return { cost: 0, error: `Unit ${line.unit} doesn't match ${ing.unit}` }
  const cost = toBase(line.quantity, line.unit) * costPerBaseUnit(ing) * (1 + (line.wastePct || 0) / 100)
  return { cost }
}

export function dishFoodCost(dish: Pick<Dish, "recipe">, ings: IngredientMap): number {
  return dish.recipe.reduce((s, l) => s + lineCost(l, ings).cost, 0)
}

export interface DishEconomics {
  cost: number
  net: number
  gp: number
  gpPct: number
  foodCostPct: number
  hasRecipe: boolean
}

export function dishEconomics(dish: Dish, r: Restaurant, ings: IngredientMap): DishEconomics {
  const cost = dishFoodCost(dish, ings)
  const net = netOfTax(dish.menuPrice, r)
  const gp = net - cost
  return {
    cost,
    net,
    gp,
    gpPct: net > 0 ? (gp / net) * 100 : 0,
    foodCostPct: net > 0 ? (cost / net) * 100 : 0,
    hasRecipe: dish.recipe.length > 0,
  }
}

export type Flag = "good" | "warning" | "bad" | "none"

/** Colour flag vs target food cost %: good = at/under target, warning = within 5 pts, bad = beyond. */
export function foodCostFlag(foodCostPct: number, target: number, hasRecipe: boolean): Flag {
  if (!hasRecipe) return "none"
  if (foodCostPct <= target) return "good"
  if (foodCostPct <= target + 5) return "warning"
  return "bad"
}

/* ───────────── delivery ───────────── */

export function dishDeliveryPrice(dish: Dish, r: Restaurant): number {
  return dish.deliveryPrice ?? round2(dish.menuPrice * (1 + r.deliveryPriceUpliftPct / 100))
}

export function dishPackaging(dish: Dish, r: Restaurant): number {
  return dish.packagingCost ?? r.packagingCostDefault
}

export interface PlatformEconomics {
  platform: DeliveryPlatform
  gross: number
  net: number
  commission: number
  fee: number
  packaging: number
  cost: number
  profit: number
  breakEvenPrice: number | null
  isLoss: boolean
}

export function platformEconomics(
  dish: Dish,
  p: DeliveryPlatform,
  r: Restaurant,
  ings: IngredientMap,
  grossOverride?: number
): PlatformEconomics {
  const gross = grossOverride ?? dishDeliveryPrice(dish, r)
  const net = netOfTax(gross, r)
  const commission = (gross * p.commissionPct) / 100
  const fee = p.fixedFeePerOrder / Math.max(1, r.avgDishesPerOrder)
  const packaging = dishPackaging(dish, r)
  const cost = dishFoodCost(dish, ings)
  const profit = net - cost - commission - fee - packaging
  const denom = taxFactor(r) - p.commissionPct / 100
  const breakEvenPrice = denom > 0 ? (cost + packaging + fee) / denom : null
  return { platform: p, gross, net, commission, fee, packaging, cost, profit, breakEvenPrice, isLoss: profit < 0 }
}

/* ───────────── periods ───────────── */

export type PeriodKey = "last_week" | "last_4_weeks" | "all"

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  last_week: "Last 7 days",
  last_4_weeks: "Last 4 weeks",
  all: "All imported data",
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function periodRange(sales: SaleRow[], period: PeriodKey): { start: string; end: string } | null {
  if (sales.length === 0) return null
  let min = sales[0].date
  let max = sales[0].date
  for (const s of sales) {
    if (s.date < min) min = s.date
    if (s.date > max) max = s.date
  }
  if (period === "all") return { start: min, end: max }
  const days = period === "last_week" ? 7 : 28
  const start = addDays(max, -(days - 1))
  return { start: start < min ? min : start, end: max }
}

export function weeksInRange(range: { start: string; end: string } | null): number {
  if (!range) return 1
  const ms = new Date(range.end).getTime() - new Date(range.start).getTime()
  return Math.max(1, (ms / 86400000 + 1) / 7)
}

/* ───────────── sales aggregation ───────────── */

export interface DishStats {
  dish: Dish
  qty: number
  grossSales: number
  netRevenue: number
  foodCost: number
  deliveryCosts: number // commission + fees + packaging
  profit: number
  unitProfit: number
  byChannel: Partial<Record<Channel, { qty: number; profit: number; netRevenue: number }>>
}

export interface Aggregate {
  range: { start: string; end: string } | null
  weeks: number
  dishes: DishStats[]
  totals: {
    qty: number
    netRevenue: number
    foodCost: number
    deliveryCosts: number
    grossProfit: number
    foodCostPct: number
    deliveryProfit: number
    deliveryNetRevenue: number
  }
  unmatchedNames: { name: string; qty: number; gross: number }[]
}

export interface AggregateFilter {
  period: PeriodKey
  category?: string // "all" or category
  channel?: string // "all" | "in_house" | "delivery" | PlatformId
}

function channelMatches(ch: Channel, filter?: string): boolean {
  if (!filter || filter === "all") return true
  if (filter === "delivery") return ch !== "in_house"
  return ch === filter
}

export function aggregate(state: AppState, filter: AggregateFilter): Aggregate {
  const r = state.restaurant
  const ings = ingredientMap(state.ingredients)
  const dishById = new Map(state.dishes.map((d) => [d.id, d]))
  const costCache = new Map<string, number>()
  const unitCost = (d: Dish) => {
    if (!costCache.has(d.id)) costCache.set(d.id, dishFoodCost(d, ings))
    return costCache.get(d.id)!
  }
  const platforms = new Map(r.platforms.map((p) => [p.id, p]))
  const range = periodRange(state.sales, filter.period)
  const stats = new Map<string, DishStats>()
  const unmatched = new Map<string, { name: string; qty: number; gross: number }>()

  const totals = {
    qty: 0,
    netRevenue: 0,
    foodCost: 0,
    deliveryCosts: 0,
    grossProfit: 0,
    foodCostPct: 0,
    deliveryProfit: 0,
    deliveryNetRevenue: 0,
  }

  for (const s of state.sales) {
    if (range && (s.date < range.start || s.date > range.end)) continue
    if (!channelMatches(s.channel, filter.channel)) continue
    const mapped = state.mappings[s.posName]
    if (!mapped) {
      const u = unmatched.get(s.posName) ?? { name: s.posName, qty: 0, gross: 0 }
      u.qty += s.quantity
      u.gross += s.grossSales
      unmatched.set(s.posName, u)
      continue
    }
    if (mapped === "ignored") continue
    const dish = dishById.get(mapped)
    if (!dish) continue
    if (filter.category && filter.category !== "all" && dish.category !== filter.category) continue

    const net = netOfTax(s.grossSales, r)
    const food = unitCost(dish) * s.quantity
    let delivery = 0
    if (s.channel !== "in_house") {
      const p = platforms.get(s.channel)
      if (p) {
        delivery =
          (s.grossSales * p.commissionPct) / 100 +
          (s.quantity * p.fixedFeePerOrder) / Math.max(1, r.avgDishesPerOrder) +
          s.quantity * dishPackaging(dish, r)
      }
    }
    const profit = net - food - delivery

    let st = stats.get(dish.id)
    if (!st) {
      st = { dish, qty: 0, grossSales: 0, netRevenue: 0, foodCost: 0, deliveryCosts: 0, profit: 0, unitProfit: 0, byChannel: {} }
      stats.set(dish.id, st)
    }
    st.qty += s.quantity
    st.grossSales += s.grossSales
    st.netRevenue += net
    st.foodCost += food
    st.deliveryCosts += delivery
    st.profit += profit
    const bc = st.byChannel[s.channel] ?? { qty: 0, profit: 0, netRevenue: 0 }
    bc.qty += s.quantity
    bc.profit += profit
    bc.netRevenue += net
    st.byChannel[s.channel] = bc

    totals.qty += s.quantity
    totals.netRevenue += net
    totals.foodCost += food
    totals.deliveryCosts += delivery
    totals.grossProfit += profit
    if (s.channel !== "in_house") {
      totals.deliveryProfit += profit
      totals.deliveryNetRevenue += net
    }
  }

  for (const st of stats.values()) st.unitProfit = st.qty > 0 ? st.profit / st.qty : 0
  totals.foodCostPct = totals.netRevenue > 0 ? (totals.foodCost / totals.netRevenue) * 100 : 0

  return {
    range,
    weeks: weeksInRange(range),
    dishes: [...stats.values()].sort((a, b) => b.profit - a.profit),
    totals,
    unmatchedNames: [...unmatched.values()].sort((a, b) => b.qty - a.qty),
  }
}

/* ───────────── menu engineering ───────────── */

export type MenuClass = "Star" | "Plowhorse" | "Puzzle" | "Dog"

export const MENU_CLASS_INFO: Record<MenuClass, { label: string; meaning: string; action: string; color: string }> = {
  Star: {
    label: "Star",
    meaning: "Popular and profitable",
    action: "Keep it prominent and consistent. Test a small price rise (3–5%).",
    color: "#2a78d6",
  },
  Plowhorse: {
    label: "Plowhorse",
    meaning: "Popular, low margin",
    action: "Raise the price 5–10% or cut cost (portion, cheaper supplier).",
    color: "#eb6834",
  },
  Puzzle: {
    label: "Puzzle",
    meaning: "Profitable, low sales",
    action: "Promote it: move higher on the menu, rename, have staff recommend it.",
    color: "#1baf7a",
  },
  Dog: {
    label: "Dog",
    meaning: "Low sales, low margin",
    action: "Remove it or rework the recipe and price.",
    color: "#eda100",
  },
}

export interface MenuItemClass extends DishStats {
  menuClass: MenuClass
  popularityPct: number
}

export function menuEngineering(dishes: DishStats[]): {
  items: MenuItemClass[]
  popThresholdPct: number
  avgUnitProfit: number
} {
  const sold = dishes.filter((d) => d.qty > 0)
  const totalQty = sold.reduce((s, d) => s + d.qty, 0)
  const totalProfit = sold.reduce((s, d) => s + d.profit, 0)
  const n = sold.length || 1
  // Kasavana & Smith: popular if share ≥ 70% of an equal share
  const popThresholdPct = (100 / n) * 0.7
  const avgUnitProfit = totalQty > 0 ? totalProfit / totalQty : 0
  const items = sold.map((d) => {
    const popularityPct = totalQty > 0 ? (d.qty / totalQty) * 100 : 0
    const popular = popularityPct >= popThresholdPct
    const profitable = d.unitProfit >= avgUnitProfit
    const menuClass: MenuClass = popular ? (profitable ? "Star" : "Plowhorse") : profitable ? "Puzzle" : "Dog"
    return { ...d, menuClass, popularityPct }
  })
  return { items, popThresholdPct, avgUnitProfit }
}

/* ───────────── string matching ───────────── */

function bigrams(s: string): string[] {
  const t = s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim()
  const out: string[] = []
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2))
  return out
}

export function similarity(a: string, b: string): number {
  const A = bigrams(a)
  const B = bigrams(b)
  if (!A.length || !B.length) return a.toLowerCase() === b.toLowerCase() ? 1 : 0
  const counts = new Map<string, number>()
  for (const x of A) counts.set(x, (counts.get(x) ?? 0) + 1)
  let hits = 0
  for (const x of B) {
    const c = counts.get(x) ?? 0
    if (c > 0) {
      hits++
      counts.set(x, c - 1)
    }
  }
  return (2 * hits) / (A.length + B.length)
}

export function suggestDish(posName: string, dishes: Dish[]): { dish: Dish; score: number } | null {
  let best: { dish: Dish; score: number } | null = null
  for (const d of dishes) {
    const score = similarity(posName, d.name)
    if (!best || score > best.score) best = { dish: d, score }
  }
  return best && best.score >= 0.35 ? best : null
}

/* ───────────── formatting ───────────── */

export function round2(n: number) {
  return Math.round(n * 100) / 100
}

export function fmtMoney(n: number, currency: string, opts: { decimals?: number } = {}) {
  const locale = currency === "AUD" ? "en-AU" : "en-GB"
  const d = opts.decimals ?? 2
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(Number.isFinite(n) ? n : 0)
}

export function fmtPct(n: number, decimals = 1) {
  return `${(Number.isFinite(n) ? n : 0).toFixed(decimals)}%`
}

export function fmtDate(iso: string) {
  return new Date(iso.length === 10 ? iso + "T00:00:00" : iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}
