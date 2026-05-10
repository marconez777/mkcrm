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
      agent_evals: {
        Row: {
          agent_id: string
          clinic_id: string
          created_at: string
          expected_contains: string[]
          id: string
          last_passed: boolean | null
          last_response: string | null
          last_run_at: string | null
          prompt: string
        }
        Insert: {
          agent_id: string
          clinic_id?: string
          created_at?: string
          expected_contains?: string[]
          id?: string
          last_passed?: boolean | null
          last_response?: string | null
          last_run_at?: string | null
          prompt: string
        }
        Update: {
          agent_id?: string
          clinic_id?: string
          created_at?: string
          expected_contains?: string[]
          id?: string
          last_passed?: boolean | null
          last_response?: string | null
          last_run_at?: string | null
          prompt?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_evals_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_evals_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_mcp_servers: {
        Row: {
          agent_id: string
          clinic_id: string
          created_at: string
          enabled: boolean
          headers: Json
          id: string
          name: string
          url: string
        }
        Insert: {
          agent_id: string
          clinic_id?: string
          created_at?: string
          enabled?: boolean
          headers?: Json
          id?: string
          name: string
          url: string
        }
        Update: {
          agent_id?: string
          clinic_id?: string
          created_at?: string
          enabled?: boolean
          headers?: Json
          id?: string
          name?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_mcp_servers_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_mcp_servers_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_memory: {
        Row: {
          agent_id: string | null
          clinic_id: string
          content: string
          created_at: string
          embedding: string | null
          id: string
          kind: string
          lead_id: string | null
        }
        Insert: {
          agent_id?: string | null
          clinic_id?: string
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          kind: string
          lead_id?: string | null
        }
        Update: {
          agent_id?: string | null
          clinic_id?: string
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          kind?: string
          lead_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_memory_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_memory_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_memory_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_traces: {
        Row: {
          agent_id: string | null
          clinic_id: string
          created_at: string
          error: string | null
          id: string
          kind: string
          latency_ms: number | null
          lead_id: string | null
          name: string | null
          payload: Json | null
          run_id: string
          step: number
          thread_id: string | null
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          agent_id?: string | null
          clinic_id?: string
          created_at?: string
          error?: string | null
          id?: string
          kind: string
          latency_ms?: number | null
          lead_id?: string | null
          name?: string | null
          payload?: Json | null
          run_id: string
          step: number
          thread_id?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          agent_id?: string | null
          clinic_id?: string
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          latency_ms?: number | null
          lead_id?: string | null
          name?: string | null
          payload?: Json | null
          run_id?: string
          step?: number
          thread_id?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_traces_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          api_key: string | null
          base_url: string | null
          clinic_id: string
          created_at: string
          debounce_seconds: number
          description: string | null
          embedding_api_key: string | null
          embedding_model: string | null
          enabled: boolean
          id: string
          max_iterations: number
          max_tool_calls: number
          model: string
          name: string
          planning_mode: boolean
          provider: string
          rag_top_k: number
          reranker_api_key: string | null
          reranker_provider: string | null
          role: string | null
          silent: boolean
          system_prompt: string
          temperature: number
          tools: Json
          updated_at: string
          use_hybrid_search: boolean
          use_hyde: boolean
          use_memory: boolean
        }
        Insert: {
          api_key?: string | null
          base_url?: string | null
          clinic_id?: string
          created_at?: string
          debounce_seconds?: number
          description?: string | null
          embedding_api_key?: string | null
          embedding_model?: string | null
          enabled?: boolean
          id?: string
          max_iterations?: number
          max_tool_calls?: number
          model?: string
          name: string
          planning_mode?: boolean
          provider?: string
          rag_top_k?: number
          reranker_api_key?: string | null
          reranker_provider?: string | null
          role?: string | null
          silent?: boolean
          system_prompt: string
          temperature?: number
          tools?: Json
          updated_at?: string
          use_hybrid_search?: boolean
          use_hyde?: boolean
          use_memory?: boolean
        }
        Update: {
          api_key?: string | null
          base_url?: string | null
          clinic_id?: string
          created_at?: string
          debounce_seconds?: number
          description?: string | null
          embedding_api_key?: string | null
          embedding_model?: string | null
          enabled?: boolean
          id?: string
          max_iterations?: number
          max_tool_calls?: number
          model?: string
          name?: string
          planning_mode?: boolean
          provider?: string
          rag_top_k?: number
          reranker_api_key?: string | null
          reranker_provider?: string | null
          role?: string | null
          silent?: boolean
          system_prompt?: string
          temperature?: number
          tools?: Json
          updated_at?: string
          use_hybrid_search?: boolean
          use_hyde?: boolean
          use_memory?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chunks: {
        Row: {
          agent_id: string | null
          chunk_index: number
          clinic_id: string
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          token_count: number | null
          tsv: unknown
        }
        Insert: {
          agent_id?: string | null
          chunk_index?: number
          clinic_id?: string
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          token_count?: number | null
          tsv?: unknown
        }
        Update: {
          agent_id?: string | null
          chunk_index?: number
          clinic_id?: string
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          token_count?: number | null
          tsv?: unknown
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
            foreignKeyName: "ai_chunks_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
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
          clinic_id: string
          content: string
          created_at: string
          doc_summary: string | null
          id: string
          metadata: Json | null
          source: string | null
          title: string
        }
        Insert: {
          agent_id?: string | null
          clinic_id?: string
          content: string
          created_at?: string
          doc_summary?: string | null
          id?: string
          metadata?: Json | null
          source?: string | null
          title: string
        }
        Update: {
          agent_id?: string | null
          clinic_id?: string
          content?: string
          created_at?: string
          doc_summary?: string | null
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
          {
            foreignKeyName: "ai_documents_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          clinic_id: string
          content: string | null
          created_at: string
          id: string
          role: string
          thread_id: string
          tool_call_id: string | null
          tool_calls: Json | null
        }
        Insert: {
          clinic_id?: string
          content?: string | null
          created_at?: string
          id?: string
          role: string
          thread_id: string
          tool_call_id?: string | null
          tool_calls?: Json | null
        }
        Update: {
          clinic_id?: string
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
            foreignKeyName: "ai_messages_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
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
          clinic_id: string
          created_at: string
          id: string
          lead_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          clinic_id?: string
          created_at?: string
          id?: string
          lead_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          clinic_id?: string
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
            foreignKeyName: "ai_threads_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
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
          clinic_id: string
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
          clinic_id?: string
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
          clinic_id?: string
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
        Relationships: [
          {
            foreignKeyName: "ai_usage_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      attendants: {
        Row: {
          clinic_id: string
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          clinic_id?: string
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          clinic_id?: string
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendants_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          clinic_id: string | null
          created_at: string
          diff: Json | null
          entity: string | null
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          clinic_id?: string | null
          created_at?: string
          diff?: Json | null
          entity?: string | null
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          clinic_id?: string | null
          created_at?: string
          diff?: Json | null
          entity?: string | null
          entity_id?: string | null
          id?: string
        }
        Relationships: []
      }
      automation_runs: {
        Row: {
          automation_id: string
          clinic_id: string
          created_at: string
          detail: string | null
          id: string
          lead_id: string
          status: string
        }
        Insert: {
          automation_id: string
          clinic_id?: string
          created_at?: string
          detail?: string | null
          id?: string
          lead_id: string
          status?: string
        }
        Update: {
          automation_id?: string
          clinic_id?: string
          created_at?: string
          detail?: string | null
          id?: string
          lead_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          action_config: Json
          action_type: string
          clinic_id: string
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
          clinic_id?: string
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
          clinic_id?: string
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
        Relationships: [
          {
            foreignKeyName: "automations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_invites: {
        Row: {
          accepted_at: string | null
          clinic_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["clinic_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          clinic_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["clinic_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          clinic_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["clinic_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_invites_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_members: {
        Row: {
          attendant_id: string | null
          clinic_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["clinic_role"]
          user_id: string
        }
        Insert: {
          attendant_id?: string | null
          clinic_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["clinic_role"]
          user_id: string
        }
        Update: {
          attendant_id?: string | null
          clinic_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["clinic_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_members_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          created_at: string
          id: string
          name: string
          plan: string
          settings: Json
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          plan?: string
          settings?: Json
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan?: string
          settings?: Json
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      data_access_log: {
        Row: {
          action: string
          actor_user_id: string | null
          clinic_id: string | null
          created_at: string
          id: string
          lead_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          clinic_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          clinic_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
        }
        Relationships: []
      }
      embedding_cache: {
        Row: {
          created_at: string
          embedding: string | null
          model: string
          text_hash: string
        }
        Insert: {
          created_at?: string
          embedding?: string | null
          model: string
          text_hash: string
        }
        Update: {
          created_at?: string
          embedding?: string | null
          model?: string
          text_hash?: string
        }
        Relationships: []
      }
      lead_ai_settings: {
        Row: {
          agent_id: string | null
          auto_reply: boolean
          clinic_id: string
          created_at: string
          lead_id: string
          paused_until: string | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          auto_reply?: boolean
          clinic_id?: string
          created_at?: string
          lead_id: string
          paused_until?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          auto_reply?: boolean
          clinic_id?: string
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
            foreignKeyName: "lead_ai_settings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
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
          clinic_id: string
          created_at: string
          field_key: string
          field_type: string
          id: string
          label: string
          options: Json | null
          position: number
        }
        Insert: {
          clinic_id?: string
          created_at?: string
          field_key: string
          field_type?: string
          id?: string
          label: string
          options?: Json | null
          position?: number
        }
        Update: {
          clinic_id?: string
          created_at?: string
          field_key?: string
          field_type?: string
          id?: string
          label?: string
          options?: Json | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_custom_fields_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_events: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          lead_id: string
          payload: Json | null
          type: string
        }
        Insert: {
          clinic_id?: string
          created_at?: string
          id?: string
          lead_id: string
          payload?: Json | null
          type: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          lead_id?: string
          payload?: Json | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_internal_notes: {
        Row: {
          author_id: string | null
          author_name: string | null
          clinic_id: string
          created_at: string
          id: string
          lead_id: string
          text: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          clinic_id?: string
          created_at?: string
          id?: string
          lead_id: string
          text: string
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          clinic_id?: string
          created_at?: string
          id?: string
          lead_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_internal_notes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_reply_counters: {
        Row: {
          clinic_id: string
          count: number
          hour_bucket: string
          last_bot_sent_at: string | null
          lead_id: string
        }
        Insert: {
          clinic_id?: string
          count?: number
          hour_bucket: string
          last_bot_sent_at?: string | null
          lead_id: string
        }
        Update: {
          clinic_id?: string
          count?: number
          hour_bucket?: string
          last_bot_sent_at?: string | null
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_reply_counters_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_stage_history: {
        Row: {
          clinic_id: string
          from_stage_id: string | null
          id: string
          lead_id: string
          moved_at: string
          moved_by_agent_id: string | null
          moved_by_user_id: string | null
          to_stage_id: string | null
        }
        Insert: {
          clinic_id?: string
          from_stage_id?: string | null
          id?: string
          lead_id: string
          moved_at?: string
          moved_by_agent_id?: string | null
          moved_by_user_id?: string | null
          to_stage_id?: string | null
        }
        Update: {
          clinic_id?: string
          from_stage_id?: string | null
          id?: string
          lead_id?: string
          moved_at?: string
          moved_by_agent_id?: string | null
          moved_by_user_id?: string | null
          to_stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_stage_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_stage_history_moved_by_agent_id_fkey"
            columns: ["moved_by_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tasks: {
        Row: {
          clinic_id: string
          created_at: string
          done_at: string | null
          due_at: string
          id: string
          lead_id: string
          title: string
        }
        Insert: {
          clinic_id?: string
          created_at?: string
          done_at?: string | null
          due_at: string
          id?: string
          lead_id: string
          title: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          done_at?: string | null
          due_at?: string
          id?: string
          lead_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tasks_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ai_summary: string | null
          ai_summary_at: string | null
          archived_at: string | null
          attendant_id: string | null
          avatar_url: string | null
          clinic_id: string
          company: string | null
          created_at: string
          custom_fields: Json
          deal_value: number | null
          email: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          marked_unread: boolean
          name: string | null
          notes: string | null
          phone: string
          pinned_at: string | null
          pipeline_id: string | null
          position: number
          stage_changed_at: string
          stage_id: string | null
          tags: string[]
          unread_count: number
          updated_at: string
          whatsapp_instance_id: string | null
        }
        Insert: {
          ai_summary?: string | null
          ai_summary_at?: string | null
          archived_at?: string | null
          attendant_id?: string | null
          avatar_url?: string | null
          clinic_id?: string
          company?: string | null
          created_at?: string
          custom_fields?: Json
          deal_value?: number | null
          email?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          marked_unread?: boolean
          name?: string | null
          notes?: string | null
          phone: string
          pinned_at?: string | null
          pipeline_id?: string | null
          position?: number
          stage_changed_at?: string
          stage_id?: string | null
          tags?: string[]
          unread_count?: number
          updated_at?: string
          whatsapp_instance_id?: string | null
        }
        Update: {
          ai_summary?: string | null
          ai_summary_at?: string | null
          archived_at?: string | null
          attendant_id?: string | null
          avatar_url?: string | null
          clinic_id?: string
          company?: string | null
          created_at?: string
          custom_fields?: Json
          deal_value?: number | null
          email?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          marked_unread?: boolean
          name?: string | null
          notes?: string | null
          phone?: string
          pinned_at?: string | null
          pipeline_id?: string | null
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
            foreignKeyName: "leads_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
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
          clinic_id: string
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
          clinic_id?: string
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
          clinic_id?: string
          content?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          shortcut?: string | null
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          client_message_id: string | null
          clinic_id: string
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
          clinic_id?: string
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
          clinic_id?: string
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
            foreignKeyName: "messages_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_replies: {
        Row: {
          agent_id: string
          clinic_id: string
          created_at: string
          lead_id: string
          run_at: string
        }
        Insert: {
          agent_id: string
          clinic_id?: string
          created_at?: string
          lead_id: string
          run_at: string
        }
        Update: {
          agent_id?: string
          clinic_id?: string
          created_at?: string
          lead_id?: string
          run_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_replies_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_replies_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_replies_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          clinic_id: string
          color: string
          created_at: string
          id: string
          name: string
          pipeline_id: string
          position: number
        }
        Insert: {
          clinic_id?: string
          color?: string
          created_at?: string
          id?: string
          name: string
          pipeline_id: string
          position: number
        }
        Update: {
          clinic_id?: string
          color?: string
          created_at?: string
          id?: string
          name?: string
          pipeline_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stages_pipeline_fk"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          clinic_id: string
          color: string
          created_at: string
          id: string
          is_default: boolean
          kind: string
          name: string
          position: number
          updated_at: string
          whatsapp_instance_id: string | null
        }
        Insert: {
          clinic_id?: string
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean
          kind?: string
          name: string
          position?: number
          updated_at?: string
          whatsapp_instance_id?: string | null
        }
        Update: {
          clinic_id?: string
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean
          kind?: string
          name?: string
          position?: number
          updated_at?: string
          whatsapp_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          council_number: string | null
          created_at: string
          email: string | null
          full_name: string | null
          professional_type:
            | Database["public"]["Enums"]["professional_type"]
            | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          council_number?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          professional_type?:
            | Database["public"]["Enums"]["professional_type"]
            | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          council_number?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          professional_type?:
            | Database["public"]["Enums"]["professional_type"]
            | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quick_replies: {
        Row: {
          clinic_id: string
          content: string
          created_at: string
          id: string
          shortcut: string
          updated_at: string
        }
        Insert: {
          clinic_id?: string
          content: string
          created_at?: string
          id?: string
          shortcut: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          content?: string
          created_at?: string
          id?: string
          shortcut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_replies_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_cache: {
        Row: {
          agent_id: string
          chunks: Json
          created_at: string
          query_hash: string
        }
        Insert: {
          agent_id: string
          chunks: Json
          created_at?: string
          query_hash: string
        }
        Update: {
          agent_id?: string
          chunks?: Json
          created_at?: string
          query_hash?: string
        }
        Relationships: []
      }
      scheduled_messages: {
        Row: {
          clinic_id: string
          content: string
          created_at: string
          id: string
          last_error: string | null
          lead_id: string
          send_at: string
          sent_at: string | null
          status: string
        }
        Insert: {
          clinic_id?: string
          content: string
          created_at?: string
          id?: string
          last_error?: string | null
          lead_id: string
          send_at: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          clinic_id?: string
          content?: string
          created_at?: string
          id?: string
          last_error?: string | null
          lead_id?: string
          send_at?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
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
          clinic_id: string
          stage_id: string
        }
        Insert: {
          agent_id?: string | null
          auto_reply?: boolean
          clinic_id?: string
          stage_id: string
        }
        Update: {
          agent_id?: string | null
          auto_reply?: boolean
          clinic_id?: string
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
            foreignKeyName: "stage_ai_defaults_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
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
      task_assignees: {
        Row: {
          attendant_id: string
          clinic_id: string
          created_at: string
          task_id: string
        }
        Insert: {
          attendant_id: string
          clinic_id?: string
          created_at?: string
          task_id: string
        }
        Update: {
          attendant_id?: string
          clinic_id?: string
          created_at?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_attendant_id_fkey"
            columns: ["attendant_id"]
            isOneToOne: false
            referencedRelation: "attendants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          clinic_id: string
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          task_id: string
        }
        Insert: {
          clinic_id?: string
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          task_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_boards: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          name: string
          position: number
        }
        Insert: {
          clinic_id?: string
          created_at?: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "task_boards_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      task_checklist_items: {
        Row: {
          clinic_id: string
          created_at: string
          done: boolean
          id: string
          position: number
          task_id: string
          text: string
        }
        Insert: {
          clinic_id?: string
          created_at?: string
          done?: boolean
          id?: string
          position?: number
          task_id: string
          text: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          done?: boolean
          id?: string
          position?: number
          task_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_checklist_items_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_checklist_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_columns: {
        Row: {
          board_id: string
          clinic_id: string
          created_at: string
          id: string
          name: string
          position: number
        }
        Insert: {
          board_id: string
          clinic_id?: string
          created_at?: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          board_id?: string
          clinic_id?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "task_columns_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "task_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_columns_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      task_label_links: {
        Row: {
          clinic_id: string
          label_id: string
          task_id: string
        }
        Insert: {
          clinic_id?: string
          label_id: string
          task_id: string
        }
        Update: {
          clinic_id?: string
          label_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_label_links_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_label_links_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "task_labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_label_links_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_labels: {
        Row: {
          board_id: string
          clinic_id: string
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          board_id: string
          clinic_id?: string
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          board_id?: string
          clinic_id?: string
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_labels_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "task_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_labels_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          board_id: string
          clinic_id: string
          column_id: string
          created_at: string
          description: string | null
          done_at: string | null
          due_at: string | null
          id: string
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          board_id: string
          clinic_id?: string
          column_id: string
          created_at?: string
          description?: string | null
          done_at?: string | null
          due_at?: string | null
          id?: string
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          board_id?: string
          clinic_id?: string
          column_id?: string
          created_at?: string
          description?: string | null
          done_at?: string | null
          due_at?: string | null
          id?: string
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "task_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "task_columns"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_dedup: {
        Row: {
          event_hash: string
          expires_at: string
        }
        Insert: {
          event_hash: string
          expires_at?: string
        }
        Update: {
          event_hash?: string
          expires_at?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          clinic_id: string
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
          clinic_id?: string
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
          clinic_id?: string
          error?: string | null
          event_type?: string
          id?: string
          lead_id?: string | null
          payload?: Json | null
          processed_at?: string | null
          received_at?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          clinic_id: string
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
          watcher_agent_id: string | null
          webhook_last_error: string | null
          webhook_last_set_at: string | null
          webhook_ok: boolean | null
          webhook_token: string
        }
        Insert: {
          clinic_id?: string
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
          watcher_agent_id?: string | null
          webhook_last_error?: string | null
          webhook_last_set_at?: string | null
          webhook_ok?: boolean | null
          webhook_token?: string
        }
        Update: {
          clinic_id?: string
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
          watcher_agent_id?: string | null
          webhook_last_error?: string | null
          webhook_last_set_at?: string | null
          webhook_ok?: boolean | null
          webhook_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_instances_watcher_agent_id_fkey"
            columns: ["watcher_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_clinic_invite: { Args: { _token: string }; Returns: string }
      cleanup_agent_caches: { Args: never; Returns: undefined }
      cleanup_webhook_dedup: { Args: never; Returns: undefined }
      cleanup_webhook_events: { Args: never; Returns: undefined }
      current_clinic_id: { Args: never; Returns: string }
      current_clinic_role: {
        Args: never
        Returns: Database["public"]["Enums"]["clinic_role"]
      }
      has_clinic_access: { Args: { _clinic_id: string }; Returns: boolean }
      increment_unread: {
        Args: { p_lead_id: string; p_preview: string; p_ts: string }
        Returns: undefined
      }
      is_clinic_admin: { Args: { _user_id?: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id?: string }; Returns: boolean }
      log_agent_trace: {
        Args: {
          p_agent_id: string
          p_error: string
          p_kind: string
          p_latency_ms: number
          p_lead_id: string
          p_name: string
          p_payload: Json
          p_run_id: string
          p_step: number
          p_thread_id: string
          p_tokens_in: number
          p_tokens_out: number
        }
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
      match_chunks_hybrid: {
        Args: {
          match_count?: number
          p_agent_id: string
          query_embedding: string
          query_text: string
        }
        Returns: {
          content: string
          document_id: string
          id: string
          score: number
        }[]
      }
      match_memories: {
        Args: {
          match_count?: number
          p_agent_id: string
          p_lead_id: string
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          kind: string
          similarity: number
        }[]
      }
    }
    Enums: {
      app_role: "super_admin"
      clinic_role: "owner" | "admin" | "professional" | "viewer"
      professional_type:
        | "psiquiatra"
        | "psicologo"
        | "recepcao"
        | "admin"
        | "outro"
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
    Enums: {
      app_role: ["super_admin"],
      clinic_role: ["owner", "admin", "professional", "viewer"],
      professional_type: [
        "psiquiatra",
        "psicologo",
        "recepcao",
        "admin",
        "outro",
      ],
    },
  },
} as const
