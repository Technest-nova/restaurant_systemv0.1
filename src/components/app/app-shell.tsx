"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BarChart3,
  Calculator,
  ChefHat,
  Grid2x2,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  Settings,
  ShoppingBasket,
  Truck,
  Upload,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckoutDialog } from "@/components/app/checkout-dialog"
import { actions, hasAccess, trialDaysLeft, useAppState, useHydrated } from "@/lib/store"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ingredients", label: "Ingredients", icon: ShoppingBasket },
  { href: "/dishes", label: "Dishes & recipes", icon: ChefHat },
  { href: "/import", label: "Import sales", icon: Upload },
  { href: "/matching", label: "Item matching", icon: Link2, badge: "unmatched" as const },
  { href: "/menu-engineering", label: "Menu engineering", icon: Grid2x2 },
  { href: "/delivery", label: "Delivery profit", icon: Truck },
  { href: "/simulator", label: "Price simulator", icon: Calculator },
  { href: "/settings", label: "Settings & billing", icon: Settings },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated()
  const state = useAppState()
  const router = useRouter()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [checkoutOpen, setCheckoutOpen] = React.useState(false)

  const { account } = state
  const access = hasAccess(account)
  const locked = hydrated && account && !access

  React.useEffect(() => {
    if (!hydrated) return
    if (!account || !state.loggedIn) router.replace("/login")
    else if (!account.onboarded) router.replace("/onboarding")
    else if (!access && pathname !== "/settings") router.replace("/settings?tab=billing")
  }, [hydrated, account, state.loggedIn, access, pathname, router])

  const unmatched = React.useMemo(() => {
    if (!hydrated) return 0
    const names = new Set<string>()
    for (const s of state.sales) if (!state.mappings[s.posName]) names.add(s.posName)
    return names.size
  }, [hydrated, state.sales, state.mappings])

  React.useEffect(() => setMobileOpen(false), [pathname])

  if (!hydrated || !account || !state.loggedIn || !account.onboarded) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>
    )
  }

  const days = trialDaysLeft(account)
  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 px-3">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/")
        const disabled = locked && item.href !== "/settings"
        return (
          <Link
            key={item.href}
            href={disabled ? "/settings?tab=billing" : item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-foreground/75 hover:bg-accent hover:text-foreground",
              disabled && "pointer-events-none opacity-40"
            )}
          >
            <item.icon className="size-4" />
            <span className="flex-1">{item.label}</span>
            {item.badge === "unmatched" && unmatched > 0 && (
              <Badge variant={active ? "secondary" : "warning"} className="px-1.5">
                {unmatched}
              </Badge>
            )}
          </Link>
        )
      })}
    </nav>
  )

  const brand = (
    <Link href="/dashboard" className="flex items-center gap-2 px-6 py-5">
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <BarChart3 className="size-4" />
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold">Profit Analyzer</div>
        <div className="max-w-[150px] truncate text-xs text-muted-foreground">{state.restaurant.name || "Your restaurant"}</div>
      </div>
    </Link>
  )

  const footer = (
    <div className="border-t p-3">
      <div className="px-3 pb-2 text-xs text-muted-foreground">
        <div className="truncate font-medium text-foreground">{account.name || account.email}</div>
        <div className="truncate">{account.email}</div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start"
        onClick={async () => {
          await actions.logOut()
          router.replace("/login")
          router.refresh()
        }}
      >
        <LogOut /> Log out
      </Button>
    </div>
  )

  return (
    <div className="min-h-screen bg-muted/30">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-background lg:flex">
        {brand}
        {nav}
        {footer}
      </aside>

      {/* mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-background shadow-xl">
            <div className="flex items-center justify-between pr-3">
              {brand}
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X />
              </Button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu />
          </Button>
          <span className="text-sm font-semibold">Profit Analyzer</span>
        </header>

        {account.subscriptionStatus === "trialing" && days > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b bg-accent px-4 py-2 text-center text-sm">
            <span>
              <strong>{days} day{days === 1 ? "" : "s"}</strong> left in your free trial.
            </span>
            <button className="font-medium text-primary underline underline-offset-4" onClick={() => setCheckoutOpen(true)}>
              Subscribe now
            </button>
          </div>
        )}

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
      <CheckoutDialog open={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </div>
  )
}

