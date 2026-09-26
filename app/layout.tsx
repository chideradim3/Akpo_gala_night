import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";

import "./globals.css";

/**
 * Fonts are downloaded at BUILD time and served from our own origin — there
 * is no request to Google at runtime, so no third-party tracking and no
 * render-blocking external stylesheet.
 *
 * Sora:  wide geometric display face for headings.
 * Inter: clean grotesque for body copy and UI.
 */
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
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
    <html lang="en-NG" className={`${sora.variable} ${inter.variable} h-full`}>
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
