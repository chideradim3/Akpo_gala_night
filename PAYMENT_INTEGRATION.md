# Payment integration guide

> **Status: stub. Written in full during Phase 5.**
>
> This file exists now so the payment developer can be pointed at a stable path early. The
> contracts below are already fixed by the build spec and will not change — only the detail
> around them gets filled in.

## Who builds what

| Built by us | Built by the payment developer |
|---|---|
| Checkout, order creation, ticket issuance, emails, admin, check-in | Everything that touches the payment provider (Providus Bank or other) |

No payment provider SDK is installed in this repository, and none should be. The payment
developer's code lives behind two small contracts.

## Contract 1 — outgoing: starting a payment

We call you. Implement this interface in `lib/services/payment/real.ts`:

```ts
export interface PaymentService {
  startPayment(input: {
    orderId: string;
    reference: string;          // our human-readable order reference, e.g. GALA-1042
    amountKobo: number;         // integer kobo — ₦5,000 is 500000. Never a float.
    currency: 'NGN';
    customer: { email: string; firstName: string; lastName: string; phone: string };
    returnUrl: string;          // /payment/return?ref=…&token=… — send the buyer here afterwards
  }): Promise<{ redirectUrl: string }>;
}
```

Then set `PAYMENT_PROVIDER=real`. No checkout or ticket code changes.

## Contract 2 — incoming: confirming a payment

You call us, at `POST /api/payments/confirm`:

```ts
{
  reference: string;           // our order reference
  paymentReference: string;    // your provider's reference — used for idempotency
  amountKobo: number;          // must match the order total EXACTLY
  status: 'success' | 'failed';
  paidAt: string;              // ISO 8601
  raw?: unknown;               // your provider's raw payload, stored for audit
}
```

- Requires an `X-Signature` header: HMAC-SHA256 of the **raw request body** using the shared
  `PAYMENT_CONFIRM_SECRET`. Wrong or missing signature is rejected.
- **Idempotent.** If we have already processed that `paymentReference`, we return ok and change
  nothing. Safe to retry.
- Rejected if the order does not exist, is not `PENDING`/`EXPIRED`, or the amount does not match.

## The rule that matters most

**This route is the only thing in the entire system that can mark an order `PAID`.** No page, no
button, no redirect and no return URL can do it. `/payment/return` is read-only — it polls the
order status and displays it, nothing more.

---

*Full field tables, worked examples, error responses and a test script
(`scripts/simulate-payment.ts`) land in Phase 5.*
