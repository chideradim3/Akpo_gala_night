import { ButtonLink, Container } from "@/components/ui";

export default function NotFound() {
  return (
    <main id="main" className="flex flex-1 items-center py-24">
      <Container width="narrow" className="space-y-6 text-center">
        <p className="eyebrow text-[var(--color-accent)]">404</p>
        <h1 className="text-[length:var(--text-h1)] font-bold">Page not found</h1>
        <p className="text-[var(--color-ink-secondary)]">
          The page you were looking for does not exist, or the link has expired.
        </p>
        <div className="flex justify-center pt-2">
          <ButtonLink href="/" variant="ghost">
            Back to the event
          </ButtonLink>
        </div>
      </Container>
    </main>
  );
}
