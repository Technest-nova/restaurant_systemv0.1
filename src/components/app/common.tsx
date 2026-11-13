"use client"

import * as React from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { AlertTriangle, CheckCircle2, CircleDashed, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { fmtMoney, fmtPct, type Flag } from "@/lib/calc"
import { useAppState } from "@/lib/store"
import { cn } from "@/lib/utils"

export function useMoney() {
  const { restaurant } = useAppState()
  return React.useCallback(
    (n: number, decimals = 2) => fmtMoney(n, restaurant.currency, { decimals }),
    [restaurant.currency]
  )
}

export function currencySymbol(currency: string) {
  return currency === "AUD" ? "A$" : "£"
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: { label: string; href?: string; onClick?: () => void }
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-14 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent">
        <Icon className="size-6 text-primary" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {action &&
        (action.href ? (
          <Button asChild className="mt-5">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button className="mt-5" onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
    </div>
  )
}

export function StatCard({
  label,
  value,
  sub,
  tone = "default",
  icon: Icon,
}: {
  label: string
  value: string
  sub?: React.ReactNode
  tone?: "default" | "good" | "bad" | "warning"
  icon?: LucideIcon
}) {
  return (
    <Card className="gap-0 py-5">
      <CardContent className="px-5">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{label}</span>
          {Icon && <Icon className="size-4" />}
        </div>
        <div
          className={cn(
            "mt-2 text-2xl font-semibold tabular-nums tracking-tight",
            tone === "bad" && "text-destructive"
          )}
        >
          {value}
        </div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  )
}

export function FlagBadge({ flag, foodCostPct }: { flag: Flag; foodCostPct?: number }) {
  if (flag === "none")
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <CircleDashed /> No recipe
      </Badge>
    )
  if (flag === "good")
    return (
      <Badge variant="success">
        <CheckCircle2 /> On target{foodCostPct != null && ` · ${fmtPct(foodCostPct, 0)}`}
      </Badge>
    )
  if (flag === "warning")
    return (
      <Badge variant="warning">
        <AlertTriangle /> Close{foodCostPct != null && ` · ${fmtPct(foodCostPct, 0)}`}
      </Badge>
    )
  return (
    <Badge variant="danger">
      <XCircle /> Over target{foodCostPct != null && ` · ${fmtPct(foodCostPct, 0)}`}
    </Badge>
  )
}

export function NumberInput({
  value,
  onChange,
  step = "0.01",
  min,
  className,
  prefix,
  suffix,
  ...rest
}: {
  value: number | string
  onChange: (v: number) => void
  step?: string
  min?: number
  className?: string
  prefix?: string
  suffix?: string
} & Omit<React.ComponentProps<"input">, "value" | "onChange" | "prefix">) {
  const [text, setText] = React.useState(String(value))
  React.useEffect(() => {
    if (Number(text) !== Number(value)) setText(String(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <div className={cn("relative flex items-center", className)}>
      {prefix && <span className="pointer-events-none absolute left-3 text-sm text-muted-foreground">{prefix}</span>}
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          const n = Number(e.target.value)
          if (e.target.value !== "" && Number.isFinite(n)) onChange(n)
        }}
        onBlur={() => {
          if (text === "" || !Number.isFinite(Number(text))) setText(String(value))
        }}
        className={cn(
          "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm tabular-nums shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          prefix && "pl-8",
          suffix && "pr-8"
        )}
        {...rest}
      />
      {suffix && <span className="pointer-events-none absolute right-3 text-sm text-muted-foreground">{suffix}</span>}
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
