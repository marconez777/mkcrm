import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Wrench, BookOpen, Cpu, Clock, Coins, GitBranch } from "lucide-react";

export type AlfredTrace = {
  id?: string | null;
  model?: string;
  tokens_in?: number;
  tokens_out?: number;
  latency_ms?: number;
  kb_hits?: Array<{ idx: number; title?: string; snippet: string; score?: number }>;
  tool_calls?: Array<{ name: string; args: unknown; ok?: boolean; error?: string | null }>;
  system_prompt_excerpt?: string;
  stage?: {
    stage_id: string | null;
    name: string | null;
    reason: string | null;
    delta_excerpt: string | null;
    all_stages?: Array<{ id: string; name: string; advance_when: string | null }>;
  } | null;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trace: AlfredTrace | null;
}

export function AlfredDialog({ open, onOpenChange, trace }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Por que o agente disse isso?</DialogTitle>
          <DialogDescription className="text-xs">
            Tudo o que o agente "viu" e fez para gerar esta resposta. Telefones e e-mails são mascarados.
          </DialogDescription>
        </DialogHeader>

        {!trace ? (
          <p className="text-xs text-muted-foreground">Sem diagnóstico disponível para esta mensagem.</p>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-3">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-[11px]">
                <Badge variant="outline" className="gap-1">
                  <Cpu className="h-3 w-3" /> {trace.model ?? "-"}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" /> {trace.latency_ms ?? 0} ms
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Coins className="h-3 w-3" />
                  in {trace.tokens_in ?? 0} · out {trace.tokens_out ?? 0}
                </Badge>
              </div>

              {trace.stage && (
                <section className="rounded-md border border-primary/30 bg-primary/5 p-2">
                  <h4 className="mb-1 flex items-center gap-1 text-xs font-semibold text-primary">
                    <GitBranch className="h-3.5 w-3.5" /> Estágio detectado: {trace.stage.name ?? "—"}
                  </h4>
                  {trace.stage.reason && (
                    <p className="text-[11px] text-muted-foreground">Motivo: {trace.stage.reason}</p>
                  )}
                  {trace.stage.delta_excerpt && (
                    <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-background/60 p-1.5 text-[10px]">
                      {trace.stage.delta_excerpt}
                    </pre>
                  )}
                  {trace.stage.all_stages && trace.stage.all_stages.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {trace.stage.all_stages.map((s) => (
                        <Badge
                          key={s.id}
                          variant={s.id === trace.stage?.stage_id ? "default" : "outline"}
                          className="text-[10px]"
                        >
                          {s.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </section>
              )}


              <section>
                <h4 className="mb-1 flex items-center gap-1 text-xs font-semibold">
                  <BookOpen className="h-3.5 w-3.5" /> Trechos da base usados ({trace.kb_hits?.length ?? 0})
                </h4>
                {!trace.kb_hits?.length ? (
                  <p className="text-xs text-muted-foreground">Nenhum trecho da base entrou no contexto.</p>
                ) : (
                  <div className="space-y-1">
                    {trace.kb_hits.map((h) => (
                      <div key={h.idx} className="rounded border bg-muted/30 p-2 text-xs">
                        <div className="mb-0.5 flex items-center justify-between gap-2">
                          <span className="font-medium">[{h.idx}] {h.title ?? "(sem título)"}</span>
                          {typeof h.score === "number" && (
                            <Badge variant="secondary" className="text-[10px]">{h.score.toFixed(3)}</Badge>
                          )}
                        </div>
                        <p className="line-clamp-3 text-muted-foreground">{h.snippet}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h4 className="mb-1 flex items-center gap-1 text-xs font-semibold">
                  <Wrench className="h-3.5 w-3.5" /> Ferramentas chamadas ({trace.tool_calls?.length ?? 0})
                </h4>
                {!trace.tool_calls?.length ? (
                  <p className="text-xs text-muted-foreground">Nenhuma ferramenta foi chamada.</p>
                ) : (
                  <div className="space-y-1">
                    {trace.tool_calls.map((t, i) => (
                      <div key={i} className="rounded border bg-muted/30 p-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-medium">{t.name}</span>
                          {t.ok === false ? (
                            <Badge className="bg-destructive/15 text-destructive text-[10px]">erro</Badge>
                          ) : (
                            <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 text-[10px]">ok</Badge>
                          )}
                        </div>
                        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words rounded bg-background/60 p-1 font-mono text-[10px]">
                          {JSON.stringify(t.args, null, 2)}
                        </pre>
                        {t.error && (
                          <p className="mt-1 text-[10px] text-destructive">{t.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {trace.system_prompt_excerpt && (
                <section>
                  <h4 className="mb-1 text-xs font-semibold">System prompt (trecho)</h4>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded border bg-muted/30 p-2 text-[11px]">
                    {trace.system_prompt_excerpt}
                  </pre>
                </section>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
