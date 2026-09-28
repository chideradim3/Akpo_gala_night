# Security

What protects this system, what does not, and what must be done before real
money goes through it.

Written at the Phase 9 review. Re-run the checks with:

```bash
npm run audit          # static security audit + responsive audit
npm run test:db        # inventory race + Row Level Security, needs local Supabase
```

---

## The four rules everything else rests on

**1. Money is integer kobo.** ₦5,000 is `500000`. Every money column is
`integer`, enforced by the database, and checked by `npm run audit:security`.
Floats would drift, and a total a kobo out is rejected by the payment
confirmation as a mismatch — a genuine payment refused for reasons nobody
could diagnose.

**2. The browser never writes to the database.** It may read the published
event and its active ticket types. Nothing else — not by policy alone but
because the `anon` role has no write grant on any table, verified against
the live project.

**3. `SUPABASE_SERVICE_ROLE_KEY` is server-only.** `lib/supabase/admin.ts`
and `lib/env.ts` start with `import "server-only"`, so importing them into a
client component is a build error rather than a leak. The built bundle is
scanned for the key, the payment secret and the database URL; none appear.

**4. Only `POST /api/payments/confirm` can mark an order PAID.** It requires
an HMAC-SHA256 signature over the raw body, compared in constant time. No
page, button or redirect can do it, including the payment return page, which
only reads.

---

## What is in place

| Area | How |
|---|---|
| Row Level Security | On all 8 tables. `anon` reads the published event and active tiers; every other table has no policy at all, and the grants are revoked too |
| Overselling | `create_order_with_reservation` locks `ticket_types` rows `FOR UPDATE` in a fixed order, so concurrent buyers cannot oversell and cannot deadlock. Proved with 6 simultaneous buyers against production |
| Double-issuing tickets | `confirm_order_payment` is idempotent on `paymentReference`; a replayed webhook returns `ALREADY_PROCESSED` and changes nothing |
| Admin access | Signed in, **and** two-factor at AAL2, **and** a row in `admins`. Checked by `requireAdmin()` at the top of every page, action and API route — never in a layout, which does not run for server actions |
| Input validation | Zod on every public server action. The schemas have no field for a price, so a tampered page has nothing to tamper with |
| Ticket privacy | QR codes encode an opaque random token only — no name, email or reference. Ticket pages are `noindex` |
| Guest list | CSV export is owner-only and every download writes an audit row naming the account |
| Audit trail | Insert-only. No code path updates or deletes, and RLS blocks it |
| Headers | CSP scoped to this Supabase project rather than all of `https:`, `frame-ancestors 'none'`, HSTS, `nosniff`, restrictive `Permissions-Policy` |
| Spreadsheet injection | CSV cells beginning `=`, `+`, `-` or `@` are prefixed so Excel does not execute them |
| Enumeration | `/find-tickets` returns one sentence whatever happens, so it cannot be used to discover who is attending. Admin login does not distinguish "no such account" from "wrong password" |

---

## What is NOT protected, and what to do about it

Stated plainly. These are known and accepted for now, not oversights.

### Rate limiting is per-instance

`lib/rateLimit.ts` counts in the memory of one server process. On Vercel each
serverless instance keeps its own tally and the counts reset when an instance
is recycled, so a determined attacker gets more attempts than the numbers
suggest.

It stops accidental double-clicks and casual scripts, which is what actually
happens. It is not a defence against someone who means it.

**To fix:** put Upstash Redis behind the same `checkRateLimit` signature. No
caller changes.

### Bot protection is switched off

Cloudflare Turnstile is wired in and fails closed once enabled — but with no
keys configured it is a no-op, so nothing stops a script creating PENDING
orders and holding your inventory for 30 minutes at a time.

**To fix before launch:** set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and
`TURNSTILE_SECRET_KEY`. Free, and it is the single highest-value item on
this list.

### Admin passwords have no lockout

Login is rate limited per IP, not per account, so someone rotating IPs could
grind at a password. Two-factor is what actually stops them getting in.

**Mitigation:** use a long generated password. `npm run create-admin`
produces one.

### Refunds are manual

Flagging an order for refund records that money is owed. It does not move
any. Somebody must refund it in the payment provider and then mark it
handled.

### Node 20 is below what the Supabase client requires

`@supabase/supabase-js` declares `engines: node >= 22`. The app runs on Node 20 only because
Next.js polyfills the WebSocket the library expects; a plain Node script using the same library
already throws.

Nothing is broken today, but an unmet engine requirement is a dependency waiting to break on a
routine `npm install`, and Vercel now defaults to Node 22 — so production and a Node 20 laptop are
running different runtimes, which is how bugs hide.

**To fix:** install Node 22 LTS. `package.json` and `.nvmrc` already declare it.

### The payment integration is not written yet

`lib/services/payment/real.ts` is a skeleton. Until it exists,
`PAYMENT_PROVIDER=mock`, and the mock refuses to load in production.

---

## Before you go live

- [ ] `PAYMENT_PROVIDER=real`, with the real integration deployed
- [ ] `PAYMENT_CONFIRM_SECRET` generated fresh for production and shared with the payment developer **securely** — not over chat
- [ ] `NEXT_PUBLIC_SITE_URL` set to the real domain. Until then every ticket email links to `localhost`
- [ ] Turnstile keys set
- [ ] `EMAIL_PROVIDER=resend` with a verified domain, checked using `npm run test-email`
- [ ] A **separate Supabase project** for production, so test orders never mix with real ones
- [ ] Sample data removed and the real event published
- [ ] At least two owner accounts, so losing one phone does not lock you out
- [ ] Running Node 22, locally and in production, so both match
- [ ] `npm run audit` passes
- [ ] A real purchase made end to end on the production site, with a real card

---

## If something goes wrong

**A key is exposed** — rotate it in Supabase (Settings → API), update the
environment, redeploy. The old key stops working immediately.

**Someone is abusing the checkout** — set `is_active = false` on the ticket
types to stop sales while you look. Availability recovers on its own as the
30-minute holds expire.

**A guest cannot get in at the door** — find the order in the admin by email
or phone, check the ticket status, and resend the tickets. The ticket code is
enough; the QR is a convenience.
