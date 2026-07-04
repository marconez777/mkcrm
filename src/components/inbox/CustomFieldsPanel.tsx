import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { CalendarIcon, ChevronDown, ExternalLink, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useRegion } from "@/hooks/useRegion";
import type { CustomFieldDef, Lead } from "@/types/crm";

// Símbolo da moeda local (R$ / € / $) — extraído via Intl.NumberFormat.
function currencySymbol(currency: string, locale: string): string {
  try {
    const parts = new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol" }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}


type Props = {
  lead: Lead;
  fields: CustomFieldDef[];
  onChange: (next: Record<string, any>) => void;
};

export default function CustomFieldsPanel({ lead, fields, onChange }: Props) {
  // Fonte da verdade = lead.custom_fields (props/realtime).
  // `values` = overlay otimista para writes ainda em voo. Toda mutação envia
  // apenas o PATCH (chave alterada) via RPC `merge_lead_custom_fields`, que
  // faz merge atômico no JSONB no Postgres — evita o Lost Update clássico em
  // que dois `UPDATE ... custom_fields = <objeto inteiro>` concorrentes se
  // sobrescrevem quando o usuário fecha o painel logo após editar 2 campos.
  const [values, setValues] = useState<Record<string, any>>(lead.custom_fields ?? {});
  const queueRef = useRef<Promise<any>>(Promise.resolve());

  useEffect(() => {
    setValues(lead.custom_fields ?? {});
  }, [lead.id, lead.custom_fields]);

  function set(key: string, v: any) {
    const remove = v === null || v === undefined || v === "";
    // Optimistic update local (merge contra a fonte mais fresca).
    const optimistic = { ...(lead.custom_fields ?? {}), ...values };
    if (remove) delete optimistic[key]; else optimistic[key] = v;
    setValues(optimistic);
    onChange(optimistic);

    // Fila serial: encadeia chamadas para que dois onBlur no mesmo tick
    // não disputem — cada uma manda só seu patch e o Postgres soma.
    queueRef.current = queueRef.current
      .catch(() => undefined)
      .then(async () => {
        const patch = remove ? {} : { [key]: v };
        const removeKeys = remove ? [key] : [];
        const { data, error } = await supabase.rpc("merge_lead_custom_fields", {
          p_lead_id: lead.id,
          p_patch: patch,
          p_remove_keys: removeKeys,
        });
        if (error) {
          console.error("[CustomFieldsPanel] merge failed", error.message);
          return;
        }
        if (data && typeof data === "object") {
          setValues(data as Record<string, any>);
          onChange(data as Record<string, any>);
        }
      });
  }

  if (fields.length === 0) return null;

  return (
    <div className="rounded-md border bg-muted/10 px-3 py-2">
      <div className="mb-1 text-[10px] uppercase tracking-wide text-foreground">Principal</div>
      <div className="divide-y divide-border">
        {fields.map((f) => (
          <div key={f.id} className="grid min-h-[28px] grid-cols-[auto_1fr] items-start gap-x-3 py-1">
            <span className="line-clamp-2 max-w-[180px] pt-0.5 text-xs text-foreground" title={f.label}>{f.label}</span>
            <FieldInput field={f} value={values[f.field_key]} onChange={(v) => set(f.field_key, v)} />
          </div>
        ))}
      </div>
    </div>
  );
}


function ResizableTextareaField({
  fieldKey,
  value,
  setLocal,
  onCommit,
}: {
  fieldKey: string;
  value: any;
  setLocal: (v: any) => void;
  onCommit: () => void;
}) {
  const storageKey = `cf-textarea-h:${fieldKey}`;
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
    if (saved && ref.current) ref.current.style.height = saved;
  }, [storageKey]);

  function persistHeight() {
    if (ref.current) {
      const h = ref.current.style.height;
      if (h) window.localStorage.setItem(storageKey, h);
    }
  }

  return (
    <div className="rounded-md border bg-background px-2 py-1.5 transition-colors focus-within:border-primary/40">
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { persistHeight(); onCommit(); }}
        onMouseUp={persistHeight}
        className="min-h-[64px] max-h-[480px] resize-y border-0 bg-transparent p-0 text-sm leading-relaxed text-foreground placeholder:text-foreground/60 shadow-none focus-visible:ring-0"
        placeholder="..."
      />
    </div>
  );
}

const nakedInput =
  "w-full border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-foreground/70 focus:outline-none";

function FieldInput({ field, value, onChange }: { field: CustomFieldDef; value: any; onChange: (v: any) => void }) {
  const region = useRegion();

  const [local, setLocal] = useState<any>(value ?? "");
  useEffect(() => setLocal(value ?? ""), [value]);

  switch (field.field_type) {
    case "text":
    case "url":
      return (
        <div className="flex items-center gap-1">
          <input
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={() => onChange(local || null)}
            className={cn(nakedInput, local && "underline decoration-primary/40 underline-offset-2")}
            placeholder="..."
          />
          {field.field_type === "url" && local && (
            <a href={local} target="_blank" rel="noreferrer" className="text-foreground hover:text-primary">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      );

    case "textarea":
      return <ResizableTextareaField fieldKey={field.field_key} value={local} setLocal={setLocal} onCommit={() => onChange(local || null)} />;

    case "number":
      return (
        <input
          type="number"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => onChange(local === "" ? null : Number(local))}
          className={cn(nakedInput, local !== "" && "underline decoration-primary/40 underline-offset-2")}
          placeholder="0"
        />
      );

    case "currency":
      return (
        <div className="flex items-center gap-1">
          <span className="text-sm text-foreground">{currencySymbol(region.currency, region.locale)}</span>

          <input
            type="text"
            inputMode="decimal"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={() => {
              const raw = String(local ?? "").trim();
              if (raw === "") return onChange(null);
              const normalized = raw.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
              const n = Number(normalized);
              if (Number.isFinite(n)) onChange(n);
            }}
            className={cn(nakedInput, local !== "" && "underline decoration-primary/40 underline-offset-2")}
            placeholder="0"
          />
        </div>
      );


    case "boolean":
      return (
        <div className="flex items-center justify-start">
          <Switch checked={!!value} onCheckedChange={onChange} className="scale-75" />
        </div>
      );

    case "date":
    case "datetime": {
      const parsed = value ? new Date(value) : undefined;
      const d = parsed && !isNaN(parsed.getTime()) ? parsed : undefined;
      // localTime mantém digitação fluida no <input type="time">. Commit no
      // onBlur evita uma cascata de saves a cada keystroke (que estava
      // gerando race conditions com o realtime e ressuscitando valores).
      const [localTime, setLocalTime] = useState<string>(d ? format(d, "HH:mm") : "");
      useEffect(() => { setLocalTime(d ? format(d, "HH:mm") : ""); }, [value]);
      const commitTime = (raw: string) => {
        if (!d) return;
        const [h, m] = raw.split(":").map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return;
        const nd = new Date(d);
        nd.setHours(h, m, 0, 0);
        const iso = nd.toISOString();
        if (iso !== value) onChange(iso);
      };
      return (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex items-center gap-1.5 text-left text-sm text-foreground hover:text-primary"
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {d && (
                <span className="underline decoration-primary/40 underline-offset-2">
                  {format(d, field.field_type === "datetime" ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy")}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={d}
              onSelect={(date) => onChange(date ? date.toISOString() : null)}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
            {d && (
              <div className="flex items-center gap-2 border-t p-2">
                {field.field_type === "datetime" && (
                  <input
                    type="time"
                    value={localTime}
                    onChange={(e) => setLocalTime(e.target.value)}
                    onBlur={(e) => commitTime(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        commitTime((e.target as HTMLInputElement).value);
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className="flex-1 rounded border bg-background px-2 py-1 text-xs"
                  />
                )}
                <button
                  type="button"
                  onClick={() => onChange(null)}
                  className="ml-auto inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                  title="Limpar data"
                >
                  <X className="h-3 w-3" /> Limpar
                </button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      );
    }

    case "select":
      return (
        <Select value={value ?? "__none"} onValueChange={(v) => onChange(v === "__none" ? null : v)}>
          <SelectTrigger
            className={cn(
              "h-auto w-fit gap-1 border-0 bg-transparent p-0 text-sm text-foreground shadow-none hover:text-primary focus:ring-0 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-100"
            )}
          >
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">—</SelectItem>
            {(field.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      );

    case "multiselect": {
      const arr: string[] = Array.isArray(value) ? value : [];
      return (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex w-fit items-center gap-1 text-left text-sm text-foreground hover:text-primary"
              )}
            >
              {arr.length === 0 ? (
                <span>Selecione</span>
              ) : (
                <span className="flex flex-wrap gap-1">
                  {arr.map((v) => (
                    <span key={v} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{v}</span>
                  ))}
                </span>
              )}
              <ChevronDown className="h-3 w-3 shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="space-y-1.5">
              {(field.options ?? []).map((o) => {
                const checked = arr.includes(o);
                return (
                  <label key={o} className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(c) => {
                        const next = c ? [...arr, o] : arr.filter((x) => x !== o);
                        onChange(next.length ? next : null);
                      }}
                    />
                    {o}
                  </label>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      );
    }
  }
}
