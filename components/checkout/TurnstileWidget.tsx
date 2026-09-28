"use client";

import { useEffect, useRef, useState } from "react";

import { ErrorMessage } from "@/components/ui";

/**
 * Cloudflare Turnstile — the bot check on checkout step 1 (spec §7).
 *
 * Renders nothing at all when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is unset, so
 * the checkout works normally before any Cloudflare account exists. The
 * server half (`lib/turnstile.ts`) is switched off by the same absence, so
 * the two halves cannot disagree about whether it is on.
 *
 * ── WHY THIS COMPONENT HAS TO EXIST ─────────────────────────────────────
 * The server fails CLOSED: with both keys set, an order without a valid
 * token is refused. That is the right behaviour — bot protection that
 * waves requests through when something is wrong is not protection.
 *
 * But it means the browser MUST be able to produce a token. Without this
 * widget, setting both keys would reject every order from every real
 * customer, and the failure would look like a broken checkout rather than
 * a misconfiguration.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Tokens are single-use and expire after about five minutes, so the widget
 * resets itself rather than leaving a stale one that the server will
 * reject.
 */

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SCRIPT_ID = "cf-turnstile-script";

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      theme?: "light" | "dark" | "auto";
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** Load Cloudflare's script once, however many times this mounts. */
function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve();

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("blocked")));
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("blocked"));
    document.head.appendChild(script);
  });
}

export function TurnstileWidget({
  onToken,
}: {
  /** Called with a fresh token, or null when it expires or fails. */
  onToken: (token: string | null) => void;
}) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const container = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);

  // The callback changes identity on every parent render; a ref keeps the
  // widget from being torn down and rebuilt each time, which would make it
  // flicker and lose its token.
  const latestOnToken = useRef(onToken);
  latestOnToken.current = onToken;

  useEffect(() => {
    if (!siteKey || !container.current) return;

    let cancelled = false;
    const element = container.current;

    loadScript()
      .then(() => {
        if (cancelled || !window.turnstile) return;
        widgetId.current = window.turnstile.render(element, {
          sitekey: siteKey,
          theme: "dark",
          callback: (token) => latestOnToken.current(token),
          // A token is short-lived. Clearing it means the form asks for a
          // fresh one rather than submitting something the server will
          // reject with a message nobody can act on.
          "expired-callback": () => latestOnToken.current(null),
          "error-callback": () => {
            latestOnToken.current(null);
            setFailed(true);
          },
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [siteKey]);

  // Not configured: render nothing. The server is off too.
  if (!siteKey) return null;

  if (failed) {
    return (
      <ErrorMessage title="The security check could not load">
        It may be blocked by an ad blocker or your network. Disable the blocker for this page, or
        try a different connection, and reload.
      </ErrorMessage>
    );
  }

  return (
    <div className="space-y-2">
      <div ref={container} />
      <p className="text-xs text-[var(--color-ink-muted)]">
        A quick check that you are not a robot, so tickets are not bought up by scripts.
      </p>
    </div>
  );
}

/** True when the checkout should expect a token. Safe on the server. */
export function isTurnstileConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}
