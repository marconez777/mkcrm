import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { QuickReply } from "@/types/crm";

export function useQuickReplies() {
  const [items, setItems] = useState<QuickReply[]>([]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase.from("quick_replies").select("*").order("shortcut");
      if (active && data) setItems(data as QuickReply[]);
    };
    load();
    const ch = supabase
      .channel(`qr-rt-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "quick_replies" }, load)
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, []);
  return { items };
}

export function applyVariables(template: string, ctx: { name?: string | null; phone?: string }) {
  const name = ctx.name || ctx.phone || "";
  const first = name.split(" ")[0] || "";
  return template
    .replaceAll("{{nome}}", name)
    .replaceAll("{{primeiro_nome}}", first)
    .replaceAll("{{telefone}}", ctx.phone || "");
}
