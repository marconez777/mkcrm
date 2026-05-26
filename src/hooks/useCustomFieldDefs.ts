import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CustomFieldDefLite } from "@/lib/template-vars";

export function useCustomFieldDefs() {
  const [defs, setDefs] = useState<CustomFieldDefLite[]>([]);
  useEffect(() => {
    let active = true;
    supabase
      .from("lead_custom_fields")
      .select("field_key, field_type, label, position")
      .order("position")
      .then(({ data }) => {
        if (active && data) setDefs(data as any);
      });
    return () => { active = false; };
  }, []);
  return defs;
}

export function useCustomFieldDefsFull() {
  const [defs, setDefs] = useState<Array<{ field_key: string; field_type: string; label: string }>>([]);
  useEffect(() => {
    let active = true;
    supabase
      .from("lead_custom_fields")
      .select("field_key, field_type, label, position")
      .order("position")
      .then(({ data }) => {
        if (active && data) setDefs(data as any);
      });
    return () => { active = false; };
  }, []);
  return defs;
}
