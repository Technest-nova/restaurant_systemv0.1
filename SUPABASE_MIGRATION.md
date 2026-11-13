# Supabase backend

The app runs on Supabase Auth + Postgres. Screens read with `useAppState()` and write through
`actions` in `src/lib/store.ts`; that file is the only place that talks to the database.

## One-time setup

1. **Database**: Supabase → SQL Editor → paste `supabase/migrations/001_app_setup.sql` → Run.
   It is idempotent (safe to re-run) and creates all tables, indexes, row-level security,
   and a trigger that gives every new user a restaurant, default delivery platforms and a 14-day trial.
2. **Env vars**: see `.env.example`. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   go in `.env.local`; `SUPABASE_SECRET_KEY` (server only) can live in `.env` or `.env.local`.
3. **Auth → URL Configuration**: Site URL `http://localhost:3000` (your domain in production).
   Add redirect URLs `http://localhost:3000/auth/callback` and `https://YOUR-DOMAIN/auth/callback`.
4. **Auth → Providers → Email**: keep "Confirm email" on for production. With it on, sign-up shows
   "check your email" and the link lands on `/auth/callback` → onboarding.
5. **Google sign-in (optional)**: Auth → Providers → Google, paste a Google OAuth client ID/secret.
   In Google Cloud, the authorised redirect URI is `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`.

## How it fits together

| Piece | File |
|---|---|
| Browser client | `src/lib/supabase/client.ts` |
| Server client + admin (secret key) | `src/lib/supabase/server.ts` |
| Session refresh + route guard | `src/middleware.ts`, `src/lib/supabase/middleware.ts` |
| Email confirm / OAuth / reset links | `src/app/auth/callback/route.ts` |
| New password form | `src/app/reset-password/page.tsx` |
| Test billing (writes `subscriptions` with secret key) | `src/app/api/billing/test/route.ts` |
| Delete account (cascades all data) | `src/app/api/account/delete/route.ts` |

Writes are optimistic: the UI updates instantly, then a serial queue persists to Supabase.
On any error the user gets a toast and the cache reloads from the database.

## Still to do before launch

- **Billing**: replace `checkout-dialog.tsx` with Paddle.js and add a Paddle webhook route that updates
  `subscriptions` via `supabaseAdmin()`. The test route is disabled in production builds.
- **Weekly email**: scheduled Edge Function using `weeklyEmailNumbers()` + Resend/Postmark.
- **Custom SMTP**: Supabase's built-in email sender is rate-limited; set up SMTP under Auth → Emails.
- **Scale**: sales rows are loaded client-side (paged, 1,000 per request). Move aggregations in
  `lib/calc.ts` to SQL views/RPCs when restaurants exceed ~100k rows.
