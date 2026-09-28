# Check-in integration

For the developer building the door scanner. Everything you need is here.

**Written for:** the payment developer, who is also building check-in.

---

## What you are building

A page at **`/admin/check-in`** that staff use at the door: scan a QR code,
or type a ticket code, and get an immediate, unmistakable yes or no.

A placeholder lives there now. Replace the page; keep the route.

Everything it depends on already exists — the ticket fields, the access
check, the colours, the camera permission. You are building the screen and
one database call.

### The conditions it works under

Design for these, not for a desk:

- A phone, held one-handed, in a queue.
- Poor lighting and a dim guest screen.
- Patchy signal at a venue.
- Someone reading a code aloud because their battery died.
- A staff member who has never seen the page before tonight.

The answer must be readable at arm's length in under a second.

---

## What already exists

| What | Where |
|---|---|
| `tickets.qr_token` | The **only** thing in the QR code. Random, opaque, unique |
| `tickets.ticket_code` | `K7Q2-XM9P`. For typing when a scan fails. No `0`/`O`, `1`/`I`/`L`, `5`/`S`, `8`/`B`, `2`/`Z` |
| `tickets.status` | `ACTIVE` → `USED`, or `CANCELLED` on refund |
| `tickets.checked_in_at` | `timestamptz`, set by you |
| `tickets.checked_in_by` | `uuid` → `auth.users`, the admin who scanned |
| `requireAdmin(role)` | `lib/auth/requireAdmin.ts` |
| Status colours | `--color-success`, `--color-danger` and their `-soft` variants |
| `camera=(self)` | Already in the Permissions-Policy. **Do not remove it** — your scanner cannot open the camera without it |
| `audit_log` | Write one row per check-in |

A database constraint enforces that `status = 'USED'` and
`checked_in_at` are set together. You cannot record a half-check-in.

---

## Protecting the page

```ts
import { requireAdmin } from "@/lib/auth/requireAdmin";

export default async function CheckInPage() {
  const admin = await requireAdmin("staff");   // owners pass this too
  // …
}
```

Call it in **the page and in every server action** — not once in a layout.
A layout does not run for a server action, so a page that relies on one
leaves its actions open to anyone who posts to them directly.

`requireAdmin` requires all three of: signed in, two-factor complete, and a
row in `admins`. It redirects if any is missing. `admin.userId` is what
goes in `checked_in_by`.

---

## The one rule that matters

Checking a ticket in must be **a single atomic UPDATE**:

```sql
update public.tickets
   set status        = 'USED',
       checked_in_at = now(),
       checked_in_by = $2
 where (qr_token = $1 or ticket_code = $1)
   and status = 'ACTIVE'
returning id, ticket_code, ticket_type_id, attendee_id;
```

**Never** select the ticket, check its status in your code, then update it.

Two staff members scanning the same ticket at the same moment would both
read `ACTIVE`, both decide it is valid, and both let someone in. Putting
`and status = 'ACTIVE'` in the same statement is what makes that
impossible: the database applies it once, and exactly one of them gets a
row back. The other gets nothing, which is how you know it was already
used.

This is the same technique that stops the checkout overselling, and it is
the only part of your page that cannot be got wrong quietly.

### Reading the result

| The update returns | Then | Show |
|---|---|---|
| A row | Admitted | **VALID** — big, green |
| No row, and the ticket exists with `status = 'USED'` | Already through | **ALREADY USED** — big, red, with `checked_in_at` |
| No row, and the ticket exists with `status = 'CANCELLED'` | Refunded | **CANCELLED** — big, red |
| No row, and no such ticket | Not ours | **INVALID** — big, red |

So: one write, then one read to explain a "no". Never a read before the
write.

**VALID must show** the guest's name, the ticket type, and **"admits N"** —
a VIP table is one ticket and ten people, and the person on the door needs
that number, not the ticket count.

---

## Suggested shape

```ts
"use server";

export async function checkInTicket(scanned: string) {
  const admin = await requireAdmin("staff");
  const db = createAdminSupabaseClient();     // server-only

  const code = scanned.trim().toUpperCase();  // typed codes arrive any case

  const { data: claimed } = await db
    .from("tickets")
    .update({
      status: "USED",
      checked_in_at: new Date().toISOString(),
      checked_in_by: admin.userId,
    })
    .or(`qr_token.eq.${scanned.trim()},ticket_code.eq.${code}`)
    .eq("status", "ACTIVE")                   // the guard — keep it here
    .select("id, ticket_code, ticket_type_id, attendee_id")
    .maybeSingle();

  if (claimed) {
    await recordAudit(admin.userId, "ticket.checked_in", {
      ticketCode: claimed.ticket_code,
    });
    return { result: "VALID", /* name, tier, admits */ };
  }

  // Only now look, and only to explain the refusal.
  const { data: existing } = await db
    .from("tickets")
    .select("status, checked_in_at")
    .or(`qr_token.eq.${scanned.trim()},ticket_code.eq.${code}`)
    .maybeSingle();

  if (!existing) return { result: "INVALID" };
  if (existing.status === "CANCELLED") return { result: "CANCELLED" };
  return { result: "ALREADY_USED", at: existing.checked_in_at };
}
```

`qr_token` is case-sensitive; `ticket_code` is not, because someone will
type it in lower case.

---

## Also needed

**Manual entry.** A text box for the ticket code, always visible — not
hidden behind "having trouble?". Flat batteries are common and the queue
does not wait.

**Search by name or phone.** For a guest with no phone at all. Find their
ticket, then check it in through the same function. `attendees` has
`first_name`, `last_name`, `phone` (stored `+234XXXXXXXXXX`); match phone
on its last ten digits, because people say "0801 234 5678".

**An audit row per check-in.** `recordAudit(admin.userId, "ticket.checked_in", { … })`.

**Offline is not handled, and that is a decision.** The page needs a
connection. If the venue's signal is doubtful, say so in advance — a
scanner that queues check-ins locally can let the same ticket in twice,
which is the one failure this design refuses to allow.

---

## Testing it

1. Buy a ticket and pay (`npm run simulate-payment`, see PAYMENT_INTEGRATION.md).
2. Open `/tickets/<access token>` and scan the QR from the screen.
3. **Scan the same ticket again** — it must say ALREADY USED, with the time.
4. Type the ticket code instead, in lower case.
5. Scan something random — INVALID.
6. Check `/admin/orders/<reference>`: the ticket shows as admitted.
7. **The one that matters:** have two phones scan the same ticket at the
   same moment. Exactly one must say VALID.

---

## Before you hand it back

- [ ] One atomic UPDATE, with `status = 'ACTIVE'` in the same statement
- [ ] Two simultaneous scans of one ticket → exactly one VALID
- [ ] `requireAdmin("staff")` in the page **and** every action
- [ ] Manual code entry, case-insensitive, always visible
- [ ] Search by name and phone
- [ ] An audit row per check-in
- [ ] VALID shows the name, the tier and **admits N**
- [ ] ALREADY USED shows when it was used
- [ ] Readable at arm's length, one-handed, in poor light
- [ ] `npm run audit:security` passes
