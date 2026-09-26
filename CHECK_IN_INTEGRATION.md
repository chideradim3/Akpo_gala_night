# Check-in integration guide

> **Status: stub. Written in full in Phase 10.**
>
> This file exists now so the boundary is visible from day one and the payment developer can be
> pointed at a stable path. The contracts below are already fixed by the build spec (§10, §13) and
> will not change — only the surrounding detail gets filled in.

## Scope

The venue check-in page at **`/admin/check-in`** — the QR scanner used at the door — is built by
the **payment developer**, not in this repository. We build everything it depends on.

Until it is built, `/admin/check-in` shows a "coming soon" placeholder (added in Phase 7), and the
admin menu links to it. Replace that page; leave the route.

## Groundwork already in place

| What | Where | Why you need it |
|---|---|---|
| `tickets.qr_token` | Phase 2 migration | A long random opaque secret. **This is the only thing the QR code contains** — no name, no email, no order id. |
| `tickets.ticket_code` | Phase 2 migration | Short human-readable code, e.g. `K7Q2-XM9P`. No confusable characters (`0`/`O`, `1`/`I`). For manual entry when a scan fails. |
| `tickets.status` | Phase 2 migration | `ACTIVE` → `USED`, or `ACTIVE` → `CANCELLED` on refund. |
| `tickets.checked_in_at`, `checked_in_by` | Phase 2 migration | Filled in by your update. `checked_in_by` is the admin's user id. |
| `requireAdmin(role)` | `lib/auth/` (Phase 7) | Protect your page with `requireAdmin('staff')`. Server-side, on the route **and** every action. |
| Status colour tokens | `app/globals.css` | `--color-success` / `--color-danger` and their soft variants, so your VALID and ALREADY USED screens match the rest of the admin. |
| `camera=(self)` | `next.config.ts` Permissions-Policy | Without this header your scanner cannot open the camera. It is already set. Do not remove it. |
| `audit_log` table | Phase 2 migration | Write one row per check-in. |

## The one rule that matters

Checking a ticket in must be **a single atomic UPDATE**, never a read followed by a write:

```sql
UPDATE tickets
   SET status = 'USED',
       checked_in_at = now(),
       checked_in_by = $2
 WHERE (qr_token = $1 OR ticket_code = $1)
   AND status = 'ACTIVE'
RETURNING ...;
```

If you `SELECT` first and then `UPDATE`, two staff members scanning the same ticket at the same
moment can both see `ACTIVE` and both let the guest in. The `AND status = 'ACTIVE'` in the same
statement is what makes that impossible — exactly one of them gets a row back.

Results to show:

| Returned | Screen |
|---|---|
| A row | **VALID** — big green. Guest name, ticket type, "admits N". |
| No row, ticket exists and is `USED` | **ALREADY USED** — big red, with the time it was used. |
| No row, no such ticket | **INVALID** — big red. |

Also needed: a manual search by guest name or phone, for people whose phone battery died.

---

*Full field tables, the exact query, response shapes, an `audit_log` example and the placeholder
page's location are filled in during Phase 10.*
