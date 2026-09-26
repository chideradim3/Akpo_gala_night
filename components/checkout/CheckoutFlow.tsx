"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createOrderAction } from "@/app/checkout/actions";
import { GuestDetailsStep, type GuestDetailsValues } from "@/components/checkout/GuestDetailsStep";
import { OrderHold } from "@/components/checkout/OrderHold";
import { SelectTicketsStep } from "@/components/checkout/SelectTicketsStep";
import { Card, CardBody, Container, ErrorMessage, Stepper } from "@/components/ui";
import { normalizeNigerianPhone } from "@/lib/phone";
import type { TicketTier } from "@/lib/services/events";

/**
 * The three-step checkout.
 *
 * Steps 1 and 2 live in this one component rather than separate routes.
 * The buyer's details exist only in memory until they press the final
 * button, so an abandoned checkout leaves nothing behind — no half-made
 * order holding inventory, and no personal data stored for someone who
 * changed their mind.
 *
 * Step 3 belongs to the payment developer. Our part ends when the order is
 * created; Phase 5 adds the redirect.
 */

const STEPS = [
  { label: "Your details" },
  { label: "Select tickets" },
  { label: "Payment" },
];

const EMPTY_DETAILS: GuestDetailsValues = {
  email: "",
  firstName: "",
  lastName: "",
  phone: "",
  consent: false,
};

type CreatedOrder = {
  reference: string;
  accessToken: string;
  totalKobo: number;
  expiresAt: string;
};

/**
 * Client-side checks for step 1.
 *
 * These exist so the buyer gets an answer without a round trip. They are
 * NOT the validation that matters — the server runs the same rules through
 * Zod and does not care what happened here.
 */
function validateDetails(values: GuestDetailsValues): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!values.email.trim()) {
    errors["details.email"] = "Enter your email address";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors["details.email"] = "Enter a valid email address";
  }

  if (!values.firstName.trim()) errors["details.firstName"] = "Enter your first name";
  if (!values.lastName.trim()) errors["details.lastName"] = "Enter your last name";

  if (!values.phone.trim()) {
    errors["details.phone"] = "Enter your phone number";
  } else if (!normalizeNigerianPhone(values.phone)) {
    errors["details.phone"] = "Enter a Nigerian mobile number, e.g. 08012345678";
  }

  if (!values.consent) {
    errors["details.consent"] = "Please agree to the privacy policy to continue";
  }

  return errors;
}

export function CheckoutFlow({ tiers }: { tiers: TicketTier[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [step, setStep] = useState<1 | 2>(1);
  const [details, setDetails] = useState<GuestDetailsValues>(EMPTY_DETAILS);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [order, setOrder] = useState<CreatedOrder | null>(null);

  function goToStep(next: 1 | 2) {
    setFormError(null);
    setStep(next);
    // Long forms on a phone: without this the buyer lands halfway down the
    // next step with no idea the page changed.
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleDetailsSubmit() {
    const found = validateDetails(details);
    setErrors(found);
    if (Object.keys(found).length === 0) goToStep(2);
  }

  function handleQuantityChange(tierId: string, quantity: number) {
    setQuantities((current) => ({ ...current, [tierId]: Math.max(0, quantity) }));
    setFormError(null);
  }

  function handlePlaceOrder() {
    setFormError(null);

    const items = Object.entries(quantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity }));

    if (items.length === 0) {
      setFormError("Choose at least one ticket.");
      return;
    }

    startTransition(async () => {
      const result = await createOrderAction({
        details: {
          email: details.email,
          firstName: details.firstName,
          lastName: details.lastName,
          phone: details.phone,
          consent: details.consent,
        },
        items,
      });

      if (result.ok) {
        setOrder(result.order);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      setFormError(result.message);
      if (result.fields) setErrors(result.fields);

      // A field-level problem can only be fixed back on step 1.
      if (result.fields && Object.keys(result.fields).some((key) => key.startsWith("details."))) {
        goToStep(1);
      }

      // Availability moved while they were choosing — re-fetch the tiers so
      // the page stops offering something that is gone.
      if (result.refreshAvailability) {
        router.refresh();
      }
    });
  }

  // Order placed. Payment itself arrives in Phase 5.
  if (order) {
    return (
      <Container width="narrow" className="py-10 sm:py-16">
        <Stepper steps={STEPS} current={3} />
        <div className="mt-10">
          <OrderHold order={order} />
        </div>
      </Container>
    );
  }

  return (
    <Container width="narrow" className="py-10 sm:py-16">
      <Stepper steps={STEPS} current={step} />

      <Card className="mt-10">
        <CardBody className="space-y-6">
          {formError && <ErrorMessage title={formError} />}

          {step === 1 ? (
            <GuestDetailsStep
              values={details}
              errors={errors}
              onChange={(patch) => {
                setDetails((current) => ({ ...current, ...patch }));
                setErrors({});
              }}
              onSubmit={handleDetailsSubmit}
            />
          ) : (
            <SelectTicketsStep
              tiers={tiers}
              quantities={quantities}
              onQuantityChange={handleQuantityChange}
              onBack={() => goToStep(1)}
              onSubmit={handlePlaceOrder}
              submitting={isPending}
            />
          )}
        </CardBody>
      </Card>
    </Container>
  );
}
