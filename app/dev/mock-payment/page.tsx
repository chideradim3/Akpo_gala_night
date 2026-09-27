import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MockPaymentPanel } from "@/app/dev/mock-payment/MockPaymentPanel";
import { Container } from "@/components/ui";
import { devRoutesEnabled } from "@/lib/utils";

/**
 * DEVELOPMENT ONLY — 404s in production (spec §8).
 *
 * Stands in for the payment provider's hosted page. Two buttons, and each
 * one calls the real signed confirm route.
 */
export const metadata: Metadata = devRoutesEnabled()
  ? { title: "Mock payment", robots: { index: false, follow: false } }
  : { robots: { index: false, follow: false } };

export const dynamic = "force-dynamic";

export default async function MockPaymentPage(props: PageProps<"/dev/mock-payment">) {
  if (!devRoutesEnabled()) {
    notFound();
  }

  // searchParams is a Promise in Next 16.
  const params = await props.searchParams;

  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const reference = first(params.reference);
  const amountKobo = Number(first(params.amountKobo) ?? "0");
  const returnUrl = first(params.returnUrl) ?? "/";

  if (!reference || !Number.isInteger(amountKobo) || amountKobo < 0) {
    notFound();
  }

  return (
    <main id="main" className="flex flex-1 items-center py-16">
      <Container width="narrow">
        <MockPaymentPanel
          reference={reference}
          amountKobo={amountKobo}
          returnUrl={returnUrl}
        />
      </Container>
    </main>
  );
}
