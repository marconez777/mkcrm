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
      attendants: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      lead_custom_fields: {
        Row: {
          created_at: string
          field_key: string
          field_type: string
          id: string
          label: string
          options: Json | null
          position: number
        }
        Insert: {
          created_at?: string
          field_key: string
          field_type?: string
          id?: string
          label: string
          options?: Json | null
          position?: number
        }
        Update: {
          created_at?: string
          field_key?: string
          field_type?: string
          id?: string
          label?: string
          options?: Json | null
          position?: number
        }
        Relationships: []
      }
      leads: {
        Row: {
          attendant_id: string | null
          avatar_url: string | null
          company: string | null
          created_at: string
          custom_fields: Json
          deal_value: number | null
          email: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          name: string | null
          notes: string | null
          phone: string
          position: number
          stage_changed_at: string
          stage_id: string | null
          tags: string[]
          unread_count: number
          updated_at: string
        }
        Insert: {
          attendant_id?: string | null
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          custom_fields?: Json
          deal_value?: number | null
          email?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          name?: string | null
          notes?: string | null
          phone: string
          position?: number
          stage_changed_at?: string
          stage_id?: string | null
          tags?: string[]
          unread_count?: number
          updated_at?: string
        }
        Update: {
          attendant_id?: string | null
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          custom_fields?: Json
          deal_value?: number | null
          email?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          name?: string | null
          notes?: string | null
          phone?: string
          position?: number
          stage_changed_at?: string
          stage_id?: string | null
          tags?: string[]
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_attendant_id_fkey"
            columns: ["attendant_id"]
            isOneToOne: false
            referencedRelation: "attendants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          client_message_id: string | null
          content: string | null
          created_at: string
          external_id: string | null
          from_me: boolean
          id: string
          last_error: string | null
          lead_id: string
          media_mime: string | null
          media_url: string | null
          message_type: string
          raw: Json | null
          retry_count: number
          status: string
          timestamp: string
        }
        Insert: {
          client_message_id?: string | null
          content?: string | null
          created_at?: string
          external_id?: string | null
          from_me?: boolean
          id?: string
          last_error?: string | null
          lead_id: string
          media_mime?: string | null
          media_url?: string | null
          message_type?: string
          raw?: Json | null
          retry_count?: number
          status?: string
          timestamp?: string
        }
        Update: {
          client_message_id?: string | null
          content?: string | null
          created_at?: string
          external_id?: string | null
          from_me?: boolean
          id?: string
          last_error?: string | null
          lead_id?: string
          media_mime?: string | null
          media_url?: string | null
          message_type?: string
          raw?: Json | null
          retry_count?: number
          status?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          position: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          position: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      settings: {
        Row: {
          connection_state: string | null
          created_at: string
          evolution_api_key: string | null
          evolution_instance: string | null
          evolution_url: string | null
          id: number
          last_health_check: string | null
          last_poll_at: string | null
          updated_at: string
          webhook_last_error: string | null
          webhook_last_set_at: string | null
          webhook_ok: boolean | null
          webhook_token: string
        }
        Insert: {
          connection_state?: string | null
          created_at?: string
          evolution_api_key?: string | null
          evolution_instance?: string | null
          evolution_url?: string | null
          id?: number
          last_health_check?: string | null
          last_poll_at?: string | null
          updated_at?: string
          webhook_last_error?: string | null
          webhook_last_set_at?: string | null
          webhook_ok?: boolean | null
          webhook_token?: string
        }
        Update: {
          connection_state?: string | null
          created_at?: string
          evolution_api_key?: string | null
          evolution_instance?: string | null
          evolution_url?: string | null
          id?: number
          last_health_check?: string | null
          last_poll_at?: string | null
          updated_at?: string
          webhook_last_error?: string | null
          webhook_last_set_at?: string | null
          webhook_ok?: boolean | null
          webhook_token?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          error: string | null
          event_type: string
          id: string
          lead_id: string | null
          payload: Json | null
          processed_at: string | null
          received_at: string
          source: string
        }
        Insert: {
          error?: string | null
          event_type: string
          id?: string
          lead_id?: string | null
          payload?: Json | null
          processed_at?: string | null
          received_at?: string
          source?: string
        }
        Update: {
          error?: string | null
          event_type?: string
          id?: string
          lead_id?: string | null
          payload?: Json | null
          processed_at?: string | null
          received_at?: string
          source?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_webhook_events: { Args: never; Returns: undefined }
      increment_unread: {
        Args: { p_lead_id: string; p_preview: string; p_ts: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
