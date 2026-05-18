import { supabase } from "@/integrations/supabase/client";

export type LinkVisitorInput = {
  clinic_id: string;
  visitor_id: string;
  lead_id?: string;
  email?: string;
  phone?: string;
  whatsapp_id?: string;
  source_event?: string;
  session_id?: string;
  project_id?: string;
  properties?: Record<string, unknown>;
};

/**
 * Vincula um visitor_id anônimo a um lead identificado e
 * faz backfill dos eventos passados desse visitante.
 * Usa a edge function tracking-identify (autorizada como usuário interno).
 */
export async function linkVisitorToLead(input: LinkVisitorInput) {
  let project_id = input.project_id;
  if (!project_id) {
    const { data } = await supabase.from("clinics").select("slug").eq("id", input.clinic_id).maybeSingle();
    project_id = data?.slug || undefined;
  }
  if (!project_id) throw new Error("project_id_not_resolved");

  const { data, error } = await supabase.functions.invoke("tracking-identify", {
    body: { ...input, project_id },
  });
  if (error) throw error;
  return data as { ok: boolean; lead_id: string };
}
