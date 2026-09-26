# Reference screenshots — UX only, NOT deployed

These are screenshots of a third-party ticketing site (unboxedparty.com), kept here purely as a
**layout and interaction reference** for the checkout flow.

Use them for: step ordering, the 1·2·3 progress indicator, card shape and spacing, the − / +
quantity selector, and the order-summary structure.

**Do NOT copy**: brand name, logo, wordmark, colours as-is, copy/wording, images or any asset.
Gala Night has its own original identity.

Deliberate differences from these screenshots:

- **No "Have a sponsor or promo code?" row.** The build spec (section 3, rule 7) forbids promo,
  discount and sponsor codes everywhere — no table, no UI, no service.
- **No "Subtotal (Face Value)" line.** With no discounts there is nothing to subtotal, so there is
  a single **Total**.
- Step 1 collects email, first name, last name and phone together (one of the screenshots shows an
  email-only variant; the spec calls for all four fields, plus an NDPA consent checkbox).

| File | Shows |
|---|---|
| `01-step1-details.jpg` | Step 1, empty — page header, stepper, card |
| `02-step1-details-filled.jpg` | Step 1 with all fields |
| `03-step2-select-tickets.jpg` | Step 2 — ticket tier cards, quantity selectors, total |

This folder is excluded from the deployed build via `.vercelignore`.
