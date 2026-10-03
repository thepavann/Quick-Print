export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_devices: {
        Row: {
          agent_version: string | null
          created_at: string
          hostname: string | null
          id: string
          last_heartbeat_at: string | null
          name: string
          printer_id: string | null
          reported_printer_name: string | null
          reported_printer_status: string | null
          revoked: boolean
          station_id: string
          token_hash: string
          token_prefix: string
        }
        Insert: {
          agent_version?: string | null
          created_at?: string
          hostname?: string | null
          id?: string
          last_heartbeat_at?: string | null
          name?: string
          printer_id?: string | null
          reported_printer_name?: string | null
          reported_printer_status?: string | null
          revoked?: boolean
          station_id: string
          token_hash: string
          token_prefix: string
        }
        Update: {
          agent_version?: string | null
          created_at?: string
          hostname?: string | null
          id?: string
          last_heartbeat_at?: string | null
          name?: string
          printer_id?: string | null
          reported_printer_name?: string | null
          reported_printer_status?: string | null
          revoked?: boolean
          station_id?: string
          token_hash?: string
          token_prefix?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_devices_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_devices_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor: string
          created_at: string
          detail: Json | null
          id: string
          station_id: string | null
        }
        Insert: {
          action: string
          actor: string
          created_at?: string
          detail?: Json | null
          id?: string
          station_id?: string | null
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          detail?: Json | null
          id?: string
          station_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          color: Database["public"]["Enums"]["color_mode"]
          duplex: boolean
          id: string
          paper: Database["public"]["Enums"]["paper_size"]
          price_per_page: number
          station_id: string
        }
        Insert: {
          color: Database["public"]["Enums"]["color_mode"]
          duplex: boolean
          id?: string
          paper: Database["public"]["Enums"]["paper_size"]
          price_per_page: number
          station_id: string
        }
        Update: {
          color?: Database["public"]["Enums"]["color_mode"]
          duplex?: boolean
          id?: string
          paper?: Database["public"]["Enums"]["paper_size"]
          price_per_page?: number
          station_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      print_jobs: {
        Row: {
          amount: number
          attempts: number
          claimed_at: string | null
          claimed_by: string | null
          color: Database["public"]["Enums"]["color_mode"]
          completed_at: string | null
          copies: number
          created_at: string
          demo: boolean
          duplex: boolean
          error_message: string | null
          failed_at: string | null
          file_purged_at: string | null
          file_size: number
          filename: string
          id: string
          idempotency_key: string | null
          job_number: number
          page_count: number
          page_range: string | null
          paid_at: string | null
          paper: Database["public"]["Enums"]["paper_size"]
          payment_method: string
          printed_pages: number
          printer_id: string | null
          session_id: string | null
          started_at: string | null
          station_id: string
          status: Database["public"]["Enums"]["job_status"]
          storage_path: string
        }
        Insert: {
          amount: number
          attempts?: number
          claimed_at?: string | null
          claimed_by?: string | null
          color?: Database["public"]["Enums"]["color_mode"]
          completed_at?: string | null
          copies?: number
          created_at?: string
          demo?: boolean
          duplex?: boolean
          error_message?: string | null
          failed_at?: string | null
          file_purged_at?: string | null
          file_size?: number
          filename: string
          id?: string
          idempotency_key?: string | null
          job_number?: number
          page_count: number
          page_range?: string | null
          paid_at?: string | null
          paper?: Database["public"]["Enums"]["paper_size"]
          payment_method?: string
          printed_pages?: number
          printer_id?: string | null
          session_id?: string | null
          started_at?: string | null
          station_id: string
          status?: Database["public"]["Enums"]["job_status"]
          storage_path: string
        }
        Update: {
          amount?: number
          attempts?: number
          claimed_at?: string | null
          claimed_by?: string | null
          color?: Database["public"]["Enums"]["color_mode"]
          completed_at?: string | null
          copies?: number
          created_at?: string
          demo?: boolean
          duplex?: boolean
          error_message?: string | null
          failed_at?: string | null
          file_purged_at?: string | null
          file_size?: number
          filename?: string
          id?: string
          idempotency_key?: string | null
          job_number?: number
          page_count?: number
          page_range?: string | null
          paid_at?: string | null
          paper?: Database["public"]["Enums"]["paper_size"]
          payment_method?: string
          printed_pages?: number
          printer_id?: string | null
          session_id?: string | null
          started_at?: string | null
          station_id?: string
          status?: Database["public"]["Enums"]["job_status"]
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_jobs_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "agent_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_jobs_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_jobs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "qr_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_jobs_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      printers: {
        Row: {
          created_at: string
          default_paper: Database["public"]["Enums"]["paper_size"]
          id: string
          last_seen_at: string | null
          last_success_at: string | null
          model: string | null
          name: string
          station_id: string
          status: Database["public"]["Enums"]["printer_status"]
          supports_color: boolean
          supports_duplex: boolean
          windows_printer_name: string | null
        }
        Insert: {
          created_at?: string
          default_paper?: Database["public"]["Enums"]["paper_size"]
          id?: string
          last_seen_at?: string | null
          last_success_at?: string | null
          model?: string | null
          name?: string
          station_id: string
          status?: Database["public"]["Enums"]["printer_status"]
          supports_color?: boolean
          supports_duplex?: boolean
          windows_printer_name?: string | null
        }
        Update: {
          created_at?: string
          default_paper?: Database["public"]["Enums"]["paper_size"]
          id?: string
          last_seen_at?: string | null
          last_success_at?: string | null
          model?: string | null
          name?: string
          station_id?: string
          status?: Database["public"]["Enums"]["printer_status"]
          supports_color?: boolean
          supports_duplex?: boolean
          windows_printer_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "printers_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      qr_sessions: {
        Row: {
          claim_hash: string | null
          claimed_at: string | null
          created_at: string
          expires_at: string
          id: string
          jobs_used: number
          max_jobs: number
          station_id: string
          status: Database["public"]["Enums"]["session_status"]
          token: string
        }
        Insert: {
          claim_hash?: string | null
          claimed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          jobs_used?: number
          max_jobs?: number
          station_id: string
          status?: Database["public"]["Enums"]["session_status"]
          token: string
        }
        Update: {
          claim_hash?: string | null
          claimed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          jobs_used?: number
          max_jobs?: number
          station_id?: string
          status?: Database["public"]["Enums"]["session_status"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_sessions_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      stations: {
        Row: {
          a3_enabled: boolean
          a4_enabled: boolean
          color_enabled: boolean
          created_at: string
          currency: string
          duplex_enabled: boolean
          id: string
          is_demo: boolean
          location: string | null
          max_file_size_mb: number
          max_jobs_per_session: number
          name: string
          owner_id: string | null
          session_duration_seconds: number
        }
        Insert: {
          a3_enabled?: boolean
          a4_enabled?: boolean
          color_enabled?: boolean
          created_at?: string
          currency?: string
          duplex_enabled?: boolean
          id?: string
          is_demo?: boolean
          location?: string | null
          max_file_size_mb?: number
          max_jobs_per_session?: number
          name: string
          owner_id?: string | null
          session_duration_seconds?: number
        }
        Update: {
          a3_enabled?: boolean
          a4_enabled?: boolean
          color_enabled?: boolean
          created_at?: string
          currency?: string
          duplex_enabled?: boolean
          id?: string
          is_demo?: boolean
          location?: string | null
          max_file_size_mb?: number
          max_jobs_per_session?: number
          name?: string
          owner_id?: string | null
          session_duration_seconds?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_next_print_job: {
        Args: { _agent_id: string; _job_id?: string; _station_id: string }
        Returns: {
          amount: number
          attempts: number
          claimed_at: string | null
          claimed_by: string | null
          color: Database["public"]["Enums"]["color_mode"]
          completed_at: string | null
          copies: number
          created_at: string
          demo: boolean
          duplex: boolean
          error_message: string | null
          failed_at: string | null
          file_purged_at: string | null
          file_size: number
          filename: string
          id: string
          idempotency_key: string | null
          job_number: number
          page_count: number
          page_range: string | null
          paid_at: string | null
          paper: Database["public"]["Enums"]["paper_size"]
          payment_method: string
          printed_pages: number
          printer_id: string | null
          session_id: string | null
          started_at: string | null
          station_id: string
          status: Database["public"]["Enums"]["job_status"]
          storage_path: string
        }
        SetofOptions: {
          from: "*"
          to: "print_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      consume_qr_session_job: {
        Args: { _session_id: string }
        Returns: boolean
      }
      requeue_stale_downloading_jobs: {
        Args: { _station_id: string }
        Returns: number
      }
      seed_station_defaults: { Args: { _station: string }; Returns: undefined }
    }
    Enums: {
      app_role: "OWNER" | "STAFF" | "ADMIN"
      color_mode: "BW" | "COLOR"
      job_status:
        | "QUEUED"
        | "DOWNLOADING"
        | "PRINTING"
        | "COMPLETED"
        | "FAILED"
        | "CANCELLED"
      paper_size: "A4" | "A3"
      printer_status: "ONLINE" | "OFFLINE"
      session_status: "ACTIVE" | "EXPIRED" | "REVOKED"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["OWNER", "STAFF", "ADMIN"],
      color_mode: ["BW", "COLOR"],
      job_status: [
        "QUEUED",
        "DOWNLOADING",
        "PRINTING",
        "COMPLETED",
        "FAILED",
        "CANCELLED",
      ],
      paper_size: ["A4", "A3"],
      printer_status: ["ONLINE", "OFFLINE"],
      session_status: ["ACTIVE", "EXPIRED", "REVOKED"],
    },
  },
} as const
