import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Inter } from "next/font/google";

import "./globals.css";

/**
 * Fonts are downloaded at BUILD time and served from our own origin — there
 * is no request to Google at runtime, so no third-party tracking and no
 * render-blocking external stylesheet.
 *
 * Bodoni Moda — a Didone, the letterform of engraved invitations and of
 * luxury print. It is the typographic voice of a black-tie event, and it is
 * what gives this site an identity of its own rather than the wide geometric
 * sans every event site reaches for.
 *
 * Its hairline strokes are a liability at small sizes on a dark screen, so
 * it is used for DISPLAY ONLY — headings, the event name, prices. Body copy
 * and every control use Inter, which is built for exactly that job.
 */
const display = Bodoni_Moda({
  variable: "--font-display-face",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Gala Night",
    template: "%s · Gala Night",
  },
  description: "An evening of elegance. Secure your place.",
};

export const viewport: Viewport = {
  themeColor: "#08070a",
  colorScheme: "dark",
  // No maximum-scale / user-scalable=no: pinch-zoom must stay available.
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-NG" className={`${display.variable} ${inter.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only rounded-[var(--radius-pill)] bg-white px-4 py-2 font-semibold text-[var(--color-ink-inverse)] focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
