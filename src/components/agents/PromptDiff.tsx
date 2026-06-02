import { useMemo, useState } from "react";
import { diffLines, diffStats } from "@/lib/diff-lines";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  oldText: string;
  newText: string;
}

export function PromptDiff({ oldText, newText }: Props) {
  const [mode, setMode] = useState<"diff" | "new" | "old">("diff");
  const ops = useMemo(() => diffLines(oldText ?? "", newText ?? ""), [oldText, newText]);
  const stats = useMemo(() => diffStats(ops), [ops]);

  return (
    <div className="mt-1 overflow-hidden rounded border bg-background">
      <div className="flex items-center justify-between border-b bg-muted/40 px-2 py-1">
        <div className="flex items-center gap-2 text-[10px]">
          <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 text-[10px]">
            +{stats.added}
          </Badge>
          <Badge className="bg-destructive/15 text-destructive text-[10px]">
            −{stats.removed}
          </Badge>
        </div>
        <div className="flex gap-1">
          {(["diff", "new", "old"] as const).map((m) => (
            <Button
              key={m}
              size="sm"
              variant={mode === m ? "secondary" : "ghost"}
              className="h-6 px-2 text-[10px]"
              onClick={() => setMode(m)}
            >
              {m === "diff" ? "Diff" : m === "new" ? "Novo" : "Atual"}
            </Button>
          ))}
        </div>
      </div>
      <div className="max-h-64 overflow-auto font-mono text-[11px] leading-snug">
        {mode === "diff" && (
          <div>
            {ops.map((o, i) => {
              const cls =
                o.type === "add"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : o.type === "del"
                  ? "bg-destructive/10 text-destructive line-through opacity-80"
                  : "text-muted-foreground";
              const sigil = o.type === "add" ? "+" : o.type === "del" ? "−" : " ";
              return (
                <div key={i} className={`flex gap-2 px-2 ${cls}`}>
                  <span className="select-none opacity-60">{sigil}</span>
                  <span className="whitespace-pre-wrap break-words">{o.line || " "}</span>
                </div>
              );
            })}
          </div>
        )}
        {mode === "new" && (
          <pre className="whitespace-pre-wrap break-words px-2 py-1">{newText}</pre>
        )}
        {mode === "old" && (
          <pre className="whitespace-pre-wrap break-words px-2 py-1 text-muted-foreground">{oldText}</pre>
        )}
      </div>
    </div>
  );
}
