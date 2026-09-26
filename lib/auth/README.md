# `lib/auth`

Home of **`requireAdmin(role)`** — the single server-side access check used by every admin route
and every admin action (spec §10). Built in Phase 7.

It exists as one shared helper for a specific reason: the payment developer will add
`/admin/check-in` to this app later, and they must be able to protect it with the same one-line
call rather than inventing their own check. That contract is written up in
`CHECK_IN_INTEGRATION.md`.

```ts
// what their page will do
const admin = await requireAdmin("staff");  // throws / redirects if not allowed
```

Rules it enforces:

- The caller must be signed in via Supabase Auth **and** have a row in the `admins` table.
- `owner` can do everything. `staff` can view, and use check-in once it exists.
- The check runs on the **server**, on every route and every action. Hiding a menu item is not
  access control.
