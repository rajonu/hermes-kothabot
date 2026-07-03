export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ShopCategory =
  | "restaurant"
  | "retail"
  | "salon"
  | "clinic"
  | "pharmacy"
  | "grocery"
  | "services"
  | "other";

export type SubscriptionPlan = "trial" | "monthly" | "yearly";
export type SubscriptionStatus =
  | "trial"
  | "active"
  | "past_due"
  | "cancelled"
  | "paused";
export type PaymentMethod = "paddle" | "bkash";

export type VoiceSessionStatus = "active" | "ended" | "failed";

export type OrderType = "order" | "appointment" | "lead";
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "completed"
  | "cancelled";

export type TicketStatus = "open" | "pending" | "resolved";

export type TrainingSourceType = "website" | "facebook" | "manual" | "faq";

export type InvoiceStatus = "paid" | "pending" | "rejected";

export interface Database {
  public: {
    Tables: {
      shops: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          category: ShopCategory;
          slug: string;
          widget_config: Json;
          ai_config: Json;
          onboarding_done: boolean;
          business_profile?: string | null; // New column for compact business profile
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          category: ShopCategory;
          slug: string;
          widget_config?: Json;
          ai_config?: Json;
          onboarding_done?: boolean;
          business_profile?: string | null; // New column for compact business profile
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["shops"]["Insert"]>;
      };
      subscriptions: {
        Row: {
          id: string;
          shop_id: string;
          plan: SubscriptionPlan;
          status: SubscriptionStatus;
          payment_method: PaymentMethod;
          paddle_sub_id: string | null;
          trial_ends_at: string | null;
          current_period_end: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          plan?: SubscriptionPlan;
          status?: SubscriptionStatus;
          payment_method?: PaymentMethod;
          paddle_sub_id?: string | null;
          trial_ends_at?: string | null;
          current_period_end?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Insert"]>;
      };
      voice_sessions: {
        Row: {
          id: string;
          shop_id: string;
          session_token: string;
          status: VoiceSessionStatus;
          duration_s: number | null;
          caller_ip: string | null;
          transcript: Json[];
          summary: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          session_token: string;
          status?: VoiceSessionStatus;
          duration_s?: number | null;
          caller_ip?: string | null;
          transcript?: Json[];
          summary?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["voice_sessions"]["Insert"]>;
      };
      orders: {
        Row: {
          id: string;
          shop_id: string;
          customer_id: string | null;
          type: OrderType;
          items: Json;
          status: OrderStatus;
          total_amount: number | null;
          session_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          customer_id?: string | null;
          type?: OrderType;
          items?: Json;
          status?: OrderStatus;
          total_amount?: number | null;
          session_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
      };
      customers: {
        Row: {
          id: string;
          shop_id: string;
          name: string;
          phone: string | null;
          address: string | null;
          lifetime_value: number;
          order_count: number;
          demographics: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          name: string;
          phone?: string | null;
          address?: string | null;
          lifetime_value?: number;
          order_count?: number;
          demographics?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
      };
      support_tickets: {
        Row: {
          id: string;
          shop_id: string;
          subject: string;
          status: TicketStatus;
          messages: Json[];
          screenshot_url: string | null;
          unread_admin: boolean;
          unread_client: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          subject: string;
          status?: TicketStatus;
          messages?: Json[];
          screenshot_url?: string | null;
          unread_admin?: boolean;
          unread_client?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["support_tickets"]["Insert"]>;
      };
      training_data: {
        Row: {
          id: string;
          shop_id: string;
          source_type: TrainingSourceType;
          source_url: string | null;
          extracted_text: string;
          last_scraped_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          source_type: TrainingSourceType;
          source_url?: string | null;
          extracted_text: string;
          last_scraped_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["training_data"]["Insert"]>;
      };
      invoices: {
        Row: {
          id: string;
          shop_id: string;
          amount: number;
          currency: string;
          status: InvoiceStatus;
          paddle_tx_id: string | null;
          bkash_tx_id: string | null;
          bkash_last4: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          amount: number;
          currency?: string;
          status?: InvoiceStatus;
          paddle_tx_id?: string | null;
          bkash_tx_id?: string | null;
          bkash_last4?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["invoices"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Convenience row types
export type Shop = Database["public"]["Tables"]["shops"]["Row"];
export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
export type VoiceSession = Database["public"]["Tables"]["voice_sessions"]["Row"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type SupportTicket = Database["public"]["Tables"]["support_tickets"]["Row"];
export type TrainingData = Database["public"]["Tables"]["training_data"]["Row"];
export type Invoice = Database["public"]["Tables"]["invoices"]["Row"];
