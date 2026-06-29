import { useState } from "react";
import { Sparkles, Loader2, Globe, FileText, ListChecks, AlertTriangle, CheckCircle2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parseBuilderError } from "@/lib/builder-errors";

interface Props {
  agentId: string;
  clinicId: string | null;
  agentNiche?: string | null;
  onDocsChanged: () => void;
}

const NICHE_OPTS = [
  { v: "other", l: "Outro / não sei" },
  { v: "clinic", l: "Empresa / Saúde" },
  { v: "dental", l: "Odontologia" },
  { v: "real_estate", l: "Imobiliária" },
  { v: "restaurant", l: "Restaurante" },
  { v: "ecommerce", l: "E-commerce" },
  { v: "saas", l: "SaaS B2B" },
  { v: "law", l: "Advocacia" },
  { v: "education", l: "Educação" },
  { v: "aesthetics", l: "Estética" },
  { v: "agency", l: "Agência" },
  { v: "local_services", l: "Serviços locais" },
];

const GOAL_OPTS = [
  { v: "sdr", l: "Qualificar e agendar (SDR)" },
  { v: "classifier", l: "Classificar conversas" },
  { v: "support", l: "Suporte / dúvidas" },
  { v: "scheduler", l: "Agendador" },
  { v: "custom", l: "Customizado" },
];

type UrlSuggestion = { url: string; title: string; reason: string; recommended: boolean };
type Gap = { topic: string; why: string; severity: "high" | "medium" | "low"; suggestion: string };

export function KbAssistant({ agentId, clinicId, agentNiche, onDocsChanged }: Props) {
  const initialNiche = agentNiche && NICHE_OPTS.some((o) => o.v === agentNiche) ? agentNiche : "other";
  const [niche, setNiche] = useState(initialNiche);
  const [goal, setGoal] = useState("sdr");
  const [dominantOffer, setDominantOffer] = useState("");

  // suggest URLs
  const [siteUrl, setSiteUrl] = useState("");
  const [loadingSugg, setLoadingSugg] = useState(false);
  const [suggestions, setSuggestions] = useState<UrlSuggestion[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<Record<string, boolean>>({});
  const [importing, setImporting] = useState(false);

  // draft KB
  const [rawText, setRawText] = useState("");
  const [titleHint, setTitleHint] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftSummary, setDraftSummary] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);

  // audit
  const [auditing, setAuditing] = useState(false);
  const [overall, setOverall] = useState<string>("");
  const [coverageNote, setCoverageNote] = useState("");
  const [gaps, setGaps] = useState<Gap[]>([]);

  const invokeBuilder = async (action: string, payload: any) => {
    if (!clinicId) {
      toast.error("Empresa não identificada.");
      return { ok: false } as any;
    }
    const { data, error } = await supabase.functions.invoke("ai-builder", {
      body: { action, clinic_id: clinicId, payload },
    });
    if (error) {
      const pe = parseBuilderError(error);
      toast.error(pe.message);
      return { ok: false } as any;
    }
    if (!(data as any)?.ok) {
      toast.error((data as any)?.message || "Falha no Construtor.");
      return { ok: false } as any;
    }
    return data as any;
  };

  // ------- Suggest URLs flow -------
  const runSuggest = async () => {
    if (!siteUrl.trim()) return toast.error("Informe a URL do site.");
    setLoadingSugg(true);
    setSuggestions([]);
    setSelectedUrls({});
    const res = await invokeBuilder("suggest_kb_urls", {
      url: siteUrl.trim(),
      niche,
      goal,
      dominant_offer: dominantOffer,
    });
    setLoadingSugg(false);
    if (!res.ok) return;
    const list: UrlSuggestion[] = res.suggestions ?? [];
    setSuggestions(list);
    const preset: Record<string, boolean> = {};
    list.forEach((s) => { preset[s.url] = !!s.recommended; });
    setSelectedUrls(preset);
    toast.success(`${list.length} sugestões (de ${res.found} links).`);
  };

  const importSelected = async () => {
    const urls = Object.entries(selectedUrls).filter(([, v]) => v).map(([k]) => k);
    if (urls.length === 0) return toast.error("Selecione ao menos uma URL.");
    setImporting(true);
    const { data, error } = await supabase.functions.invoke("ai-ingest-urls", {
      body: { agent_id: agentId, urls },
    });
    setImporting(false);
    if (error) return toast.error(error.message);
    const d = data as any;
    toast.success(`Lote: ${d.succeeded}/${d.processed} ingeridas`);
    setSuggestions([]);
    setSelectedUrls({});
    onDocsChanged();
  };

  // ------- Draft KB flow -------
  const runDraft = async () => {
    if (rawText.trim().length < 30) return toast.error("Cole um texto maior.");
    setDrafting(true);
    setDraftTitle(""); setDraftContent(""); setDraftSummary("");
    const res = await invokeBuilder("draft_knowledge_base", {
      text: rawText,
      title_hint: titleHint,
      niche,
      goal,
    });
    setDrafting(false);
    if (!res.ok) return;
    setDraftTitle(res.title);
    setDraftContent(res.content);
    setDraftSummary(res.summary);
    toast.success("Rascunho gerado. Revise antes de salvar.");
  };

  const saveDraft = async () => {
    if (!draftTitle.trim() || !draftContent.trim()) return;
    setSavingDraft(true);
    const { data, error } = await supabase.functions.invoke("ai-ingest-document", {
      body: { agent_id: agentId, title: draftTitle, content: draftContent },
    });
    setSavingDraft(false);
    if (error || (data as any)?.error) {
      return toast.error("Erro ao salvar: " + (error?.message ?? (data as any)?.error));
    }
    toast.success(`Documento salvo (${(data as any)?.chunks} chunks)`);
    setRawText(""); setTitleHint(""); setDraftTitle(""); setDraftContent(""); setDraftSummary("");
    onDocsChanged();
  };

  // ------- Audit flow -------
  const runAudit = async () => {
    setAuditing(true);
    setGaps([]); setOverall(""); setCoverageNote("");
    const res = await invokeBuilder("audit_kb", {
      agent_id: agentId,
      niche,
      goal,
      dominant_offer: dominantOffer,
    });
    setAuditing(false);
    if (!res.ok) return;
    setOverall(res.overall);
    setCoverageNote(res.coverage_note);
    setGaps(res.gaps ?? []);
  };

  const severityBadge = (s: Gap["severity"]) => {
    const cls = s === "high"
      ? "bg-destructive/20 text-destructive"
      : s === "medium"
        ? "bg-amber-500/20 text-amber-700 dark:text-amber-400"
        : "bg-muted text-muted-foreground";
    return <Badge variant="outline" className={`text-[10px] ${cls}`}>{s}</Badge>;
  };

  return (
    <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="h-4 w-4 text-primary" />
        Assistente da base (IA)
      </div>
      <p className="text-xs text-muted-foreground">
        Use o Construtor para extrair conteúdo do seu site, limpar textos colados e identificar lacunas — adaptado ao seu nicho e à sua oferta principal.
      </p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div>
          <label className="text-[11px] text-muted-foreground">Nicho</label>
          <Select value={niche} onValueChange={setNiche}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>{NICHE_OPTS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">Objetivo</label>
          <Select value={goal} onValueChange={setGoal}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>{GOAL_OPTS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">Oferta principal</label>
          <Input
            className="h-8"
            placeholder="ex: Botox / venda de imóveis"
            value={dominantOffer}
            onChange={(e) => setDominantOffer(e.target.value)}
          />
        </div>
      </div>

      <Accordion type="multiple" className="space-y-2">
        <AccordionItem value="urls" className="rounded border bg-background px-3">
          <AccordionTrigger className="py-2 text-sm hover:no-underline">
            <span className="flex items-center gap-2"><Globe className="h-4 w-4" /> Sugerir páginas do site</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-2 pb-3">
            <div className="flex gap-2">
              <Input
                placeholder="https://seusite.com"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
              />
              <Button onClick={runSuggest} disabled={loadingSugg} size="sm" variant="secondary">
                {loadingSugg ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListChecks className="h-4 w-4" />}
              </Button>
            </div>
            {suggestions.length > 0 && (
              <>
                <div className="max-h-72 space-y-1 overflow-y-auto rounded border bg-muted/30 p-2">
                  {suggestions.map((s) => (
                    <label key={s.url} className="flex cursor-pointer items-start gap-2 rounded p-1 text-xs hover:bg-background">
                      <Checkbox
                        checked={!!selectedUrls[s.url]}
                        onCheckedChange={(v) => setSelectedUrls((prev) => ({ ...prev, [s.url]: !!v }))}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-medium truncate">{s.title}</span>
                          {s.recommended && <Badge variant="outline" className="text-[9px]">recomendado</Badge>}
                        </div>
                        <div className="truncate text-muted-foreground">{s.url}</div>
                        <div className="text-muted-foreground/80">{s.reason}</div>
                      </div>
                    </label>
                  ))}
                </div>
                <Button onClick={importSelected} disabled={importing} size="sm">
                  {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ListChecks className="mr-2 h-4 w-4" />}
                  Importar selecionadas
                </Button>
              </>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="text" className="rounded border bg-background px-3">
          <AccordionTrigger className="py-2 text-sm hover:no-underline">
            <span className="flex items-center gap-2"><Wand2 className="h-4 w-4" /> Estruturar texto colado</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-2 pb-3">
            <Input placeholder="Sugestão de título (opcional)" value={titleHint} onChange={(e) => setTitleHint(e.target.value)} />
            <Textarea
              rows={6}
              placeholder="Cole aqui um texto bruto (ex: copiou tudo da página de serviços). O Construtor limpa e estrutura."
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
            />
            <Button onClick={runDraft} disabled={drafting} size="sm" variant="secondary">
              {drafting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Limpar e estruturar
            </Button>
            {draftContent && (
              <div className="space-y-2 rounded border bg-muted/30 p-2">
                <Input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} className="h-8 text-sm" />
                {draftSummary && <p className="text-xs italic text-muted-foreground">{draftSummary}</p>}
                <Textarea rows={10} value={draftContent} onChange={(e) => setDraftContent(e.target.value)} className="font-mono text-xs" />
                <Button onClick={saveDraft} disabled={savingDraft} size="sm">
                  {savingDraft ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                  Salvar na base
                </Button>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="audit" className="rounded border bg-background px-3">
          <AccordionTrigger className="py-2 text-sm hover:no-underline">
            <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Diagnosticar lacunas</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-2 pb-3">
            <Button onClick={runAudit} disabled={auditing} size="sm" variant="secondary">
              {auditing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
              Analisar base
            </Button>
            {overall && (
              <div className="rounded border bg-muted/30 p-2 text-xs">
                <div className="mb-1 flex items-center gap-2">
                  {overall === "solid"
                    ? <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    : <AlertTriangle className="h-3 w-3 text-amber-500" />}
                  <span className="font-semibold capitalize">{overall}</span>
                </div>
                {coverageNote && <p className="text-muted-foreground">{coverageNote}</p>}
                {gaps.length === 0 && <p className="mt-1 text-muted-foreground">Nenhuma lacuna apontada.</p>}
                <ul className="mt-2 space-y-1.5">
                  {gaps.map((g, i) => (
                    <li key={i} className="rounded border bg-background p-2">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="font-medium">{g.topic}</span>
                        {severityBadge(g.severity)}
                      </div>
                      <p className="text-muted-foreground">{g.why}</p>
                      <p className="mt-1 text-[11px] italic text-muted-foreground/80">→ {g.suggestion}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
