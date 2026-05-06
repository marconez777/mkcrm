import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  whatsappInstances: { id: string; name: string }[];
  nextPosition: number;
  onCreated: (pipelineId: string) => void;
}

// Colunas customizadas a importar (resto é ignorado)
const CUSTOM_COLUMNS: { col: string; key: string; label: string; type: string }[] = [
  { col: "Interesse", key: "interesse", label: "Interesse", type: "text" },
  { col: "Procedimentos", key: "procedimentos", label: "Procedimentos", type: "text" },
  { col: "Dara e horário", key: "data_horario", label: "Data e horário", type: "text" },
  { col: "Data e horário", key: "data_horario", label: "Data e horário", type: "text" },
  { col: "Teleconsulta?", key: "teleconsulta", label: "Teleconsulta?", type: "text" },
  { col: "Link de Consulta:", key: "link_consulta", label: "Link de Consulta", type: "url" },
  { col: "Pagamento", key: "pagamento", label: "Pagamento", type: "text" },
  { col: "Origem", key: "origem", label: "Origem", type: "text" },
  { col: "Mensagem:", key: "mensagem", label: "Mensagem", type: "textarea" },
  { col: "Enviar Dia:", key: "enviar_dia", label: "Enviar Dia", type: "text" },
  { col: "utm_content", key: "utm_content", label: "UTM Content", type: "text" },
  { col: "utm_medium", key: "utm_medium", label: "UTM Medium", type: "text" },
  { col: "utm_campaign", key: "utm_campaign", label: "UTM Campaign", type: "text" },
  { col: "utm_source", key: "utm_source", label: "UTM Source", type: "text" },
  { col: "utm_term", key: "utm_term", label: "UTM Term", type: "text" },
  { col: "utm_referrer", key: "utm_referrer", label: "UTM Referrer", type: "text" },
];

const PHONE_COLS = ["Celular (contato)", "Telefone comercial (contato)", "Tel. direto com. (contato)", "Telefone residencial (contato)", "Outro telefone (contato)", "Faz (contato)"];
const EMAIL_COLS = ["Email comercial (contato)", "Email pessoal (contato)", "Outro email (contato)"];

function normalizePhone(raw: any): string | null {
  if (!raw) return null;
  let p = String(raw).replace(/\D/g, "");
  if (!p) return null;
  if (p.length < 8) return null;
  // Brasil: se começa sem 55 e tem 10/11 dígitos, prefixa 55
  if (p.length <= 11 && !p.startsWith("55")) p = "55" + p;
  return p;
}

function parseKommoDate(s: any): string | null {
  if (!s) return null;
  // dd.mm.yyyy hh:mm:ss
  const m = String(s).match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6]}`;
}

const COLORS = ["#6366f1", "#22c55e", "#ef4444", "#f59e0b", "#06b6d4", "#a855f7", "#ec4899"];

export default function KommoImportDialog({ open, onOpenChange, whatsappInstances, nextPosition, onCreated }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ rows: any[]; pipelineName: string; stages: string[] } | null>(null);
  const [pipelineName, setPipelineName] = useState("");
  const [kind, setKind] = useState<"sales" | "internal">("sales");
  const [instanceId, setInstanceId] = useState<string | "none">("none");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState("");

  async function handleFile(f: File | null) {
    setFile(f);
    setPreview(null);
    if (!f) return;
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: null });
      const pipeFromFile = rows.find((r) => r["Funil de vendas"])?.["Funil de vendas"] || f.name.replace(/\.xlsx?$/i, "");
      const stagesSet = new Set<string>();
      rows.forEach((r) => { if (r["Etapa do lead"]) stagesSet.add(String(r["Etapa do lead"])); });
      setPreview({ rows, pipelineName: pipeFromFile, stages: Array.from(stagesSet) });
      setPipelineName(pipeFromFile);
    } catch (e: any) {
      toast.error("Erro ao ler arquivo: " + e.message);
    }
  }

  async function doImport() {
    if (!preview || !pipelineName.trim()) return;
    setImporting(true);
    setProgress("Preparando…");

    let createdPipelineId: string | null = null;
    try {
      // 1. Get clinic_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { data: mem } = await supabase.from("clinic_members").select("clinic_id").eq("user_id", user.id).maybeSingle();
      const clinicId = mem?.clinic_id;
      if (!clinicId) throw new Error("Sem clínica");

      // 2. Cria pipeline
      setProgress("Criando funil…");
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const { data: pipeline, error: pErr } = await supabase
        .from("pipelines")
        .insert({
          name: pipelineName.trim(), kind, color,
          position: nextPosition,
          whatsapp_instance_id: kind === "sales" && instanceId !== "none" ? instanceId : null,
        })
        .select("id").single();
      if (pErr || !pipeline) throw new Error(pErr?.message ?? "Erro ao criar funil");
      createdPipelineId = pipeline.id;

      // 3. Cria etapas (preserva ordem de aparição)
      setProgress("Criando etapas…");
      const stagesPayload = preview.stages.map((name, i) => ({
        name, position: i, color, pipeline_id: pipeline.id,
      }));
      const { data: stagesCreated, error: sErr } = await supabase
        .from("pipeline_stages").insert(stagesPayload).select("id, name");
      if (sErr) throw new Error(sErr.message);
      const stageMap = new Map<string, string>();
      stagesCreated!.forEach((s: any) => stageMap.set(s.name, s.id));

      // 4. Custom fields - upsert por field_key
      setProgress("Criando campos personalizados…");
      const headers = Object.keys(preview.rows[0] ?? {});
      const fieldsToCreate = CUSTOM_COLUMNS.filter((cf) => headers.includes(cf.col));
      const uniqueByKey = new Map<string, typeof CUSTOM_COLUMNS[number]>();
      fieldsToCreate.forEach((f) => { if (!uniqueByKey.has(f.key)) uniqueByKey.set(f.key, f); });
      const { data: existingFields } = await supabase
        .from("lead_custom_fields").select("field_key").eq("clinic_id", clinicId);
      const existingKeys = new Set((existingFields ?? []).map((f: any) => f.field_key));
      const newFields = Array.from(uniqueByKey.values()).filter((f) => !existingKeys.has(f.key));
      if (newFields.length) {
        const basePos = (existingFields?.length ?? 0);
        await supabase.from("lead_custom_fields").insert(
          newFields.map((f, i) => ({
            field_key: f.key, label: f.label, field_type: f.type, position: basePos + i,
            clinic_id: clinicId,
          }))
        );
      }

      // 5. Attendants (responsáveis)
      setProgress("Criando responsáveis…");
      const respNames = new Set<string>();
      preview.rows.forEach((r) => {
        const n = r["Lead usuário responsável"];
        if (n) respNames.add(String(n).trim());
      });
      const { data: existingAtt } = await supabase.from("attendants").select("id, name");
      const attMap = new Map<string, string>();
      (existingAtt ?? []).forEach((a: any) => attMap.set(a.name, a.id));
      const newAtt = Array.from(respNames).filter((n) => !attMap.has(n));
      if (newAtt.length) {
        const { data: created } = await supabase.from("attendants").insert(
          newAtt.map((name) => ({ name, color: COLORS[Math.floor(Math.random() * COLORS.length)] }))
        ).select("id, name");
        (created ?? []).forEach((a: any) => attMap.set(a.name, a.id));
      }

      // 6. Existing leads (para dedupe por phone)
      setProgress("Verificando duplicados…");
      const allPhones: string[] = [];
      const rowsPrepped = preview.rows.map((r) => {
        let phone: string | null = null;
        for (const c of PHONE_COLS) {
          phone = normalizePhone(r[c]);
          if (phone) break;
        }
        return { row: r, phone };
      });
      rowsPrepped.forEach((p) => { if (p.phone) allPhones.push(p.phone); });
      const uniquePhones = Array.from(new Set(allPhones));

      const existingLeadsMap = new Map<string, string>();
      // chunk de 500 para não estourar URL
      for (let i = 0; i < uniquePhones.length; i += 500) {
        const chunk = uniquePhones.slice(i, i + 500);
        const { data } = await supabase.from("leads").select("id, phone").eq("clinic_id", clinicId).in("phone", chunk);
        (data ?? []).forEach((l: any) => existingLeadsMap.set(l.phone, l.id));
      }

      // 7. Insert/update leads
      setProgress("Importando leads…");
      const toInsert: any[] = [];
      const toUpdate: { id: string; patch: any }[] = [];
      let skipped = 0;
      const stagePositions = new Map<string, number>();

      for (const { row, phone } of rowsPrepped) {
        if (!phone) { skipped++; continue; }
        const stageName = row["Etapa do lead"] ? String(row["Etapa do lead"]) : null;
        const stageId = stageName ? stageMap.get(stageName) ?? null : null;
        if (!stageId) { skipped++; continue; }

        const custom: Record<string, any> = {};
        for (const cf of fieldsToCreate) {
          const v = row[cf.col];
          if (v != null && v !== "") custom[cf.key] = v;
        }

        let email: string | null = null;
        for (const c of EMAIL_COLS) { if (row[c]) { email = String(row[c]); break; } }

        const notes = ["Nota 1", "Nota 2", "Nota 3", "Nota 4", "Nota 5"]
          .map((k) => row[k]).filter(Boolean).join("\n\n") || null;

        const respName = row["Lead usuário responsável"] ? String(row["Lead usuário responsável"]).trim() : null;
        const attendantId = respName ? attMap.get(respName) ?? null : null;

        const name = row["Lead título"] || row["Contato principal"] || null;
        const dealRaw = row["Venda"];
        const dealValue = dealRaw != null && !isNaN(Number(dealRaw)) ? Number(dealRaw) : null;
        const createdAt = parseKommoDate(row["Data Criada"]);

        const tagsRaw = row["Lead tags"];
        const tags = tagsRaw ? String(tagsRaw).split(",").map((t) => t.trim()).filter(Boolean) : [];

        const pos = (stagePositions.get(stageId) ?? -1) + 1;
        stagePositions.set(stageId, pos);

        const existing = existingLeadsMap.get(phone);
        if (existing) {
          toUpdate.push({
            id: existing,
            patch: {
              stage_id: stageId, pipeline_id: pipeline.id, position: pos,
              custom_fields: custom,
              ...(name ? { name } : {}),
              ...(email ? { email } : {}),
              ...(attendantId ? { attendant_id: attendantId } : {}),
              ...(dealValue != null ? { deal_value: dealValue } : {}),
              ...(tags.length ? { tags } : {}),
            },
          });
        } else {
          toInsert.push({
            phone, name, email, stage_id: stageId, pipeline_id: pipeline.id,
            attendant_id: attendantId, deal_value: dealValue,
            position: pos, custom_fields: custom, notes, tags,
            ...(createdAt ? { created_at: createdAt } : {}),
            whatsapp_instance_id: kind === "sales" && instanceId !== "none" ? instanceId : null,
          });
        }
      }

      // Dedupe por telefone dentro do próprio arquivo (mantém a última ocorrência)
      const dedupedMap = new Map<string, any>();
      for (const item of toInsert) dedupedMap.set(item.phone, item);
      const dedupedInsert = Array.from(dedupedMap.values());
      const dupSkipped = toInsert.length - dedupedInsert.length;
      skipped += dupSkipped;

      // Upsert em chunks (onConflict clinic_id,phone evita erro de duplicado)
      let inserted = 0;
      for (let i = 0; i < dedupedInsert.length; i += 200) {
        const chunk = dedupedInsert.slice(i, i + 200);
        setProgress(`Inserindo ${i + chunk.length}/${dedupedInsert.length}…`);
        const { error } = await supabase
          .from("leads")
          .upsert(chunk, { onConflict: "clinic_id,phone", ignoreDuplicates: false });
        if (error) throw new Error(`Insert: ${error.message}`);
        inserted += chunk.length;
      }

      // Updates um por um (RLS-safe, simples)
      let updated = 0;
      for (const u of toUpdate) {
        await supabase.from("leads").update(u.patch).eq("id", u.id);
        updated++;
        if (updated % 20 === 0) setProgress(`Atualizando ${updated}/${toUpdate.length}…`);
      }

      toast.success(`Importação concluída: ${inserted} novos, ${updated} atualizados${skipped ? `, ${skipped} ignorados` : ""}`);
      onCreated(pipeline.id);
      onOpenChange(false);
      setFile(null); setPreview(null); setPipelineName("");
    } catch (e: any) {
      // Rollback: remove pipeline criado e tudo que veio junto (etapas + leads inseridos)
      if (createdPipelineId) {
        try {
          await supabase.from("leads").delete().eq("pipeline_id", createdPipelineId);
          await supabase.from("pipeline_stages").delete().eq("pipeline_id", createdPipelineId);
          await supabase.from("pipelines").delete().eq("id", createdPipelineId);
        } catch {}
      }
      toast.error(e.message);
    } finally {
      setImporting(false);
      setProgress("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !importing && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Importar funil da Kommo</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Arquivo .xlsx exportado da Kommo</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                disabled={importing}
              />
            </div>
          </div>

          {preview && (
            <>
              <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                <div><span className="text-muted-foreground">Leads detectados:</span> <strong>{preview.rows.length}</strong></div>
                <div><span className="text-muted-foreground">Etapas:</span> {preview.stages.join(" → ")}</div>
                <div className="text-xs text-muted-foreground">
                  Campos personalizados a criar: Interesse, Procedimentos, Data e horário, Teleconsulta?, Link de Consulta, Pagamento, Origem, Mensagem, Enviar Dia, utm_*
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Nome do funil</Label>
                <Input value={pipelineName} onChange={(e) => setPipelineName(e.target.value)} disabled={importing} />
              </div>

              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={kind} onValueChange={(v) => setKind(v as any)} disabled={importing}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales">Vendas (com WhatsApp)</SelectItem>
                    <SelectItem value="internal">Gestão interna</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {kind === "sales" && whatsappInstances.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Instância WhatsApp (opcional)</Label>
                  <Select value={instanceId} onValueChange={setInstanceId} disabled={importing}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {whatsappInstances.map((i) => (
                        <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          {progress && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {progress}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={importing}>Cancelar</Button>
          <Button onClick={doImport} disabled={!preview || importing || !pipelineName.trim()}>
            {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
