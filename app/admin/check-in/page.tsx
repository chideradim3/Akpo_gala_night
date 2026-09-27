import { AdminShell } from "@/components/admin/AdminShell";
import { Badge, Card, CardBody } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { noindexMetadata } from "@/lib/utils";

export const metadata = noindexMetadata("Check-in");
export const dynamic = "force-dynamic";

/**
 * Placeholder (spec §10).
 *
 * The venue check-in page and its QR scanner are built by the payment
 * developer, not here. This holds the route and the menu item so the
 * boundary is visible, and so there is somewhere for them to build.
 *
 * It already calls `requireAdmin("staff")` — the same guard their page must
 * keep. Everything else they need is in CHECK_IN_INTEGRATION.md.
 */
export default async function CheckInPlaceholderPage() {
  const admin = await requireAdmin("staff");

  return (
    <AdminShell admin={admin} current="/admin/check-in">
      <div className="space-y-6">
        <div className="space-y-2">
          <Badge tone="warning">Coming soon</Badge>
          <h1 className="text-[length:var(--text-h2)]">Check-in</h1>
          <p className="max-w-2xl text-[var(--color-ink-secondary)]">
            The door scanner is being built separately. When it arrives it replaces this page, and
            the Orders and Attendees screens begin showing who has arrived.
          </p>
        </div>

        <Card>
          <CardBody className="space-y-4">
            <h2 className="text-[length:var(--text-h3)]">Already in place for it</h2>
            <ul className="space-y-2.5 text-sm text-[var(--color-ink-secondary)]">
              <li>
                Every ticket carries a QR token, a short readable code, a status, and fields
                recording when and by whom it was checked in.
              </li>
              <li>
                This route is protected by the shared access check, which the real page keeps.
              </li>
              <li>The camera is permitted on this domain by the security headers.</li>
              <li>
                The single atomic update that makes it impossible to use one ticket twice is
                written out in CHECK_IN_INTEGRATION.md.
              </li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </AdminShell>
  );
}
