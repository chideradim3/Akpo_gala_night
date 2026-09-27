import Link from "next/link";
import type { ReactNode } from "react";

import { signOutAction } from "@/app/admin/login/actions";
import { Badge, Container } from "@/components/ui";
import type { Admin } from "@/lib/auth/requireAdmin";
import { cn } from "@/lib/utils";

/**
 * The frame around every admin page.
 *
 * The navigation hides what a staff member cannot use — but hiding is
 * courtesy, not security. Every one of these pages calls `requireAdmin()`
 * itself, so typing the URL directly gets you nowhere (spec §10).
 *
 * Responsive: a horizontal scrolling strip of links on a phone, a fixed
 * sidebar from `lg`. Phones are for the door, not for admin work, but the
 * organiser will absolutely check sales from one.
 */

type NavItem = { href: string; label: string; ownerOnly?: boolean; soon?: boolean };

const NAV: NavItem[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/orders", label: "Orders", soon: true },
  { href: "/admin/attendees", label: "Attendees", soon: true },
  { href: "/admin/ticket-types", label: "Ticket types", ownerOnly: true, soon: true },
  { href: "/admin/event", label: "Event settings", ownerOnly: true, soon: true },
  { href: "/admin/check-in", label: "Check-in", soon: true },
];

export function AdminShell({
  admin,
  current,
  children,
}: {
  admin: Admin;
  current: string;
  children: ReactNode;
}) {
  const items = NAV.filter((item) => !item.ownerOnly || admin.role === "owner");

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-[var(--color-line)] bg-[var(--color-surface-raised)]">
        <Container width="full">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/admin" className="truncate font-semibold [font-family:var(--font-display)]">
                Admin
              </Link>
              <Badge tone={admin.role === "owner" ? "accent" : "neutral"}>{admin.role}</Badge>
            </div>

            <div className="flex min-w-0 items-center gap-4">
              <span className="hidden truncate text-sm text-[var(--color-ink-muted)] sm:inline">
                {admin.email}
              </span>
              {/* A form, not a link: signing out is a state change and must
                  not happen because something prefetched a URL. */}
              <form
                action={async () => {
                  "use server";
                  await signOutAction();
                }}
              >
                <button
                  type="submit"
                  className="shrink-0 text-sm text-[var(--color-ink-secondary)] underline underline-offset-4 hover:text-[var(--color-ink)]"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </Container>
      </header>

      <Container width="full" className="flex flex-1 flex-col gap-6 py-6 lg:flex-row lg:gap-10">
        <nav
          aria-label="Admin sections"
          className="-mx-5 overflow-x-auto px-5 lg:mx-0 lg:w-52 lg:shrink-0 lg:overflow-visible lg:px-0"
        >
          <ul className="flex gap-2 lg:flex-col lg:gap-1">
            {items.map((item) => {
              const active = current === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-[var(--radius-control)] px-3 py-2 text-sm whitespace-nowrap transition-colors",
                      active
                        ? "bg-[var(--color-accent-soft)] text-[var(--color-ink)]"
                        : "text-[var(--color-ink-secondary)] hover:bg-white/[0.04] hover:text-[var(--color-ink)]",
                    )}
                  >
                    {item.label}
                    {item.soon && (
                      <span className="eyebrow text-[0.5625rem] text-[var(--color-ink-muted)]">
                        soon
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </Container>
    </div>
  );
}
