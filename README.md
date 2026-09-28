# Gala Night — ticketing

A ticket sales website for a Gala Night in Nigeria, with an admin dashboard. Currency is Naira (₦).

Payment integration and the venue check-in page are built separately by the payment developer —
see [What this repository does NOT build](#what-this-repository-does-not-build).

**Current status: Phase 9 complete** — the site sells tickets end to end. Landing page, checkout with
atomic inventory reservation, the payment boundary, ticket issuance with QR codes, ticket emails,
lost-ticket recovery, and an admin dashboard behind mandatory two-factor authentication.

---

## Two rules you must know before touching this code

**1. Money is always an integer number of kobo.**

₦5,000 is `500000`, not `5000` and never `5000.00`. Floats lose precision, and a total that is one
kobo off will be rejected by the payment confirmation as a mismatch. Use the helpers in
[`lib/money.ts`](lib/money.ts) — Naira only ever appears at the moment something is displayed.

**2. The browser never writes to the database.**

The browser may read the active event and its ticket prices; nothing else. Every write — creating
an order, issuing a ticket, checking someone in — goes through server code. Prices and totals are
always recalculated on the server from the database, never taken from the browser.

A third rule follows from the second: `SUPABASE_SERVICE_ROLE_KEY` is server-only. The code enforces
it — `lib/supabase/admin.ts` and `lib/env.ts` start with `import "server-only"`, so importing them
into a client component is a **build error**, not a silent leak.

---

## Tech stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS v4 · Supabase (Postgres, Auth,
Storage) · Zod. Deployed on Vercel.

Dependencies are kept deliberately few. Do not add a UI kit, an icon package, a class-merging
library or a payment SDK.

---

## Running it locally

You need **Node.js 20.9 or newer**.

```bash
npm install
cp .env.example .env.local     # nothing needs filling in yet
npm run dev
```

Then open <http://localhost:3000>.

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Unit tests (compiles TS, then Node's built-in test runner) |
| `npm run db:push` | Apply database migrations |
| `npm run db:seed` | Apply the sample event |
| `npm run db:status` | Show which migrations are applied |
| `npm run test:db` | Inventory race + RLS tests (needs local Supabase) |
| `npm run create-admin -- --email you@example.com --role owner` | Create an administrator |
| `npm run simulate-payment -- --ref GALA-1042 --amount 500000` | Send a signed fake payment confirmation |
| `npm run test-email -- --to you@example.com` | Check that email sending is configured |
| `npm run audit` | Security audit + responsive audit |
| `npm run audit:security` | Static check of the non-negotiable rules |
| `npm run audit:responsive` | Measures every page at 320–1440px for overflow |

### Seeing it on your phone

The site is built to work on a phone and a laptop equally, and device emulation in browser
devtools does not catch everything — real touch targets and font rendering differ. To open it on
your actual phone, on the same Wi-Fi:

```bash
npm run dev -- -H 0.0.0.0
```

Then visit `http://<your-computer's-LAN-IP>:3000` from the phone.

---

## The design system

`/design` (development only — it 404s in production) shows every UI component in every state. It
is the fastest way to see the visual language and to check nothing broke.

All colour, radius, shadow and type-scale values live as tokens in
[`app/globals.css`](app/globals.css). Components reference the tokens and never hardcode a hex
value, so restyling the whole site means editing that one file.

Type sizes use `clamp()`, so headings scale with the viewport and there is no separate mobile
override anywhere in the app. [`components/ui/Container.tsx`](components/ui/Container.tsx) owns
page width and side gutters — pages use it rather than hand-rolling `max-w-* mx-auto px-*`.

---

## Folder map

```
app/
  page.tsx               landing page (placeholder until Phase 3)
  design/                dev-only component gallery
  checkout/              3-step purchase flow            (Phase 4)
  payment/return/        "confirming your payment…"      (Phase 5)
  tickets/[accessToken]/ the buyer's tickets             (Phase 5)
  find-tickets/          lost-ticket recovery            (Phase 6)
  admin/                 dashboard, orders, attendees    (Phases 7–8)
    check-in/            placeholder — the payment developer builds this
  api/                   route handlers                  (Phase 5+)
  dev/                   mock payment simulator          (Phase 5)
components/
  ui/                    design-system primitives
  event/ checkout/ tickets/ admin/   feature components
lib/
  money.ts               kobo ⇄ Naira. Read this first.
  env.ts                 environment variables, validated with Zod
  utils.ts               cn(), noindexMetadata(), devRoutesEnabled()
  supabase/              server / browser / admin clients
  auth/                  requireAdmin(role) access check  (Phase 7)
  services/              business logic                  (Phase 2+)
    payment/             the payment boundary            (Phase 5)
  validation/            Zod schemas                     (Phase 4+)
types/
supabase/migrations/     database schema                 (Phase 2)
reference/               UX screenshots — not deployed
```

Keep the layers separate: no database queries inside React components, no business logic inside
large page files.

---

## Environment variables

Every variable the project will ever need is listed in [`.env.example`](.env.example), with a
comment saying what it is and which phase uses it. Variables belonging to later phases are
optional, so the app boots with an empty `.env.local`.

Supabase setup is written out step by step in [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

[SECURITY.md](SECURITY.md) records what is protected, what is not, and the checklist to work
through before taking real money.

---

## What this repository does NOT build

Two pieces are the payment developer's work. Both live behind documented boundaries so neither
needs changes to the code here.

**1. Payment provider integration** — see [PAYMENT_INTEGRATION.md](PAYMENT_INTEGRATION.md).

The single most important rule: **only `POST /api/payments/confirm` can mark an order `PAID`.** No
page, button or redirect may do it. The payment return page is read-only.

Do not install Paystack, Stripe, Flutterwave or any other provider SDK.

**2. The venue check-in page and QR scanner** at `/admin/check-in` — see
`CHECK_IN_INTEGRATION.md` (written in Phase 10).

We *do* build everything it depends on: the `tickets` table with `qr_token`, `ticket_code`,
`status`, `checked_in_at` and `checked_in_by`; the `requireAdmin('staff')` helper it protects
itself with; the status colour tokens its pass/fail screens use; and `camera=(self)` in the
Permissions-Policy header so its scanner can open the camera at all.

Note that we still **generate** QR codes — the buyer's ticket page needs the image. We just do not
build the thing that reads them.

---

## Turning on real emails

Out of the box `EMAIL_PROVIDER=console`: nothing is sent, and each email is written to `.mail/`
for you to open in a browser. The whole ticket flow works this way, which is why no email account
was needed to build it.

To send for real you need **a domain you control**. Providers will not let you email strangers
from a Gmail address — you prove ownership with DNS records, and those same records are what stop
your tickets landing in spam.

1. Sign up at [resend.com](https://resend.com). The free tier is 3,000 emails a month.
2. **Domains → Add Domain**, then paste the DNS records it gives you into your registrar.
   Verification usually takes about 15 minutes.
3. **API Keys → Create**, and copy the key.
4. In `.env.local`:

   ```
   EMAIL_PROVIDER=resend
   RESEND_API_KEY=re_...
   EMAIL_FROM=Your Event <tickets@yourdomain.com>
   ```

   `EMAIL_FROM` must be on the domain you just verified. Getting that wrong is the commonest
   first failure.
5. Restart, then check it:

   ```bash
   npm run test-email -- --to you@example.com
   ```

No code changes are needed. `lib/services/notifications.ts` picks the driver from that one
variable, and a different provider means writing a sibling of
`lib/services/email/resend.ts`.

> **Before going live**, set `NEXT_PUBLIC_SITE_URL` to your real address. The "View your tickets"
> link in every email is built from it, so while it says `localhost` those links work on your
> laptop and nowhere else.

---

## The admin

`/admin` is behind Supabase Auth **plus mandatory two-factor authentication**. A password alone
will not get in, even for a real administrator.

There is no admin sign-up page, deliberately. An administrator exists only because someone holding
the service-role key created one:

```bash
npm run create-admin -- --email you@example.com --role owner
```

That prints a generated password once. On first sign-in the new admin scans a QR code with an
authenticator app on their own phone — a secret you generate and send them is not a second factor.

| Role | Can |
|---|---|
| `owner` | everything: settings, prices, exports |
| `staff` | view, plus check-in once it exists |

Access is checked by one helper, `requireAdmin(role)` in [`lib/auth/`](lib/auth/), called at the
top of **every** admin page and action — not once in a layout, because a layout does not run for a
server action. The payment developer's check-in page uses the same call.

> **Two-factor codes depend on clocks agreeing.** If a code is always rejected, check the device's
> clock. Windows: Settings → Time & language → Date & time → **Sync now**. A minute of drift is
> enough to fail.

---

## Phases

Each phase stops for review before the next one starts.

| | Phase | Status |
|---|---|---|
| 1 | Project setup, design system, folder structure | ✅ done |
| 2 | Database migrations, RLS, seed data | ✅ done |
| 3 | Landing page from Supabase | ✅ done |
| 4 | Checkout steps 1–2, order creation with atomic inventory reservation | ✅ done |
| 5 | Payment boundary, ticket issuance, ticket pages | ✅ done |
| 6 | Email delivery, find-tickets | ✅ done |
| 7 | Admin auth with 2FA, overview dashboard | ✅ done |
| 8 | Admin ticket types, orders, attendees, settings, CSV export | next |
| 9 | Security review and responsive polish | ✅ done |
| 10 | README, PAYMENT_INTEGRATION.md, CHECK_IN_INTEGRATION.md, final test run | next |

The full specification is in [`gala_prompt.MD`](gala_prompt.MD).
