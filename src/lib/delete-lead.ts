import { supabase } from "@/integrations/supabase/client";

export async function deleteLead(leadId: string) {
  const { data, error } = await supabase.functions.invoke("evolution-delete-lead", {
    body: { lead_id: leadId },
  });

  if (error) throw error;

  const payload = data as { ok?: boolean; error?: string } | null;
  if (!payload?.ok) {
    throw new Error(payload?.error || "Não foi possível excluir o lead");
  }

  return payload;
}