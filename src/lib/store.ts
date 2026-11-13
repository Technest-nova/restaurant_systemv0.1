"use client"

/**
 * Data layer backed by Supabase (Auth + Postgres with row-level security).
 *
 * Screens read with `useAppState()` and write through `actions`. Each action
 * updates the in-memory cache immediately (optimistic UI), then persists to
 * Supabase through a serial write queue so dependent writes (e.g. create dish →
 * link POS item to it) always land in order. If a write fails, the user sees a
 * toast and the cache is re-synced from the database.
 */
import { useSyncExternalStore } from "react"
import { toast } from "sonner"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { uid } from "./calc"
import { buildSampleState, COUNTRY_DEFAULTS, defaultPlatforms, emptyState } from "./sample-data"
import { supabaseBrowser } from "./supabase/client"
import type {
  Account,
  AppState,
  Channel,
  Country,
  DeliveryPlatform,
  Dish,
  Ingredient,
  PackUnit,
  PlatformId,
  Restaurant,
  SaleRow,
  SalesImport,
  ScenarioNote,
  SubscriptionStatus,
  Weekday,
} from "./types"

const TRIAL_DAYS = 14
const PAGE = 1000 // PostgREST default max rows per request
const BATCH = 1000

/* ───────────── store plumbing ───────────── */

let state: AppState = emptyState()
let ready = false
let started = false
let restaurantId: string | null = null
let loadedUserId: string | null = null
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()

const sb = (): SupabaseClient => supabaseBrowser()

function emit() {
  listeners.forEach((l) => l())
}

function set(updater: (s: AppState) => AppState) {
  state = updater(state)
  emit()
}

function setReady(v: boolean) {
  if (ready !== v) {
    ready = v
    emit()
  }
}

function subscribe(l: () => void) {
  listeners.add(l)
  start()
  return () => listeners.delete(l)
}

const serverSnapshot = emptyState()

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, () => state, () => serverSnapshot)
}

/** True once the session has been checked and (if signed in) the user's data is loaded. */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => ready, () => false)
}

export function getState() {
  return state
}

/* ───────────── errors + serial write queue ───────────── */

type PgResult = { error: { message: string; code?: string } | null }

function check<T extends PgResult>(res: T, what: string): T {
  if (res.error) {
    const msg = res.error.code === "23505" ? `${what}: that name already exists` : `${what}: ${res.error.message}`
    throw new Error(msg)
  }
  return res
}

let queue: Promise<unknown> = Promise.resolve()

/** Runs DB writes one after another. On failure: toast + reload from the database. */
function persist(label: string, fn: () => Promise<void>): Promise<void> {
  const run = queue.then(async () => {
    if (!restaurantId) return
    try {
      await fn()
    } catch (e) {
      console.error(`[supabase] ${label}`, e)
      toast.error(e instanceof Error ? e.message : `Could not save (${label})`)
      await resync()
    }
  })
  queue = run.catch(() => undefined)
  return run
}

/** Wait for every pending write to finish (used before navigation-critical steps). */
export function flushWrites(): Promise<void> {
  flushRestaurant()
  return queue.then(() => undefined)
}

/* ───────────── row ↔ model mapping ───────────── */

const num = (v: unknown) => (v == null ? 0 : Number(v))
const numOrNull = (v: unknown) => (v == null ? null : Number(v))

const PLATFORM_NAME: Record<PlatformId, string> = { deliveroo: "Deliveroo", uber_eats: "Uber Eats", just_eat: "Just Eat" }

type Row = Record<string, unknown>

function rowToRestaurant(r: Row, platforms: Row[]): Restaurant {
  const byId = new Map(platforms.map((p) => [p.platform as PlatformId, p]))
  return {
    name: (r.name as string) ?? "",
    country: r.country as Country,
    currency: r.currency as Restaurant["currency"],
    pricesIncludeTax: Boolean(r.prices_include_tax),
    taxRate: num(r.tax_rate),
    targetFoodCostPct: num(r.target_food_cost_pct),
    packagingCostDefault: num(r.packaging_cost_default),
    avgDishesPerOrder: num(r.avg_dishes_per_order),
    deliveryPriceUpliftPct: num(r.delivery_price_uplift_pct),
    reportDay: (r.report_day as Weekday) ?? "Mon",
    reportEmail: (r.report_email as string) ?? "",
    platforms: defaultPlatforms().map((d) => {
      const p = byId.get(d.id)
      return p
        ? { id: d.id, name: PLATFORM_NAME[d.id], enabled: Boolean(p.enabled), commissionPct: num(p.commission_pct), fixedFeePerOrder: num(p.fixed_fee_per_order) }
        : d
    }),
  }
}

const RESTAURANT_COLS: Partial<Record<keyof Restaurant, string>> = {
  name: "name",
  country: "country",
  currency: "currency",
  pricesIncludeTax: "prices_include_tax",
  taxRate: "tax_rate",
  targetFoodCostPct: "target_food_cost_pct",
  packagingCostDefault: "packaging_cost_default",
  avgDishesPerOrder: "avg_dishes_per_order",
  deliveryPriceUpliftPct: "delivery_price_uplift_pct",
  reportDay: "report_day",
  reportEmail: "report_email",
}

function restaurantPatchToRow(patch: Partial<Restaurant>): Row {
  const row: Row = {}
  for (const [k, v] of Object.entries(patch)) {
    const col = RESTAURANT_COLS[k as keyof Restaurant]
    if (col) row[col] = v
  }
  return row
}

const platformRow = (p: DeliveryPlatform) => ({
  restaurant_id: restaurantId,
  platform: p.id,
  enabled: p.enabled,
  commission_pct: p.commissionPct,
  fixed_fee_per_order: p.fixedFeePerOrder,
})

const rowToIngredient = (r: Row): Ingredient => ({
  id: r.id as string,
  name: r.name as string,
  category: r.category as string,
  packSize: num(r.pack_size),
  unit: r.unit as PackUnit,
  packPrice: num(r.pack_price),
  supplier: (r.supplier as string) ?? "",
  updatedAt: r.updated_at as string,
})

const ingredientRow = (i: Ingredient) => ({
  id: i.id,
  restaurant_id: restaurantId,
  name: i.name,
  category: i.category || "Other",
  pack_size: i.packSize,
  unit: i.unit,
  pack_price: i.packPrice,
  supplier: i.supplier || null,
  updated_at: i.updatedAt,
})

const rowToDish = (r: Row): Dish => ({
  id: r.id as string,
  name: r.name as string,
  category: r.category as string,
  menuPrice: num(r.menu_price),
  deliveryPrice: numOrNull(r.delivery_price),
  packagingCost: numOrNull(r.packaging_cost),
  createdAt: r.created_at as string,
  recipe: ((r.recipe_lines as Row[]) ?? []).map((l) => ({
    id: l.id as string,
    ingredientId: l.ingredient_id as string,
    quantity: num(l.quantity),
    unit: l.unit as PackUnit,
    wastePct: num(l.waste_pct),
  })),
})

const dishRow = (d: Dish) => ({
  id: d.id,
  restaurant_id: restaurantId,
  name: d.name,
  category: d.category || "Other",
  menu_price: d.menuPrice,
  delivery_price: d.deliveryPrice,
  packaging_cost: d.packagingCost,
  created_at: d.createdAt,
})

const recipeRows = (d: Dish) =>
  d.recipe.map((l) => ({ id: l.id, dish_id: d.id, ingredient_id: l.ingredientId, quantity: l.quantity, unit: l.unit, waste_pct: l.wastePct }))

const rowToImport = (r: Row): SalesImport => ({
  id: r.id as string,
  source: r.source as SalesImport["source"],
  fileName: r.file_name as string,
  periodStart: r.period_start as string,
  periodEnd: r.period_end as string,
  rowCount: num(r.row_count),
  createdAt: r.created_at as string,
})

const importRow = (i: SalesImport) => ({
  id: i.id,
  restaurant_id: restaurantId,
  source: i.source,
  file_name: i.fileName,
  period_start: i.periodStart,
  period_end: i.periodEnd,
  row_count: i.rowCount,
  created_at: i.createdAt,
})

const rowToSale = (r: Row): SaleRow => ({
  id: String(r.id),
  importId: r.import_id as string,
  date: r.sale_date as string,
  posName: r.pos_name as string,
  channel: r.channel as Channel,
  quantity: num(r.quantity),
  grossSales: num(r.gross_sales),
})

const saleRow = (s: Omit<SaleRow, "id">) => ({
  import_id: s.importId,
  restaurant_id: restaurantId,
  sale_date: s.date,
  pos_name: s.posName,
  channel: s.channel,
  quantity: s.quantity,
  gross_sales: s.grossSales,
})

const mappingRow = (posName: string, target: string) => ({
  restaurant_id: restaurantId,
  pos_name: posName,
  dish_id: target === "ignored" ? null : target,
  ignored: target === "ignored",
})

const rowToNote = (r: Row): ScenarioNote => ({
  id: r.id as string,
  title: r.title as string,
  body: r.body as string,
  createdAt: r.created_at as string,
})

/* ───────────── loading ───────────── */

async function fetchAll(table: string, select: string, order: string): Promise<Row[]> {
  const out: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const res = await sb()
      .from(table)
      .select(select)
      .eq("restaurant_id", restaurantId!)
      .order(order, { ascending: true })
      .range(from, from + PAGE - 1)
    check(res, `Loading ${table}`)
    const rows = (res.data ?? []) as unknown as Row[]
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

async function getOrCreateRestaurant(user: User): Promise<Row> {
  const first = check(await sb().from("restaurants").select("*").eq("owner_id", user.id).maybeSingle(), "Loading restaurant")
  if (first.data) return first.data as Row
  // User existed before the provisioning trigger: create their restaurant now.
  check(await sb().rpc("ensure_my_restaurant"), "Creating restaurant")
  const again = check(await sb().from("restaurants").select("*").eq("owner_id", user.id).single(), "Loading restaurant")
  return again.data as Row
}

async function loadAll(user: User) {
  const r = await getOrCreateRestaurant(user)
  restaurantId = r.id as string

  const [platforms, sub, ingredients, dishes, imports, sales, mappings, notes] = await Promise.all([
    fetchAll("delivery_platforms", "*", "platform"),
    sb().from("subscriptions").select("status, trial_ends_at").eq("restaurant_id", restaurantId).maybeSingle(),
    fetchAll("ingredients", "*", "name"),
    fetchAll("dishes", "*, recipe_lines(*)", "name"),
    fetchAll("sales_imports", "*", "created_at"),
    fetchAll("sales_rows", "id, import_id, sale_date, pos_name, channel, quantity, gross_sales", "id"),
    fetchAll("item_mappings", "pos_name, dish_id, ignored", "pos_name"),
    fetchAll("scenario_notes", "*", "created_at"),
  ])
  check(sub, "Loading subscription")

  const meta = (user.user_metadata ?? {}) as Record<string, string>
  const subRow = sub.data as Row | null
  const account: Account = {
    email: user.email ?? "",
    name: meta.full_name || meta.name || "",
    provider: user.app_metadata?.provider === "google" ? "google" : "email",
    trialEndsAt: (subRow?.trial_ends_at as string) ?? new Date(new Date(r.created_at as string).getTime() + TRIAL_DAYS * 86400000).toISOString(),
    subscriptionStatus: ((subRow?.status as SubscriptionStatus) ?? "trialing"),
    onboarded: Boolean(r.onboarded),
  }

  const restaurant = rowToRestaurant(r, platforms)
  if (!restaurant.reportEmail) restaurant.reportEmail = account.email

  state = {
    version: 1,
    loggedIn: true,
    account,
    restaurant,
    ingredients: ingredients.map(rowToIngredient),
    dishes: dishes.map(rowToDish),
    imports: imports.map(rowToImport).reverse(), // newest first
    sales: sales.map(rowToSale),
    mappings: Object.fromEntries(
      mappings.filter((m) => m.ignored || m.dish_id).map((m) => [m.pos_name as string, m.ignored ? "ignored" : (m.dish_id as string)])
    ),
    notes: notes.map(rowToNote).reverse(),
  }
  loadedUserId = user.id
  emit()
}

function loadFor(user: User): Promise<void> {
  if (loadedUserId === user.id && ready) return Promise.resolve()
  if (loading) return loading
  setReady(false)
  loading = loadAll(user)
    .catch((e) => {
      console.error("[supabase] load", e)
      toast.error(e instanceof Error ? e.message : "Could not load your data")
      // Keep the user signed in but surface the error; screens show empty state.
      state = { ...emptyState(), loggedIn: true }
    })
    .finally(() => {
      loading = null
      setReady(true)
    })
  return loading
}

function clearSession() {
  restaurantId = null
  loadedUserId = null
  pendingRestaurant = {}
  state = emptyState()
  setReady(true)
  emit()
}

async function resync() {
  const {
    data: { user },
  } = await sb().auth.getUser()
  if (!user) return clearSession()
  loadedUserId = null
  await loadFor(user)
}

/** Boots the auth listener once, on the first subscriber in the browser. */
function start() {
  if (started || typeof window === "undefined") return
  started = true
  const client = sb()
  client.auth.onAuthStateChange((event, session) => {
    // Defer Supabase calls out of the callback (avoids auth lock deadlocks).
    setTimeout(() => {
      if (!session?.user) {
        if (event === "SIGNED_OUT" || event === "INITIAL_SESSION") clearSession()
        return
      }
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "USER_UPDATED") {
        if (session.user.id !== loadedUserId) void loadFor(session.user)
        else if (event === "USER_UPDATED") {
          const meta = (session.user.user_metadata ?? {}) as Record<string, string>
          set((s) => (s.account ? { ...s, account: { ...s.account, email: session.user.email ?? s.account.email, name: meta.full_name || s.account.name } } : s))
        }
      }
    }, 0)
  })
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

/* ───────────── restaurant writes (debounced: inputs fire per keystroke) ───────────── */

let pendingRestaurant: Partial<Restaurant> = {}
let restaurantTimer: ReturnType<typeof setTimeout> | null = null

function flushRestaurant() {
  if (restaurantTimer) clearTimeout(restaurantTimer)
  restaurantTimer = null
  const patch = pendingRestaurant
  pendingRestaurant = {}
  if (!Object.keys(patch).length) return
  void persist("Saving restaurant settings", async () => {
    const row = restaurantPatchToRow(patch)
    if (Object.keys(row).length) check(await sb().from("restaurants").update(row).eq("id", restaurantId!), "Saving restaurant settings")
    if (patch.platforms) {
      check(
        await sb().from("delivery_platforms").upsert(patch.platforms.map(platformRow), { onConflict: "restaurant_id,platform" }),
        "Saving delivery platforms"
      )
    }
  })
}

function queueRestaurant(patch: Partial<Restaurant>) {
  pendingRestaurant = { ...pendingRestaurant, ...patch }
  if (restaurantTimer) clearTimeout(restaurantTimer)
  restaurantTimer = setTimeout(flushRestaurant, 600)
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => flushRestaurant())
}

/* ───────────── bulk helpers ───────────── */

async function insertBatched(table: string, rows: Row[], label: string, opts?: { onConflict?: string }) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    const q = opts?.onConflict ? sb().from(table).upsert(chunk, { onConflict: opts.onConflict }) : sb().from(table).insert(chunk)
    check(await q, label)
  }
}

async function wipeBusinessData() {
  const rid = restaurantId!
  // Order matters: sales_rows/recipe_lines cascade from their parents.
  check(await sb().from("item_mappings").delete().eq("restaurant_id", rid), "Clearing item matches")
  check(await sb().from("sales_imports").delete().eq("restaurant_id", rid), "Clearing sales")
  check(await sb().from("dishes").delete().eq("restaurant_id", rid), "Clearing dishes")
  check(await sb().from("ingredients").delete().eq("restaurant_id", rid), "Clearing ingredients")
  check(await sb().from("scenario_notes").delete().eq("restaurant_id", rid), "Clearing notes")
}

async function callBilling(action: "activate" | "cancel" | "end_trial" | "restart_trial") {
  const res = await fetch("/api/billing/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  })
  const body = (await res.json().catch(() => ({}))) as { status?: SubscriptionStatus; trial_ends_at?: string; error?: string }
  if (!res.ok) {
    toast.error(body.error ?? "Billing update failed")
    return
  }
  set((s) =>
    s.account
      ? { ...s, account: { ...s.account, subscriptionStatus: body.status ?? s.account.subscriptionStatus, trialEndsAt: body.trial_ends_at ?? s.account.trialEndsAt } }
      : s
  )
}

function origin() {
  return typeof window === "undefined" ? "" : window.location.origin
}

export type AuthResult = { ok: true; needsConfirmation?: boolean } | { ok: false; error: string }

/* ───────────── actions ───────────── */

export const actions = {
  /* ── auth (Supabase Auth) ── */
  async signUp(email: string, password: string, name: string): Promise<AuthResult> {
    const { data, error } = await sb().auth.signUp({
      email,
      password,
      options: { data: { full_name: name }, emailRedirectTo: `${origin()}/auth/callback?next=/onboarding` },
    })
    if (error) return { ok: false, error: error.message }
    // Supabase returns a user with no identities when the email is already registered.
    if (data.user && data.user.identities && data.user.identities.length === 0)
      return { ok: false, error: "An account with this email already exists. Log in instead." }
    if (!data.session) return { ok: true, needsConfirmation: true }
    await loadFor(data.session.user)
    return { ok: true }
  },
  async logIn(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await sb().auth.signInWithPassword({ email, password })
    if (error) {
      const msg = /confirm/i.test(error.message)
        ? "Please confirm your email first. Check your inbox for the link."
        : error.message === "Invalid login credentials"
          ? "Wrong email or password."
          : error.message
      return { ok: false, error: msg }
    }
    await loadFor(data.user)
    return { ok: true }
  },
  async signInWithGoogle(next = "/dashboard"): Promise<AuthResult> {
    const { error } = await sb().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin()}/auth/callback?next=${encodeURIComponent(next)}` },
    })
    return error ? { ok: false, error: error.message } : { ok: true }
  },
  async sendPasswordReset(email: string): Promise<AuthResult> {
    const { error } = await sb().auth.resetPasswordForEmail(email, { redirectTo: `${origin()}/auth/callback?next=/reset-password` })
    return error ? { ok: false, error: error.message } : { ok: true }
  },
  async updatePassword(password: string): Promise<AuthResult> {
    const { error } = await sb().auth.updateUser({ password })
    return error ? { ok: false, error: error.message } : { ok: true }
  },
  async logOut() {
    await flushWrites()
    await sb().auth.signOut()
    clearSession()
  },
  async deleteAccount(): Promise<AuthResult> {
    await flushWrites()
    const res = await fetch("/api/account/delete", { method: "POST" })
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) return { ok: false, error: body.error ?? "Could not delete account" }
    await sb().auth.signOut().catch(() => undefined)
    clearSession()
    return { ok: true }
  },

  /* ── onboarding / restaurant (tables: restaurants, delivery_platforms) ── */
  updateRestaurant(patch: Partial<Restaurant>) {
    set((s) => ({ ...s, restaurant: { ...s.restaurant, ...patch } }))
    queueRestaurant(patch)
  },
  setCountry(country: Country) {
    const d = COUNTRY_DEFAULTS[country]
    actions.updateRestaurant({ country, currency: d.currency, taxRate: d.taxRate })
  },
  async completeOnboarding() {
    set((s) => (s.account ? { ...s, account: { ...s.account, onboarded: true } } : s))
    flushRestaurant()
    await persist("Finishing onboarding", async () => {
      check(await sb().from("restaurants").update({ onboarded: true }).eq("id", restaurantId!), "Finishing onboarding")
    })
  },
  async loadSampleData() {
    flushRestaurant()
    const next = buildSampleState(state, state.restaurant.country)
    set(() => (state.account ? { ...next, account: { ...state.account, onboarded: true } } : next))
    await persist("Loading sample data", async () => {
      await wipeBusinessData()
      check(
        await sb()
          .from("restaurants")
          .update({ ...restaurantPatchToRow(next.restaurant), onboarded: true })
          .eq("id", restaurantId!),
        "Saving restaurant"
      )
      check(
        await sb().from("delivery_platforms").upsert(next.restaurant.platforms.map(platformRow), { onConflict: "restaurant_id,platform" }),
        "Saving delivery platforms"
      )
      await insertBatched("ingredients", next.ingredients.map(ingredientRow), "Saving ingredients")
      await insertBatched("dishes", next.dishes.map(dishRow), "Saving dishes")
      await insertBatched("recipe_lines", next.dishes.flatMap(recipeRows), "Saving recipes")
      await insertBatched("sales_imports", next.imports.map(importRow), "Saving sales import")
      await insertBatched("sales_rows", next.sales.map(saleRow), "Saving sales rows")
      await insertBatched("item_mappings", Object.entries(next.mappings).map(([k, v]) => mappingRow(k, v)), "Saving item matches")
    })
    // Pick up server-generated ids (sales rows) so later deletes target real rows.
    await resync()
  },
  async clearBusinessData() {
    set((s) => ({ ...s, ingredients: [], dishes: [], imports: [], sales: [], mappings: {}, notes: [] }))
    await persist("Clearing data", wipeBusinessData)
  },

  /* ── ingredients (table: ingredients) ── */
  upsertIngredient(ing: Omit<Ingredient, "id" | "updatedAt"> & { id?: string }) {
    const now = new Date().toISOString()
    const existing = ing.id ? state.ingredients.find((i) => i.id === ing.id) : undefined
    const full: Ingredient = existing ? { ...existing, ...ing, id: existing.id, updatedAt: now } : { ...ing, id: uid("ing"), updatedAt: now }
    set((s) => ({
      ...s,
      ingredients: existing ? s.ingredients.map((i) => (i.id === full.id ? full : i)) : [...s.ingredients, full],
    }))
    void persist("Saving ingredient", async () => {
      check(await sb().from("ingredients").upsert(ingredientRow(full)), "Saving ingredient")
    })
  },
  deleteIngredient(id: string) {
    set((s) => ({
      ...s,
      ingredients: s.ingredients.filter((i) => i.id !== id),
      dishes: s.dishes.map((d) => ({ ...d, recipe: d.recipe.filter((l) => l.ingredientId !== id) })),
    }))
    void persist("Deleting ingredient", async () => {
      check(await sb().from("ingredients").delete().eq("id", id), "Deleting ingredient")
    })
  },
  importIngredients(rows: Omit<Ingredient, "id" | "updatedAt">[]) {
    const now = new Date().toISOString()
    const byName = new Map(state.ingredients.map((i) => [i.name.toLowerCase(), i]))
    const changed: Ingredient[] = []
    const list = [...state.ingredients]
    for (const r of rows) {
      const existing = byName.get(r.name.toLowerCase())
      if (existing) {
        const updated = { ...existing, ...r, updatedAt: now }
        list[list.findIndex((i) => i.id === existing.id)] = updated
        byName.set(r.name.toLowerCase(), updated)
        changed.push(updated)
      } else {
        const created = { ...r, id: uid("ing"), updatedAt: now }
        list.push(created)
        byName.set(r.name.toLowerCase(), created)
        changed.push(created)
      }
    }
    set((s) => ({ ...s, ingredients: list }))
    const unique = [...new Map(changed.map((c) => [c.id, c])).values()]
    void persist("Importing ingredients", () => insertBatched("ingredients", unique.map(ingredientRow), "Importing ingredients", { onConflict: "id" }))
  },

  /* ── dishes + recipes (tables: dishes, recipe_lines) ── */
  upsertDish(dish: Omit<Dish, "id" | "createdAt"> & { id?: string }): string {
    const existing = dish.id ? state.dishes.find((d) => d.id === dish.id) : undefined
    const full: Dish = existing ? { ...existing, ...dish, id: existing.id } : { ...dish, id: uid("dish"), createdAt: new Date().toISOString() }
    set((s) => ({ ...s, dishes: existing ? s.dishes.map((d) => (d.id === full.id ? full : d)) : [...s.dishes, full] }))
    void persist("Saving dish", async () => {
      check(await sb().from("dishes").upsert(dishRow(full)), "Saving dish")
      // Replace the recipe: drop lines that were removed, upsert the rest.
      const keep = full.recipe.map((l) => l.id)
      let del = sb().from("recipe_lines").delete().eq("dish_id", full.id)
      if (keep.length) del = del.not("id", "in", `(${keep.join(",")})`)
      check(await del, "Saving recipe")
      if (keep.length) check(await sb().from("recipe_lines").upsert(recipeRows(full)), "Saving recipe")
    })
    return full.id
  },
  deleteDish(id: string) {
    set((s) => ({
      ...s,
      dishes: s.dishes.filter((d) => d.id !== id),
      mappings: Object.fromEntries(Object.entries(s.mappings).filter(([, v]) => v !== id)),
    }))
    void persist("Deleting dish", async () => {
      check(await sb().from("dishes").delete().eq("id", id), "Deleting dish")
    })
  },
  importDishes(rows: { name: string; category: string; menuPrice: number }[]) {
    const byName = new Map(state.dishes.map((d) => [d.name.toLowerCase(), d]))
    const list = [...state.dishes]
    const changed = new Map<string, Dish>()
    for (const r of rows) {
      const existing = byName.get(r.name.toLowerCase())
      let d: Dish
      if (existing) {
        d = { ...existing, category: r.category, menuPrice: r.menuPrice }
        list[list.findIndex((x) => x.id === existing.id)] = d
      } else {
        d = { ...r, id: uid("dish"), deliveryPrice: null, packagingCost: null, recipe: [], createdAt: new Date().toISOString() }
        list.push(d)
      }
      byName.set(r.name.toLowerCase(), d)
      changed.set(d.id, d)
    }
    set((s) => ({ ...s, dishes: list }))
    void persist("Importing dishes", () => insertBatched("dishes", [...changed.values()].map(dishRow), "Importing dishes", { onConflict: "id" }))
  },

  /* ── sales imports (tables: sales_imports, sales_rows, item_mappings) ── */
  addSalesImport(imp: Omit<SalesImport, "id" | "createdAt" | "rowCount">, rows: Omit<SaleRow, "id" | "importId">[]): SalesImport {
    const full: SalesImport = { ...imp, id: uid("imp"), createdAt: new Date().toISOString(), rowCount: rows.length }
    const newSales: SaleRow[] = rows.map((r) => ({ ...r, id: uid("s"), importId: full.id }))
    // auto-link POS names that exactly match a dish name
    const autoLinks: Record<string, string> = {}
    const byName = new Map(state.dishes.map((d) => [d.name.toLowerCase(), d.id]))
    for (const r of rows) {
      if (!state.mappings[r.posName] && !autoLinks[r.posName] && byName.has(r.posName.toLowerCase()))
        autoLinks[r.posName] = byName.get(r.posName.toLowerCase())!
    }
    set((s) => ({ ...s, mappings: { ...s.mappings, ...autoLinks }, imports: [full, ...s.imports], sales: [...s.sales, ...newSales] }))
    void persist("Importing sales", async () => {
      check(await sb().from("sales_imports").insert(importRow(full)), "Importing sales")
      await insertBatched("sales_rows", newSales.map(saleRow), "Importing sales rows")
      const links = Object.entries(autoLinks).map(([k, v]) => mappingRow(k, v))
      if (links.length) await insertBatched("item_mappings", links, "Linking items", { onConflict: "restaurant_id,pos_name" })
    })
    return full
  },
  deleteImport(id: string) {
    set((s) => ({ ...s, imports: s.imports.filter((i) => i.id !== id), sales: s.sales.filter((r) => r.importId !== id) }))
    void persist("Deleting import", async () => {
      check(await sb().from("sales_imports").delete().eq("id", id), "Deleting import")
    })
  },

  /* ── item matching (table: item_mappings) ── */
  setMapping(posName: string, target: string | null) {
    set((s) => {
      const mappings = { ...s.mappings }
      if (target) mappings[posName] = target
      else delete mappings[posName]
      return { ...s, mappings }
    })
    void persist("Saving item match", async () => {
      if (target) check(await sb().from("item_mappings").upsert(mappingRow(posName, target), { onConflict: "restaurant_id,pos_name" }), "Saving item match")
      else check(await sb().from("item_mappings").delete().eq("restaurant_id", restaurantId!).eq("pos_name", posName), "Removing item match")
    })
  },

  /* ── price simulator notes (table: scenario_notes) ── */
  addNote(title: string, body: string) {
    const note: ScenarioNote = { id: uid("note"), title, body, createdAt: new Date().toISOString() }
    set((s) => ({ ...s, notes: [note, ...s.notes] }))
    void persist("Saving note", async () => {
      check(
        await sb().from("scenario_notes").insert({ id: note.id, restaurant_id: restaurantId, title, body, created_at: note.createdAt }),
        "Saving note"
      )
    })
  },
  deleteNote(id: string) {
    set((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }))
    void persist("Deleting note", async () => {
      check(await sb().from("scenario_notes").delete().eq("id", id), "Deleting note")
    })
  },

  /* ── billing (test mode via /api/billing/test; Paddle webhook later) ── */
  setSubscription(status: Extract<SubscriptionStatus, "active" | "canceled">) {
    return callBilling(status === "active" ? "activate" : "cancel")
  },
  endTrialNow() {
    return callBilling("end_trial")
  },
  restartTrial() {
    return callBilling("restart_trial")
  },
}
