import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Site = { id: string; name: string; domain: string; ingest_token: string; created_at: string };

export default function TrackingSitesPanel() {
  const [sites, setSites] = useState<Site[]>([]);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const fnBase = `https://${projectRef}.supabase.co/functions/v1`;

  async function load() {
    const { data } = await supabase.from("tracking_sites" as any).select("*").order("created_at", { ascending: false });
    setSites((data as unknown as Site[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!name.trim() || !domain.trim()) return;
    setLoading(true);
    const { error } = await supabase.from("tracking_sites" as any).insert({ name, domain } as any);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setName(""); setDomain(""); load();
  }

  async function remove(id: string) {
    if (!confirm("Remover site? Sessões e eventos relacionados serão apagados.")) return;
    const { error } = await supabase.from("tracking_sites" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copiado");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Rastreamento de origem</h2>
        <p className="text-sm text-muted-foreground">
          Cadastre os sites monitorados, copie o snippet e cole antes do <code>&lt;/body&gt;</code>.
          O script captura UTMs, páginas visitadas e adiciona um <code>?ref=</code> automático em links de WhatsApp para identificar o lead quando ele entra em contato.
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Site Dr. Ivan" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Domínio</Label>
            <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="drivan.com.br" />
          </div>
          <Button onClick={create} disabled={loading}><Plus className="mr-1 h-4 w-4" />Adicionar</Button>
        </div>
      </Card>

      <div className="space-y-4">
        {sites.length === 0 && <p className="text-sm text-muted-foreground">Nenhum site cadastrado ainda.</p>}
        {sites.map((s) => {
          const snippet = `<script src="${fnBase}/tracking-pixel?t=${s.ingest_token}" async></script>`;
          return (
            <Card key={s.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.domain}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => remove(s.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Snippet (cole no &lt;/body&gt; do site)</Label>
                <div className="flex gap-2">
                  <code className="flex-1 rounded bg-muted px-2 py-1.5 text-xs break-all">{snippet}</code>
                  <Button size="sm" variant="outline" onClick={() => copy(snippet)}><Copy className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Token de ingestão: <code className="font-mono">{s.ingest_token}</code>
              </div>
              <div className="text-[11px] text-muted-foreground border-t pt-2">
                <strong>Como funciona:</strong> o script reescreve qualquer link <code>wa.me/55…</code> da página adicionando <code>(ref=XXXX)</code> ao texto.
                Quando o lead manda a 1ª mensagem no WhatsApp, o CRM casa essa sessão e mostra a navegação dele na aba <em>Origem & Navegação</em> do lead.
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
