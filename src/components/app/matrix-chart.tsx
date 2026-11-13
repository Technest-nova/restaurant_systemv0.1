"use client"

import * as React from "react"
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts"
import { fmtMoney, MENU_CLASS_INFO, type MenuClass } from "@/lib/calc"

export interface MatrixPoint {
  id: string
  name: string
  popularityPct: number
  unitProfit: number
  qty: number
  menuClass: MenuClass
}

const CLASSES: MenuClass[] = ["Star", "Plowhorse", "Puzzle", "Dog"]

export function MatrixChart({
  points,
  popThresholdPct,
  avgUnitProfit,
  currency,
  height = 380,
  onSelect,
  compact = false,
}: {
  points: MatrixPoint[]
  popThresholdPct: number
  avgUnitProfit: number
  currency: string
  height?: number
  onSelect?: (id: string) => void
  compact?: boolean
}) {
  const [hidden, setHidden] = React.useState<Set<MenuClass>>(new Set())
  const toggle = (c: MenuClass) =>
    setHidden((h) => {
      const n = new Set(h)
      if (n.has(c)) n.delete(c)
      else n.add(c)
      return n
    })

  return (
    <div className="w-full">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs" role="list" aria-label="Legend">
        {CLASSES.map((c) => (
          <button
            key={c}
            role="listitem"
            onClick={() => toggle(c)}
            className="flex cursor-pointer items-center gap-1.5 text-muted-foreground hover:text-foreground"
            style={{ opacity: hidden.has(c) ? 0.4 : 1 }}
          >
            <span className="inline-block size-2.5 rounded-full" style={{ background: MENU_CLASS_INFO[c].color }} />
            <span className="font-medium text-foreground">{c}</span>
            {!compact && <span>· {MENU_CLASS_INFO[c].meaning}</span>}
          </button>
        ))}
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 16, bottom: 28, left: 8 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="0" vertical={false} />
            <XAxis
              type="number"
              dataKey="popularityPct"
              name="Popularity"
              unit="%"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              label={{ value: "Popularity (share of items sold)", position: "insideBottom", offset: -16, fontSize: 11, fill: "var(--muted-foreground)" }}
              domain={[0, "auto"]}
            />
            <YAxis
              type="number"
              dataKey="unitProfit"
              name="Profit per dish"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={(v: number) => fmtMoney(v, currency, { decimals: 0 })}
            />
            <ZAxis range={[150, 150]} />
            <ReferenceLine x={popThresholdPct} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
            <ReferenceLine y={avgUnitProfit} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload as MatrixPoint
                return (
                  <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                    <div className="mb-1 flex items-center gap-1.5 font-medium">
                      <span className="inline-block size-2 rounded-full" style={{ background: MENU_CLASS_INFO[p.menuClass].color }} />
                      {p.name}
                    </div>
                    <div className="text-muted-foreground">
                      {p.menuClass} · {p.qty.toLocaleString()} sold
                    </div>
                    <div className="tabular-nums">Popularity {p.popularityPct.toFixed(1)}%</div>
                    <div className="tabular-nums">Profit per dish {fmtMoney(p.unitProfit, currency)}</div>
                  </div>
                )
              }}
            />
            {CLASSES.filter((c) => !hidden.has(c)).map((c) => (
              <Scatter
                key={c}
                name={c}
                data={points.filter((p) => p.menuClass === c)}
                fill={MENU_CLASS_INFO[c].color}
                stroke="var(--card)"
                strokeWidth={2}
                isAnimationActive={false}
                onClick={(d: unknown) => {
                  const id = (d as { payload?: MatrixPoint })?.payload?.id ?? (d as MatrixPoint)?.id
                  if (id && onSelect) onSelect(id)
                }}
                style={{ cursor: onSelect ? "pointer" : "default" }}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
