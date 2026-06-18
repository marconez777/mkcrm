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
      agent_personas: {
        Row: {
          agent_id: string | null
          channel: string
          clinic_id: string
          created_at: string
          created_by: string | null
          custom_fields: Json
          id: string
          name: string
          opening_message: string | null
          persona_text: string | null
          phone: string | null
          tags: string[]
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          channel?: string
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          id?: string
          name: string
          opening_message?: string | null
          persona_text?: string | null
          phone?: string | null
          tags?: string[]
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          channel?: string
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          id?: string
          name?: string
          opening_message?: string | null
          persona_text?: string | null
          phone?: string | null
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_personas_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_prompt_versions: {
        Row: {
          agent_id: string
          clinic_id: string
          created_at: string
          created_by: string | null
          id: string
          prompt: string
          source: string
          summary: string | null
        }
        Insert: {
          agent_id: string
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          prompt: string
          source?: string
          summary?: string | null
        }
        Update: {
          agent_id?: string
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          prompt?: string
          source?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_prompt_versions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_stages: {
        Row: {
          advance_when: string | null
          agent_id: string
          allowed_tools: string[]
          clinic_id: string
          created_at: string
          follow_up_after_min: number | null
          follow_up_message: string | null
          follow_up_tool_name: string | null
          goal: string | null
          id: string
          name: string
          order_idx: number
          system_prompt_delta: string | null
          updated_at: string
        }
        Insert: {
          advance_when?: string | null
          agent_id: string
          allowed_tools?: string[]
          clinic_id?: string
          created_at?: string
          follow_up_after_min?: number | null
          follow_up_message?: string | null
          follow_up_tool_name?: string | null
          goal?: string | null
          id?: string
          name: string
          order_idx?: number
          system_prompt_delta?: string | null
          updated_at?: string
        }
        Update: {
          advance_when?: string | null
          agent_id?: string
          allowed_tools?: string[]
          clinic_id?: string
          created_at?: string
          follow_up_after_min?: number | null
          follow_up_message?: string | null
          follow_up_tool_name?: string | null
          goal?: string | null
          id?: string
          name?: string
          order_idx?: number
          system_prompt_delta?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_stages_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
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
      ai_agent_drafts: {
        Row: {
          api_key: string | null
          base_url: string | null
          clinic_id: string
          created_at: string
          generated_prompt: string | null
          goal: string | null
          goal_other: string | null
          id: string
          interview_answers: Json
          model: string | null
          niche: string | null
          niche_other: string | null
          provider: string | null
          provider_verified_at: string | null
          settings: Json
          step: number
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key?: string | null
          base_url?: string | null
          clinic_id: string
          created_at?: string
          generated_prompt?: string | null
          goal?: string | null
          goal_other?: string | null
          id?: string
          interview_answers?: Json
          model?: string | null
          niche?: string | null
          niche_other?: string | null
          provider?: string | null
          provider_verified_at?: string | null
          settings?: Json
          step?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string | null
          base_url?: string | null
          clinic_id?: string
          created_at?: string
          generated_prompt?: string | null
          goal?: string | null
          goal_other?: string | null
          id?: string
          interview_answers?: Json
          model?: string | null
          niche?: string | null
          niche_other?: string | null
          provider?: string | null
          provider_verified_at?: string | null
          settings?: Json
          step?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_drafts_clinic_id_fkey"
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
          builder_verified_at: string | null
          clinic_id: string
          created_at: string
          debounce_seconds: number
          description: string | null
          draft_mode: boolean
          embedding_api_key: string | null
          embedding_model: string | null
          enabled: boolean
          id: string
          is_system: boolean
          max_iterations: number
          max_tool_calls: number
          model: string
          name: string
          niche: string | null
          niche_other: string | null
          planning_mode: boolean
          provider: string
          rag_top_k: number
          reranker_api_key: string | null
          reranker_provider: string | null
          role: string | null
          silent: boolean
          stages_enabled: boolean
          system_key: string | null
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
          builder_verified_at?: string | null
          clinic_id?: string
          created_at?: string
          debounce_seconds?: number
          description?: string | null
          draft_mode?: boolean
          embedding_api_key?: string | null
          embedding_model?: string | null
          enabled?: boolean
          id?: string
          is_system?: boolean
          max_iterations?: number
          max_tool_calls?: number
          model?: string
          name: string
          niche?: string | null
          niche_other?: string | null
          planning_mode?: boolean
          provider?: string
          rag_top_k?: number
          reranker_api_key?: string | null
          reranker_provider?: string | null
          role?: string | null
          silent?: boolean
          stages_enabled?: boolean
          system_key?: string | null
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
          builder_verified_at?: string | null
          clinic_id?: string
          created_at?: string
          debounce_seconds?: number
          description?: string | null
          draft_mode?: boolean
          embedding_api_key?: string | null
          embedding_model?: string | null
          enabled?: boolean
          id?: string
          is_system?: boolean
          max_iterations?: number
          max_tool_calls?: number
          model?: string
          name?: string
          niche?: string | null
          niche_other?: string | null
          planning_mode?: boolean
          provider?: string
          rag_top_k?: number
          reranker_api_key?: string | null
          reranker_provider?: string | null
          role?: string | null
          silent?: boolean
          stages_enabled?: boolean
          system_key?: string | null
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
      ai_chat_traces: {
        Row: {
          agent_id: string
          agent_message: string | null
          clinic_id: string
          created_at: string
          id: string
          kb_hits: Json
          latency_ms: number | null
          lead_id: string | null
          model: string | null
          persona_id: string | null
          source: string
          stage_meta: Json | null
          system_prompt_excerpt: string | null
          tokens_in: number | null
          tokens_out: number | null
          tool_calls: Json
          user_message: string | null
        }
        Insert: {
          agent_id: string
          agent_message?: string | null
          clinic_id: string
          created_at?: string
          id?: string
          kb_hits?: Json
          latency_ms?: number | null
          lead_id?: string | null
          model?: string | null
          persona_id?: string | null
          source?: string
          stage_meta?: Json | null
          system_prompt_excerpt?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          tool_calls?: Json
          user_message?: string | null
        }
        Update: {
          agent_id?: string
          agent_message?: string | null
          clinic_id?: string
          created_at?: string
          id?: string
          kb_hits?: Json
          latency_ms?: number | null
          lead_id?: string | null
          model?: string | null
          persona_id?: string | null
          source?: string
          stage_meta?: Json | null
          system_prompt_excerpt?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          tool_calls?: Json
          user_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_traces_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chat_traces_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "agent_personas"
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
          source_type: string
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
          source_type?: string
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
          source_type?: string
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
      ai_insights: {
        Row: {
          agent_id: string | null
          clinic_id: string
          created_at: string
          drop_off_reasons: Json
          id: string
          lead_id: string | null
          period_end: string
          period_start: string | null
          raw: Json
          recommendations: Json
          sentiment: string | null
          summary: string
          thread_id: string | null
          top_doubts: Json
          top_interests: Json
          top_objections: Json
        }
        Insert: {
          agent_id?: string | null
          clinic_id?: string
          created_at?: string
          drop_off_reasons?: Json
          id?: string
          lead_id?: string | null
          period_end?: string
          period_start?: string | null
          raw?: Json
          recommendations?: Json
          sentiment?: string | null
          summary: string
          thread_id?: string | null
          top_doubts?: Json
          top_interests?: Json
          top_objections?: Json
        }
        Update: {
          agent_id?: string | null
          clinic_id?: string
          created_at?: string
          drop_off_reasons?: Json
          id?: string
          lead_id?: string | null
          period_end?: string
          period_start?: string | null
          raw?: Json
          recommendations?: Json
          sentiment?: string | null
          summary?: string
          thread_id?: string | null
          top_doubts?: Json
          top_interests?: Json
          top_objections?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_insights_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_kb_defaults: {
        Row: {
          content: string
          created_at: string
          enabled: boolean
          id: string
          niche: string | null
          position: number
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          enabled?: boolean
          id?: string
          niche?: string | null
          position?: number
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          enabled?: boolean
          id?: string
          niche?: string | null
          position?: number
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
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
      ai_spend_events: {
        Row: {
          actor_user_id: string | null
          clinic_id: string
          created_at: string
          id: string
          kind: string
          limit_usd: number | null
          notes: string | null
          spent_usd: number | null
        }
        Insert: {
          actor_user_id?: string | null
          clinic_id: string
          created_at?: string
          id?: string
          kind: string
          limit_usd?: number | null
          notes?: string | null
          spent_usd?: number | null
        }
        Update: {
          actor_user_id?: string | null
          clinic_id?: string
          created_at?: string
          id?: string
          kind?: string
          limit_usd?: number | null
          notes?: string | null
          spent_usd?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_spend_events_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_spend_limits: {
        Row: {
          block_on_limit: boolean
          blocked: boolean
          blocked_at: string | null
          blocked_reason: string | null
          clinic_id: string
          created_at: string
          daily_limit_usd: number
          manual_override_until: string | null
          notify_emails: string[]
          notify_thresholds: number[]
          updated_at: string
        }
        Insert: {
          block_on_limit?: boolean
          blocked?: boolean
          blocked_at?: string | null
          blocked_reason?: string | null
          clinic_id: string
          created_at?: string
          daily_limit_usd?: number
          manual_override_until?: string | null
          notify_emails?: string[]
          notify_thresholds?: number[]
          updated_at?: string
        }
        Update: {
          block_on_limit?: boolean
          blocked?: boolean
          blocked_at?: string | null
          blocked_reason?: string | null
          clinic_id?: string
          created_at?: string
          daily_limit_usd?: number
          manual_override_until?: string | null
          notify_emails?: string[]
          notify_thresholds?: number[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_spend_limits_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_spend_notifications_sent: {
        Row: {
          clinic_id: string
          notify_date: string
          sent_at: string
          threshold: number
        }
        Insert: {
          clinic_id: string
          notify_date: string
          sent_at?: string
          threshold: number
        }
        Update: {
          clinic_id?: string
          notify_date?: string
          sent_at?: string
          threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_spend_notifications_sent_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
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
          cost_usd: number | null
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
          cost_usd?: number | null
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
          cost_usd?: number | null
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
      app_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          lead_id: string
          notes: string | null
          scheduled_at: string
          status: string
          updated_at: string
        }
        Insert: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          lead_id: string
          notes?: string | null
          scheduled_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          lead_id?: string
          notes?: string | null
          scheduled_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
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
      auth_lockouts: {
        Row: {
          created_at: string
          email: string
          failed_attempts: number
          last_failed_at: string | null
          locked_until: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          failed_attempts?: number
          last_failed_at?: string | null
          locked_until?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          failed_attempts?: number
          last_failed_at?: string | null
          locked_until?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      automation_runs: {
        Row: {
          appointment_at: string | null
          automation_id: string
          clinic_id: string
          created_at: string
          detail: string | null
          id: string
          lead_id: string
          status: string
        }
        Insert: {
          appointment_at?: string | null
          automation_id: string
          clinic_id?: string
          created_at?: string
          detail?: string | null
          id?: string
          lead_id: string
          status?: string
        }
        Update: {
          appointment_at?: string | null
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
      broadcast_events: {
        Row: {
          broadcast_id: string
          clinic_id: string
          created_at: string
          id: string
          payload: Json
          recipient_id: string | null
          type: string
        }
        Insert: {
          broadcast_id: string
          clinic_id: string
          created_at?: string
          id?: string
          payload?: Json
          recipient_id?: string | null
          type: string
        }
        Update: {
          broadcast_id?: string
          clinic_id?: string
          created_at?: string
          id?: string
          payload?: Json
          recipient_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_events_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "broadcasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_events_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "broadcast_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_message_groups: {
        Row: {
          broadcast_id: string
          created_at: string
          id: string
          name: string
          position: number
        }
        Insert: {
          broadcast_id: string
          created_at?: string
          id?: string
          name: string
          position: number
        }
        Update: {
          broadcast_id?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_message_groups_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "broadcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_message_parts: {
        Row: {
          content: string
          created_at: string
          group_id: string
          id: string
          position: number
        }
        Insert: {
          content: string
          created_at?: string
          group_id: string
          id?: string
          position: number
        }
        Update: {
          content?: string
          created_at?: string
          group_id?: string
          id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_message_parts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "broadcast_message_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_recipients: {
        Row: {
          broadcast_id: string
          clinic_id: string
          created_at: string
          custom: Json
          group_position: number | null
          id: string
          last_error: string | null
          lead_id: string | null
          name: string | null
          next_send_at: string
          parts_sent: number
          phone: string
          replied_at: string | null
          sent_at: string | null
          stage_id_at_send: string | null
          stage_position_at_send: number | null
          status: string
        }
        Insert: {
          broadcast_id: string
          clinic_id: string
          created_at?: string
          custom?: Json
          group_position?: number | null
          id?: string
          last_error?: string | null
          lead_id?: string | null
          name?: string | null
          next_send_at?: string
          parts_sent?: number
          phone: string
          replied_at?: string | null
          sent_at?: string | null
          stage_id_at_send?: string | null
          stage_position_at_send?: number | null
          status?: string
        }
        Update: {
          broadcast_id?: string
          clinic_id?: string
          created_at?: string
          custom?: Json
          group_position?: number | null
          id?: string
          last_error?: string | null
          lead_id?: string | null
          name?: string | null
          next_send_at?: string
          parts_sent?: number
          phone?: string
          replied_at?: string | null
          sent_at?: string | null
          stage_id_at_send?: string | null
          stage_position_at_send?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_recipients_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "broadcasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_recipients_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcasts: {
        Row: {
          audience_frozen_at: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          scheduled_at: string | null
          send_window: Json
          source: Json
          status: string
          throttle_seconds: number
          totals: Json
          updated_at: string
          whatsapp_instance_id: string | null
        }
        Insert: {
          audience_frozen_at?: string | null
          clinic_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          scheduled_at?: string | null
          send_window?: Json
          source?: Json
          status?: string
          throttle_seconds?: number
          totals?: Json
          updated_at?: string
          whatsapp_instance_id?: string | null
        }
        Update: {
          audience_frozen_at?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          scheduled_at?: string | null
          send_window?: Json
          source?: Json
          status?: string
          throttle_seconds?: number
          totals?: Json
          updated_at?: string
          whatsapp_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broadcasts_whatsapp_instance_id_fkey"
            columns: ["whatsapp_instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      builder_manual_versions: {
        Row: {
          content: string
          created_at: string
          id: string
          is_active: boolean
          published_at: string
          published_by: string | null
          source: string
          summary: string | null
          version: number
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          published_at?: string
          published_by?: string | null
          source?: string
          summary?: string | null
          version: number
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          published_at?: string
          published_by?: string | null
          source?: string
          summary?: string | null
          version?: number
        }
        Relationships: []
      }
      campaign_throughput: {
        Row: {
          campaign_id: string
          failed: number
          minute: string
          sent: number
          updated_at: string
        }
        Insert: {
          campaign_id: string
          failed?: number
          minute: string
          sent?: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          failed?: number
          minute?: string
          sent?: number
          updated_at?: string
        }
        Relationships: []
      }
      clinic_email_integrations: {
        Row: {
          clinic_id: string
          created_at: string
          enabled: boolean
          id: string
          provider: string
          secret_name: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          provider?: string
          secret_name: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          provider?: string
          secret_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_email_integrations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
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
      clinic_secrets: {
        Row: {
          clinic_id: string
          created_at: string
          openai_api_key: string | null
          openai_key_last4: string | null
          openai_last_checked_at: string | null
          openai_last_error: string | null
          openai_status: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          openai_api_key?: string | null
          openai_key_last4?: string | null
          openai_last_checked_at?: string | null
          openai_last_error?: string | null
          openai_status?: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          openai_api_key?: string | null
          openai_key_last4?: string | null
          openai_last_checked_at?: string | null
          openai_last_error?: string | null
          openai_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_secrets_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_subscriptions: {
        Row: {
          cancel_at: string | null
          canceled_at: string | null
          clinic_id: string
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          grant_reason: string | null
          granted_by: string | null
          id: string
          is_current: boolean
          metadata: Json
          plan_id: string
          source: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          cancel_at?: string | null
          canceled_at?: string | null
          clinic_id: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grant_reason?: string | null
          granted_by?: string | null
          id?: string
          is_current?: boolean
          metadata?: Json
          plan_id: string
          source?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at?: string | null
          canceled_at?: string | null
          clinic_id?: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grant_reason?: string | null
          granted_by?: string | null
          id?: string
          is_current?: boolean
          metadata?: Json
          plan_id?: string
          source?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_subscriptions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          classifier_config: Json
          created_at: string
          id: string
          name: string
          plan: string
          plan_id: string | null
          settings: Json
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          classifier_config?: Json
          created_at?: string
          id?: string
          name: string
          plan?: string
          plan_id?: string | null
          settings?: Json
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          classifier_config?: Json
          created_at?: string
          id?: string
          name?: string
          plan?: string
          plan_id?: string | null
          settings?: Json
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinics_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
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
      deleted_leads: {
        Row: {
          clinic_id: string
          deleted_at: string
          deleted_by_user_id: string | null
          id: string
          lead_id: string | null
          phone: string
          source: string
        }
        Insert: {
          clinic_id: string
          deleted_at?: string
          deleted_by_user_id?: string | null
          id?: string
          lead_id?: string | null
          phone: string
          source?: string
        }
        Update: {
          clinic_id?: string
          deleted_at?: string
          deleted_by_user_id?: string | null
          id?: string
          lead_id?: string | null
          phone?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "deleted_leads_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      eduzz_purchases: {
        Row: {
          cli_email: string | null
          cli_name: string | null
          cli_taxnumber: string | null
          clinic_id: string | null
          cnt_cod: string | null
          created_at: string
          error_msg: string | null
          fat_cod: string | null
          fat_status: number | null
          id: string
          payload: Json
          plan_code: string
          processed_status: string
          type: string
          valor: number | null
        }
        Insert: {
          cli_email?: string | null
          cli_name?: string | null
          cli_taxnumber?: string | null
          clinic_id?: string | null
          cnt_cod?: string | null
          created_at?: string
          error_msg?: string | null
          fat_cod?: string | null
          fat_status?: number | null
          id?: string
          payload?: Json
          plan_code: string
          processed_status?: string
          type: string
          valor?: number | null
        }
        Update: {
          cli_email?: string | null
          cli_name?: string | null
          cli_taxnumber?: string | null
          clinic_id?: string | null
          cnt_cod?: string | null
          created_at?: string
          error_msg?: string | null
          fat_cod?: string | null
          fat_status?: number | null
          id?: string
          payload?: Json
          plan_code?: string
          processed_status?: string
          type?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "eduzz_purchases_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      email_automation_enrollments: {
        Row: {
          automation_id: string
          clinic_id: string
          enrolled_at: string
          id: string
          lead_id: string
          recipient_email: string
          source_event: string | null
          steps_enqueued: number
        }
        Insert: {
          automation_id: string
          clinic_id: string
          enrolled_at?: string
          id?: string
          lead_id: string
          recipient_email: string
          source_event?: string | null
          steps_enqueued?: number
        }
        Update: {
          automation_id?: string
          clinic_id?: string
          enrolled_at?: string
          id?: string
          lead_id?: string
          recipient_email?: string
          source_event?: string | null
          steps_enqueued?: number
        }
        Relationships: [
          {
            foreignKeyName: "email_automation_enrollments_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "email_automations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_automations: {
        Row: {
          active: boolean
          clinic_id: string
          created_at: string
          description: string | null
          id: string
          last_run_at: string | null
          name: string
          preset_key: string | null
          steps: Json
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          clinic_id: string
          created_at?: string
          description?: string | null
          id?: string
          last_run_at?: string | null
          name: string
          preset_key?: string | null
          steps?: Json
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          clinic_id?: string
          created_at?: string
          description?: string | null
          id?: string
          last_run_at?: string | null
          name?: string
          preset_key?: string | null
          steps?: Json
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_automations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaign_variants: {
        Row: {
          campaign_id: string
          clicked_count: number
          clinic_id: string
          created_at: string
          from_name_override: string | null
          id: string
          is_winner: boolean
          label: string
          opened_count: number
          sent_count: number
          subject_override: string | null
          template_slug_override: string | null
          updated_at: string
          weight: number
        }
        Insert: {
          campaign_id: string
          clicked_count?: number
          clinic_id: string
          created_at?: string
          from_name_override?: string | null
          id?: string
          is_winner?: boolean
          label: string
          opened_count?: number
          sent_count?: number
          subject_override?: string | null
          template_slug_override?: string | null
          updated_at?: string
          weight?: number
        }
        Update: {
          campaign_id?: string
          clicked_count?: number
          clinic_id?: string
          created_at?: string
          from_name_override?: string | null
          id?: string
          is_winner?: boolean
          label?: string
          opened_count?: number
          sent_count?: number
          subject_override?: string | null
          template_slug_override?: string | null
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_variants_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          enqueued_count: number
          error: string | null
          failed_count: number
          from_domain_pool: string | null
          from_name_override: string | null
          id: string
          last_sent_at: string | null
          name: string
          scheduled_for: string | null
          segment_id: string | null
          segment_ids: string[]
          send_rate_per_minute: number | null
          sent_at: string | null
          sent_count: number
          status: string
          template_slug: string
          test_email: string | null
          test_sent_at: string | null
          total_recipients: number
          updated_at: string
          variant_strategy: string
          winner_picked_at: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          enqueued_count?: number
          error?: string | null
          failed_count?: number
          from_domain_pool?: string | null
          from_name_override?: string | null
          id?: string
          last_sent_at?: string | null
          name: string
          scheduled_for?: string | null
          segment_id?: string | null
          segment_ids?: string[]
          send_rate_per_minute?: number | null
          sent_at?: string | null
          sent_count?: number
          status?: string
          template_slug: string
          test_email?: string | null
          test_sent_at?: string | null
          total_recipients?: number
          updated_at?: string
          variant_strategy?: string
          winner_picked_at?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          enqueued_count?: number
          error?: string | null
          failed_count?: number
          from_domain_pool?: string | null
          from_name_override?: string | null
          id?: string
          last_sent_at?: string | null
          name?: string
          scheduled_for?: string | null
          segment_id?: string | null
          segment_ids?: string[]
          send_rate_per_minute?: number | null
          sent_at?: string | null
          sent_count?: number
          status?: string
          template_slug?: string
          test_email?: string | null
          test_sent_at?: string | null
          total_recipients?: number
          updated_at?: string
          variant_strategy?: string
          winner_picked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "email_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      email_domain_warmup: {
        Row: {
          clinic_id: string
          created_at: string
          current_day_window: string
          domain: string
          enabled: boolean
          id: string
          sent_today: number
          started_at: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          current_day_window?: string
          domain: string
          enabled?: boolean
          id?: string
          sent_today?: number
          started_at?: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          current_day_window?: string
          domain?: string
          enabled?: boolean
          id?: string
          sent_today?: number
          started_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_domain_warmup_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      email_domains: {
        Row: {
          clinic_id: string
          created_at: string
          dns_records: Json
          domain: string
          id: string
          last_checked_at: string | null
          region: string
          resend_domain_id: string | null
          rotation_pool: string | null
          rotation_weight: number
          status: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          dns_records?: Json
          domain: string
          id?: string
          last_checked_at?: string | null
          region?: string
          resend_domain_id?: string | null
          rotation_pool?: string | null
          rotation_weight?: number
          status?: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          dns_records?: Json
          domain?: string
          id?: string
          last_checked_at?: string | null
          region?: string
          resend_domain_id?: string | null
          rotation_pool?: string | null
          rotation_weight?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_domains_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      email_health_alerts: {
        Row: {
          action_taken: string | null
          alert_type: string
          clinic_id: string
          created_at: string
          id: string
          metric_value: number
          resolved_at: string | null
          sample_size: number
          threshold: number
        }
        Insert: {
          action_taken?: string | null
          alert_type: string
          clinic_id: string
          created_at?: string
          id?: string
          metric_value: number
          resolved_at?: string | null
          sample_size: number
          threshold: number
        }
        Update: {
          action_taken?: string | null
          alert_type?: string
          clinic_id?: string
          created_at?: string
          id?: string
          metric_value?: number
          resolved_at?: string | null
          sample_size?: number
          threshold?: number
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          bounced_at: string | null
          clicked_at: string | null
          clinic_id: string
          complained_at: string | null
          created_at: string
          delivered_at: string | null
          error: string | null
          events: Json
          from_domain_override: string | null
          id: string
          opened_at: string | null
          recipient_email: string
          related_lead_id: string | null
          related_lead_table: string | null
          resend_id: string | null
          sent_at: string
          status: string
          subject: string
          template_slug: string | null
          variant_id: string | null
        }
        Insert: {
          bounced_at?: string | null
          clicked_at?: string | null
          clinic_id: string
          complained_at?: string | null
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          events?: Json
          from_domain_override?: string | null
          id?: string
          opened_at?: string | null
          recipient_email: string
          related_lead_id?: string | null
          related_lead_table?: string | null
          resend_id?: string | null
          sent_at?: string
          status?: string
          subject: string
          template_slug?: string | null
          variant_id?: string | null
        }
        Update: {
          bounced_at?: string | null
          clicked_at?: string | null
          clinic_id?: string
          complained_at?: string | null
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          events?: Json
          from_domain_override?: string | null
          id?: string
          opened_at?: string | null
          recipient_email?: string
          related_lead_id?: string | null
          related_lead_table?: string | null
          resend_id?: string | null
          sent_at?: string
          status?: string
          subject?: string
          template_slug?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      email_metrics_daily: {
        Row: {
          bounced: number
          clicked: number
          clinic_id: string
          complained: number
          day: string
          delivered: number
          failed: number
          opened: number
          sent: number
          template_slug: string
          updated_at: string
        }
        Insert: {
          bounced?: number
          clicked?: number
          clinic_id: string
          complained?: number
          day: string
          delivered?: number
          failed?: number
          opened?: number
          sent?: number
          template_slug?: string
          updated_at?: string
        }
        Update: {
          bounced?: number
          clicked?: number
          clinic_id?: string
          complained?: number
          day?: string
          delivered?: number
          failed?: number
          opened?: number
          sent?: number
          template_slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_metrics_daily_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      email_operational_alerts: {
        Row: {
          alert_type: string
          clinic_id: string | null
          context: Json | null
          created_at: string
          id: string
          message: string
          metric_value: number | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          threshold: number | null
        }
        Insert: {
          alert_type: string
          clinic_id?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          message: string
          metric_value?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          threshold?: number | null
        }
        Update: {
          alert_type?: string
          clinic_id?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          message?: string
          metric_value?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          threshold?: number | null
        }
        Relationships: []
      }
      email_queue: {
        Row: {
          attempts: number
          clinic_id: string
          created_at: string
          error: string | null
          force_send: boolean
          from_domain_override: string | null
          from_name_override: string | null
          id: string
          priority: number
          recipient_email: string
          recipient_name: string | null
          related_lead_id: string | null
          related_lead_table: string | null
          scheduled_at: string
          sent_at: string | null
          status: string
          template_slug: string | null
          updated_at: string
          variables: Json
          variant_id: string | null
        }
        Insert: {
          attempts?: number
          clinic_id: string
          created_at?: string
          error?: string | null
          force_send?: boolean
          from_domain_override?: string | null
          from_name_override?: string | null
          id?: string
          priority?: number
          recipient_email: string
          recipient_name?: string | null
          related_lead_id?: string | null
          related_lead_table?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          template_slug?: string | null
          updated_at?: string
          variables?: Json
          variant_id?: string | null
        }
        Update: {
          attempts?: number
          clinic_id?: string
          created_at?: string
          error?: string | null
          force_send?: boolean
          from_domain_override?: string | null
          from_name_override?: string | null
          id?: string
          priority?: number
          recipient_email?: string
          recipient_name?: string | null
          related_lead_id?: string | null
          related_lead_table?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          template_slug?: string | null
          updated_at?: string
          variables?: Json
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_queue_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      email_recipient_throttle: {
        Row: {
          clinic_id: string
          dest_domain: string
          sent: number
          window_start: string
        }
        Insert: {
          clinic_id: string
          dest_domain: string
          sent?: number
          window_start: string
        }
        Update: {
          clinic_id?: string
          dest_domain?: string
          sent?: number
          window_start?: string
        }
        Relationships: []
      }
      email_segment_contacts: {
        Row: {
          added_by: string | null
          clinic_id: string
          created_at: string
          email: string
          id: string
          lead_id: string | null
          name: string | null
          segment_id: string | null
        }
        Insert: {
          added_by?: string | null
          clinic_id: string
          created_at?: string
          email: string
          id?: string
          lead_id?: string | null
          name?: string | null
          segment_id?: string | null
        }
        Update: {
          added_by?: string | null
          clinic_id?: string
          created_at?: string
          email?: string
          id?: string
          lead_id?: string | null
          name?: string | null
          segment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_segment_contacts_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "email_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      email_segments: {
        Row: {
          active: boolean
          clinic_id: string
          created_at: string
          created_by: string | null
          description: string | null
          filters: Json
          id: string
          is_system: boolean
          name: string
          source_table: string
          system_key: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          clinic_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          filters?: Json
          id?: string
          is_system?: boolean
          name: string
          source_table?: string
          system_key?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          filters?: Json
          id?: string
          is_system?: boolean
          name?: string
          source_table?: string
          system_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_segments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_dedup: {
        Row: {
          clinic_id: string
          context: string
          created_at: string
          email: string
          id: string
          resend_id: string | null
          template_slug: string
        }
        Insert: {
          clinic_id: string
          context: string
          created_at?: string
          email: string
          id?: string
          resend_id?: string | null
          template_slug: string
        }
        Update: {
          clinic_id?: string
          context?: string
          created_at?: string
          email?: string
          id?: string
          resend_id?: string | null
          template_slug?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          clinic_id: string
          quota_resets_at: string
          sent_today: number
          updated_at: string
        }
        Insert: {
          clinic_id: string
          quota_resets_at?: string
          sent_today?: number
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          quota_resets_at?: string
          sent_today?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_send_state_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      email_template_folders: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_template_folders_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          active: boolean
          blocks_json: Json | null
          category: string
          clinic_id: string
          created_at: string
          description: string | null
          folder_id: string | null
          from_email: string
          from_name: string
          html_body: string
          id: string
          is_preset: boolean
          name: string
          preheader: string | null
          preset_label: string | null
          reply_to: string | null
          slug: string
          subject: string
          text_body: string | null
          updated_at: string
          variables_schema: Json
          version: number
        }
        Insert: {
          active?: boolean
          blocks_json?: Json | null
          category?: string
          clinic_id: string
          created_at?: string
          description?: string | null
          folder_id?: string | null
          from_email: string
          from_name: string
          html_body: string
          id?: string
          is_preset?: boolean
          name: string
          preheader?: string | null
          preset_label?: string | null
          reply_to?: string | null
          slug: string
          subject: string
          text_body?: string | null
          updated_at?: string
          variables_schema?: Json
          version?: number
        }
        Update: {
          active?: boolean
          blocks_json?: Json | null
          category?: string
          clinic_id?: string
          created_at?: string
          description?: string | null
          folder_id?: string | null
          from_email?: string
          from_name?: string
          html_body?: string
          id?: string
          is_preset?: boolean
          name?: string
          preheader?: string | null
          preset_label?: string | null
          reply_to?: string | null
          slug?: string
          subject?: string
          text_body?: string | null
          updated_at?: string
          variables_schema?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "email_template_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      email_unsubscribes: {
        Row: {
          clinic_id: string
          email: string
          reason: string | null
          source: string | null
          unsubscribed_at: string
        }
        Insert: {
          clinic_id: string
          email: string
          reason?: string | null
          source?: string | null
          unsubscribed_at?: string
        }
        Update: {
          clinic_id?: string
          email?: string
          reason?: string | null
          source?: string | null
          unsubscribed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_unsubscribes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
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
      error_events: {
        Row: {
          clinic_id: string | null
          created_at: string
          error_message: string
          error_stack: string | null
          function_name: string | null
          id: string
          metadata: Json
          route: string | null
          severity: string
          surface: string
          user_id: string | null
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          error_message: string
          error_stack?: string | null
          function_name?: string | null
          id?: string
          metadata?: Json
          route?: string | null
          severity?: string
          surface: string
          user_id?: string | null
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          error_message?: string
          error_stack?: string | null
          function_name?: string | null
          id?: string
          metadata?: Json
          route?: string | null
          severity?: string
          surface?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "error_events_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_events: {
        Row: {
          action: string
          clinic_id: string | null
          created_at: string
          entity_id: string | null
          feature: string
          id: string
          metadata: Json
          user_id: string | null
        }
        Insert: {
          action: string
          clinic_id?: string | null
          created_at?: string
          entity_id?: string | null
          feature: string
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          action?: string
          clinic_id?: string | null
          created_at?: string
          entity_id?: string | null
          feature?: string
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_events_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      form_definitions: {
        Row: {
          active: boolean
          clinic_id: string
          created_at: string
          default_email_segment_id: string | null
          default_pipeline_stage_id: string | null
          default_tags: string[]
          field_map: Json
          form_key: string
          id: string
          integration_id: string
          last_submission_at: string | null
          name: string
          source_page: string | null
          total_submissions: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          clinic_id: string
          created_at?: string
          default_email_segment_id?: string | null
          default_pipeline_stage_id?: string | null
          default_tags?: string[]
          field_map?: Json
          form_key: string
          id?: string
          integration_id: string
          last_submission_at?: string | null
          name: string
          source_page?: string | null
          total_submissions?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          clinic_id?: string
          created_at?: string
          default_email_segment_id?: string | null
          default_pipeline_stage_id?: string | null
          default_tags?: string[]
          field_map?: Json
          form_key?: string
          id?: string
          integration_id?: string
          last_submission_at?: string | null
          name?: string
          source_page?: string | null
          total_submissions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_definitions_default_email_segment_id_fkey"
            columns: ["default_email_segment_id"]
            isOneToOne: false
            referencedRelation: "email_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_definitions_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "form_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      form_integrations: {
        Row: {
          allowed_domains: string[]
          clinic_id: string
          created_at: string
          created_by: string | null
          default_pipeline_stage_id: string | null
          default_tags: string[]
          id: string
          last_submission_at: string | null
          name: string
          previous_token: string | null
          previous_token_expires_at: string | null
          slug: string
          status: string
          token: string
          total_submissions: number
          updated_at: string
        }
        Insert: {
          allowed_domains?: string[]
          clinic_id: string
          created_at?: string
          created_by?: string | null
          default_pipeline_stage_id?: string | null
          default_tags?: string[]
          id?: string
          last_submission_at?: string | null
          name: string
          previous_token?: string | null
          previous_token_expires_at?: string | null
          slug: string
          status?: string
          token?: string
          total_submissions?: number
          updated_at?: string
        }
        Update: {
          allowed_domains?: string[]
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          default_pipeline_stage_id?: string | null
          default_tags?: string[]
          id?: string
          last_submission_at?: string | null
          name?: string
          previous_token?: string | null
          previous_token_expires_at?: string | null
          slug?: string
          status?: string
          token?: string
          total_submissions?: number
          updated_at?: string
        }
        Relationships: []
      }
      form_submissions: {
        Row: {
          clinic_id: string
          created_at: string
          error: string | null
          form_definition_id: string | null
          form_key: string | null
          id: string
          integration_id: string
          ip: string | null
          is_new_lead: boolean
          lead_id: string | null
          payload: Json
          source_page: string | null
          status: string
          user_agent: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          error?: string | null
          form_definition_id?: string | null
          form_key?: string | null
          id?: string
          integration_id: string
          ip?: string | null
          is_new_lead?: boolean
          lead_id?: string | null
          payload?: Json
          source_page?: string | null
          status?: string
          user_agent?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          error?: string | null
          form_definition_id?: string | null
          form_key?: string | null
          id?: string
          integration_id?: string
          ip?: string | null
          is_new_lead?: boolean
          lead_id?: string | null
          payload?: Json
          source_page?: string | null
          status?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_form_definition_id_fkey"
            columns: ["form_definition_id"]
            isOneToOne: false
            referencedRelation: "form_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "form_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_brl: number
          clinic_id: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          due_date: string | null
          id: string
          issued_at: string
          metadata: Json
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          period_end: string | null
          period_start: string | null
          plan_id: string | null
          status: string
          stripe_invoice_id: string | null
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          amount_brl?: number
          clinic_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          due_date?: string | null
          id?: string
          issued_at?: string
          metadata?: Json
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_id?: string | null
          status?: string
          stripe_invoice_id?: string | null
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_brl?: number
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          due_date?: string | null
          id?: string
          issued_at?: string
          metadata?: Json
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_id?: string | null
          status?: string
          stripe_invoice_id?: string | null
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "clinic_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_ai_settings: {
        Row: {
          agent_id: string | null
          auto_reply: boolean
          clinic_id: string | null
          created_at: string
          lead_id: string
          paused_until: string | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          auto_reply?: boolean
          clinic_id?: string | null
          created_at?: string
          lead_id: string
          paused_until?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          auto_reply?: boolean
          clinic_id?: string | null
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
          actor_user_id: string | null
          clinic_id: string
          created_at: string
          id: string
          lead_id: string
          payload: Json | null
          type: string
        }
        Insert: {
          actor_user_id?: string | null
          clinic_id?: string
          created_at?: string
          id?: string
          lead_id: string
          payload?: Json | null
          type: string
        }
        Update: {
          actor_user_id?: string | null
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
          metadata: Json
          moved_at: string
          moved_by_agent_id: string | null
          moved_by_user_id: string | null
          reason: string | null
          source: string
          to_stage_id: string | null
        }
        Insert: {
          clinic_id?: string
          from_stage_id?: string | null
          id?: string
          lead_id: string
          metadata?: Json
          moved_at?: string
          moved_by_agent_id?: string | null
          moved_by_user_id?: string | null
          reason?: string | null
          source?: string
          to_stage_id?: string | null
        }
        Update: {
          clinic_id?: string
          from_stage_id?: string | null
          id?: string
          lead_id?: string
          metadata?: Json
          moved_at?: string
          moved_by_agent_id?: string | null
          moved_by_user_id?: string | null
          reason?: string | null
          source?: string
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
      lead_thread_classifications: {
        Row: {
          agent_id: string | null
          anchor_message_id: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          id: string
          label: string
          lead_id: string
          note: string | null
          promoted_eval_id: string | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          anchor_message_id?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          lead_id: string
          note?: string | null
          promoted_eval_id?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          anchor_message_id?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          lead_id?: string
          note?: string | null
          promoted_eval_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_thread_classifications_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_thread_classifications_anchor_message_id_fkey"
            columns: ["anchor_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_thread_classifications_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_thread_classifications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_thread_classifications_promoted_eval_id_fkey"
            columns: ["promoted_eval_id"]
            isOneToOne: false
            referencedRelation: "agent_evals"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ai_review_queued_at: string | null
          ai_review_reasons: string[]
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
          fbclid: string | null
          form_source: string | null
          gclid: string | null
          id: string
          is_internal_contact: boolean
          landing_page: string | null
          last_classified_at: string | null
          last_human_activity_at: string | null
          last_message_at: string | null
          last_message_preview: string | null
          last_site_activity_at: string | null
          manual_lock_until: string | null
          marked_unread: boolean
          name: string | null
          needs_ai_review: boolean
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
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          whatsapp_instance_id: string | null
        }
        Insert: {
          ai_review_queued_at?: string | null
          ai_review_reasons?: string[]
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
          fbclid?: string | null
          form_source?: string | null
          gclid?: string | null
          id?: string
          is_internal_contact?: boolean
          landing_page?: string | null
          last_classified_at?: string | null
          last_human_activity_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          last_site_activity_at?: string | null
          manual_lock_until?: string | null
          marked_unread?: boolean
          name?: string | null
          needs_ai_review?: boolean
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
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp_instance_id?: string | null
        }
        Update: {
          ai_review_queued_at?: string | null
          ai_review_reasons?: string[]
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
          fbclid?: string | null
          form_source?: string | null
          gclid?: string | null
          id?: string
          is_internal_contact?: boolean
          landing_page?: string | null
          last_classified_at?: string | null
          last_human_activity_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          last_site_activity_at?: string | null
          manual_lock_until?: string | null
          marked_unread?: boolean
          name?: string | null
          needs_ai_review?: boolean
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
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
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
      message_sequence_enrollments: {
        Row: {
          clinic_id: string
          current_step: number
          ended_at: string | null
          id: string
          lead_id: string
          next_run_at: string | null
          sequence_id: string
          source: Json | null
          started_at: string
          status: string
        }
        Insert: {
          clinic_id?: string
          current_step?: number
          ended_at?: string | null
          id?: string
          lead_id: string
          next_run_at?: string | null
          sequence_id: string
          source?: Json | null
          started_at?: string
          status?: string
        }
        Update: {
          clinic_id?: string
          current_step?: number
          ended_at?: string | null
          id?: string
          lead_id?: string
          next_run_at?: string | null
          sequence_id?: string
          source?: Json | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_sequence_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "message_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      message_sequence_runs: {
        Row: {
          clinic_id: string
          created_at: string
          detail: string | null
          enrollment_id: string
          id: string
          message_id: string | null
          replied_at: string | null
          stage_id_at_send: string | null
          stage_position_at_send: number | null
          status: string
          step_id: string | null
        }
        Insert: {
          clinic_id?: string
          created_at?: string
          detail?: string | null
          enrollment_id: string
          id?: string
          message_id?: string | null
          replied_at?: string | null
          stage_id_at_send?: string | null
          stage_position_at_send?: number | null
          status: string
          step_id?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          detail?: string | null
          enrollment_id?: string
          id?: string
          message_id?: string | null
          replied_at?: string | null
          stage_id_at_send?: string | null
          stage_position_at_send?: number | null
          status?: string
          step_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_sequence_runs_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "message_sequence_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      message_sequence_steps: {
        Row: {
          clinic_id: string
          content: string | null
          created_at: string
          delay_minutes: number
          id: string
          position: number
          send_window: Json | null
          sequence_id: string
          template_id: string | null
        }
        Insert: {
          clinic_id?: string
          content?: string | null
          created_at?: string
          delay_minutes?: number
          id?: string
          position?: number
          send_window?: Json | null
          sequence_id: string
          template_id?: string | null
        }
        Update: {
          clinic_id?: string
          content?: string | null
          created_at?: string
          delay_minutes?: number
          id?: string
          position?: number
          send_window?: Json | null
          sequence_id?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_sequence_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "message_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      message_sequences: {
        Row: {
          clinic_id: string
          cooldown_days: number
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          name: string
          public_token: string
          stop_on_reply: boolean
          trigger_config: Json
          trigger_type: string
          updated_at: string
          whatsapp_instance_id: string | null
        }
        Insert: {
          clinic_id?: string
          cooldown_days?: number
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          name: string
          public_token?: string
          stop_on_reply?: boolean
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
          whatsapp_instance_id?: string | null
        }
        Update: {
          clinic_id?: string
          cooldown_days?: number
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          name?: string
          public_token?: string
          stop_on_reply?: boolean
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
          whatsapp_instance_id?: string | null
        }
        Relationships: []
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
          bot_agent_id: string | null
          client_message_id: string | null
          clinic_id: string
          content: string | null
          created_at: string
          delivery_status: string | null
          external_id: string | null
          from_me: boolean
          id: string
          is_auto_reply: boolean
          is_automated: boolean
          last_error: string | null
          lead_id: string
          media_mime: string | null
          media_url: string | null
          message_type: string
          needs_audio_transcription: boolean
          raw: Json | null
          reply_to_external_id: string | null
          retry_count: number
          status: string
          timestamp: string
          transcript: string | null
          transcript_cost_usd: number | null
          transcript_status: string | null
          vision_processed: boolean
        }
        Insert: {
          bot_agent_id?: string | null
          client_message_id?: string | null
          clinic_id?: string
          content?: string | null
          created_at?: string
          delivery_status?: string | null
          external_id?: string | null
          from_me?: boolean
          id?: string
          is_auto_reply?: boolean
          is_automated?: boolean
          last_error?: string | null
          lead_id: string
          media_mime?: string | null
          media_url?: string | null
          message_type?: string
          needs_audio_transcription?: boolean
          raw?: Json | null
          reply_to_external_id?: string | null
          retry_count?: number
          status?: string
          timestamp?: string
          transcript?: string | null
          transcript_cost_usd?: number | null
          transcript_status?: string | null
          vision_processed?: boolean
        }
        Update: {
          bot_agent_id?: string | null
          client_message_id?: string | null
          clinic_id?: string
          content?: string | null
          created_at?: string
          delivery_status?: string | null
          external_id?: string | null
          from_me?: boolean
          id?: string
          is_auto_reply?: boolean
          is_automated?: boolean
          last_error?: string | null
          lead_id?: string
          media_mime?: string | null
          media_url?: string | null
          message_type?: string
          needs_audio_transcription?: boolean
          raw?: Json | null
          reply_to_external_id?: string | null
          retry_count?: number
          status?: string
          timestamp?: string
          transcript?: string | null
          transcript_cost_usd?: number | null
          transcript_status?: string | null
          vision_processed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "messages_bot_agent_id_fkey"
            columns: ["bot_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
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
      payment_receipts: {
        Row: {
          clinic_id: string
          created_at: string
          file_path: string
          id: string
          invoice_id: string
          uploaded_by: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          file_path: string
          id?: string
          invoice_id: string
          uploaded_by?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          file_path?: string
          id?: string
          invoice_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_receipts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_receipts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_replies: {
        Row: {
          agent_id: string
          attempts: number
          claimed_at: string | null
          clinic_id: string
          created_at: string
          last_error: string | null
          lead_id: string
          run_at: string
          status: string
        }
        Insert: {
          agent_id: string
          attempts?: number
          claimed_at?: string | null
          clinic_id?: string
          created_at?: string
          last_error?: string | null
          lead_id: string
          run_at: string
          status?: string
        }
        Update: {
          agent_id?: string
          attempts?: number
          claimed_at?: string | null
          clinic_id?: string
          created_at?: string
          last_error?: string | null
          lead_id?: string
          run_at?: string
          status?: string
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
          is_terminal: boolean
          lock_auto_move: boolean
          name: string
          pipeline_id: string
          position: number
        }
        Insert: {
          clinic_id?: string
          color?: string
          created_at?: string
          id?: string
          is_terminal?: boolean
          lock_auto_move?: boolean
          name: string
          pipeline_id: string
          position: number
        }
        Update: {
          clinic_id?: string
          color?: string
          created_at?: string
          id?: string
          is_terminal?: boolean
          lock_auto_move?: boolean
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
          is_system: boolean
          kind: string
          name: string
          position: number
          system_key: string | null
          updated_at: string
          whatsapp_instance_id: string | null
        }
        Insert: {
          clinic_id?: string
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean
          is_system?: boolean
          kind?: string
          name: string
          position?: number
          system_key?: string | null
          updated_at?: string
          whatsapp_instance_id?: string | null
        }
        Update: {
          clinic_id?: string
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean
          is_system?: boolean
          kind?: string
          name?: string
          position?: number
          system_key?: string | null
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
      plan_change_log: {
        Row: {
          changed_by: string | null
          clinic_id: string
          created_at: string
          from_plan_id: string | null
          from_status: string | null
          id: string
          metadata: Json
          reason: string | null
          source: string | null
          subscription_id: string | null
          to_plan_id: string | null
          to_status: string | null
        }
        Insert: {
          changed_by?: string | null
          clinic_id: string
          created_at?: string
          from_plan_id?: string | null
          from_status?: string | null
          id?: string
          metadata?: Json
          reason?: string | null
          source?: string | null
          subscription_id?: string | null
          to_plan_id?: string | null
          to_status?: string | null
        }
        Update: {
          changed_by?: string | null
          clinic_id?: string
          created_at?: string
          from_plan_id?: string | null
          from_status?: string | null
          id?: string
          metadata?: Json
          reason?: string | null
          source?: string | null
          subscription_id?: string | null
          to_plan_id?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_change_log_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_change_log_from_plan_id_fkey"
            columns: ["from_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_change_log_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "clinic_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_change_log_to_plan_id_fkey"
            columns: ["to_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          code: string
          created_at: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          is_public: boolean
          limits: Json
          name: string
          price_monthly_brl: number
          price_yearly_brl: number
          sort_order: number
          stripe_price_id_monthly: string | null
          stripe_price_id_yearly: string | null
          stripe_product_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          is_public?: boolean
          limits?: Json
          name: string
          price_monthly_brl?: number
          price_yearly_brl?: number
          sort_order?: number
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          stripe_product_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          is_public?: boolean
          limits?: Json
          name?: string
          price_monthly_brl?: number
          price_yearly_brl?: number
          sort_order?: number
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          stripe_product_id?: string | null
          updated_at?: string
        }
        Relationships: []
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
      resend_webhook_events: {
        Row: {
          event_type: string | null
          received_at: string
          resend_id: string | null
          svix_id: string
        }
        Insert: {
          event_type?: string | null
          received_at?: string
          resend_id?: string | null
          svix_id: string
        }
        Update: {
          event_type?: string | null
          received_at?: string
          resend_id?: string | null
          svix_id?: string
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
      scheduled_report_runs: {
        Row: {
          clinic_id: string
          created_at: string
          error: string | null
          id: string
          message_preview: string | null
          metrics: Json | null
          report_id: string
          status: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          error?: string | null
          id?: string
          message_preview?: string | null
          metrics?: Json | null
          report_id: string
          status: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          error?: string | null
          id?: string
          message_preview?: string | null
          metrics?: Json | null
          report_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_report_runs_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "scheduled_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_reports: {
        Row: {
          clinic_id: string
          created_at: string
          enabled: boolean
          group_jid: string
          group_name: string | null
          id: string
          instance_id: string
          last_error: string | null
          last_sent_at: string | null
          last_status: string | null
          metrics: Json
          name: string
          send_time: string
          tz: string
          updated_at: string
          weekdays: number[]
        }
        Insert: {
          clinic_id?: string
          created_at?: string
          enabled?: boolean
          group_jid: string
          group_name?: string | null
          id?: string
          instance_id: string
          last_error?: string | null
          last_sent_at?: string | null
          last_status?: string | null
          metrics?: Json
          name?: string
          send_time?: string
          tz?: string
          updated_at?: string
          weekdays?: number[]
        }
        Update: {
          clinic_id?: string
          created_at?: string
          enabled?: boolean
          group_jid?: string
          group_name?: string | null
          id?: string
          instance_id?: string
          last_error?: string | null
          last_sent_at?: string | null
          last_status?: string | null
          metrics?: Json
          name?: string
          send_time?: string
          tz?: string
          updated_at?: string
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_reports_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
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
          stage_id: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          auto_reply?: boolean
          stage_id: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          auto_reply?: boolean
          stage_id?: string
          updated_at?: string
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
      support_agent_config: {
        Row: {
          api_key: string | null
          created_at: string
          embedding_model: string
          enabled: boolean
          id: string
          kb_synced_at: string | null
          max_iterations: number
          model: string
          monthly_cap_usd: number
          provider: string
          singleton: boolean
          system_prompt: string
          temperature: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_key?: string | null
          created_at?: string
          embedding_model?: string
          enabled?: boolean
          id?: string
          kb_synced_at?: string | null
          max_iterations?: number
          model?: string
          monthly_cap_usd?: number
          provider?: string
          singleton?: boolean
          system_prompt?: string
          temperature?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_key?: string | null
          created_at?: string
          embedding_model?: string
          enabled?: boolean
          id?: string
          kb_synced_at?: string | null
          max_iterations?: number
          model?: string
          monthly_cap_usd?: number
          provider?: string
          singleton?: boolean
          system_prompt?: string
          temperature?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      support_chat_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          message_id: string | null
          payload: Json
          route: string | null
          thread_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          message_id?: string | null
          payload?: Json
          route?: string | null
          thread_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          message_id?: string | null
          payload?: Json
          route?: string | null
          thread_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_chat_events_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "support_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_chat_events_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "support_chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      support_chat_messages: {
        Row: {
          content: string
          cost_usd: number
          created_at: string
          id: string
          latency_ms: number | null
          pinned_at: string | null
          pinned_by: string | null
          pinned_note: string | null
          pinned_resolved: boolean
          role: string
          runtime_errors: Json | null
          screen_context: Json | null
          thread_id: string
          tokens_in: number
          tokens_out: number
          tool_args: Json | null
          tool_name: string | null
          tool_result: Json | null
        }
        Insert: {
          content?: string
          cost_usd?: number
          created_at?: string
          id?: string
          latency_ms?: number | null
          pinned_at?: string | null
          pinned_by?: string | null
          pinned_note?: string | null
          pinned_resolved?: boolean
          role: string
          runtime_errors?: Json | null
          screen_context?: Json | null
          thread_id: string
          tokens_in?: number
          tokens_out?: number
          tool_args?: Json | null
          tool_name?: string | null
          tool_result?: Json | null
        }
        Update: {
          content?: string
          cost_usd?: number
          created_at?: string
          id?: string
          latency_ms?: number | null
          pinned_at?: string | null
          pinned_by?: string | null
          pinned_note?: string | null
          pinned_resolved?: boolean
          role?: string
          runtime_errors?: Json | null
          screen_context?: Json | null
          thread_id?: string
          tokens_in?: number
          tokens_out?: number
          tool_args?: Json | null
          tool_name?: string | null
          tool_result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "support_chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "support_chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      support_chat_threads: {
        Row: {
          clinic_id: string | null
          created_at: string
          id: string
          last_route: string | null
          resolved: boolean
          taken_over_at: string | null
          taken_over_by: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          id?: string
          last_route?: string | null
          resolved?: boolean
          taken_over_at?: string | null
          taken_over_by?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          id?: string
          last_route?: string | null
          resolved?: boolean
          taken_over_at?: string | null
          taken_over_by?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_chat_threads_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      support_documents: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          embedding: string | null
          hash: string
          id: string
          metadata: Json
          path: string
          title: string | null
          updated_at: string
        }
        Insert: {
          chunk_index?: number
          content: string
          created_at?: string
          embedding?: string | null
          hash: string
          id?: string
          metadata?: Json
          path: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          embedding?: string | null
          hash?: string
          id?: string
          metadata?: Json
          path?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      support_feedback: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          message_id: string
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          message_id: string
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          message_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "support_chat_messages"
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
      tracking_events: {
        Row: {
          clinic_id: string
          created_at: string
          event_id: string
          event_name: string
          event_time: string
          event_type: string
          id: string
          lead_id: string | null
          page_path: string | null
          page_title: string | null
          page_url: string | null
          properties: Json
          referrer: string | null
          session_id: string | null
          visitor_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          event_id: string
          event_name: string
          event_time?: string
          event_type?: string
          id?: string
          lead_id?: string | null
          page_path?: string | null
          page_title?: string | null
          page_url?: string | null
          properties?: Json
          referrer?: string | null
          session_id?: string | null
          visitor_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          event_id?: string
          event_name?: string
          event_time?: string
          event_type?: string
          id?: string
          lead_id?: string | null
          page_path?: string | null
          page_title?: string | null
          page_url?: string | null
          properties?: Json
          referrer?: string | null
          session_id?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      tracking_identity_links: {
        Row: {
          clinic_id: string
          created_at: string
          email_hash: string | null
          id: string
          lead_id: string
          link_source: string | null
          linked_at: string
          phone_hash: string | null
          updated_at: string
          visitor_id: string
          whatsapp_id: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          email_hash?: string | null
          id?: string
          lead_id: string
          link_source?: string | null
          linked_at?: string
          phone_hash?: string | null
          updated_at?: string
          visitor_id: string
          whatsapp_id?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          email_hash?: string | null
          id?: string
          lead_id?: string
          link_source?: string | null
          linked_at?: string
          phone_hash?: string | null
          updated_at?: string
          visitor_id?: string
          whatsapp_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tracking_identity_links_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_identity_links_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_lead_sources: {
        Row: {
          campaign: string | null
          channel_group: string | null
          clinic_id: string
          confidence_score: number | null
          content: string | null
          conversion_page: string | null
          created_at: string
          ctwa_clid: string | null
          fbc: string | null
          fbclid: string | null
          fbp: string | null
          gbraid: string | null
          gclid: string | null
          id: string
          landing_page: string | null
          lead_id: string
          li_fat_id: string | null
          medium: string | null
          msclkid: string | null
          raw_params: Json | null
          referrer: string | null
          session_id: string | null
          source: string | null
          source_type: string
          term: string | null
          ttclid: string | null
          visitor_id: string
          wbraid: string | null
        }
        Insert: {
          campaign?: string | null
          channel_group?: string | null
          clinic_id: string
          confidence_score?: number | null
          content?: string | null
          conversion_page?: string | null
          created_at?: string
          ctwa_clid?: string | null
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          gbraid?: string | null
          gclid?: string | null
          id?: string
          landing_page?: string | null
          lead_id: string
          li_fat_id?: string | null
          medium?: string | null
          msclkid?: string | null
          raw_params?: Json | null
          referrer?: string | null
          session_id?: string | null
          source?: string | null
          source_type: string
          term?: string | null
          ttclid?: string | null
          visitor_id: string
          wbraid?: string | null
        }
        Update: {
          campaign?: string | null
          channel_group?: string | null
          clinic_id?: string
          confidence_score?: number | null
          content?: string | null
          conversion_page?: string | null
          created_at?: string
          ctwa_clid?: string | null
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          gbraid?: string | null
          gclid?: string | null
          id?: string
          landing_page?: string | null
          lead_id?: string
          li_fat_id?: string | null
          medium?: string | null
          msclkid?: string | null
          raw_params?: Json | null
          referrer?: string | null
          session_id?: string | null
          source?: string | null
          source_type?: string
          term?: string | null
          ttclid?: string | null
          visitor_id?: string
          wbraid?: string | null
        }
        Relationships: []
      }
      tracking_sessions: {
        Row: {
          attribution_reason: string | null
          browser: string | null
          campaign: string | null
          channel_group: string | null
          clinic_id: string
          confidence_score: number | null
          created_at: string
          ctwa_clid: string | null
          device_type: string | null
          ended_at: string | null
          fbc: string | null
          fbclid: string | null
          fbp: string | null
          gbraid: string | null
          gclid: string | null
          id: string
          ip_hash: string | null
          landing_page: string | null
          li_fat_id: string | null
          medium: string | null
          msclkid: string | null
          operating_system: string | null
          raw_params: Json | null
          raw_querystring: string | null
          raw_referrer: string | null
          referrer: string | null
          session_id: string
          source: string | null
          started_at: string
          ttclid: string | null
          updated_at: string
          user_agent: string | null
          utm_content: string | null
          utm_term: string | null
          visitor_id: string
          wbraid: string | null
        }
        Insert: {
          attribution_reason?: string | null
          browser?: string | null
          campaign?: string | null
          channel_group?: string | null
          clinic_id: string
          confidence_score?: number | null
          created_at?: string
          ctwa_clid?: string | null
          device_type?: string | null
          ended_at?: string | null
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          gbraid?: string | null
          gclid?: string | null
          id?: string
          ip_hash?: string | null
          landing_page?: string | null
          li_fat_id?: string | null
          medium?: string | null
          msclkid?: string | null
          operating_system?: string | null
          raw_params?: Json | null
          raw_querystring?: string | null
          raw_referrer?: string | null
          referrer?: string | null
          session_id: string
          source?: string | null
          started_at?: string
          ttclid?: string | null
          updated_at?: string
          user_agent?: string | null
          utm_content?: string | null
          utm_term?: string | null
          visitor_id: string
          wbraid?: string | null
        }
        Update: {
          attribution_reason?: string | null
          browser?: string | null
          campaign?: string | null
          channel_group?: string | null
          clinic_id?: string
          confidence_score?: number | null
          created_at?: string
          ctwa_clid?: string | null
          device_type?: string | null
          ended_at?: string | null
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          gbraid?: string | null
          gclid?: string | null
          id?: string
          ip_hash?: string | null
          landing_page?: string | null
          li_fat_id?: string | null
          medium?: string | null
          msclkid?: string | null
          operating_system?: string | null
          raw_params?: Json | null
          raw_querystring?: string | null
          raw_referrer?: string | null
          referrer?: string | null
          session_id?: string
          source?: string | null
          started_at?: string
          ttclid?: string | null
          updated_at?: string
          user_agent?: string | null
          utm_content?: string | null
          utm_term?: string | null
          visitor_id?: string
          wbraid?: string | null
        }
        Relationships: []
      }
      tracking_visitors: {
        Row: {
          browser: string | null
          clinic_id: string
          consent_status: string
          created_at: string
          device_type: string | null
          first_campaign: string | null
          first_landing_page: string | null
          first_medium: string | null
          first_referrer: string | null
          first_seen_at: string
          first_source: string | null
          id: string
          last_campaign: string | null
          last_channel_group: string | null
          last_medium: string | null
          last_non_direct_at: string | null
          last_non_direct_campaign: string | null
          last_non_direct_channel_group: string | null
          last_non_direct_medium: string | null
          last_non_direct_source: string | null
          last_seen_at: string
          last_seen_attribution_at: string | null
          last_source: string | null
          operating_system: string | null
          updated_at: string
          visitor_id: string
        }
        Insert: {
          browser?: string | null
          clinic_id: string
          consent_status?: string
          created_at?: string
          device_type?: string | null
          first_campaign?: string | null
          first_landing_page?: string | null
          first_medium?: string | null
          first_referrer?: string | null
          first_seen_at?: string
          first_source?: string | null
          id?: string
          last_campaign?: string | null
          last_channel_group?: string | null
          last_medium?: string | null
          last_non_direct_at?: string | null
          last_non_direct_campaign?: string | null
          last_non_direct_channel_group?: string | null
          last_non_direct_medium?: string | null
          last_non_direct_source?: string | null
          last_seen_at?: string
          last_seen_attribution_at?: string | null
          last_source?: string | null
          operating_system?: string | null
          updated_at?: string
          visitor_id: string
        }
        Update: {
          browser?: string | null
          clinic_id?: string
          consent_status?: string
          created_at?: string
          device_type?: string | null
          first_campaign?: string | null
          first_landing_page?: string | null
          first_medium?: string | null
          first_referrer?: string | null
          first_seen_at?: string
          first_source?: string | null
          id?: string
          last_campaign?: string | null
          last_channel_group?: string | null
          last_medium?: string | null
          last_non_direct_at?: string | null
          last_non_direct_campaign?: string | null
          last_non_direct_channel_group?: string | null
          last_non_direct_medium?: string | null
          last_non_direct_source?: string | null
          last_seen_at?: string
          last_seen_attribution_at?: string | null
          last_source?: string | null
          operating_system?: string | null
          updated_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      traffic_source_rules: {
        Row: {
          active: boolean
          channel_group: string | null
          clinic_id: string | null
          created_at: string
          id: string
          input_medium: string | null
          input_source: string | null
          match_type: string
          normalized_medium: string | null
          normalized_source: string | null
          priority: number
        }
        Insert: {
          active?: boolean
          channel_group?: string | null
          clinic_id?: string | null
          created_at?: string
          id?: string
          input_medium?: string | null
          input_source?: string | null
          match_type: string
          normalized_medium?: string | null
          normalized_source?: string | null
          priority?: number
        }
        Update: {
          active?: boolean
          channel_group?: string | null
          clinic_id?: string | null
          created_at?: string
          id?: string
          input_medium?: string | null
          input_source?: string | null
          match_type?: string
          normalized_medium?: string | null
          normalized_source?: string | null
          priority?: number
        }
        Relationships: []
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
          auto_logout_count: number
          auto_restart_count: number
          clinic_id: string
          connection_state: string | null
          created_at: string
          evolution_api_key: string
          evolution_instance: string
          evolution_url: string
          id: string
          is_default: boolean
          last_auto_logout_at: string | null
          last_auto_restart_at: string | null
          last_backfill_at: string | null
          last_backfill_imported: number | null
          last_health_check: string | null
          last_inbound_webhook_at: string | null
          last_poll_at: string | null
          last_reconnect_at: string | null
          name: string
          session_stale_since: string | null
          updated_at: string
          watcher_agent_id: string | null
          watcher_pipeline_id: string | null
          webhook_last_error: string | null
          webhook_last_set_at: string | null
          webhook_ok: boolean | null
          webhook_token: string
        }
        Insert: {
          auto_logout_count?: number
          auto_restart_count?: number
          clinic_id?: string
          connection_state?: string | null
          created_at?: string
          evolution_api_key: string
          evolution_instance: string
          evolution_url: string
          id?: string
          is_default?: boolean
          last_auto_logout_at?: string | null
          last_auto_restart_at?: string | null
          last_backfill_at?: string | null
          last_backfill_imported?: number | null
          last_health_check?: string | null
          last_inbound_webhook_at?: string | null
          last_poll_at?: string | null
          last_reconnect_at?: string | null
          name: string
          session_stale_since?: string | null
          updated_at?: string
          watcher_agent_id?: string | null
          watcher_pipeline_id?: string | null
          webhook_last_error?: string | null
          webhook_last_set_at?: string | null
          webhook_ok?: boolean | null
          webhook_token?: string
        }
        Update: {
          auto_logout_count?: number
          auto_restart_count?: number
          clinic_id?: string
          connection_state?: string | null
          created_at?: string
          evolution_api_key?: string
          evolution_instance?: string
          evolution_url?: string
          id?: string
          is_default?: boolean
          last_auto_logout_at?: string | null
          last_auto_restart_at?: string | null
          last_backfill_at?: string | null
          last_backfill_imported?: number | null
          last_health_check?: string | null
          last_inbound_webhook_at?: string | null
          last_poll_at?: string | null
          last_reconnect_at?: string | null
          name?: string
          session_stale_since?: string | null
          updated_at?: string
          watcher_agent_id?: string | null
          watcher_pipeline_id?: string | null
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
      whatsapp_intents: {
        Row: {
          campaign: string | null
          clicked_at: string
          clinic_id: string
          created_at: string
          id: string
          landing_page: string | null
          lead_id: string | null
          matched_at: string | null
          medium: string | null
          phone_destination: string | null
          referrer: string | null
          session_id: string | null
          source: string | null
          status: string
          tracking_code: string
          updated_at: string
          user_agent: string | null
          utm_content: string | null
          utm_term: string | null
          visitor_id: string | null
        }
        Insert: {
          campaign?: string | null
          clicked_at?: string
          clinic_id: string
          created_at?: string
          id?: string
          landing_page?: string | null
          lead_id?: string | null
          matched_at?: string | null
          medium?: string | null
          phone_destination?: string | null
          referrer?: string | null
          session_id?: string | null
          source?: string | null
          status?: string
          tracking_code: string
          updated_at?: string
          user_agent?: string | null
          utm_content?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Update: {
          campaign?: string | null
          clicked_at?: string
          clinic_id?: string
          created_at?: string
          id?: string
          landing_page?: string | null
          lead_id?: string | null
          matched_at?: string | null
          medium?: string | null
          phone_destination?: string | null
          referrer?: string | null
          session_id?: string | null
          source?: string | null
          status?: string
          tracking_code?: string
          updated_at?: string
          user_agent?: string | null
          utm_content?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_intents_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_intents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      ai_usage_daily: {
        Row: {
          agent_id: string | null
          avg_latency_ms: number | null
          calls: number | null
          clinic_id: string | null
          cost_usd: number | null
          day: string | null
          errors: number | null
          input_tokens: number | null
          model: string | null
          operation: string | null
          output_tokens: number | null
          total_tokens: number | null
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
      email_system_health: {
        Row: {
          active_alerts: number | null
          computed_at: string | null
          global_failed_today: number | null
          global_pending: number | null
          global_processing: number | null
          global_sent_today: number | null
          global_stuck: number | null
          health_alerts_24h: number | null
        }
        Relationships: []
      }
      email_throughput_stats: {
        Row: {
          bounce_rate_pct: number | null
          bounced_today: number | null
          cancelled_today: number | null
          clicked_today: number | null
          clinic_id: string | null
          complained_today: number | null
          complaint_rate_pct: number | null
          computed_at: string | null
          failed_today: number | null
          newest_pending_at: string | null
          oldest_pending_at: string | null
          opened_today: number | null
          pending_count: number | null
          processing_count: number | null
          sent_today: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _email_segment_filters_to_where: {
        Args: { _filters: Json }
        Returns: string
      }
      _email_segment_rule_to_sql: { Args: { _rule: Json }; Returns: string }
      accept_clinic_invite: { Args: { _token: string }; Returns: string }
      admin_clinic_usage: { Args: { _clinic: string }; Returns: Json }
      admin_daily_metrics: {
        Args: { _days?: number }
        Returns: {
          ai_cost_usd: number
          day: string
          leads: number
          messages: number
        }[]
      }
      admin_dead_features: {
        Args: { _days?: number }
        Returns: {
          feature: string
          last_event: string
          total_events: number
        }[]
      }
      admin_error_summary: {
        Args: { _days?: number }
        Returns: {
          count: number
          day: string
          severity: string
          surface: string
        }[]
      }
      admin_feature_usage: {
        Args: { _days?: number }
        Returns: {
          clinics: number
          day: string
          events: number
          feature: string
          users: number
        }[]
      }
      admin_finance_kpis: { Args: never; Returns: Json }
      admin_get_ai_agent: {
        Args: { _id: string }
        Returns: {
          api_key: string | null
          base_url: string | null
          builder_verified_at: string | null
          clinic_id: string
          created_at: string
          debounce_seconds: number
          description: string | null
          draft_mode: boolean
          embedding_api_key: string | null
          embedding_model: string | null
          enabled: boolean
          id: string
          is_system: boolean
          max_iterations: number
          max_tool_calls: number
          model: string
          name: string
          niche: string | null
          niche_other: string | null
          planning_mode: boolean
          provider: string
          rag_top_k: number
          reranker_api_key: string | null
          reranker_provider: string | null
          role: string | null
          silent: boolean
          stages_enabled: boolean
          system_key: string | null
          system_prompt: string
          temperature: number
          tools: Json
          updated_at: string
          use_hybrid_search: boolean
          use_hyde: boolean
          use_memory: boolean
        }[]
        SetofOptions: {
          from: "*"
          to: "ai_agents"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_get_last_seen: {
        Args: { _user_ids: string[] }
        Returns: {
          last_seen_at: string
          user_id: string
        }[]
      }
      admin_list_agent_mcp_servers: {
        Args: { _agent_id: string }
        Returns: {
          agent_id: string
          clinic_id: string
          created_at: string
          enabled: boolean
          headers: Json
          id: string
          name: string
          url: string
        }[]
        SetofOptions: {
          from: "*"
          to: "agent_mcp_servers"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_ai_agents: {
        Args: never
        Returns: {
          api_key: string | null
          base_url: string | null
          builder_verified_at: string | null
          clinic_id: string
          created_at: string
          debounce_seconds: number
          description: string | null
          draft_mode: boolean
          embedding_api_key: string | null
          embedding_model: string | null
          enabled: boolean
          id: string
          is_system: boolean
          max_iterations: number
          max_tool_calls: number
          model: string
          name: string
          niche: string | null
          niche_other: string | null
          planning_mode: boolean
          provider: string
          rag_top_k: number
          reranker_api_key: string | null
          reranker_provider: string | null
          role: string | null
          silent: boolean
          stages_enabled: boolean
          system_key: string | null
          system_prompt: string
          temperature: number
          tools: Json
          updated_at: string
          use_hybrid_search: boolean
          use_hyde: boolean
          use_memory: boolean
        }[]
        SetofOptions: {
          from: "*"
          to: "ai_agents"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_overdue_list: {
        Args: never
        Returns: {
          amount_brl: number
          clinic_id: string
          clinic_name: string
          days_overdue: number
          description: string
          due_date: string
          invoice_id: string
        }[]
      }
      admin_overview_metrics: { Args: never; Returns: Json }
      admin_plan_distribution: {
        Args: never
        Returns: {
          clinics_count: number
          plan_code: string
          plan_name: string
          price_monthly: number
        }[]
      }
      admin_revenue_timeseries: {
        Args: { _months?: number }
        Returns: {
          invoices_paid: number
          month: string
          revenue: number
        }[]
      }
      admin_top_clinics: {
        Args: { _limit?: number }
        Returns: {
          ai_cost_usd_30d: number
          clinic_id: string
          clinic_name: string
          leads_30d: number
          messages_30d: number
        }[]
      }
      apply_reclassify_proposal: {
        Args: { _proposal_id: string }
        Returns: Json
      }
      broadcast_freeze_audience: {
        Args: {
          _broadcast_id: string
          _extra_contacts?: Json
          _pipeline_id: string
          _stage_ids: string[]
        }
        Returns: number
      }
      broadcast_mark_replied: {
        Args: { _clinic_id: string; _phone: string }
        Returns: undefined
      }
      cancel_pending_emails_for: {
        Args: { _clinic_id: string; _email: string }
        Returns: number
      }
      check_ai_spend_status: { Args: { p_clinic_id: string }; Returns: Json }
      check_email_operational_health: { Args: never; Returns: undefined }
      check_login_lockout: {
        Args: { _email: string }
        Returns: {
          failed_attempts: number
          locked: boolean
          retry_after_seconds: number
        }[]
      }
      claim_domain_warmup: {
        Args: { _clinic_id: string; _domain: string }
        Returns: {
          allowed: boolean
          daily_cap: number
          sent_today: number
        }[]
      }
      claim_email_quota: {
        Args: { _clinic_id: string }
        Returns: {
          allowed: boolean
          quota: number
          sent_today: number
        }[]
      }
      claim_recipient_throttle: {
        Args: {
          _clinic_id: string
          _dest_domain: string
          _limit_per_hour?: number
        }
        Returns: {
          allowed: boolean
          sent: number
          window_start: string
        }[]
      }
      cleanup_agent_caches: { Args: never; Returns: undefined }
      cleanup_webhook_dedup: { Args: never; Returns: undefined }
      cleanup_webhook_events: { Args: never; Returns: undefined }
      clear_login_lockout: { Args: { _email: string }; Returns: undefined }
      clinic_email_quota: { Args: { _clinic_id: string }; Returns: number }
      clinic_has_feature: {
        Args: { _clinic_id: string; _key: string }
        Returns: boolean
      }
      current_clinic_has_feature: { Args: { _key: string }; Returns: boolean }
      current_clinic_id: { Args: never; Returns: string }
      current_clinic_plan: {
        Args: { _clinic: string }
        Returns: {
          current_period_end: string
          plan_code: string
          plan_id: string
          source: string
          status: string
          trial_ends_at: string
        }[]
      }
      current_clinic_role: {
        Args: never
        Returns: Database["public"]["Enums"]["clinic_role"]
      }
      engagement_broadcasts_summary: {
        Args: { _from: string; _to: string }
        Returns: {
          broadcast_id: string
          broadcast_name: string
          created_at: string
          qualified_count: number
          replied_count: number
          sent_count: number
        }[]
      }
      engagement_sequence_steps: {
        Args: { _from: string; _sequence_id: string; _to: string }
        Returns: {
          qualified_count: number
          replied_count: number
          sent_count: number
          step_id: string
          step_position: number
        }[]
      }
      engagement_sequences_summary: {
        Args: { _from: string; _to: string }
        Returns: {
          enabled: boolean
          qualified_count: number
          replied_count: number
          sent_count: number
          sequence_id: string
          sequence_name: string
        }[]
      }
      enqueue_email: {
        Args: {
          _clinic_id: string
          _force_send?: boolean
          _from_name_override?: string
          _priority?: number
          _recipient_email: string
          _recipient_name?: string
          _related_lead_id?: string
          _related_lead_table?: string
          _scheduled_at?: string
          _template_slug: string
          _variables?: Json
        }
        Returns: string
      }
      ensure_system_form_assets: {
        Args: { _clinic_id: string }
        Returns: undefined
      }
      find_duplicate_leads_by_phone: {
        Args: { p_clinic_id: string }
        Returns: {
          last_message_ats: string[]
          lead_count: number
          lead_ids: string[]
          names: string[]
          normalized_phone: string
          stage_ids: string[]
        }[]
      }
      generate_unsubscribe_token: {
        Args: { _clinic_id: string; _email: string }
        Returns: string
      }
      get_active_builder_manual: {
        Args: never
        Returns: {
          content: string
          published_at: string
          version: number
        }[]
      }
      get_clinic_openai_status: {
        Args: { _clinic_id: string }
        Returns: {
          clinic_id: string
          openai_key_last4: string
          openai_last_checked_at: string
          openai_last_error: string
          openai_status: string
          updated_at: string
        }[]
      }
      get_invite_by_token: {
        Args: { _token: string }
        Returns: {
          accepted_at: string
          clinic_id: string
          clinic_name: string
          email: string
          expires_at: string
          role: Database["public"]["Enums"]["clinic_role"]
        }[]
      }
      get_openai_key: { Args: { _clinic_id: string }; Returns: string }
      has_clinic_access: { Args: { _clinic_id: string }; Returns: boolean }
      increment_unread: {
        Args: { p_lead_id: string; p_preview: string; p_ts: string }
        Returns: undefined
      }
      invoke_edge_function: {
        Args: { _body?: Json; _function_name: string }
        Returns: number
      }
      is_clinic_admin: { Args: { _user_id?: string }; Returns: boolean }
      is_pure_super_admin: { Args: { _uid: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id?: string }; Returns: boolean }
      lead_matches_segment: {
        Args: { _lead_id: string; _segment_id: string }
        Returns: boolean
      }
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
      mark_overdue_invoices: { Args: never; Returns: number }
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
      match_support_documents: {
        Args: { match_count?: number; query_embedding: string }
        Returns: {
          chunk_index: number
          content: string
          id: string
          path: string
          similarity: number
          title: string
        }[]
      }
      pick_ab_winner: { Args: { _campaign_id: string }; Returns: string }
      pick_rotation_domain: {
        Args: { _clinic_id: string; _pool: string }
        Returns: string
      }
      provision_builder_for_clinic: {
        Args: { _clinic_id: string }
        Returns: string
      }
      provision_default_kb_for_agent: {
        Args: { _agent_id: string }
        Returns: undefined
      }
      publish_builder_manual: {
        Args: { _content: string; _summary: string }
        Returns: number
      }
      reactivate_ai_spend: { Args: { p_clinic_id: string }; Returns: Json }
      recompute_lead_appointment_summary: {
        Args: { _lead_id: string }
        Returns: undefined
      }
      refresh_email_metrics_daily: { Args: { _days?: number }; Returns: number }
      register_failed_login: {
        Args: { _email: string }
        Returns: {
          failed_attempts: number
          locked: boolean
          retry_after_seconds: number
        }[]
      }
      reject_reclassify_proposal: {
        Args: { _proposal_id: string }
        Returns: Json
      }
      release_domain_warmup: {
        Args: { _clinic_id: string; _domain: string }
        Returns: undefined
      }
      report_campaign_stats: {
        Args: { _campaign_id: string; _clinic_id: string }
        Returns: {
          best_hour: number
          bounce_rate: number
          bounced: number
          click_rate: number
          clicked: number
          complained: number
          delivered: number
          failed: number
          hourly: Json
          open_rate: number
          opened: number
          sent: number
        }[]
      }
      report_template_stats: {
        Args: {
          _clinic_id: string
          _from?: string
          _template_slug: string
          _to?: string
        }
        Returns: {
          best_hour: number
          bounce_rate: number
          bounced: number
          click_rate: number
          clicked: number
          complained: number
          delivered: number
          failed: number
          hourly: Json
          open_rate: number
          opened: number
          sent: number
        }[]
      }
      reprovision_default_kb_for_agent: {
        Args: { _agent_id: string }
        Returns: undefined
      }
      reset_email_send_state: { Args: never; Returns: undefined }
      resolve_email_segment: {
        Args: { _segment_id: string }
        Returns: {
          email: string
          lead_id: string
          name: string
        }[]
      }
      resolve_email_segment_preview: {
        Args: { _clinic_id: string; _filters: Json }
        Returns: {
          email: string
          lead_id: string
          name: string
        }[]
      }
      revert_builder_manual: { Args: { _version: number }; Returns: number }
      seed_system_agents: { Args: { _clinic_id: string }; Returns: undefined }
      support_chat_spent_this_month_usd: { Args: never; Returns: number }
      verify_unsubscribe_token: {
        Args: { _clinic_id: string; _email: string; _token: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin"
      clinic_role: "owner" | "admin" | "professional" | "viewer"
      lead_ai_extraction_kind: "text" | "vision" | "audio" | "skipped"
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
      lead_ai_extraction_kind: ["text", "vision", "audio", "skipped"],
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
