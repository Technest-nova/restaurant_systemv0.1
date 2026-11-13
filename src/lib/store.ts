"use client"

/**
 * Mock data layer (localStorage). Every mutation lives in `actions` below, so when
 * the Supabase backend is ready you replace the bodies of these functions with
 * Supabase queries and keep every screen unchanged. See SUPABASE_MIGRATION.md.
 */
import { useSyncExternalStore } from "react"
import { uid } from "./calc"
import { buildSampleState, COUNTRY_DEFAULTS, emptyState } from "./sample-data"
import type {
  Account,
  AppState,
  Country,
  Dish,
  Ingredient,
  Restaurant,
  SaleRow,
  SalesImport,
  ScenarioNote,
  SubscriptionStatus,
} from "./types"

const KEY = "rpa-state-v1"
const TRIAL_DAYS = 14

let state: AppState = emptyState()
let loaded = false
const listeners = new Set<() => void>()

function load() {
  if (loaded || typeof window === "undefined") return
  loaded = true
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw) state = { ...emptyState(), ...JSON.parse(raw) }
  } catch {
    /* corrupted or unavailable storage: start fresh */
  }
}

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* quota or private mode: keep in memory */
  }
}

function set(updater: (s: AppState) => AppState) {
  load()
  state = updater(state)
  persist()
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

const serverSnapshot = emptyState()

export function useAppState(): AppState {
  return useSyncExternalStore(
    subscribe,
    () => {
      load()
      return state
    },
    () => serverSnapshot
  )
}

export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
}

export function getState() {
  load()
  return state
}

/* ───────────── derived helpers ───────────── */

export function trialDaysLeft(a: Account | null): number {
  if (!a) return 0
  const ms = new Date(a.trialEndsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86400000))
}

export function hasAccess(a: Account | null): boolean {
  if (!a) return false
  if (a.subscriptionStatus === "active") return true
  if (a.subscriptionStatus === "trialing") return trialDaysLeft(a) > 0
  return false
}

/* ───────────── actions ───────────── */

export const actions = {
  /* auth (→ Supabase Auth) */
  signUp(email: string, name: string, provider: Account["provider"] = "email") {
    set((s) => {
      const fresh = emptyState()
      return {
        ...fresh,
        loggedIn: true,
        account: {
          email,
          name,
          provider,
          trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString(),
          subscriptionStatus: "trialing",
          onboarded: false,
        },
        restaurant: { ...fresh.restaurant, reportEmail: email },
        // keep nothing from a previous mock account
        version: s.version,
      }
    })
  },
  logIn(email: string): "ok" | "no_account" {
    const s = getState()
    if (!s.account || s.account.email.toLowerCase() !== email.toLowerCase()) return "no_account"
    set((st) => ({ ...st, loggedIn: true }))
    return "ok"
  },
  logOut() {
    set((s) => ({ ...s, loggedIn: false }))
  },

  /* onboarding / restaurant (→ table: restaurants, delivery_platforms) */
  updateRestaurant(patch: Partial<Restaurant>) {
    set((s) => ({ ...s, restaurant: { ...s.restaurant, ...patch } }))
  },
  setCountry(country: Country) {
    const d = COUNTRY_DEFAULTS[country]
    set((s) => ({ ...s, restaurant: { ...s.restaurant, country, currency: d.currency, taxRate: d.taxRate } }))
  },
  completeOnboarding() {
    set((s) => (s.account ? { ...s, account: { ...s.account, onboarded: true } } : s))
  },
  loadSampleData() {
    set((s) => {
      const next = buildSampleState(s, s.restaurant.country)
      return s.account ? { ...next, account: { ...s.account, onboarded: true } } : next
    })
  },
  clearBusinessData() {
    set((s) => ({ ...s, ingredients: [], dishes: [], imports: [], sales: [], mappings: {}, notes: [] }))
  },
  resetEverything() {
    set(() => emptyState())
  },

  /* ingredients (→ table: ingredients) */
  upsertIngredient(ing: Omit<Ingredient, "id" | "updatedAt"> & { id?: string }) {
    set((s) => {
      const now = new Date().toISOString()
      if (ing.id) {
        return { ...s, ingredients: s.ingredients.map((i) => (i.id === ing.id ? { ...i, ...ing, id: i.id, updatedAt: now } : i)) }
      }
      return { ...s, ingredients: [...s.ingredients, { ...ing, id: uid("ing"), updatedAt: now }] }
    })
  },
  deleteIngredient(id: string) {
    set((s) => ({
      ...s,
      ingredients: s.ingredients.filter((i) => i.id !== id),
      dishes: s.dishes.map((d) => ({ ...d, recipe: d.recipe.filter((l) => l.ingredientId !== id) })),
    }))
  },
  importIngredients(rows: Omit<Ingredient, "id" | "updatedAt">[]) {
    set((s) => {
      const now = new Date().toISOString()
      const byName = new Map(s.ingredients.map((i) => [i.name.toLowerCase(), i]))
      const list = [...s.ingredients]
      for (const r of rows) {
        const existing = byName.get(r.name.toLowerCase())
        if (existing) {
          const idx = list.findIndex((i) => i.id === existing.id)
          list[idx] = { ...existing, ...r, updatedAt: now }
        } else list.push({ ...r, id: uid("ing"), updatedAt: now })
      }
      return { ...s, ingredients: list }
    })
  },

  /* dishes + recipes (→ tables: dishes, recipe_lines) */
  upsertDish(dish: Omit<Dish, "id" | "createdAt"> & { id?: string }): string {
    let id = dish.id ?? ""
    set((s) => {
      if (dish.id) return { ...s, dishes: s.dishes.map((d) => (d.id === dish.id ? { ...d, ...dish, id: d.id } : d)) }
      id = uid("dish")
      return { ...s, dishes: [...s.dishes, { ...dish, id, createdAt: new Date().toISOString() }] }
    })
    return id
  },
  deleteDish(id: string) {
    set((s) => ({
      ...s,
      dishes: s.dishes.filter((d) => d.id !== id),
      mappings: Object.fromEntries(Object.entries(s.mappings).filter(([, v]) => v !== id)),
    }))
  },
  importDishes(rows: { name: string; category: string; menuPrice: number }[]) {
    set((s) => {
      const byName = new Map(s.dishes.map((d) => [d.name.toLowerCase(), d]))
      const list = [...s.dishes]
      for (const r of rows) {
        const existing = byName.get(r.name.toLowerCase())
        if (existing) {
          const idx = list.findIndex((d) => d.id === existing.id)
          list[idx] = { ...existing, category: r.category, menuPrice: r.menuPrice }
        } else
          list.push({ ...r, id: uid("dish"), deliveryPrice: null, packagingCost: null, recipe: [], createdAt: new Date().toISOString() })
      }
      return { ...s, dishes: list }
    })
  },

  /* sales imports (→ tables: sales_imports, sales_rows) */
  addSalesImport(imp: Omit<SalesImport, "id" | "createdAt" | "rowCount">, rows: Omit<SaleRow, "id" | "importId">[]): SalesImport {
    const full: SalesImport = { ...imp, id: uid("imp"), createdAt: new Date().toISOString(), rowCount: rows.length }
    set((s) => {
      // auto-link POS names that exactly match a dish name
      const mappings = { ...s.mappings }
      const byName = new Map(s.dishes.map((d) => [d.name.toLowerCase(), d.id]))
      for (const r of rows) {
        if (!mappings[r.posName] && byName.has(r.posName.toLowerCase())) mappings[r.posName] = byName.get(r.posName.toLowerCase())!
      }
      return {
        ...s,
        mappings,
        imports: [full, ...s.imports],
        sales: [...s.sales, ...rows.map((r) => ({ ...r, id: uid("s"), importId: full.id }))],
      }
    })
    return full
  },
  deleteImport(id: string) {
    set((s) => ({ ...s, imports: s.imports.filter((i) => i.id !== id), sales: s.sales.filter((r) => r.importId !== id) }))
  },

  /* item matching (→ table: item_mappings) */
  setMapping(posName: string, target: string | null) {
    set((s) => {
      const mappings = { ...s.mappings }
      if (target) mappings[posName] = target
      else delete mappings[posName]
      return { ...s, mappings }
    })
  },

  /* price simulator notes (→ table: scenario_notes) */
  addNote(title: string, body: string) {
    const note: ScenarioNote = { id: uid("note"), title, body, createdAt: new Date().toISOString() }
    set((s) => ({ ...s, notes: [note, ...s.notes] }))
  },
  deleteNote(id: string) {
    set((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }))
  },

  /* billing (→ Paddle webhooks update subscriptions table) */
  setSubscription(status: SubscriptionStatus) {
    set((s) => (s.account ? { ...s, account: { ...s.account, subscriptionStatus: status } } : s))
  },
  endTrialNow() {
    set((s) =>
      s.account
        ? { ...s, account: { ...s.account, subscriptionStatus: "trialing", trialEndsAt: new Date(Date.now() - 1000).toISOString() } }
        : s
    )
  },
  restartTrial() {
    set((s) =>
      s.account
        ? {
            ...s,
            account: {
              ...s.account,
              subscriptionStatus: "trialing",
              trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString(),
            },
          }
        : s
    )
  },
}

