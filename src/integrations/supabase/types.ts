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
      ai_agents: {
        Row: {
          api_key: string | null
          base_url: string | null
          created_at: string
          description: string | null
          embedding_api_key: string | null
          embedding_model: string | null
          enabled: boolean
          id: string
          model: string
          name: string
          provider: string
          system_prompt: string
          temperature: number
          tools: Json
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          base_url?: string | null
          created_at?: string
          description?: string | null
          embedding_api_key?: string | null
          embedding_model?: string | null
          enabled?: boolean
          id?: string
          model?: string
          name: string
          provider?: string
          system_prompt: string
          temperature?: number
          tools?: Json
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          base_url?: string | null
          created_at?: string
          description?: string | null
          embedding_api_key?: string | null
          embedding_model?: string | null
          enabled?: boolean
          id?: string
          model?: string
          name?: string
          provider?: string
          system_prompt?: string
          temperature?: number
          tools?: Json
          updated_at?: string
        }
        Relationships: []
      }
      ai_chunks: {
        Row: {
          agent_id: string | null
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          token_count: number | null
        }
        Insert: {
          agent_id?: string | null
          chunk_index?: number
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          token_count?: number | null
        }
        Update: {
          agent_id?: string | null
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_chunks_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "ai_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_documents: {
        Row: {
          agent_id: string | null
          content: string
          created_at: string
          id: string
          metadata: Json | null
          source: string | null
          title: string
        }
        Insert: {
          agent_id?: string | null
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          source?: string | null
          title: string
        }
        Update: {
          agent_id?: string | null
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          source?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_documents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string | null
          created_at: string
          id: string
          role: string
          thread_id: string
          tool_call_id: string | null
          tool_calls: Json | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          role: string
          thread_id: string
          tool_call_id?: string | null
          tool_calls?: Json | null
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          role?: string
          thread_id?: string
          tool_call_id?: string | null
          tool_calls?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "ai_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_threads: {
        Row: {
          agent_id: string | null
          created_at: string
          id: string
          lead_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_threads_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_threads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          agent_id: string | null
          automation_id: string | null
          created_at: string
          error: string | null
          id: string
          input_tokens: number | null
          latency_ms: number | null
          lead_id: string | null
          model: string
          operation: string
          output_tokens: number | null
          replied: boolean
          status: string
          thread_id: string | null
          tools_called: number
          total_tokens: number | null
        }
        Insert: {
          agent_id?: string | null
          automation_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          lead_id?: string | null
          model: string
          operation?: string
          output_tokens?: number | null
          replied?: boolean
          status?: string
          thread_id?: string | null
          tools_called?: number
          total_tokens?: number | null
        }
        Update: {
          agent_id?: string | null
          automation_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          lead_id?: string | null
          model?: string
          operation?: string
          output_tokens?: number | null
          replied?: boolean
          status?: string
          thread_id?: string | null
          tools_called?: number
          total_tokens?: number | null
        }
        Relationships: []
      }
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
      automation_runs: {
        Row: {
          automation_id: string
          created_at: string
          detail: string | null
          id: string
          lead_id: string
          status: string
        }
        Insert: {
          automation_id: string
          created_at?: string
          detail?: string | null
          id?: string
          lead_id: string
          status?: string
        }
        Update: {
          automation_id?: string
          created_at?: string
          detail?: string | null
          id?: string
          lead_id?: string
          status?: string
        }
        Relationships: []
      }
      automations: {
        Row: {
          action_config: Json
          action_type: string
          cooldown_hours: number
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          name: string
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          action_config?: Json
          action_type: string
          cooldown_hours?: number
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          name: string
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          cooldown_hours?: number
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          name?: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_ai_settings: {
        Row: {
          agent_id: string | null
          auto_reply: boolean
          created_at: string
          lead_id: string
          paused_until: string | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          auto_reply?: boolean
          created_at?: string
          lead_id: string
          paused_until?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          auto_reply?: boolean
          created_at?: string
          lead_id?: string
          paused_until?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_ai_settings_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_ai_settings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
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
      lead_events: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          payload: Json | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          payload?: Json | null
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          payload?: Json | null
          type?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          archived_at: string | null
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
          whatsapp_instance_id: string | null
        }
        Insert: {
          archived_at?: string | null
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
          whatsapp_instance_id?: string | null
        }
        Update: {
          archived_at?: string | null
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
          whatsapp_instance_id?: string | null
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
          {
            foreignKeyName: "leads_whatsapp_instance_id_fkey"
            columns: ["whatsapp_instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          content: string
          created_at: string
          description: string | null
          id: string
          name: string
          shortcut: string | null
          updated_at: string
          variables: Json
        }
        Insert: {
          content: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          shortcut?: string | null
          updated_at?: string
          variables?: Json
        }
        Update: {
          content?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          shortcut?: string | null
          updated_at?: string
          variables?: Json
        }
        Relationships: []
      }
      messages: {
        Row: {
          client_message_id: string | null
          content: string | null
          created_at: string
          delivery_status: string | null
          external_id: string | null
          from_me: boolean
          id: string
          last_error: string | null
          lead_id: string
          media_mime: string | null
          media_url: string | null
          message_type: string
          raw: Json | null
          reply_to_external_id: string | null
          retry_count: number
          status: string
          timestamp: string
        }
        Insert: {
          client_message_id?: string | null
          content?: string | null
          created_at?: string
          delivery_status?: string | null
          external_id?: string | null
          from_me?: boolean
          id?: string
          last_error?: string | null
          lead_id: string
          media_mime?: string | null
          media_url?: string | null
          message_type?: string
          raw?: Json | null
          reply_to_external_id?: string | null
          retry_count?: number
          status?: string
          timestamp?: string
        }
        Update: {
          client_message_id?: string | null
          content?: string | null
          created_at?: string
          delivery_status?: string | null
          external_id?: string | null
          from_me?: boolean
          id?: string
          last_error?: string | null
          lead_id?: string
          media_mime?: string | null
          media_url?: string | null
          message_type?: string
          raw?: Json | null
          reply_to_external_id?: string | null
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
      quick_replies: {
        Row: {
          content: string
          created_at: string
          id: string
          shortcut: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          shortcut: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          shortcut?: string
          updated_at?: string
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
      stage_ai_defaults: {
        Row: {
          agent_id: string | null
          auto_reply: boolean
          stage_id: string
        }
        Insert: {
          agent_id?: string | null
          auto_reply?: boolean
          stage_id: string
        }
        Update: {
          agent_id?: string | null
          auto_reply?: boolean
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_ai_defaults_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_ai_defaults_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: true
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
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
      whatsapp_instances: {
        Row: {
          connection_state: string | null
          created_at: string
          evolution_api_key: string
          evolution_instance: string
          evolution_url: string
          id: string
          is_default: boolean
          last_health_check: string | null
          last_poll_at: string | null
          name: string
          updated_at: string
          webhook_last_error: string | null
          webhook_last_set_at: string | null
          webhook_ok: boolean | null
          webhook_token: string
        }
        Insert: {
          connection_state?: string | null
          created_at?: string
          evolution_api_key: string
          evolution_instance: string
          evolution_url: string
          id?: string
          is_default?: boolean
          last_health_check?: string | null
          last_poll_at?: string | null
          name: string
          updated_at?: string
          webhook_last_error?: string | null
          webhook_last_set_at?: string | null
          webhook_ok?: boolean | null
          webhook_token?: string
        }
        Update: {
          connection_state?: string | null
          created_at?: string
          evolution_api_key?: string
          evolution_instance?: string
          evolution_url?: string
          id?: string
          is_default?: boolean
          last_health_check?: string | null
          last_poll_at?: string | null
          name?: string
          updated_at?: string
          webhook_last_error?: string | null
          webhook_last_set_at?: string | null
          webhook_ok?: boolean | null
          webhook_token?: string
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
      match_chunks: {
        Args: {
          match_count?: number
          p_agent_id: string
          query_embedding: string
        }
        Returns: {
          content: string
          document_id: string
          id: string
          similarity: number
        }[]
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
