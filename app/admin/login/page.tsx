import { redirect } from "next/navigation";

import { LoginForm } from "@/app/admin/login/LoginForm";
import { Container, ErrorMessage } from "@/components/ui";
import { getCurrentAdmin } from "@/lib/auth/requireAdmin";
import { noindexMetadata } from "@/lib/utils";
import type { Step } from "@/app/admin/login/actions";

export const metadata = noindexMetadata("Admin sign in");
export const dynamic = "force-dynamic";

const STEP_VALUES = new Set<Step>(["password", "enrol", "verify"]);

export default async function AdminLoginPage(props: PageProps<"/admin/login">) {
  // Already fully signed in? Do not make them do it again.
  if (await getCurrentAdmin()) redirect("/admin");

  const params = await props.searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const requested = first(params.step) as Step | undefined;
  const step: Step = requested && STEP_VALUES.has(requested) ? requested : "password";

  const errorCode = first(params.error);

  return (
    <main id="main" className="flex flex-1 items-center py-16">
      <Container width="narrow" className="space-y-5">
        {errorCode === "not-an-admin" && (
          <ErrorMessage title="That account is not an administrator">
            You signed in successfully, but this account has no admin access. Ask an owner to add
            you.
          </ErrorMessage>
        )}
        <LoginForm initialStep={step} />
      </Container>
    </main>
  );
}
