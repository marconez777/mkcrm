import type { EmailBlock } from "@/lib/email/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import TipTapEditor from "./TipTapEditor";

interface Props {
  block: EmailBlock | null;
  onChange: (b: EmailBlock) => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] uppercase text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ColorField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-12 cursor-pointer rounded border" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 font-mono text-xs" />
      </div>
    </Field>
  );
}

function AlignField({ value, onChange }: { value: "left" | "center" | "right"; onChange: (v: any) => void }) {
  return (
    <Field label="Alinhamento">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="left">Esquerda</SelectItem>
          <SelectItem value="center">Centro</SelectItem>
          <SelectItem value="right">Direita</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );
}

export default function Inspector({ block, onChange }: Props) {
  if (!block) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        Selecione um bloco para editar suas propriedades.
      </div>
    );
  }

  const upd = <K extends keyof typeof block>(patch: Partial<typeof block>) =>
    onChange({ ...block, ...patch } as EmailBlock);

  return (
    <div className="p-4 space-y-3 overflow-auto">
      <div className="text-[11px] uppercase text-muted-foreground font-semibold">{block.type}</div>

      {block.type === "heading" && (
        <>
          <Field label="Texto"><Input value={block.text} onChange={(e) => upd({ text: e.target.value })} /></Field>
          <Field label="Nível">
            <Select value={String(block.level)} onValueChange={(v) => upd({ level: Number(v) as 1 | 2 | 3 })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="1">H1</SelectItem><SelectItem value="2">H2</SelectItem><SelectItem value="3">H3</SelectItem></SelectContent>
            </Select>
          </Field>
          <AlignField value={block.align} onChange={(v) => upd({ align: v })} />
          <ColorField label="Cor" value={block.color} onChange={(v) => upd({ color: v })} />
        </>
      )}

      {block.type === "paragraph" && (
        <>
          <Field label="Texto rico">
            <TipTapEditor value={block.html} onChange={(h) => upd({ html: h })} />
          </Field>
          <AlignField value={block.align} onChange={(v) => upd({ align: v })} />
          <ColorField label="Cor base" value={block.color} onChange={(v) => upd({ color: v })} />
          <Field label={`Tamanho (${block.fontSize}px)`}>
            <Slider value={[block.fontSize]} min={10} max={24} step={1} onValueChange={(v) => upd({ fontSize: v[0] })} />
          </Field>
        </>
      )}

      {block.type === "image" && (
        <>
          <Field label="URL da imagem"><Input value={block.src} onChange={(e) => upd({ src: e.target.value })} /></Field>
          <Field label="Texto alternativo"><Input value={block.alt} onChange={(e) => upd({ alt: e.target.value })} /></Field>
          <Field label="Link (opcional)"><Input value={block.href ?? ""} onChange={(e) => upd({ href: e.target.value })} /></Field>
          <Field label={`Largura (${block.width}px)`}>
            <Slider value={[block.width]} min={100} max={600} step={10} onValueChange={(v) => upd({ width: v[0] })} />
          </Field>
          <AlignField value={block.align} onChange={(v) => upd({ align: v })} />
        </>
      )}

      {block.type === "cta" && (
        <>
          <Field label="Texto"><Input value={block.text} onChange={(e) => upd({ text: e.target.value })} /></Field>
          <Field label="URL"><Input value={block.href} onChange={(e) => upd({ href: e.target.value })} /></Field>
          <ColorField label="Fundo" value={block.bg} onChange={(v) => upd({ bg: v })} />
          <ColorField label="Texto" value={block.color} onChange={(v) => upd({ color: v })} />
          <AlignField value={block.align} onChange={(v) => upd({ align: v })} />
          <Field label={`Raio (${block.radius}px)`}>
            <Slider value={[block.radius]} min={0} max={32} step={1} onValueChange={(v) => upd({ radius: v[0] })} />
          </Field>
          <Field label={`Padding X (${block.paddingX}px)`}>
            <Slider value={[block.paddingX]} min={8} max={48} step={2} onValueChange={(v) => upd({ paddingX: v[0] })} />
          </Field>
          <Field label={`Padding Y (${block.paddingY}px)`}>
            <Slider value={[block.paddingY]} min={6} max={32} step={2} onValueChange={(v) => upd({ paddingY: v[0] })} />
          </Field>
        </>
      )}

      {block.type === "divider" && (
        <>
          <ColorField label="Cor" value={block.color} onChange={(v) => upd({ color: v })} />
          <Field label={`Espessura (${block.thickness}px)`}>
            <Slider value={[block.thickness]} min={1} max={6} step={1} onValueChange={(v) => upd({ thickness: v[0] })} />
          </Field>
        </>
      )}

      {block.type === "spacer" && (
        <Field label={`Altura (${block.height}px)`}>
          <Slider value={[block.height]} min={4} max={100} step={2} onValueChange={(v) => upd({ height: v[0] })} />
        </Field>
      )}

      {block.type === "avatar" && (
        <>
          <Field label="URL da imagem"><Input value={block.src} onChange={(e) => upd({ src: e.target.value })} /></Field>
          <Field label="Iniciais (fallback)"><Input value={block.initials} onChange={(e) => upd({ initials: e.target.value.slice(0, 3) })} /></Field>
          <Field label={`Tamanho (${block.size}px)`}>
            <Slider value={[block.size]} min={32} max={128} step={4} onValueChange={(v) => upd({ size: v[0] })} />
          </Field>
          <AlignField value={block.align} onChange={(v) => upd({ align: v })} />
        </>
      )}

      {block.type === "signature" && (
        <>
          <Field label="Avatar (URL)"><Input value={block.avatarSrc} onChange={(e) => upd({ avatarSrc: e.target.value })} /></Field>
          <Field label={`Tamanho do avatar (${block.avatarSize || 80}px)`}>
            <Slider value={[block.avatarSize || 80]} min={48} max={140} step={4} onValueChange={(v) => upd({ avatarSize: v[0] })} />
          </Field>
          <Field label="Nome"><Input value={block.name} onChange={(e) => upd({ name: e.target.value })} /></Field>
          <Field label="Cargo"><Input value={block.role} onChange={(e) => upd({ role: e.target.value })} /></Field>
          <Field label="Linha extra"><Input value={block.extra} onChange={(e) => upd({ extra: e.target.value })} /></Field>
          <Field label="Site"><Input value={block.site} onChange={(e) => upd({ site: e.target.value })} /></Field>
        </>
      )}

      {block.type === "youtube" && (
        <>
          <Field label="URL do vídeo"><Input value={block.url} onChange={(e) => upd({ url: e.target.value })} /></Field>
          <Field label="Legenda"><Input value={block.caption} onChange={(e) => upd({ caption: e.target.value })} /></Field>
          <Field label={`Largura (${block.width}px)`}>
            <Slider value={[block.width]} min={200} max={600} step={20} onValueChange={(v) => upd({ width: v[0] })} />
          </Field>
        </>
      )}

      {block.type === "columns" && (
        <Field label="Colunas">
          <Select value={String(block.cols)} onValueChange={(v) => {
            const n = Number(v) as 2 | 3;
            const children = Array.from({ length: n }, (_, i) => block.children[i] ?? []);
            upd({ cols: n, children });
          }}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="2">2 colunas</SelectItem><SelectItem value="3">3 colunas</SelectItem></SelectContent>
          </Select>
        </Field>
      )}

      {block.type === "raw" && (
        <Field label="HTML">
          <Textarea rows={10} className="font-mono text-xs" value={block.html} onChange={(e) => upd({ html: e.target.value })} />
        </Field>
      )}
    </div>
  );
}
