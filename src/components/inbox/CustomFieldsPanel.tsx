import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { CalendarIcon, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { CustomFieldDef, Lead } from "@/types/crm";

type Props = {
  lead: Lead;
  fields: CustomFieldDef[];
  onChange: (next: Record<string, any>) => void;
};

export default function CustomFieldsPanel({ lead, fields, onChange }: Props) {
  const [values, setValues] = useState<Record<string, any>>(lead.custom_fields ?? {});

  useEffect(() => { setValues(lead.custom_fields ?? {}); }, [lead.id]);

  async function save(next: Record<string, any>) {
    setValues(next);
    onChange(next);
    await supabase.from("leads").update({ custom_fields: next }).eq("id", lead.id);
  }

  function set(key: string, v: any) {
    const next = { ...values, [key]: v };
    save(next);
  }

  if (fields.length === 0) return null;

  return (
    <div className="space-y-2 rounded-md border bg-muted/10 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Principal</div>
      {fields.map((f) => (
        <div key={f.id} className="grid grid-cols-[110px_1fr] items-center gap-2">
          <Label className="text-xs text-muted-foreground">{f.label}</Label>
          <FieldInput field={f} value={values[f.field_key]} onChange={(v) => set(f.field_key, v)} />
        </div>
      ))}
    </div>
  );
}

function FieldInput({ field, value, onChange }: { field: CustomFieldDef; value: any; onChange: (v: any) => void }) {
  const [local, setLocal] = useState<any>(value ?? "");
  useEffect(() => setLocal(value ?? ""), [value]);

  switch (field.field_type) {
    case "text":
    case "url":
      return (
        <div className="flex items-center gap-1">
          <Input
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={() => onChange(local || null)}
            className="h-8 text-sm"
            placeholder="..."
          />
          {field.field_type === "url" && local && (
            <a href={local} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      );

    case "textarea":
      return (
        <Textarea
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => onChange(local || null)}
          className="min-h-[60px] text-sm"
        />
      );

    case "number":
    case "currency":
      return (
        <Input
          type="number"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => onChange(local === "" ? null : Number(local))}
          className="h-8 text-sm"
          placeholder={field.field_type === "currency" ? "R$ 0" : "0"}
        />
      );

    case "boolean":
      return (
        <div className="flex items-center gap-2">
          <Switch checked={!!value} onCheckedChange={onChange} />
          <span className="text-xs text-muted-foreground">{value ? "Sim" : "Não"}</span>
        </div>
      );

    case "date":
    case "datetime": {
      const d = value ? new Date(value) : undefined;
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("h-8 justify-start text-xs font-normal", !d && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
              {d ? format(d, field.field_type === "datetime" ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy") : "..."}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={d}
              onSelect={(date) => onChange(date ? date.toISOString() : null)}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
            {field.field_type === "datetime" && d && (
              <div className="border-t p-2">
                <Input
                  type="time"
                  value={format(d, "HH:mm")}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(":").map(Number);
                    const nd = new Date(d); nd.setHours(h || 0, m || 0, 0, 0);
                    onChange(nd.toISOString());
                  }}
                  className="h-8 text-xs"
                />
              </div>
            )}
          </PopoverContent>
        </Popover>
      );
    }

    case "select":
      return (
        <Select value={value ?? "__none"} onValueChange={(v) => onChange(v === "__none" ? null : v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="..." /></SelectTrigger>
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
            <Button variant="outline" size="sm" className="h-auto min-h-8 justify-start py-1 text-left text-xs font-normal">
              {arr.length === 0 ? <span className="text-muted-foreground">...</span> : (
                <span className="flex flex-wrap gap-1">
                  {arr.map(v => <span key={v} className="rounded bg-muted px-1.5 py-0.5">{v}</span>)}
                </span>
              )}
            </Button>
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
                        const next = c ? [...arr, o] : arr.filter(x => x !== o);
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
