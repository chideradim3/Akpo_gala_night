# Payment integration

For the developer connecting the payment provider. Everything you need is
here; you should not need to read the rest of the codebase.

**Written for:** the payment developer (Providus Bank or whichever provider
is chosen).

---

## What you are building

Two things, and nothing else:

1. **`startPayment`** — given an order, get a payment page from the provider
   and return its URL. One file: `lib/services/payment/real.ts`.
2. **Calling `POST /api/payments/confirm`** — when the provider confirms,
   tell this system. That route already exists and works.

Everything else — the checkout, ticket issuance, emails, the admin — is
built and tested. You are filling in one gap in the middle.

### What you must NOT change

| | Why |
|---|---|
| Anything in `app/checkout/`, `lib/services/orders.ts`, `lib/services/ticketDelivery.ts` | The flow either side of you is tested; changing it breaks guarantees you cannot see from your side |
| The `orders`, `order_items` or `tickets` tables | Order totals and ticket issuance depend on their exact shape |
| `app/api/payments/confirm/route.ts` | This is the contract. If it does not fit your provider, say so rather than editing it |
| `/payment/return` | It is read-only by design and must stay that way |

You may add your own tables (`payments`, `payment_attempts`) and your own
environment variables. Nothing in the core schema needs to change.

---

## Setup

```bash
git clone https://github.com/chideradim3/Akpo_gala_night.git
cd Akpo_gala_night
npm ci                       # Node 22 or newer — see .nvmrc
cp .env.example .env.local   # ask for the values
npm run dev
```

You need from whoever runs the event:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **`PAYMENT_CONFIRM_SECRET`** — the shared secret for signing. Get it
  securely; it is what stops anyone marking orders paid.

Work against a **separate Supabase project** from the live one if you can.

---

## 1. Outgoing — `startPayment`

Implement this in `lib/services/payment/real.ts` (a skeleton is already
there), then set `PAYMENT_PROVIDER=real`.

```ts
export interface PaymentService {
  startPayment(input: {
    orderId: string;        // uuid, our internal id
    reference: string;      // "GALA-1042" — human-readable, unique
    amountKobo: number;     // INTEGER KOBO. ₦5,000 is 500000
    currency: "NGN";
    customer: {
      email: string;
      firstName: string;
      lastName: string;
      phone: string;        // always +234XXXXXXXXXX
    };
    returnUrl: string;      // send the buyer here afterwards, whatever happens
  }): Promise<{ redirectUrl: string }>;
}
```

The checkout calls this and sends the buyer to `redirectUrl`.

**Do not mark anything paid here.** At this point you only know the buyer
has been *sent* to pay.

**Throwing is safe.** The order stays `PENDING` and expires by itself after
30 minutes, releasing the seats. The buyer sees "we could not reach the
payment provider — your seats are held for 30 minutes."

---

## 2. Incoming — `POST /api/payments/confirm`

**This is the only thing in the entire system that can mark an order paid.**
No page, button or redirect can, including the page the buyer lands on.

### Request

```http
POST /api/payments/confirm
Content-Type: application/json
X-Signature: <hex>

{
  "reference": "GALA-1042",
  "paymentReference": "PSP-9f3a21",
  "amountKobo": 21000000,
  "status": "success",
  "paidAt": "2026-09-27T14:12:56.849Z",
  "raw": { }
}
```

| Field | Rules |
|---|---|
| `reference` | Our order reference, exactly as given to `startPayment` |
| `paymentReference` | **Your** reference. Must be STABLE for a given payment — see idempotency below |
| `amountKobo` | Integer kobo. Must match the order total **exactly** |
| `status` | `"success"` or `"failed"` |
| `paidAt` | ISO 8601 |
| `raw` | Optional. Your provider's payload, stored for the audit trail |

### The signature

`X-Signature` is the HMAC-SHA256 of the **raw request body**, hex encoded,
keyed with `PAYMENT_CONFIRM_SECRET`.

```ts
import { createHmac } from "node:crypto";

const body = JSON.stringify({ /* … */ });          // build the string ONCE
const signature = createHmac("sha256", process.env.PAYMENT_CONFIRM_SECRET!)
  .update(body, "utf8")
  .digest("hex");

await fetch(`${siteUrl}/api/payments/confirm`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Signature": signature },
  body,                                            // send THAT EXACT string
});
```

> **Sign the exact bytes you send.** Re-serialising — signing one object and
> sending `JSON.stringify` of another — can reorder keys or change spacing,
> and the signature will not match. Build the string once, sign it, send it.

### Idempotency — read this one twice

The route is idempotent on `paymentReference`. Send the same one again and
it changes nothing and returns `ALREADY_PROCESSED`.

**This only works if your reference is stable.** Providers retry webhooks
they believe failed. If each retry carries a fresh reference, the system
sees a second, different payment — and a buyer gets two sets of tickets for
one purchase.

Use the provider's own transaction id. Never a timestamp or a random value.

### Responses

| Status | Body | Meaning | Retry? |
|---|---|---|---|
| `200` | `{ ok: true, outcome, ticketsIssued, emailed? }` | Accepted | No |
| `400` | `{ ok: false, error: "Body is not valid JSON" }` | Malformed | No — fix the request |
| `400` | `{ ok: false, error: "Invalid payload" }` | A field is wrong or missing | No — fix the request |
| `401` | `{ ok: false, error: "Invalid signature" }` | Signature missing or wrong | No — fix the signing |
| `404` | `{ ok: false, error, code: "GN101" }` | No order with that reference | No |
| `409` | `{ ok: false, error, code }` | Conflicts with the order's state — see below | No |
| `429` | `{ ok: false, error: "Too many requests" }` | Rate limited; honour `Retry-After` | Yes |
| `500` | `{ ok: false, error }` | Our fault | **Yes** — retrying is safe |

**`outcome`** on a 200:

| Value | Meaning |
|---|---|
| `PAID` | Order paid, tickets issued, email sent |
| `ALREADY_PROCESSED` | Seen this `paymentReference` before. Nothing changed |
| `FAILED_RECORDED` | Recorded as failed, seats released |
| `REFUND_REQUIRED` | Paid, but the hold had expired and the tickets were gone. **No tickets issued — this payment must be refunded.** Flagged in the admin |

**`code`** on a 409:

| Code | Meaning |
|---|---|
| `GN102` | The order is not awaiting payment — already paid, cancelled, or refunded |
| `GN103` | `amountKobo` does not match the order total |
| `GN104` | That `paymentReference` belongs to a **different** order. A mix-up; stop and investigate |

---

## 3. Where the buyer lands

Send them to `input.returnUrl` — success, failure or cancellation, always.
It looks like:

```
/payment/return?ref=GALA-1042&token=<access token>
```

That page polls the order status and shows whatever your confirmation
recorded. **It decides nothing.** If the buyer arrives before your webhook
does, it waits, then shows the tickets when the status changes.

So: never rely on the buyer returning. The confirmation is what matters.

---

## Order states

```
PENDING ──pay──▶ PAID ──▶ REFUNDED
   │
   ├──fail────▶ FAILED
   └──30 min──▶ EXPIRED
```

- A `PENDING` order **holds its seats**. Availability already subtracts them.
- `FAILED` and `EXPIRED` release the seats automatically — no cleanup needed.
- Tickets exist **only** for `PAID` orders.
- A late payment on an `EXPIRED` order is accepted if the seats are still
  free; otherwise it becomes `REFUND_REQUIRED`.

---

## Testing without the provider

Before your integration exists, and to test the signing:

```bash
# Find a pending order's reference and total in the admin, then:
npm run simulate-payment -- --ref GALA-1042 --amount 21000000

# Failure:
npm run simulate-payment -- --ref GALA-1042 --amount 21000000 --status failed

# Idempotency — send the SAME payment reference twice.
# The second must say ALREADY_PROCESSED and issue no extra tickets.
npm run simulate-payment -- --ref GALA-1042 --amount 21000000 --payment-ref PSP-1
npm run simulate-payment -- --ref GALA-1042 --amount 21000000 --payment-ref PSP-1
```

`scripts/simulate-payment.mjs` sends exactly the request you must send:
same route, same signature, same payload. **Read it** — it is the shortest
correct example of the contract.

There is also a browser simulator at `/dev/mock-payment` while
`PAYMENT_PROVIDER=mock`. It calls the same real route with a real signature.
Both it and `/dev/*` return 404 in production.

---

## Before you hand it back

- [ ] `startPayment` implemented, `PAYMENT_PROVIDER=real`
- [ ] Amounts converted correctly — confirm whether your provider works in
      Naira or kobo, and that a ₦200,000 table arrives as `20000000`
- [ ] `paymentReference` is the provider's stable transaction id
- [ ] The same webhook delivered twice issues **one** set of tickets
- [ ] A failed payment records `FAILED` and releases the seats
- [ ] The buyer is returned to `returnUrl` on success, failure and cancellation
- [ ] Your secrets are in `.env.example` by name only, never with values
- [ ] `npm run audit:security` passes
- [ ] One real payment, end to end, with a real card

Questions about anything above: ask rather than guess. Getting idempotency
or the amount unit wrong costs real money.
