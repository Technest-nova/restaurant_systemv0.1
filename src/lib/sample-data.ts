import { addDays, uid } from "./calc"
import type {
  AppState,
  Channel,
  Country,
  DeliveryPlatform,
  Dish,
  Ingredient,
  PackUnit,
  Restaurant,
  SaleRow,
  SalesImport,
} from "./types"

export const COUNTRY_DEFAULTS: Record<Country, { currency: "GBP" | "AUD"; taxRate: number; taxName: string }> = {
  UK: { currency: "GBP", taxRate: 20, taxName: "VAT" },
  AU: { currency: "AUD", taxRate: 10, taxName: "GST" },
}

export function defaultPlatforms(): DeliveryPlatform[] {
  return [
    { id: "deliveroo", name: "Deliveroo", enabled: true, commissionPct: 30, fixedFeePerOrder: 0 },
    { id: "uber_eats", name: "Uber Eats", enabled: true, commissionPct: 30, fixedFeePerOrder: 0.99 },
    { id: "just_eat", name: "Just Eat", enabled: true, commissionPct: 14, fixedFeePerOrder: 0.5 },
  ]
}

export function defaultRestaurant(): Restaurant {
  return {
    name: "",
    country: "UK",
    currency: "GBP",
    pricesIncludeTax: true,
    taxRate: 20,
    targetFoodCostPct: 30,
    packagingCostDefault: 0.45,
    avgDishesPerOrder: 1.5,
    deliveryPriceUpliftPct: 15,
    platforms: defaultPlatforms(),
    reportDay: "Mon",
    reportEmail: "",
  }
}

export function emptyState(): AppState {
  return {
    version: 1,
    account: null,
    loggedIn: false,
    restaurant: defaultRestaurant(),
    ingredients: [],
    dishes: [],
    imports: [],
    sales: [],
    mappings: {},
    notes: [],
  }
}

/* ───────────── sample restaurant ───────────── */

type IngSeed = [key: string, name: string, category: string, packSize: number, unit: PackUnit, packPrice: number, supplier: string]

const ING: IngSeed[] = [
  ["beef", "Beef mince 20% fat", "Meat", 5, "kg", 32.5, "Brakes"],
  ["chicken", "Chicken breast", "Meat", 5, "kg", 27.0, "Brakes"],
  ["bacon", "Streaky bacon", "Meat", 2, "kg", 14.8, "Brakes"],
  ["salmon", "Salmon fillet", "Fish", 2, "kg", 34.0, "Direct Seafoods"],
  ["cod", "Cod loin", "Fish", 3, "kg", 42.0, "Direct Seafoods"],
  ["bun", "Brioche bun", "Bakery", 48, "each", 16.8, "Booker"],
  ["dough", "Pizza dough ball", "Bakery", 40, "each", 18.0, "Booker"],
  ["baguette", "Part-baked baguette", "Bakery", 10, "each", 6.5, "Booker"],
  ["cheddar", "Cheddar, sliced", "Dairy", 1, "kg", 9.2, "Booker"],
  ["mozz", "Mozzarella", "Dairy", 2, "kg", 13.5, "Booker"],
  ["parm", "Parmesan", "Dairy", 1, "kg", 16.9, "Booker"],
  ["cream", "Double cream", "Dairy", 2, "l", 6.4, "Booker"],
  ["butter", "Butter", "Dairy", 1, "kg", 7.8, "Booker"],
  ["eggs", "Free-range eggs", "Dairy", 30, "each", 7.5, "Booker"],
  ["potato", "Maris Piper potatoes", "Veg", 25, "kg", 14.0, "Local greengrocer"],
  ["chips", "Frozen chips 10mm", "Veg", 10, "kg", 18.5, "Brakes"],
  ["lettuce", "Iceberg lettuce", "Veg", 12, "each", 9.6, "Local greengrocer"],
  ["tomato", "Tomatoes", "Veg", 6, "kg", 11.4, "Local greengrocer"],
  ["onion", "Onions", "Veg", 10, "kg", 8.5, "Local greengrocer"],
  ["garlic", "Garlic", "Veg", 1, "kg", 5.2, "Local greengrocer"],
  ["mushroom", "Chestnut mushrooms", "Veg", 2.5, "kg", 8.25, "Local greengrocer"],
  ["peas", "Frozen peas", "Veg", 2.5, "kg", 5.6, "Brakes"],
  ["rice", "Arborio rice", "Dry store", 5, "kg", 12.75, "Booker"],
  ["spaghetti", "Spaghetti", "Dry store", 3, "kg", 5.4, "Booker"],
  ["flour", "Plain flour", "Dry store", 16, "kg", 11.0, "Booker"],
  ["passata", "Tomato passata", "Dry store", 5, "l", 7.25, "Booker"],
  ["oil", "Sunflower oil", "Dry store", 20, "l", 36.0, "Booker"],
  ["sauce", "Burger sauce", "Dry store", 2, "l", 8.4, "Booker"],
  ["stp", "Sticky toffee pudding portion", "Desserts", 24, "each", 27.6, "Brakes"],
  ["icecream", "Vanilla ice cream", "Desserts", 4, "l", 9.8, "Brakes"],
  ["coke", "Coca-Cola 330ml can", "Drinks", 24, "each", 13.2, "Booker"],
]

type Line = [ing: string, qty: number, unit: PackUnit, waste?: number]
type DishSeed = {
  key: string
  name: string
  pos: string
  category: string
  price: number
  delivery?: number | null
  packaging?: number | null
  weekly: number // in-house + delivery units per week
  deliveryShare: number // share of sales on apps
  recipe: Line[]
}

const DISHES: DishSeed[] = [
  {
    key: "cheeseburger", name: "Classic Cheeseburger", pos: "Cheeseburger", category: "Burgers", price: 13.5, packaging: 0.6, weekly: 95, deliveryShare: 0.45,
    recipe: [["beef", 170, "g", 5], ["bun", 1, "each"], ["cheddar", 30, "g"], ["lettuce", 0.1, "each"], ["tomato", 30, "g", 10], ["sauce", 20, "ml"], ["chips", 200, "g", 5], ["oil", 30, "ml"]],
  },
  {
    key: "bacondouble", name: "Bacon Double Burger", pos: "Bacon Dbl Burger", category: "Burgers", price: 16.5, delivery: 16.5, packaging: 0.6, weekly: 42, deliveryShare: 0.5,
    recipe: [["beef", 340, "g", 5], ["bun", 1, "each"], ["cheddar", 60, "g"], ["bacon", 60, "g"], ["sauce", 25, "ml"], ["chips", 200, "g", 5], ["oil", 30, "ml"]],
  },
  {
    key: "chickenburger", name: "Chicken Burger", pos: "Chkn Burger", category: "Burgers", price: 12.5, packaging: 0.6, weekly: 70, deliveryShare: 0.45,
    recipe: [["chicken", 180, "g", 5], ["bun", 1, "each"], ["lettuce", 0.1, "each"], ["sauce", 20, "ml"], ["chips", 200, "g", 5], ["oil", 40, "ml"]],
  },
  {
    key: "fishchips", name: "Fish & Chips", pos: "Fish n Chips", category: "Mains", price: 15.95, weekly: 78, deliveryShare: 0.35,
    recipe: [["cod", 220, "g", 8], ["flour", 60, "g"], ["oil", 80, "ml"], ["chips", 300, "g", 5], ["peas", 80, "g"]],
  },
  {
    key: "salmon", name: "Pan-fried Salmon", pos: "Salmon Fillet", category: "Mains", price: 18.5, weekly: 16, deliveryShare: 0.15,
    recipe: [["salmon", 200, "g", 5], ["potato", 250, "g", 15], ["butter", 20, "g"], ["peas", 60, "g"]],
  },
  {
    key: "carbonara", name: "Spaghetti Carbonara", pos: "Carbonara", category: "Pasta", price: 13.0, weekly: 34, deliveryShare: 0.3,
    recipe: [["spaghetti", 140, "g"], ["bacon", 60, "g"], ["eggs", 2, "each"], ["parm", 25, "g"], ["cream", 50, "ml"]],
  },
  {
    key: "risotto", name: "Mushroom Risotto", pos: "Mushroom Risotto", category: "Pasta", price: 12.5, weekly: 11, deliveryShare: 0.2,
    recipe: [["rice", 100, "g"], ["mushroom", 150, "g", 10], ["butter", 30, "g"], ["parm", 30, "g"], ["onion", 50, "g", 10], ["cream", 40, "ml"]],
  },
  {
    key: "margherita", name: "Margherita Pizza", pos: "Pizza Margherita", category: "Pizza", price: 10.5, packaging: 0.55, weekly: 48, deliveryShare: 0.55,
    recipe: [["dough", 1, "each"], ["passata", 80, "ml"], ["mozz", 120, "g"]],
  },
  {
    key: "garlicbread", name: "Garlic Bread", pos: "Garlic Bread", category: "Sides", price: 4.95, delivery: 4.95, packaging: 0.6, weekly: 50, deliveryShare: 0.4,
    recipe: [["baguette", 0.5, "each"], ["butter", 30, "g"], ["garlic", 10, "g", 10]],
  },
  {
    key: "loadedfries", name: "Loaded Fries", pos: "Loaded Fries", category: "Sides", price: 6.5, weekly: 40, deliveryShare: 0.5,
    recipe: [["chips", 250, "g", 5], ["cheddar", 50, "g"], ["bacon", 30, "g"], ["oil", 30, "ml"]],
  },
  {
    key: "sidesalad", name: "Side Salad", pos: "Side Salad", category: "Sides", price: 3.95, delivery: 3.95, packaging: 0.8, weekly: 14, deliveryShare: 0.4,
    recipe: [["lettuce", 0.25, "each"], ["tomato", 60, "g", 10], ["onion", 20, "g", 10]],
  },
  {
    key: "stp", name: "Sticky Toffee Pudding", pos: "Sticky Toffee Pud", category: "Desserts", price: 7.25, weekly: 24, deliveryShare: 0.2,
    recipe: [["stp", 1, "each"], ["icecream", 80, "ml"]],
  },
  {
    key: "coke", name: "Coca-Cola can", pos: "Coke Can", category: "Drinks", price: 2.5, delivery: 2.5, packaging: 0.15, weekly: 110, deliveryShare: 0.45,
    recipe: [["coke", 1, "each"]],
  },
]

/** POS names that exist in the sample sales but are not linked yet (to demo Item matching). */
const UNMATCHED: { pos: string; price: number; weekly: number }[] = [
  { pos: "Kids Nuggets & Chips", price: 6.95, weekly: 18 },
  { pos: "Garlic Bread LRG", price: 6.45, weekly: 9 },
  { pos: "Extra Dip", price: 0.95, weekly: 30 },
]

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const WEEKDAY_FACTOR = [1.35, 0.7, 0.75, 0.85, 1.0, 1.45, 1.6] // Sun..Sat

export function buildSampleState(base: AppState, country: Country = "UK"): AppState {
  const fx = country === "AU" ? 1.9 : 1
  const cd = COUNTRY_DEFAULTS[country]
  const now = new Date().toISOString()
  const r = (n: number) => Math.round(n * fx * 100) / 100

  const ingIds = new Map<string, string>()
  const ingredients: Ingredient[] = ING.map(([key, name, category, packSize, unit, packPrice, supplier]) => {
    const id = uid("ing")
    ingIds.set(key, id)
    return { id, name, category, packSize, unit, packPrice: r(packPrice), supplier, updatedAt: addDays(now.slice(0, 10), -Math.floor(Math.random() * 40)) }
  })

  const dishes: Dish[] = []
  const mappings: Record<string, string> = {}
  for (const d of DISHES) {
    const id = uid("dish")
    dishes.push({
      id,
      name: d.name,
      category: d.category,
      menuPrice: r(d.price),
      deliveryPrice: d.delivery == null ? null : r(d.delivery),
      packagingCost: d.packaging == null ? null : r(d.packaging),
      recipe: d.recipe.map(([ing, quantity, unit, waste]) => ({
        id: uid("ln"),
        ingredientId: ingIds.get(ing)!,
        quantity,
        unit,
        wastePct: waste ?? 0,
      })),
      createdAt: now,
    })
    mappings[d.pos] = id
  }

  const restaurant: Restaurant = {
    ...base.restaurant,
    name: base.restaurant.name || (country === "AU" ? "The Copper Pot Sydney" : "The Copper Pot"),
    country,
    currency: cd.currency,
    taxRate: cd.taxRate,
    pricesIncludeTax: true,
    packagingCostDefault: r(0.45),
    platforms: defaultPlatforms().map((p) => ({ ...p, fixedFeePerOrder: r(p.fixedFeePerOrder) })),
    reportEmail: base.restaurant.reportEmail || base.account?.email || "owner@example.com",
  }

  // 8 weeks of daily sales ending yesterday
  const rand = mulberry32(42)
  const end = addDays(new Date().toISOString().slice(0, 10), -1)
  const start = addDays(end, -55)
  const imp: SalesImport = {
    id: uid("imp"),
    source: "square",
    fileName: "sample-square-items.csv",
    periodStart: start,
    periodEnd: end,
    rowCount: 0,
    createdAt: now,
  }
  const sales: SaleRow[] = []
  const platformMix: [Channel, number][] = [
    ["deliveroo", 0.5],
    ["uber_eats", 0.32],
    ["just_eat", 0.18],
  ]
  const uplift = 1 + restaurant.deliveryPriceUpliftPct / 100

  const pushSales = (pos: string, weekly: number, deliveryShare: number, menuPrice: number, deliveryPrice: number) => {
    for (let i = 0; i < 56; i++) {
      const date = addDays(start, i)
      const dow = new Date(date + "T00:00:00Z").getUTCDay()
      const trend = 0.9 + (i / 56) * 0.2
      const dayMean = (weekly / 7) * WEEKDAY_FACTOR[dow] * trend
      const channels: [Channel, number][] = [["in_house", 1 - deliveryShare], ...platformMix.map(([c, s]) => [c, s * deliveryShare] as [Channel, number])]
      for (const [ch, share] of channels) {
        const mean = dayMean * share
        const qty = Math.max(0, Math.round(mean + (rand() - 0.5) * 2 * Math.sqrt(mean + 0.25)))
        if (qty === 0) continue
        const price = ch === "in_house" ? menuPrice : deliveryPrice
        sales.push({ id: uid("s"), importId: imp.id, date, posName: pos, channel: ch, quantity: qty, grossSales: Math.round(qty * price * 100) / 100 })
      }
    }
  }

  DISHES.forEach((d, idx) => {
    const dish = dishes[idx]
    pushSales(d.pos, d.weekly, d.deliveryShare, dish.menuPrice, dish.deliveryPrice ?? Math.round(dish.menuPrice * uplift * 100) / 100)
  })
  for (const u of UNMATCHED) pushSales(u.pos, u.weekly, 0.3, r(u.price), r(u.price * uplift))
  imp.rowCount = sales.length

  return {
    ...base,
    restaurant,
    ingredients,
    dishes,
    imports: [imp],
    sales,
    mappings,
    notes: [],
  }
}
