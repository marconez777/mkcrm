import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaged } from "@/lib/fetch-all";
import UsersPanel from "@/components/admin/UsersPanel";
import { AdminPageHeader } from "@/layouts/AdminShell";

export default function AdminUsers() {
  const [clinics, setClinics] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    (async () => {
      const cs = await fetchAllPaged<any>(() => supabase.from("clinics").select("id,name").order("name"));
      setClinics(cs as any);
    })();
  }, []);
  return (
    <>
      <AdminPageHeader title="Usuários" description="Todos os usuários de todas as empresas — papéis, status, ações sensíveis." />
      <UsersPanel clinics={clinics} />
    </>
  );
}
