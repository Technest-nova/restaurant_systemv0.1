"use client"

import Link from "next/link"
import { ArrowRight, BarChart3, Calculator, Check, ChefHat, Grid2x2, Mail, Truck, Upload } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MatrixChart, type MatrixPoint } from "@/components/app/matrix-chart"
import { DEMO_EMAIL, PLAN } from "@/lib/config"

const SAMPLE: MatrixPoint[] = [
  { id: "1", name: "Classic Cheeseburger", popularityPct: 14.2, unitProfit: 5.1, qty: 380, menuClass: "Star" },
  { id: "2", name: "Fish & Chips", popularityPct: 11.6, unitProfit: 5.6, qty: 312, menuClass: "Star" },
  { id: "3", name: "Coca-Cola can", popularityPct: 16.4, unitProfit: 1.0, qty: 440, menuClass: "Plowhorse" },
  { id: "4", name: "Margherita Pizza", popularityPct: 7.1, unitProfit: 4.1, qty: 192, menuClass: "Plowhorse" },
  { id: "5", name: "Garlic Bread", popularityPct: 7.4, unitProfit: 2.4, qty: 200, menuClass: "Plowhorse" },
  { id: "6", name: "Pan-fried Salmon", popularityPct: 2.4, unitProfit: 9.2, qty: 64, menuClass: "Puzzle" },
  { id: "7", name: "Spaghetti Carbonara", popularityPct: 5.0, unitProfit: 7.0, qty: 136, menuClass: "Puzzle" },
  { id: "8", name: "Mushroom Risotto", popularityPct: 1.6, unitProfit: 6.1, qty: 44, menuClass: "Puzzle" },
  { id: "9", name: "Side Salad", popularityPct: 2.1, unitProfit: 1.3, qty: 56, menuClass: "Dog" },
  { id: "10", name: "Sticky Toffee Pudding", popularityPct: 3.6, unitProfit: 2.6, qty: 96, menuClass: "Dog" },
]

const FEATURES = [
  {
    icon: Grid2x2,
    title: "Menu Engineering Matrix",
    body: "Every dish classed as Star, Plowhorse, Puzzle or Dog, with one clear action: raise the price, promote it, rework it or drop it.",
  },
  {
    icon: Truck,
    title: "Delivery app true profit",
    body: "See what each dish really earns on Deliveroo, Uber Eats and Just Eat after commission, fees and packaging, plus the break-even price.",
  },
  {
    icon: Calculator,
    title: "Price change simulator",
    body: "Try a new price and an expected change in volume, and see weekly profit before and after, before you reprint the menu.",
  },
]

const FAQ = [
  {
    q: "Do I need to connect my POS?",
    a: "No. Export last week's sales from Square (or any POS that exports CSV) and upload the file. Live POS connections are coming after launch.",
  },
  {
    q: "How long does setup take?",
    a: "About 30–60 minutes to add your ingredients and recipes. After that your only weekly job is uploading the sales CSV. For pilot restaurants we do the setup for you.",
  },
  {
    q: "Do I enter prices with or without VAT?",
    a: "Enter menu prices exactly as customers pay them. The app removes VAT (UK) or GST (Australia) before it calculates profit.",
  },
  {
    q: "Which delivery apps are supported?",
    a: "Deliveroo, Uber Eats and Just Eat. You set your own commission %, fixed fee per order and packaging cost, so the numbers match your contract.",
  },
  {
    q: "What happens when the trial ends?",
    a: "You choose whether to subscribe. If you don't, your data is kept for 30 days so you can come back without starting again.",
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BarChart3 className="size-4" />
            </span>
            Restaurant Profit Analyzer
          </Link>
          <nav className="flex items-center gap-2">
            <a href="#pricing" className="hidden px-3 text-sm text-muted-foreground hover:text-foreground sm:block">
              Pricing
            </a>
            <a href="#faq" className="hidden px-3 text-sm text-muted-foreground hover:text-foreground sm:block">
              FAQ
            </a>
            <Button variant="ghost" asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link href="/login?mode=signup">Start free trial</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_70%_0%,oklch(0.93_0.05_158)_0%,transparent_70%)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <Badge variant="secondary" className="mb-5">
              For independent restaurants & takeaways in the UK and Australia
            </Badge>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Know which dishes make money, and which quietly lose it.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Upload last week&apos;s sales from Square or any POS. Get true profit per dish, in the restaurant and on
              Deliveroo, Uber Eats and Just Eat, with a clear action for every item on your menu.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/login?mode=signup">
                  Start 14-day free trial <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href={`mailto:${DEMO_EMAIL}?subject=Demo%20request%20-%20Restaurant%20Profit%20Analyzer`}>
                  <Mail /> Book a demo
                </a>
              </Button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">No card needed to start. Cancel anytime.</p>
          </div>

          {/* "screenshot" */}
          <div className="rounded-xl border bg-card shadow-xl ring-1 ring-black/5">
            <div className="flex items-center gap-1.5 border-b px-4 py-3">
              <span className="size-2.5 rounded-full bg-muted-foreground/25" />
              <span className="size-2.5 rounded-full bg-muted-foreground/25" />
              <span className="size-2.5 rounded-full bg-muted-foreground/25" />
              <span className="ml-3 text-xs text-muted-foreground">Menu Engineering · Last 4 weeks</span>
            </div>
            <div className="p-4">
              <MatrixChart points={SAMPLE} popThresholdPct={7} avgUnitProfit={3.9} currency="GBP" height={300} compact />
            </div>
          </div>
        </div>
      </section>

      {/* how it works */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:grid-cols-3 sm:px-6">
          {[
            { icon: ChefHat, t: "1. Add recipes once", d: "Ingredients and recipes give you cost, GP and GP % for every dish." },
            { icon: Upload, t: "2. Upload weekly sales", d: "Square export or our simple CSV template. Takes a minute." },
            { icon: BarChart3, t: "3. Act on the numbers", d: "Dashboard, matrix, delivery profit and a weekly email with 5 key numbers." },
          ].map((s) => (
            <div key={s.t} className="flex gap-4">
              <s.icon className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <div className="font-medium">{s.t}</div>
                <div className="text-sm text-muted-foreground">{s.d}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* features */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="text-center text-3xl font-semibold tracking-tight">Everything you need to fix your margins</h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title}>
              <CardHeader>
                <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-accent">
                  <f.icon className="size-5 text-primary" />
                </div>
                <CardTitle>{f.title}</CardTitle>
                <CardDescription className="leading-relaxed">{f.body}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* pricing */}
      <section id="pricing" className="border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-center text-3xl font-semibold tracking-tight">One simple plan</h2>
          <p className="mt-2 text-center text-muted-foreground">Everything included. 14-day free trial.</p>
          <Card className="mx-auto mt-10 max-w-md">
            <CardHeader>
              <CardTitle className="text-lg">{PLAN.name}</CardTitle>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-4xl font-semibold">£{PLAN.monthly.GBP}</span>
                <span className="text-muted-foreground">/ month</span>
              </div>
              <CardDescription>A${PLAN.monthly.AUD} / month in Australia</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {[
                "Recipe cost tracker with live GP %",
                "Menu Engineering Matrix with actions",
                "Delivery app true profit & break-even prices",
                "Price change simulator",
                "Weekly profit email",
                "Square & CSV imports",
              ].map((x) => (
                <div key={x} className="flex items-center gap-2 text-sm">
                  <Check className="size-4 text-primary" /> {x}
                </div>
              ))}
              <Button size="lg" className="mt-4" asChild>
                <Link href="/login?mode=signup">Start free trial</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* faq */}
      <section id="faq" className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <h2 className="text-center text-3xl font-semibold tracking-tight">Questions</h2>
        <Accordion type="single" collapsible className="mt-8">
          {FAQ.map((f, i) => (
            <AccordionItem key={i} value={`q${i}`}>
              <AccordionTrigger className="text-base">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <span>© {new Date().getFullYear()} TechNest Nova · Restaurant Profit Analyzer</span>
          <span>Payments by Paddle</span>
        </div>
      </footer>
    </div>
  )
}
