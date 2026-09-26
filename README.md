# Gala Night — ticketing

A ticket sales website for a Gala Night in Nigeria, with an admin dashboard and a venue check-in
tool. Currency is Naira (₦).

**Current status: Phase 1 complete** — project setup and design system. There is no database, no
checkout and no payment code yet. See [Phases](#phases) below.

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
  admin/                 dashboard and check-in          (Phases 7–9)
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
  services/              business logic                  (Phase 2+)
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

---

## Payments

Payment provider integration is **not** built here — it is the payment developer's work, behind two
small contracts documented in [PAYMENT_INTEGRATION.md](PAYMENT_INTEGRATION.md).

The single most important rule: **only `POST /api/payments/confirm` can mark an order `PAID`.** No
page, button or redirect may do it. The payment return page is read-only.

---

## Phases

Each phase stops for review before the next one starts.

| | Phase | Status |
|---|---|---|
| 1 | Project setup, design system, folder structure | ✅ done |
| 2 | Database migrations, RLS, seed data | next |
| 3 | Landing page from Supabase | |
| 4 | Checkout steps 1–2, order creation with atomic inventory reservation | |
| 5 | Payment boundary, ticket issuance, ticket pages | |
| 6 | Email delivery, find-tickets | |
| 7 | Admin auth with 2FA, overview dashboard | |
| 8 | Admin ticket types, orders, attendees, settings, CSV export | |
| 9 | Check-in scanner | |
| 10 | Security review, responsive polish, full docs | |

The full specification is in [`gala_prompt.MD`](gala_prompt.MD).
