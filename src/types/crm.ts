export type Stage = {
  id: string;
  name: string;
  position: number;
  color: string;
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
};

export type Attendant = { id: string; name: string; color: string };

export type QuickReply = { id: string; shortcut: string; content: string };

export type LeadEvent = {
  id: string;
  lead_id: string;
  type: string;
  payload: any;
  created_at: string;
};
