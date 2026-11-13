# Moving from mock data to Supabase

The screens never touch localStorage directly. They read state with `useAppState()` and write through `actions` in `src/lib/store.ts`. To switch to Supabase you change the store, not the screens.

## Steps

1. Create the project and run `supabase/schema.sql` in the SQL editor.
2. `npm i @supabase/supabase-js @supabase/ssr` and add `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`.
3. **Auth**: replace `actions.signUp / logIn / logOut` with `supabase.auth.signUp`, `signInWithPassword`, `signInWithOAuth({ provider: 'google' })`, `signOut`. Replace the password-reset mock in `src/app/login/page.tsx` with `supabase.auth.resetPasswordForEmail`. Move the route guard in `components/app/app-shell.tsx` to Next.js middleware.
4. **Data**: for each action, swap the `set(...)` body for an insert/update/delete on the matching table (table names are noted in comments above each action). Keep the in-memory `state` as a cache, or move reads to React Query/SWR.
5. **Sales imports**: insert `sales_imports` then bulk insert `sales_rows` (batches of ~1,000). Aggregations in `lib/calc.ts` can stay client-side for the MVP; move them into a SQL view or RPC once data grows.
6. **Billing**: replace `components/app/checkout-dialog.tsx` with Paddle.js `Paddle.Checkout.open(...)`. Add a Paddle webhook (Edge Function or Next.js route) that writes `subscriptions.status` using the service role key. Remove the "Test controls" card in Settings.
7. **Weekly email**: a scheduled Edge Function that, per restaurant on its `report_day`, computes the numbers from `weeklyEmailNumbers()` (port to SQL or reuse the TS) and sends them with Resend or Postmark.
8. **Data retention**: a scheduled job that deletes data for accounts unpaid for more than 30 days after `trial_ends_at`.

The two sales "sources" map to parsers in `lib/csv.ts`; a future Square API integration should produce the same `ParsedSale` rows.
