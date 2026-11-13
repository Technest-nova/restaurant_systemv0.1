import {
  aggregate,
  dishEconomics,
  ingredientMap,
  menuEngineering,
  type AggregateFilter,
  type DishStats,
} from "./calc"
import type { AppState } from "./types"

export interface ProblemDish {
  stats: DishStats
  reasons: string[]
  severity: number
}

export function problemDishes(state: AppState, filter: AggregateFilter, limit = 3): ProblemDish[] {
  const agg = aggregate(state, filter)
  const me = menuEngineering(agg.dishes)
  const classById = new Map(me.items.map((i) => [i.dish.id, i.menuClass]))
  const ings = ingredientMap(state.ingredients)
  const r = state.restaurant
  const names = new Map(r.platforms.map((p) => [p.id, p.name]))
  const out: ProblemDish[] = []
  for (const st of agg.dishes) {
    const reasons: string[] = []
    let severity = 0
    const eco = dishEconomics(st.dish, r, ings)
    if (!eco.hasRecipe) {
      reasons.push("No recipe yet, so cost is unknown")
      severity += 1
    } else if (eco.foodCostPct > r.targetFoodCostPct) {
      reasons.push(`Food cost ${eco.foodCostPct.toFixed(0)}% vs ${r.targetFoodCostPct}% target`)
      severity += (eco.foodCostPct - r.targetFoodCostPct) / 5
    }
    for (const [ch, v] of Object.entries(st.byChannel)) {
      if (ch !== "in_house" && v && v.profit < 0) {
        reasons.push(`Loses money on ${names.get(ch as never) ?? ch}`)
        severity += 2 + Math.abs(v.profit) / 20
      }
    }
    if (classById.get(st.dish.id) === "Dog") {
      reasons.push("Low sales and low margin")
      severity += 1
    }
    if (reasons.length) out.push({ stats: st, reasons, severity })
  }
  return out.sort((a, b) => b.severity - a.severity).slice(0, limit)
}

export function weeklyEmailNumbers(state: AppState) {
  const agg = aggregate(state, { period: "last_week" })
  const worst = problemDishes(state, { period: "last_week" }, 1)[0]
  return {
    range: agg.range,
    netRevenue: agg.totals.netRevenue,
    grossProfit: agg.totals.grossProfit,
    foodCostPct: agg.totals.foodCostPct,
    deliveryProfit: agg.totals.deliveryProfit,
    worstDish: worst ? { name: worst.stats.dish.name, reason: worst.reasons[0] } : null,
  }
}
