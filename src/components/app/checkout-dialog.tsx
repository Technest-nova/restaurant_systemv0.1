"use client"

import * as React from "react"
import { CreditCard, Lock } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { fmtMoney } from "@/lib/calc"
import { PLAN } from "@/lib/config"
import { actions, getState, useAppState } from "@/lib/store"

/**
 * Mock of the Paddle overlay checkout. Replace with Paddle.js:
 *   Paddle.Checkout.open({ items: [{ priceId: PLAN.paddlePriceId[currency] }], customer: { email } })
 * and let the Paddle webhook set subscription_status = 'active' in Supabase.
 */
export function CheckoutDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { account, restaurant } = useAppState()
  const [busy, setBusy] = React.useState(false)
  const price = PLAN.monthly[restaurant.currency]

  async function pay() {
    setBusy(true)
    await actions.setSubscription("active")
    setBusy(false)
    onOpenChange(false)
    if (getState().account?.subscriptionStatus === "active") toast.success("Subscription active. Thanks for subscribing!")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subscribe to {PLAN.name}</DialogTitle>
          <DialogDescription>Paddle checkout · test mode (no real payment is taken)</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border bg-muted/40 p-4">
          <div className="flex items-baseline justify-between">
            <span className="font-medium">{PLAN.name} · monthly</span>
            <span className="text-xl font-semibold">{fmtMoney(price, restaurant.currency, { decimals: 0 })}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {restaurant.country === "UK" ? "Includes VAT where applicable." : "Includes GST where applicable."} Cancel anytime.
          </p>
        </div>
        <div className="grid gap-3">
          <Input value={account?.email ?? ""} readOnly />
          <div className="relative">
            <CreditCard className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input className="pl-9" defaultValue="4242 4242 4242 4242" readOnly />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input defaultValue="12 / 30" readOnly />
            <Input defaultValue="123" readOnly />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={pay} disabled={busy}>
            <Lock /> {busy ? "Processing…" : `Pay ${fmtMoney(price, restaurant.currency, { decimals: 0 })}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
