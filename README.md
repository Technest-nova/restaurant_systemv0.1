# Restaurant Profit Analyzer (MVP front end)

A working front end for all 13 MVP screens. It runs on **mock data in the browser (localStorage)**, so you can click through every flow before the Supabase backend exists.

Stack: Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui (Radix) · Recharts · PapaParse.

## Run it

```bash
npm install
npm run dev
```'''''

Open http://localhost:3000.

## Test it in 2 minutes

1. **Landing page** → *Start free trial*.
2. **Sign up** with any email and an 8+ character password (nothing is sent anywhere).
3. **Onboarding** → click *Load sample data* to get a UK restaurant with 31 ingredients, 13 recipes and 8 weeks of sales. You can also complete the 3 steps by hand and start empty.
4. Walk through the sidebar: Dashboard, Ingredients, Dishes, Recipe builder (click any dish), Import sales, Item matching, Menu engineering, Delivery profit, Price simulator, Settings & billing.
5. **Import sales** → *Try a sample Square file*. It has two broken rows on purpose, so you can see the error list and the *Download error file* button. After *Confirm import*, new POS names go to Item matching.
6. **Item matching**: three names in the sample are unmatched on purpose (`Kids Nuggets & Chips`, `Garlic Bread LRG`, `Extra Dip`). Try Match, Create dish and Ignore.
7. **Trial lock**: Settings → Billing → *End trial now*. Every screen except billing is now blocked. *Subscribe* opens the mock Paddle checkout; paying unlocks the app.
8. **Start over**: Settings → Data → *Delete account (reset app)*.

Sample CSVs are in `public/templates/`.

## Screens → routes

| # | Screen | Route |
|---|---|---|
| 1 | Landing page | `/` |
| 2 | Sign up / Log in | `/login` (`?mode=signup`) |
| 3 | Onboarding wizard | `/onboarding` |
| 4 | Dashboard | `/dashboard` |
| 5 | Ingredients | `/ingredients` |
| 6 | Dishes | `/dishes` |
| 7 | Recipe builder | `/dishes/[id]` |
| 8 | Data import | `/import` |
| 9 | Item matching | `/matching` |
| 10 | Menu Engineering | `/menu-engineering` |
| 11 | Delivery Profit | `/delivery` |
| 12 | Price Simulator | `/simulator` |
| 13 | Settings and billing | `/settings` |

## Where things live

```
src/
  app/                    pages (one folder per screen; (app)/ = logged-in area)
  components/ui/          shadcn/ui components
  components/app/         app shell, matrix chart, CSV import dialog, checkout mock, shared bits
  lib/types.ts            domain types = future database tables
  lib/calc.ts             all profit maths (VAT removal, recipe cost, GP, delivery, menu engineering)
  lib/csv.ts              Square + generic CSV parsers with row-level errors
  lib/store.ts            mock data layer (localStorage); every write goes through `actions`
  lib/sample-data.ts      sample restaurant generator (UK or AU)
  lib/config.ts           plan price and Paddle price IDs (placeholders)
supabase/schema.sql       draft database schema with RLS for the backend phase
```

## How the numbers are calculated

- **Net price** = menu price ÷ (1 + VAT/GST rate) when prices include tax.
- **Food cost** = Σ quantity (converted to g/ml/each) × cost per base unit × (1 + waste %).
- **GP** = net price − food cost. **GP %** = GP ÷ net price.
- **Delivery profit per dish** = net app price − food cost − commission (% of the price the customer pays) − fixed fee ÷ dishes per order − packaging.
- **Break-even app price** = (food cost + packaging + fee share) ÷ (1/(1+tax) − commission %).
- **Menu engineering** (Kasavana–Smith): popular if the dish's share of items sold ≥ 70% of an equal share; profitable if its profit per dish ≥ the menu's weighted average. Star / Plowhorse / Puzzle / Dog.

## Next step: Supabase

See `SUPABASE_MIGRATION.md`.
