/**
 * Database types.
 *
 * Hand-written to match `supabase/migrations/` exactly. Once your Supabase
 * project exists you can regenerate this file from the live schema instead:
 *
 *   npx supabase gen types typescript --linked > types/database.ts
 *
 * Keep it in step with the migrations either way — everything above the
 * database is typed off this file, so a mismatch here shows up as a wrong
 * type somewhere far away.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

/* ── Enums (must match the Postgres enums in migration 01) ──────────────── */

export type OrderStatus =
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "EXPIRED"
  | "CANCELLED"
  | "REFUNDED";

export type TicketStatus = "ACTIVE" | "USED" | "CANCELLED";

export type EventStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type AdminRole = "owner" | "staff";

/** One entry in `events.faq`. */
export type FaqEntry = { question: string; answer: string };

/**
 * One entry in `events.experience` — a line in the evening's running order.
 * `time` is display copy ("7:00 PM", "Till late"), not a scheduled time.
 */
export type ExperienceEntry = { time?: string; title: string; description?: string };

export type Database = {
  public: {
    Tables: {
      events: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          date: string;
          start_time: string | null;
          end_time: string | null;
          venue: string | null;
          address: string | null;
          dress_code: string | null;
          hero_image_url: string | null;
          gallery: Json;
          about: string | null;
          experience: Json;
          faq: Json;
          contact_email: string | null;
          contact_phone: string | null;
          status: EventStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          date: string;
          start_time?: string | null;
          end_time?: string | null;
          venue?: string | null;
          address?: string | null;
          dress_code?: string | null;
          hero_image_url?: string | null;
          gallery?: Json;
          about?: string | null;
          experience?: Json;
          faq?: Json;
          contact_email?: string | null;
          contact_phone?: string | null;
          status?: EventStatus;
        };
        Update: Partial<Database["public"]["Tables"]["events"]["Insert"]>;
        Relationships: [];
      };

      ticket_types: {
        Row: {
          id: string;
          event_id: string;
          name: string;
          description: string | null;
          /** INTEGER KOBO. ₦200,000 = 20000000. */
          price_kobo: number;
          admits: number;
          /** Total ever available, not the remaining count. */
          inventory: number;
          max_per_order: number;
          sale_start: string | null;
          sale_end: string | null;
          is_active: boolean;
          image_url: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          name: string;
          description?: string | null;
          price_kobo: number;
          admits?: number;
          inventory: number;
          max_per_order?: number;
          sale_start?: string | null;
          sale_end?: string | null;
          is_active?: boolean;
          image_url?: string | null;
          sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["ticket_types"]["Insert"]>;
        Relationships: [];
      };

      attendees: {
        Row: {
          id: string;
          /** Always lower-cased. */
          email: string;
          first_name: string;
          last_name: string;
          /** Always +234XXXXXXXXXX. */
          phone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          first_name: string;
          last_name: string;
          phone: string;
        };
        Update: Partial<Database["public"]["Tables"]["attendees"]["Insert"]>;
        Relationships: [];
      };

      orders: {
        Row: {
          id: string;
          reference: string;
          access_token: string;
          event_id: string;
          attendee_id: string;
          /** INTEGER KOBO, always computed on the server. */
          total_kobo: number;
          status: OrderStatus;
          expires_at: string;
          paid_at: string | null;
          payment_reference: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reference?: string;
          access_token?: string;
          event_id: string;
          attendee_id: string;
          total_kobo: number;
          status?: OrderStatus;
          expires_at: string;
          paid_at?: string | null;
          payment_reference?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
        Relationships: [];
      };

      order_items: {
        Row: {
          id: string;
          order_id: string;
          ticket_type_id: string;
          quantity: number;
          unit_price_kobo: number;
          line_total_kobo: number;
        };
        Insert: {
          id?: string;
          order_id: string;
          ticket_type_id: string;
          quantity: number;
          unit_price_kobo: number;
          line_total_kobo: number;
        };
        Update: Partial<Database["public"]["Tables"]["order_items"]["Insert"]>;
        Relationships: [];
      };

      tickets: {
        Row: {
          id: string;
          order_id: string;
          order_item_id: string;
          ticket_type_id: string;
          attendee_id: string;
          ticket_code: string;
          /** The ONLY value encoded in the QR code. */
          qr_token: string;
          status: TicketStatus;
          checked_in_at: string | null;
          checked_in_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          order_item_id: string;
          ticket_type_id: string;
          attendee_id: string;
          ticket_code?: string;
          qr_token?: string;
          status?: TicketStatus;
          checked_in_at?: string | null;
          checked_in_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["tickets"]["Insert"]>;
        Relationships: [];
      };

      admins: {
        Row: { user_id: string; role: AdminRole; created_at: string };
        Insert: { user_id: string; role?: AdminRole };
        Update: Partial<Database["public"]["Tables"]["admins"]["Insert"]>;
        Relationships: [];
      };

      audit_log: {
        Row: {
          id: number;
          actor: string;
          action: string;
          details: Json;
          created_at: string;
        };
        Insert: { actor: string; action: string; details?: Json };
        /** Insert-only by design. Nothing updates the audit trail. */
        Update: never;
        Relationships: [];
      };
    };

    Views: Record<string, never>;

    Functions: {
      ticket_type_availability: {
        Args: { p_ticket_type_id: string };
        Returns: number;
      };
      event_ticket_availability: {
        Args: { p_event_id: string };
        Returns: Array<{
          ticket_type_id: string;
          inventory: number;
          reserved: number;
          available: number;
        }>;
      };
      create_order_with_reservation: {
        Args: {
          p_event_id: string;
          p_attendee_id: string;
          p_items: Json;
          p_hold_minutes?: number;
        };
        Returns: Array<{
          order_id: string;
          reference: string;
          access_token: string;
          total_kobo: number;
        }>;
      };
      expire_overdue_orders: {
        Args: Record<string, never>;
        Returns: number;
      };
    };

    Enums: {
      order_status: OrderStatus;
      ticket_status: TicketStatus;
      event_status: EventStatus;
      admin_role: AdminRole;
    };

    CompositeTypes: Record<string, never>;
  };
};

/* ── Convenience aliases ────────────────────────────────────────────────── */

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];

export type EventRow = Tables<"events">;
export type TicketTypeRow = Tables<"ticket_types">;
export type AttendeeRow = Tables<"attendees">;
export type OrderRow = Tables<"orders">;
export type OrderItemRow = Tables<"order_items">;
export type TicketRow = Tables<"tickets">;
export type AdminRow = Tables<"admins">;
export type AuditLogRow = Tables<"audit_log">;
