/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  SAMPLE DATA — DELETE IN PHASE 3                                         ║
 * ║                                                                          ║
 * ║  Invented placeholder content so Phase 1 has something to render while   ║
 * ║  the design system is reviewed. There is no database yet.                ║
 * ║                                                                          ║
 * ║  Phase 3 replaces every use of this with a real row from the `events`    ║
 * ║  table, and this file is deleted. Nothing outside app/page.tsx may       ║
 * ║  import it, and no real event details should be typed in here.           ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { kobo, type Kobo } from "@/lib/money";

export const placeholderEvent = {
  name: "Gala Night",
  tagline: "An evening of elegance",
  description:
    "A night of fine dining, live music and celebration. Black tie. Limited places.",
  date: "Saturday 20 December 2025",
  startTime: "7:00 PM",
  venue: "The Grand Ballroom",
  address: "Victoria Island, Lagos",
  dressCode: "Black tie",
} as const;

export const placeholderTicketTypes: Array<{
  id: string;
  name: string;
  description: string;
  priceKobo: Kobo;
  admits: number;
}> = [
  {
    id: "sample-vip-table",
    name: "VIP table",
    description: "A reserved table for ten, premium seating, bottle service.",
    priceKobo: kobo(20_000_000), // ₦200,000
    admits: 10,
  },
  {
    id: "sample-standard",
    name: "Standard",
    description: "General admission, open seating.",
    priceKobo: kobo(500_000), // ₦5,000
    admits: 1,
  },
];
