import { notFound } from "next/navigation";

import { PaymentReturn } from "@/app/payment/return/PaymentReturn";
import { Container } from "@/components/ui";
import { noindexMetadata } from "@/lib/utils";

/**
 * /payment/return?ref=…&token=…
 *
 * Where the payment provider sends the buyer back, whatever the outcome.
 *
 * It is a shell around a client component that polls the order status.
 * Nothing here — and nothing in the client component — can mark an order
 * paid. That is only possible through the signed confirm route.
 */
export const metadata = noindexMetadata("Confirming your payment");

export const dynamic = "force-dynamic";

export default async function PaymentReturnPage(props: PageProps<"/payment/return">) {
  const params = await props.searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const reference = first(params.ref);
  const token = first(params.token);

  if (!reference || !token) notFound();

  return (
    <main id="main" className="flex flex-1 items-center py-16">
      <Container width="narrow">
        <PaymentReturn reference={reference} token={token} />
      </Container>
    </main>
  );
}
