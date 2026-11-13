// Domain types. Each interface maps 1:1 to a future Supabase table
// (see supabase/schema.sql). Field names use camelCase here, snake_case in SQL.

export type Country = "UK" | "AU"
export type Currency = "GBP" | "AUD"
export type PackUnit = "kg" | "g" | "l" | "ml" | "each"
export type BaseUnit = "g" | "ml" | "each"
export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun"

/** "in_house" or a delivery platform id */
export type Channel = "in_house" | PlatformId
export type PlatformId = "deliveroo" | "uber_eats" | "just_eat"

export interface DeliveryPlatform {
  id: PlatformId
  name: string
  enabled: boolean
  commissionPct: number // % of the customer-paid (gross) price
  fixedFeePerOrder: number // currency per order
}

export interface Restaurant {
  name: string
  country: Country
  currency: Currency
  pricesIncludeTax: boolean
  taxRate: number // 20 for UK VAT, 10 for AU GST
  targetFoodCostPct: number // e.g. 30
  packagingCostDefault: number // per delivery dish
  avgDishesPerOrder: number // used to spread platform fixed fee over dishes
  deliveryPriceUpliftPct: number // default markup on delivery apps vs menu price
  platforms: DeliveryPlatform[]
  reportDay: Weekday
  reportEmail: string
}

export interface Ingredient {
  id: string
  name: string
  category: string
  packSize: number
  unit: PackUnit
  packPrice: number
  supplier: string
  updatedAt: string // ISO
}

export interface RecipeLine {
  id: string
  ingredientId: string
  quantity: number
  unit: PackUnit
  wastePct: number
}

export interface Dish {
  id: string
  name: string
  category: string
  menuPrice: number // as the customer pays (tax-inclusive if pricesIncludeTax)
  deliveryPrice: number | null // null = menuPrice * (1 + uplift)
  packagingCost: number | null // null = restaurant default
  recipe: RecipeLine[]
  createdAt: string
}

export interface SalesImport {
  id: string
  source: "generic" | "square"
  fileName: string
  periodStart: string // yyyy-mm-dd
  periodEnd: string
  rowCount: number
  createdAt: string
}

export interface SaleRow {
  id: string
  importId: string
  date: string // yyyy-mm-dd
  posName: string
  channel: Channel
  quantity: number
  grossSales: number // customer-paid total for the line, tax-inclusive
}

/** POS item name → dish id, or "ignored" */
export type ItemMappings = Record<string, string>

export interface ScenarioNote {
  id: string
  title: string
  body: string
  createdAt: string
}

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled"

export interface Account {
  email: string
  name: string
  provider: "email" | "google"
  trialEndsAt: string
  subscriptionStatus: SubscriptionStatus
  onboarded: boolean
}

export interface AppState {
  version: number
  account: Account | null
  loggedIn: boolean
  restaurant: Restaurant
  ingredients: Ingredient[]
  dishes: Dish[]
  imports: SalesImport[]
  sales: SaleRow[]
  mappings: ItemMappings
  notes: ScenarioNote[]
}
