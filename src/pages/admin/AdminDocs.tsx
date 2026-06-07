import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  FileText, Search, AlertTriangle, RefreshCw, FolderTree,
  Activity, ExternalLink, Calendar,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Tipos espelhando docs/INDEX.json (gerado por scripts/docs-sync.mjs)
// ---------------------------------------------------------------------------

type DocEntry = {
  path: string;
  title: string;
  topic: string;
  kind: string;
  audience: string;
  updated: string;
  summary: string;
  headings: string[];
  code_refs: string[];
  related_docs: string[];
  size_lines: number;
  stale_refs: string[];
};

type ContentMap = Record<string, string>;

const KIND_COLORS: Record<string, string> = {
  map: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  feature: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  flow: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  support: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  journey: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  troubleshooting: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  reference: "bg-muted text-muted-foreground",
  roadmap: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
  doc: "bg-muted text-muted-foreground",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminDocs() {
  const [index, setIndex] = useState<DocEntry[] | null>(null);
  const [content, setContent] = useState<ContentMap>({});
  const [loadingContent, setLoadingContent] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Index — busca leve, carregado de cara
  useEffect(() => {
    fetch("/docs-index.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: DocEntry[]) => {
        setIndex(data);
        if (data.length && !selected) setSelected(data[0].path);
      })
      .catch((e) =>
        setError(
          `Não foi possível carregar docs-index.json (${e.message}). ` +
            `Rode \`node scripts/docs-sync.mjs\` para gerar os artefatos.`,
        ),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Conteúdo — lazy: só puxa quando primeiro doc é selecionado
  useEffect(() => {
    if (!selected || content[selected]) return;
    if (loadingContent) return;
    setLoadingContent(true);
    fetch("/docs-content.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: ContentMap) => setContent(data))
      .catch(() => {})
      .finally(() => setLoadingContent(false));
  }, [selected, content, loadingContent]);

  const topics = useMemo(() => {
    if (!index) return [];
    const counts = new Map<string, number>();
    for (const d of index) counts.set(d.topic, (counts.get(d.topic) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [index]);

  const kinds = useMemo(() => {
    if (!index) return [];
    const counts = new Map<string, number>();
    for (const d of index) counts.set(d.kind, (counts.get(d.kind) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [index]);

  const filtered = useMemo(() => {
    if (!index) return [];
    const q = search.trim().toLowerCase();
    return index.filter((d) => {
      if (topicFilter && d.topic !== topicFilter) return false;
      if (kindFilter && d.kind !== kindFilter) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        d.summary.toLowerCase().includes(q) ||
        d.path.toLowerCase().includes(q) ||
        d.headings.some((h) => h.toLowerCase().includes(q))
      );
    });
  }, [index, search, topicFilter, kindFilter]);

  const current = selected ? index?.find((d) => d.path === selected) ?? null : null;
  const currentBody = current ? content[current.path] : null;

  // ----- Health stats -----
  const health = useMemo(() => {
    if (!index) return null;
    const withStale = index.filter((d) => d.stale_refs.length > 0);
    const withoutRefs = index.filter(
      (d) => ["map", "feature", "flow"].includes(d.kind) && d.code_refs.length === 0,
    );
    const byTopic = new Map<string, number>();
    for (const d of index) byTopic.set(d.topic, (byTopic.get(d.topic) ?? 0) + 1);
    return {
      total: index.length,
      withStale,
      withoutRefs,
      byTopic: [...byTopic.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [index]);

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive flex gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      </div>
    );
  }

  if (!index) {
    return (
      <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
        <RefreshCw className="h-4 w-4 animate-spin" /> Carregando índice…
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <FolderTree className="h-5 w-5" /> Documentação
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {index.length} arquivos · gerado por <code>scripts/docs-sync.mjs</code>
          </p>
        </div>
        {health && health.withStale.length > 0 && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" /> {health.withStale.length} com drift
          </Badge>
        )}
      </div>

      <Tabs defaultValue="browse" className="flex-1 flex flex-col">
        <TabsList className="mx-6 mt-3 w-fit">
          <TabsTrigger value="browse">Navegar</TabsTrigger>
          <TabsTrigger value="health">Saúde</TabsTrigger>
        </TabsList>

        {/* --------- BROWSE --------- */}
        <TabsContent value="browse" className="flex-1 mt-3 overflow-hidden">
          <div className="h-full grid grid-cols-[320px_1fr] gap-0 border-t">
            {/* Sidebar */}
            <div className="border-r flex flex-col min-h-0">
              <div className="p-3 border-b space-y-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar título, summary, heading…"
                    className="pl-7 h-8 text-xs"
                  />
                </div>

                <div className="flex flex-wrap gap-1">
                  <FilterChip
                    label="topic"
                    value={topicFilter}
                    onClear={() => setTopicFilter(null)}
                  />
                  {topics.slice(0, 8).map(([t, n]) => (
                    <button
                      key={t}
                      onClick={() => setTopicFilter(topicFilter === t ? null : t)}
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded border transition",
                        topicFilter === t
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted hover:bg-muted/70 border-transparent text-muted-foreground",
                      )}
                    >
                      {t} · {n}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-1">
                  <FilterChip
                    label="kind"
                    value={kindFilter}
                    onClear={() => setKindFilter(null)}
                  />
                  {kinds.map(([k, n]) => (
                    <button
                      key={k}
                      onClick={() => setKindFilter(kindFilter === k ? null : k)}
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded border transition",
                        kindFilter === k
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted hover:bg-muted/70 border-transparent text-muted-foreground",
                      )}
                    >
                      {k} · {n}
                    </button>
                  ))}
                </div>

                <div className="text-[10px] text-muted-foreground">
                  {filtered.length} resultados
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-2 space-y-0.5">
                  {filtered.map((d) => (
                    <button
                      key={d.path}
                      onClick={() => setSelected(d.path)}
                      className={cn(
                        "w-full text-left p-2 rounded text-xs transition",
                        selected === d.path
                          ? "bg-primary/10 ring-1 ring-primary/30"
                          : "hover:bg-muted/60",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium line-clamp-2 flex-1">{d.title}</div>
                        {d.stale_refs.length > 0 && (
                          <AlertTriangle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <span
                          className={cn(
                            "text-[9px] px-1 py-0.5 rounded",
                            KIND_COLORS[d.kind] ?? KIND_COLORS.doc,
                          )}
                        >
                          {d.kind}
                        </span>
                        <span className="text-[9px] text-muted-foreground">{d.topic}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                        {d.summary || d.path}
                      </div>
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <div className="text-xs text-muted-foreground p-4 text-center">
                      Nenhum doc encontrado.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Viewer */}
            <ScrollArea className="h-full">
              {current ? (
                <div className="max-w-4xl mx-auto px-8 py-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-2xl font-semibold">{current.title}</h2>
                      <div className="flex items-center gap-2 mt-2 flex-wrap text-xs text-muted-foreground">
                        <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                          {current.path}
                        </code>
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded",
                            KIND_COLORS[current.kind] ?? KIND_COLORS.doc,
                          )}
                        >
                          {current.kind}
                        </span>
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                          {current.topic}
                        </span>
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                          {current.audience}
                        </span>
                        <span className="flex items-center gap-1 text-[10px]">
                          <Calendar className="h-3 w-3" /> {current.updated}
                        </span>
                        <span className="text-[10px]">{current.size_lines} linhas</span>
                      </div>
                    </div>
                  </div>

                  {current.stale_refs.length > 0 && (
                    <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
                      <div className="font-medium text-destructive flex items-center gap-1 mb-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> Drift detectado
                      </div>
                      <div className="text-muted-foreground">
                        Os seguintes paths em <code>code_refs</code> não existem mais:
                      </div>
                      <ul className="list-disc list-inside mt-1">
                        {current.stale_refs.map((s) => (
                          <li key={s}>
                            <code>{s}</code>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {current.code_refs.length > 0 && (
                    <div className="mb-4 text-xs">
                      <div className="text-muted-foreground mb-1">code_refs:</div>
                      <div className="flex flex-wrap gap-1">
                        {current.code_refs.map((r) => (
                          <code
                            key={r}
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded",
                              current.stale_refs.includes(r)
                                ? "bg-destructive/10 text-destructive"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {r}
                          </code>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {currentBody ? (
                      <ReactMarkdown>{currentBody}</ReactMarkdown>
                    ) : loadingContent ? (
                      <div className="text-muted-foreground text-sm flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" /> Carregando conteúdo…
                      </div>
                    ) : (
                      <div className="text-muted-foreground text-sm">
                        Conteúdo não disponível.
                      </div>
                    )}
                  </div>

                  {current.related_docs.length > 0 && (
                    <div className="mt-8 pt-4 border-t">
                      <div className="text-xs text-muted-foreground mb-2">Relacionados</div>
                      <div className="flex flex-wrap gap-2">
                        {current.related_docs.map((r) => {
                          const target = index.find((d) => d.path === r);
                          return (
                            <button
                              key={r}
                              onClick={() => target && setSelected(target.path)}
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              <FileText className="h-3 w-3" />
                              {target?.title ?? r}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-12 text-center text-muted-foreground text-sm">
                  Selecione um documento.
                </div>
              )}
            </ScrollArea>
          </div>
        </TabsContent>

        {/* --------- HEALTH --------- */}
        <TabsContent value="health" className="flex-1 mt-3 overflow-auto">
          {health && (
            <div className="max-w-5xl mx-auto p-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Docs totais" value={health.total} />
                <Stat
                  label="Com drift"
                  value={health.withStale.length}
                  tone={health.withStale.length ? "destructive" : "neutral"}
                />
                <Stat
                  label="Map/feature sem code_refs"
                  value={health.withoutRefs.length}
                  tone={health.withoutRefs.length ? "warning" : "neutral"}
                />
                <Stat label="Topics" value={health.byTopic.length} />
              </div>

              <Section
                title="Documentos com code_refs quebrados"
                empty="Nenhum — tudo apontando para arquivos existentes."
                items={health.withStale}
                render={(d) => (
                  <button
                    key={d.path}
                    className="w-full text-left p-3 rounded border hover:bg-muted/60 text-sm"
                    onClick={() => {
                      setSelected(d.path);
                      // muda pra aba browse
                      document
                        .querySelector<HTMLButtonElement>('[role="tab"][value="browse"]')
                        ?.click();
                    }}
                  >
                    <div className="font-medium">{d.title}</div>
                    <code className="text-[10px] text-muted-foreground">{d.path}</code>
                    <div className="mt-1 text-xs text-destructive">
                      Quebrados: {d.stale_refs.map((s) => s).join(", ")}
                    </div>
                  </button>
                )}
              />

              <Section
                title="Maps / features sem code_refs declarados"
                empty="Todos os mapas e features têm code_refs."
                items={health.withoutRefs}
                render={(d) => (
                  <button
                    key={d.path}
                    className="w-full text-left p-3 rounded border hover:bg-muted/60 text-sm"
                    onClick={() => {
                      setSelected(d.path);
                      document
                        .querySelector<HTMLButtonElement>('[role="tab"][value="browse"]')
                        ?.click();
                    }}
                  >
                    <div className="font-medium">{d.title}</div>
                    <code className="text-[10px] text-muted-foreground">{d.path}</code>
                  </button>
                )}
              />

              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4" /> Distribuição por topic
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {health.byTopic.map(([t, n]) => (
                    <div
                      key={t}
                      className="flex items-center justify-between p-2 rounded border bg-muted/30 text-sm"
                    >
                      <span>{t}</span>
                      <span className="text-muted-foreground">{n}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-md border bg-muted/30 p-4 text-xs text-muted-foreground">
                Para regenerar tudo (índice, bundle e support-kb manifest), rode no
                terminal: <code className="bg-background px-1 py-0.5 rounded">node scripts/docs-sync.mjs</code>.
                O relatório completo fica em <code>docs/DRIFT.md</code>.
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function FilterChip({
  label,
  value,
  onClear,
}: {
  label: string;
  value: string | null;
  onClear: () => void;
}) {
  return (
    <span className="text-[10px] text-muted-foreground mr-1">
      {label}:{" "}
      {value && (
        <button onClick={onClear} className="underline hover:no-underline">
          limpar
        </button>
      )}
    </span>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warning" | "destructive";
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-3",
        tone === "destructive" && "border-destructive/40 bg-destructive/5",
        tone === "warning" && "border-amber-500/40 bg-amber-500/5",
      )}
    >
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function Section<T>({
  title,
  empty,
  items,
  render,
}: {
  title: string;
  empty: string;
  items: T[];
  render: (item: T) => React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground p-3 rounded border bg-muted/30">
          {empty}
        </div>
      ) : (
        <div className="space-y-2">{items.map(render)}</div>
      )}
    </div>
  );
}
