export type FieldType =
  | "text" | "textarea" | "number" | "currency" | "date" | "datetime"
  | "boolean" | "select" | "multiselect" | "url";

export type CustomFieldDef = {
  id: string;
  label: string;
  field_key: string;
  field_type: FieldType;
  options: string[] | null;
  position: number;
};

export type Stage = {
  id: string;
  name: string;
  position: number;
  color: string;
  pipeline_id: string;
  lock_auto_move?: boolean;
};


export type Pipeline = {
  id: string;
  name: string;
  kind: "sales" | "internal";
  color: string;
  position: number;
  is_default: boolean;
  is_system?: boolean;
  system_key?: string | null;
  whatsapp_instance_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Lead = {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  company: string | null;
  deal_value: number | null;
  notes: string | null;
  tags: string[];
  stage_id: string | null;
  pipeline_id: string | null;
  attendant_id: string | null;
  position: number;
  avatar_url: string | null;
  unread_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  stage_changed_at: string;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  custom_fields?: Record<string, any>;
  pinned_at?: string | null;
  marked_unread?: boolean;
  ai_summary?: string | null;
  ai_summary_at?: string | null;
  whatsapp_instance_id?: string | null;
  needs_ai_review?: boolean;
  ai_review_reasons?: string[] | null;
  ai_review_queued_at?: string | null;
  manual_lock_until?: string | null;
};

export type Message = {
  id: string;
  lead_id: string;
  external_id: string | null;
  client_message_id?: string | null;
  from_me: boolean;
  message_type: string;
  content: string | null;
  status: string;
  delivery_status?: string | null;
  reply_to_external_id?: string | null;
  timestamp: string;
  retry_count?: number;
  last_error?: string | null;
  media_url?: string | null;
  media_mime?: string | null;
};

export type Attendant = { id: string; name: string; color: string };

export type QuickReply = { id: string; shortcut: string; content: string };

export type LeadEvent = {
  id: string;
  lead_id: string;
  type: string;
  payload: any;
  created_at: string;
  actor_user_id?: string | null;
};
