import { supabase } from "@/integrations/supabase/client";

export type ScheduledMessage = {
  id: string;
  lead_id: string;
  content: string;
  send_at: string;
  status: "pending" | "sent" | "failed" | "canceled";
  sent_at: string | null;
  last_error: string | null;
  created_at: string;
};

export async function listScheduled(leadId: string): Promise<ScheduledMessage[]> {
  const { data } = await supabase
    .from("scheduled_messages")
    .select("*")
    .eq("lead_id", leadId)
    .order("send_at", { ascending: true });
  return (data ?? []) as ScheduledMessage[];
}

export async function scheduleMessage(leadId: string, content: string, sendAt: Date) {
  const { error } = await supabase.from("scheduled_messages").insert({
    lead_id: leadId,
    content,
    send_at: sendAt.toISOString(),
    status: "pending",
  });
  if (error) throw error;
}

export async function cancelScheduled(id: string) {
  await supabase.from("scheduled_messages").update({ status: "canceled" }).eq("id", id);
}
