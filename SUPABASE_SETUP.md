# Setting up Supabase

Written for someone who has never used Supabase before. Follow it in order.
Nothing here costs money — the free tier is enough for this project.

Supabase is two things for us: the **database** where events, orders and tickets live, and the
**login system** for the admin dashboard. It also stores uploaded ticket-type images.

---

## 1. Create an account

1. Go to <https://supabase.com> and click **Start your project**.
2. Sign in with GitHub, or with an email and password.

## 2. Create the project

1. On the dashboard, click **New project**.
2. **Organization** — pick the one created for you, or make a new one.
3. **Name** — `gala-night` (this is just a label; you can change it later).
4. **Database Password** — click **Generate a password** and **save it in your password manager
   immediately**. Supabase will not show it to you again. You do not need it for day-to-day work,
   but you need it to connect with database tools, and recovering it means a reset.
5. **Region** — choose **West EU (Ireland) `eu-west-1`**.

   > Supabase has no African region. Ireland is the closest option with reliable, low-latency
   > routing to Nigeria. Every page load waits on the database, so this choice is worth getting
   > right — picking a US region adds noticeable delay for your guests.

6. **Pricing plan** — Free.
7. Click **Create new project** and wait. Provisioning takes about two minutes.

## 3. Copy the three keys

Once the project is ready:

1. In the left sidebar, click the **gear icon** (Project Settings).
2. Click **API**.
3. You need three values from this page:

| On the page | Goes into `.env.local` as | What it is |
|---|---|---|
| **Project URL** | `NEXT_PUBLIC_SUPABASE_URL` | Your project's address. Not secret. |
| **Project API keys → `anon` `public`** | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The public key. Safe in the browser — Row Level Security decides what it can see. |
| **Project API keys → `service_role` `secret`** | `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ **The master key.** Bypasses all security rules. |

> **About the `service_role` key.** Anyone holding it can read and change every row in your
> database — every order, every attendee's phone number, every ticket. Treat it like the password
> to your bank account.
>
> - Never paste it into a chat, an email, a screenshot or a GitHub issue.
> - Never put it in a variable starting with `NEXT_PUBLIC_` — that prefix means "send this to the
>   browser".
> - Never commit it. `.env.local` is gitignored for exactly this reason.
>
> The code enforces this too: `lib/supabase/admin.ts` starts with `import "server-only"`, so if
> anyone ever imports it into browser code the build fails instead of leaking the key.

## 4. Put them in your local environment

In the project folder:

```bash
cp .env.example .env.local
```

Open `.env.local` in your editor and paste the three values in. Leave everything else as it is —
those belong to later phases.

```
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

Restart the dev server (`Ctrl-C`, then `npm run dev`) — environment variables are only read at
startup.

## 5. Check it worked

**As of Phase 1, nothing reads these values yet.** The app does not talk to Supabase until Phase 2
creates the database tables. Having the keys in place now just means Phase 2 can start immediately.

If a key is missing or wrong once Phase 2 lands, you will get a plain-English message like
*"Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in
.env.local"* rather than a cryptic crash — see `lib/env.ts`.

---

## Later phases

These are listed so you know what is coming; do not do them yet.

- **Phase 2** — install the Supabase CLI, run the migrations that create the tables, and turn on
  Row Level Security.
- **Phase 7** — create the first admin by adding a row to the `admins` table by hand in the
  Supabase table editor. There is deliberately no public admin sign-up.
- **Deployment** — the same three variables go into Vercel under Project Settings → Environment
  Variables. Use a **separate Supabase project** for production so test orders never mix with real
  ones.
