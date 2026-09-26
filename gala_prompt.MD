# Gala Night Ticketing Website — Build Instructions

Build a production-quality ticket sales website for a Gala Night in Nigeria (currency: Naira), plus an admin dashboard. The venue check-in tool is built later by the payment developer, so prepare the ground for it (section 10).

Reference screenshots of the ticket flow I want are in `/reference` in this project. Use them ONLY for UX, layout, spacing, visual hierarchy and the checkout structure. Do NOT copy the reference brand's name, logo, text, images or assets. The site must have its own original Gala Night identity.

**Work phase by phase. At the end of EVERY phase, stop, summarise what you built in plain English, tell me how to test it, and wait for my approval before starting the next phase.** Explain things simply — I am still learning.

---

## 1. Who builds what

**My code (what you build):**
- Public landing page and the 3-step ticket purchase flow
- Database, migrations and Row Level Security
- Order creation and ticket issuance (generating ticket codes and QR tokens)
- Ticket delivery pages and email (buyer sees and recovers their tickets)
- Admin dashboard and admin login
- The database fields and documentation the check-in tool will need (but NOT the check-in tool itself)
- A clean, documented boundary for the payment developer

**The payment developer builds (do NOT build this):**
- Payment provider integration (Providus Bank or other), initialisation, verification, webhooks, callbacks, payment secrets
- The venue check-in page (QR scanner at the gate)

Do NOT install or configure Paystack, Stripe, Flutterwave or any payment provider. Do NOT build the check-in page or a QR scanner.

---

## 2. Tech stack

Next.js (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres, Auth, Storage) · Zod · one small QR code library. Hosting: Vercel. Avoid unnecessary dependencies.

---

## 3. Non-negotiable rules

1. **Money is stored as integers in kobo** (₦5,000 = 500000). Never floats or decimals. Convert to Naira only for display.
2. **Prices and totals are always calculated on the server** from the database. Never trust amounts, prices or quantities sent from the browser.
3. **The browser never talks to the database directly for writes.** All writes go through server actions / API routes.
4. **`SUPABASE_SERVICE_ROLE_KEY` is only ever used in server code.** Never import it into a client component. Never commit `.env` files.
5. **Only the payment confirmation function can mark an order PAID.** No page, button or redirect may do it.
6. **The "payment return" page never marks anything paid.** It only reads the order status.
7. **No promo codes, discounts or sponsor codes anywhere** (no tables, UI or services).

---

## 4. Project structure

Keep layers separate. No database queries inside React components; no business logic in large page files.

```
app/
  page.tsx                      landing page
  checkout/                     3-step purchase flow
  payment/return/               "confirming your payment…" page
  tickets/[accessToken]/        buyer's ticket page
  find-tickets/                 lost-ticket recovery
  admin/                        dashboard, orders, attendees, ticket types, event settings
                                (the payment developer will add admin/check-in/ later)
  api/                          route handlers
components/  ui/ event/ tickets/ checkout/ admin/
lib/
  supabase/                     server client, browser client (anon key only)
  services/  events.ts tickets.ts orders.ts attendees.ts issuance.ts payment/ notifications.ts
  auth/                         requireAdmin(role) helper, reusable by any future admin page
  validation/                   Zod schemas
  money.ts                      kobo ⇄ Naira helpers
types/
supabase/migrations/
reference/                      screenshots (not deployed)
```

---

## 5. Database (Supabase migrations)

All money columns are `integer` kobo. Use Postgres enums for statuses.

**events** — id, name, slug, description, date, start_time, end_time, venue, address, dress_code, hero_image_url, gallery (jsonb array of image URLs), faq (jsonb array of {question, answer}), contact_email, contact_phone, status, created_at, updated_at

**ticket_types** — id, event_id, name, description, price_kobo, admits (int, how many people one ticket admits — e.g. a VIP table may admit 10), inventory (total available), max_per_order, sale_start, sale_end, is_active, image_url, sort_order, created_at, updated_at
*Do NOT store a `sold_count` column. Calculate availability from orders (see section 6).*

**attendees** — id, email (unique, lower-cased), first_name, last_name, phone (stored as +234XXXXXXXXXX), created_at, updated_at. A returning buyer with the same email reuses their row (update their name/phone).

**orders** — id, reference (unique, short, human-readable, e.g. GALA-1042), access_token (long random secret, unique), event_id, attendee_id, total_kobo, status, expires_at, paid_at, payment_reference (unique, nullable, set by payment confirmation), created_at, updated_at

**order_items** — id, order_id, ticket_type_id, quantity, unit_price_kobo (copied from ticket_types at purchase), line_total_kobo

**tickets** — id, order_id, order_item_id, ticket_type_id, attendee_id, ticket_code (short human-readable, e.g. K7Q2-XM9P, no confusable characters 0/O/1/I), qr_token (long random opaque secret, unique), status, checked_in_at, checked_in_by, created_at

**admins** — user_id (references auth.users), role (`owner` | `staff`), created_at. Rows are added by hand in Supabase. There is NO public admin sign-up.

**audit_log** — id, actor (admin user id or 'system' or 'payment'), action, details (jsonb), created_at. Insert-only. Record: order paid, tickets issued, check-ins (written later by the check-in tool), ticket type changes, event setting changes, CSV exports.

The payment developer may add their own `payments` / `payment_attempts` tables later; nothing in the core schema should need to change for that.

---

## 6. Order and ticket states

**Order status:** `PENDING` → `PAID` | `FAILED` | `EXPIRED` | `CANCELLED`; `PAID` → `REFUNDED`.
- New orders are `PENDING` with `expires_at` = now + 30 minutes.
- A scheduled job (Supabase pg_cron) marks overdue `PENDING` orders `EXPIRED`.

**Ticket status:** `ACTIVE` → `USED`; `ACTIVE` → `CANCELLED` (refunds).
Tickets are created ONLY when an order becomes `PAID`.

**Inventory (important — VIP tables are limited):**
Available = `inventory` − quantity in `PAID` orders − quantity in `PENDING` orders that have not expired.
Order creation must check and reserve inventory **atomically in one Postgres function/transaction** (lock the ticket_type rows) so two people cannot buy the last VIP table at the same moment.

---

## 7. Public website

**Visual direction:** premium, elegant, dark gala aesthetic. Black background, white typography, one purple/magenta accent, large type, rounded cards, subtle borders and glow. Mobile-first. No cheap gradients, no excessive animation, no generic template look.

**Landing page sections:** Hero (event name, date, venue, short description, **GET YOUR TICKET** button) · About · Experience · Gallery · Tickets preview · Dress code · FAQ · Contact · Footer.
All content comes from the `events` table so the admin can edit it.

**Purchase flow — 3 steps with a progress indicator (1 YOUR DETAILS · 2 SELECT TICKETS · 3 PAYMENT):**

**Step 1 — Your details.** Email, first name, last name, phone. No account or password.
- Phone accepts `08012345678` or `+2348012345678`; normalise to `+234…`.
- Consent checkbox linking to the privacy policy (Nigeria Data Protection Act).
- Bot protection: Cloudflare Turnstile.
- Button: CONTINUE TO TICKETS.

**Step 2 — Select tickets.** One card per active ticket type from Supabase: image/icon, name, price, description, − / + quantity selector.
- Respect inventory, max per order, active state, sale start/end. Show "Sold out" / "Sales not open" states.
- Order summary: each line, and **Total** in Naira. No discount line.
- Button: CONTINUE TO PAYMENT.

**On CONTINUE TO PAYMENT (server side):**
1. Validate details and selection with Zod
2. Create or reuse the attendee by email
3. In one transaction: check and reserve inventory, create the `PENDING` order and order_items, calculate `total_kobo` from database prices
4. Return `{ orderId, reference, accessToken, totalKobo }`
5. Call `paymentService.startPayment(...)` (section 8) and redirect the buyer to the URL it returns

**Step 3 — Payment** is the payment developer's. Our UI stops at the redirect.

**`/payment/return?ref=…&token=…`** — shows "Confirming your payment…", polls the order status every few seconds (read-only), then shows the tickets, or a failed/expired message with a "try again" option.

**`/tickets/[accessToken]`** — the buyer's tickets for that order: event, guest name, ticket type, ticket code, QR code (encoding the `qr_token` only — no personal data), date, venue, "admits N". Button to download/save. This page is `noindex`.

**`/find-tickets`** — buyer enters their email. If paid orders exist, the ticket links are re-sent to the email ON THE ORDER. Never display tickets on screen from this form. Rate-limited. Always show the same neutral message ("If we found tickets, we've sent them").

---

## 8. Payment boundary (for the payment developer)

**Outgoing — `lib/services/payment.ts`:**
```ts
export interface PaymentService {
  startPayment(input: {
    orderId: string; reference: string; amountKobo: number; currency: 'NGN';
    customer: { email: string; firstName: string; lastName: string; phone: string };
    returnUrl: string;           // /payment/return?ref=…&token=…
  }): Promise<{ redirectUrl: string }>;
}
```
Provide a **test-only** `DevMockPaymentService` that redirects to `/dev/mock-payment`, where I can click "Simulate success" / "Simulate failure". That page must call the real `/api/payments/confirm` route with a correctly signed request — exactly what the payment developer's system will do — so the rest of the app is tested the real way. Rules:
- It lives in its own files (`lib/services/payment/mock.ts`, `app/dev/`) and nothing else imports it directly.
- The app chooses the implementation from one env variable, `PAYMENT_PROVIDER=mock|real`.
- The `/dev` pages and the mock return 404 and refuse to load when `NODE_ENV=production`.
- The payment developer replaces it by writing `lib/services/payment/real.ts` and setting `PAYMENT_PROVIDER=real`. No checkout or ticket code changes. They may delete the mock files once done.

**Incoming — `lib/services/orders.ts → confirmOrderPayment()`, exposed at `POST /api/payments/confirm`:**
```ts
confirmOrderPayment(input: {
  reference: string; paymentReference: string; amountKobo: number;
  status: 'success' | 'failed'; paidAt: string; raw?: unknown;
}): Promise<{ ok: true }>
```
- The route requires an `X-Signature` header: HMAC-SHA256 of the raw body with `PAYMENT_CONFIRM_SECRET`. Reject if wrong.
- Idempotent: if `paymentReference` was already processed, return ok and change nothing.
- Reject and log if the order is missing, not `PENDING`/`EXPIRED`, or the amount does not exactly match `total_kobo`. (A late payment on an EXPIRED order: accept only if inventory is still available; otherwise flag it in the admin for refund.)
- On success, in ONE transaction: set order `PAID`, `paid_at`, `payment_reference`; call `issueTickets(orderId)` which creates one ticket per unit with unique `ticket_code` and `qr_token`; write audit_log rows.
- On `failed`: set order `FAILED`, release inventory.
- After commit: email the tickets to the buyer (section 9).
- Provide `scripts/simulate-payment.ts` that sends a correctly signed fake confirmation, so I can test without the real payment system.

---

## 9. Ticket delivery

Email only — **no SMS**. `lib/services/notifications.ts` with an email interface (Resend, behind the interface so the provider can change). After tickets are issued, send one email with: ticket codes, QR images, and the `/tickets/[accessToken]` link. The success page also tells buyers to screenshot their tickets.
Resending (from `/find-tickets` or admin) sends the SAME tickets. It never creates new ones.

---

## 10. Admin

**Auth:** Supabase Auth email + password + **mandatory 2FA (TOTP)**. Access requires a row in `admins`. Check on the server for every admin route and action — never rely on hiding UI. `owner` can edit settings and export; `staff` can only view (and will use check-in once it exists). Put the access check in one reusable helper, `requireAdmin(role)`, so the payment developer's check-in page protects itself the same way.

**Overview:** tickets sold (by type and total), people admitted count, tickets remaining per type, total orders, paid orders, pending orders, total revenue (sum of `PAID` orders only), revenue per ticket type, sales per day chart.

**Ticket types (owner):** create, edit, deactivate (never hard-delete a type that has orders), price, inventory, admits, max per order, sale start/end, image upload (Supabase Storage), sort order.

**Orders:** list, search by email / phone / reference, filter by status, order detail (customer, items, total, status, payment reference, tickets and their status), resend tickets, flag for refund.

**Attendees:** name, email, phone, tickets bought, order status, checked-in status; search and filter; CSV export (owner, logged).

**Event settings (owner):** all `events` fields including gallery images, FAQ, dress code, contact info.

**Check-in — NOT built by me.** The payment developer will build it. Prepare for it only:
- The `tickets` table already has `qr_token`, `ticket_code`, `status`, `checked_in_at`, `checked_in_by`.
- The Attendees and Orders pages show each ticket's status (Active / Used / Cancelled) and check-in time, so they will update automatically once check-in exists.
- Leave a "Check-in (coming soon)" item in the admin menu pointing to `/admin/check-in`, which currently shows a placeholder page.
- Write **CHECK_IN_INTEGRATION.md** (section 13).

---

## 11. Security

- RLS enabled on every table. Public (anon) role: read-only access to the active event and active ticket types; nothing else.
- All other reads/writes go through server code.
- Zod validation on every server input.
- Rate limiting on order creation, find-tickets and the payment confirm route.
- Friendly error messages to users; never show raw database errors.
- Security headers; `noindex` on ticket and admin pages.

---

## 12. Errors and loading states

Handle: invalid form data, sold out, quantity over limit, sales not open, order creation failure, payment start failure, payment failed/expired, unauthorised admin.
Show skeletons/spinners for: event, ticket types, order creation, admin tables.

Mobile-first; test at 375, 390, 430, 768, 1024, 1440px. No horizontal scrolling.

---

## 13. Documentation

- **README.md** — architecture, env vars, Supabase setup, migrations, local dev, how to create the first admin, how to test with the mock payment and `simulate-payment` script.
- **PAYMENT_INTEGRATION.md** — for the payment developer: the `PaymentService` interface to implement, the `/api/payments/confirm` contract (fields, signature, idempotency, expected responses), order statuses, what the return page expects, what they must NOT change, and a full example flow.
- **CHECK_IN_INTEGRATION.md** — for the payment developer's check-in page: what the QR code contains (the `qr_token` only), the `tickets` fields and statuses, how to protect the page with `requireAdmin('staff')`, and the exact rule for checking a ticket in: one atomic `UPDATE tickets SET status='USED', checked_in_at=now(), checked_in_by=<admin> WHERE (qr_token=$1 OR ticket_code=$1) AND status='ACTIVE' RETURNING …` so the same ticket can never be used twice; results VALID (show guest name, ticket type, admits N) / ALREADY USED (show time) / INVALID; write an audit_log row per check-in; and a manual search by name/phone for guests whose phone died.
- `.env.example` with every variable (no real values).

---

## 14. Phases (stop after each for my approval)

1. Project setup, design system (colours, fonts, buttons, cards, inputs), folder structure
2. Database migrations, RLS, seed data (one sample event + sample ticket types clearly marked as sample)
3. Landing page (data from Supabase)
4. Checkout steps 1 and 2 + order creation with atomic inventory reservation
5. Payment boundary: `PaymentService`, dev mock, `/api/payments/confirm`, ticket issuance, `/payment/return`, `/tickets/[accessToken]`, simulate-payment script
6. Email delivery + `/find-tickets`
7. Admin auth with 2FA + overview dashboard
8. Admin ticket types, orders, attendees, event settings, CSV export, audit log
9. Security review and responsive polish
10. README, PAYMENT_INTEGRATION.md, CHECK_IN_INTEGRATION.md, final test run

Before Phase 1, read this whole document, look at the screenshots, and give me a short plain-English summary of the architecture and any questions. Do not write code until I reply.