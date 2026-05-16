import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, Loader2, Plus, Globe } from "lucide-react";

type Site = { id: string; name: string; domain: string; ingest_token: string };

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lead-capture`;

export default function EmailSites() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("tracking_sites")
      .select("id, name, domain, ingest_token")
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    else {
      setSites((data as Site[]) ?? []);
      if (!selectedId && data?.[0]) setSelectedId(data[0].id);
    }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function createSite() {
    if (!newName.trim() || !newDomain.trim()) return toast.error("Informe nome e domínio");
    setCreating(true);
    const { data, error } = await supabase
      .from("tracking_sites")
      .insert({ name: newName.trim(), domain: newDomain.trim() })
      .select("id, name, domain, ingest_token")
      .single();
    setCreating(false);
    if (error) return toast.error(error.message);
    setSites((s) => [...s, data as Site]);
    setSelectedId((data as Site).id);
    setNewName(""); setNewDomain("");
    toast.success("Site criado");
  }

  const selected = useMemo(() => sites.find((s) => s.id === selectedId), [sites, selectedId]);

  function copy(text: string, label = "Copiado") {
    navigator.clipboard.writeText(text);
    toast.success(label);
  }

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Integração com sites</h2>
        <p className="text-sm text-muted-foreground">
          Conecte o site da clínica (WordPress, HTML ou React) ao CRM. Leads enviados pelo formulário entram automaticamente nas automações de e-mail.
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="text-sm font-medium">Cadastrar novo site</div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
          <div>
            <Label className="text-xs">Nome</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Site Principal" />
          </div>
          <div>
            <Label className="text-xs">Domínio</Label>
            <Input value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="clinica.com.br" />
          </div>
          <div className="flex items-end">
            <Button onClick={createSite} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Criar
            </Button>
          </div>
        </div>
      </Card>

      {sites.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          <Globe className="h-8 w-8 mx-auto mb-2 opacity-40" />
          Nenhum site cadastrado ainda.
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Label className="text-sm">Site:</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-[300px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {sites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name} — {s.domain}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selected && <SnippetTabs site={selected} endpoint={ENDPOINT} onCopy={copy} />}
        </>
      )}
    </div>
  );
}

function SnippetTabs({ site, endpoint, onCopy }: { site: Site; endpoint: string; onCopy: (t: string, l?: string) => void }) {
  const html = htmlSnippet(endpoint, site.ingest_token);
  const wp = wpSnippet(endpoint, site.ingest_token);
  const react = reactSnippet(endpoint, site.ingest_token);

  return (
    <Card className="p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div>
          <Label className="text-xs">Endpoint</Label>
          <div className="flex gap-2 mt-1">
            <Input readOnly value={endpoint} className="font-mono text-xs" />
            <Button size="sm" variant="outline" onClick={() => onCopy(endpoint)}><Copy className="h-3 w-3" /></Button>
          </div>
        </div>
        <div>
          <Label className="text-xs">Token do site</Label>
          <div className="flex gap-2 mt-1">
            <Input readOnly value={site.ingest_token} className="font-mono text-xs" />
            <Button size="sm" variant="outline" onClick={() => onCopy(site.ingest_token)}><Copy className="h-3 w-3" /></Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="html">
        <TabsList>
          <TabsTrigger value="html">HTML</TabsTrigger>
          <TabsTrigger value="wordpress">WordPress</TabsTrigger>
          <TabsTrigger value="react">React / Lovable</TabsTrigger>
        </TabsList>

        <TabsContent value="html" className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Cole este bloco no HTML do site, em qualquer lugar onde queira mostrar o formulário.
          </p>
          <CodeBlock code={html} onCopy={() => onCopy(html, "Snippet copiado")} />
        </TabsContent>

        <TabsContent value="wordpress" className="space-y-2">
          <p className="text-sm text-muted-foreground">
            No editor de página do WordPress, adicione um bloco <strong>HTML personalizado</strong> (Gutenberg) ou um widget de <strong>HTML</strong> (Elementor) e cole o conteúdo abaixo. Funciona em qualquer tema.
          </p>
          <CodeBlock code={wp} onCopy={() => onCopy(wp, "Snippet copiado")} />
        </TabsContent>

        <TabsContent value="react" className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Para sites em React/Lovable, use este componente. O fetch já aponta para o endpoint correto.
          </p>
          <CodeBlock code={react} onCopy={() => onCopy(react, "Snippet copiado")} />
        </TabsContent>
      </Tabs>

      <div className="text-xs text-muted-foreground border-t pt-3 space-y-1">
        <p><strong>Como funciona:</strong> quando o formulário é enviado, o lead é criado na clínica e qualquer automação com gatilho <em>"Lead criado"</em> dispara automaticamente. Use segmentos para filtrar quais leads entram em cada sequência.</p>
        <p><strong>Atribuição:</strong> se o pixel já estiver instalado, a origem (UTM, referrer) é automaticamente vinculada ao lead via <code>window.MK_SESSION_ID</code>.</p>
      </div>
    </Card>
  );
}

function CodeBlock({ code, onCopy }: { code: string; onCopy: () => void }) {
  return (
    <div className="relative">
      <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto font-mono whitespace-pre">{code}</pre>
      <Button size="sm" variant="outline" className="absolute top-2 right-2" onClick={onCopy}>
        <Copy className="h-3 w-3 mr-1" /> Copiar
      </Button>
    </div>
  );
}

function htmlSnippet(endpoint: string, token: string) {
  return `<form id="mk-lead-form">
  <input name="name"  placeholder="Nome" required>
  <input name="email" type="email" placeholder="E-mail" required>
  <input name="phone" placeholder="WhatsApp">
  <input name="_hp" style="display:none" tabindex="-1" autocomplete="off">
  <button type="submit">Quero contato</button>
</form>
<script>
(function(){
  var f = document.getElementById('mk-lead-form');
  f.addEventListener('submit', async function(e){
    e.preventDefault();
    var fd = new FormData(f);
    if (fd.get('_hp')) return;
    try {
      await fetch('${endpoint}', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          siteToken: '${token}',
          sessionId: window.MK_SESSION_ID || null,
          name:  fd.get('name'),
          email: fd.get('email'),
          phone: fd.get('phone'),
          source: 'site',
          tags: ['form:contato']
        })
      });
      f.reset();
      alert('Recebemos seu contato! Em breve entraremos em contato.');
    } catch(err) { alert('Erro ao enviar. Tente novamente.'); }
  });
})();
</script>`;
}

function wpSnippet(endpoint: string, token: string) {
  return htmlSnippet(endpoint, token);
}

function reactSnippet(endpoint: string, token: string) {
  return `import { useState } from "react";

const ENDPOINT = "${endpoint}";
const SITE_TOKEN = "${token}";

export function LeadForm() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (fd.get("_hp")) return;
    setLoading(true);
    try {
      await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteToken: SITE_TOKEN,
          name:  fd.get("name"),
          email: fd.get("email"),
          phone: fd.get("phone"),
          source: "site",
          tags: ["form:contato"],
        }),
      });
      setDone(true);
    } finally { setLoading(false); }
  }

  if (done) return <p>Recebemos seu contato!</p>;
  return (
    <form onSubmit={onSubmit}>
      <input name="name"  placeholder="Nome" required />
      <input name="email" type="email" placeholder="E-mail" required />
      <input name="phone" placeholder="WhatsApp" />
      <input name="_hp" style={{display:"none"}} tabIndex={-1} autoComplete="off" />
      <button type="submit" disabled={loading}>
        {loading ? "Enviando..." : "Quero contato"}
      </button>
    </form>
  );
}`;
}
