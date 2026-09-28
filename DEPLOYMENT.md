# Deploying to Vercel

Follow in order. About 20 minutes the first time.

---

## Before you start

**Node version** — nothing to do. `engines.node` in `package.json` says `22.x`, and that
overrides whatever the dashboard shows. Setting it in the dashboard as well is harmless.

**Which Supabase project?** Ideally a second one, so test orders never mix with real sales. For a
first deploy where nobody is paying yet, reusing the existing one is fine — just remember that
anything you buy on the live site lands in the same database you have been testing with.

---

## 1. Import the project

Vercel → **Add New → Project** → pick `chideradim3/Akpo_gala_night`.

Leave every build setting alone. Vercel detects Next.js and gets it right; the defaults in this
repository are already correct.

**Do not deploy yet** — add the environment variables first, or the first build produces a site
that cannot reach its database.

---

## 2. Environment variables

**Settings → Environment Variables.** Add each to **all three** environments (Production, Preview,
Development) unless noted.

### Required — the site does not work without these

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | From Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | The secret key. **Production only** — there is no reason for a preview build to hold it |
| `PAYMENT_CONFIRM_SECRET` | Generate a **new one for production**, do not reuse the development value:<br>`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

### Set these too

| Name | Value | Why |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Your live URL, e.g. `https://akpo-gala-night.vercel.app` | Every ticket link in every email is built from it. Wrong here means links that go nowhere |
| `PAYMENT_PROVIDER` | `mock` for now, `real` once the integration exists | See the warning below |
| `EMAIL_PROVIDER` | `console` until you have a domain, then `resend` | |

### Only once you have them

`RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`.

### Never add these

| | Why |
|---|---|
| `SUPABASE_DB_URL` | A local tool credential for applying migrations. The app never reads it, and it is a direct database login |
| `Repo_Key` | Your GitHub token. Nothing in the app uses it |

> **`NEXT_PUBLIC_*` variables are baked in at build time.** Changing one has no effect until you
> redeploy — restarting is not enough. This catches everyone once.

**The chicken and egg:** you will not know your URL until the first deploy. Either guess it (Vercel
uses `<project-name>.vercel.app`), or deploy, copy the real URL, set the variable, and
**redeploy**.

---

## 3. Deploy

Press Deploy. Two to three minutes.

If the build fails, read the log — it names the missing variable.

---

## 4. Check it

| Check | Expected |
|---|---|
| The landing page | Your event, prices in Naira |
| `/design` | **404** — dev-only pages must not exist in production |
| `/dev/mock-payment` | **404** |
| `/admin` | Redirects to the login page |
| `/admin/login` | Sign in with your authenticator |
| On a phone | Everything readable, nothing cut off |

---

## ⚠️ What will not work yet, and why

**Checkout stops at "Continue to payment".**

With `PAYMENT_PROVIDER=mock`, the code *deliberately refuses* to run the fake payment system in
production — a mock must never be able to take money. The buyer sees:

> Online payment is not available on this site yet. Nothing has been reserved and you have not
> been charged.

That is correct behaviour, not a broken deploy. It resolves when the payment integration is built
and you set `PAYMENT_PROVIDER=real`.

**To try the full purchase flow**, run it locally — `npm run dev`, then `npm run simulate-payment`.
The mock works there, tickets are issued, and the QR pages render. It cannot be made to work on a
deployed site, by design.

**No emails are sent.** With `EMAIL_PROVIDER=console` they are written to a file on the server,
where you cannot see them. Tickets are still issued and still reachable at
`/tickets/<access token>` — they just are not delivered. Fixed by adding a domain and a Resend
key.

So a deploy today gives you a **real, shareable site** with a working landing page, admin and
ticket pages — useful for showing people and testing on real phones — but not yet a shop.

---

## 5. Before you take real money

Work through the checklist at the end of [SECURITY.md](SECURITY.md). The short version:

- [ ] `PAYMENT_PROVIDER=real`, integration deployed and tested with a real card
- [ ] `EMAIL_PROVIDER=resend` with a verified domain, checked with `npm run test-email`
- [ ] Turnstile keys set — without them nothing stops a script holding your inventory
- [ ] `NEXT_PUBLIC_SITE_URL` is your real domain, and you have redeployed since setting it
- [ ] Sample event replaced with the real one, and published
- [ ] At least two owner accounts, so one lost phone does not lock you out
- [ ] A separate Supabase project for production

---

## Afterwards

Every push to `main` deploys automatically. CI runs first — types, lint, tests, the security
audit, a build — so a push that breaks something fails there rather than going live.

**Migrations do not run automatically.** After adding one, apply it yourself:

```bash
npm run db:push
```

Point `SUPABASE_DB_URL` at the production database when you do, and expect the app to be briefly
out of step with the schema — deploy the code and the migration close together.
