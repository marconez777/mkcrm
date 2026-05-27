import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { EmailBlock } from "@/lib/email/types";
import { sanitizeInlineHtml } from "@/lib/email/sanitize";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUp, ArrowDown, Copy, Trash2, GripVertical } from "lucide-react";
import TipTapEditor from "./TipTapEditor";

interface CanvasProps {
  blocks: EmailBlock[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onChange: (b: EmailBlock) => void;
  isDraggingFromPalette?: boolean;
}

function BlockPreview({
  b,
  selected,
  onChange,
}: {
  b: EmailBlock;
  selected: boolean;
  onChange: (b: EmailBlock) => void;
}) {
  switch (b.type) {
    case "heading": {
      const Tag = (`h${b.level}`) as keyof JSX.IntrinsicElements;
      const size = b.level === 1 ? "text-2xl" : b.level === 2 ? "text-xl" : "text-lg";
      if (selected) {
        return (
          <Input
            value={b.text}
            onChange={(e) => onChange({ ...b, text: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            className={`${size} font-bold border-dashed`}
            style={{ color: b.color, textAlign: b.align, height: "auto", padding: "4px 8px" }}
            autoFocus
          />
        );
      }
      return <Tag className={`${size} font-bold m-0`} style={{ color: b.color, textAlign: b.align }}>{b.text}</Tag>;
    }
    case "paragraph":
      if (selected) {
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <TipTapEditor value={b.html} onChange={(html) => onChange({ ...b, html })} />
          </div>
        );
      }
      return (
        <div
          className="leading-relaxed [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:my-2 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:my-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_li]:my-0.5 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:my-2 [&_a]:underline [&_a]:text-primary"
          style={{ color: b.color, fontSize: b.fontSize, textAlign: b.align }}
          dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(b.html) }}
        />
      );
    case "image":
      return (
        <div style={{ textAlign: b.align }}>
          {b.src ? (
            <img src={b.src} alt={b.alt} style={{ maxWidth: `${b.width}px`, width: "100%", display: "inline-block" }} />
          ) : (
            <div className="bg-muted border border-dashed rounded p-8 text-xs text-muted-foreground">Sem imagem</div>
          )}
        </div>
      );
    case "cta":
      if (selected) {
        return (
          <div style={{ textAlign: b.align }} onClick={(e) => e.stopPropagation()}>
            <Input
              value={b.text}
              onChange={(e) => onChange({ ...b, text: e.target.value })}
              className={`border-dashed text-center font-semibold ${b.fullWidth ? "w-full block" : "inline-block w-auto"}`}
              style={{ background: b.bg, color: b.color, padding: `${b.paddingY}px ${b.paddingX}px`, borderRadius: b.radius, height: "auto" }}
            />
          </div>
        );
      }
      return (
        <div style={{ textAlign: b.align }}>
          <span
            style={{
              display: b.fullWidth ? "block" : "inline-block",
              width: b.fullWidth ? "100%" : undefined,
              textAlign: "center",
              background: b.bg, color: b.color, padding: `${b.paddingY}px ${b.paddingX}px`,
              borderRadius: b.radius, fontWeight: 600, fontSize: 14,
              boxSizing: "border-box",
            }}
          >
            {b.text}
          </span>
        </div>
      );
    case "divider":
      return <hr style={{ border: 0, borderTop: `${b.thickness}px solid ${b.color}`, margin: 0 }} />;
    case "spacer":
      return <div style={{ height: b.height }} className="bg-muted/30 border border-dashed rounded text-[10px] text-muted-foreground flex items-center justify-center">{b.height}px</div>;
    case "avatar":
      return (
        <div style={{ textAlign: b.align }}>
          {b.src ? (
            <img src={b.src} style={{ width: b.size, height: b.size, borderRadius: "50%", display: "inline-block", objectFit: "cover" }} alt="" />
          ) : (
            <div style={{ width: b.size, height: b.size, lineHeight: `${b.size}px` }} className="inline-block rounded-full bg-muted text-center font-bold">{b.initials}</div>
          )}
        </div>
      );
    case "signature": {
      const size = b.avatarSize || 80;
      return (
        <div className="flex gap-4 items-start border-t pt-4 text-sm">
          {b.avatarSrc ? (
            <img
              src={b.avatarSrc}
              style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
              alt=""
            />
          ) : (
            <div
              style={{ width: size, height: size, lineHeight: `${size}px`, fontSize: size * 0.35 }}
              className="rounded-full bg-muted text-center font-bold flex-shrink-0"
            >
              {(b.name || "?").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="leading-snug pt-1">
            <div className="font-bold text-foreground">{b.name}</div>
            {b.role && <div className="text-muted-foreground">{b.role}</div>}
            {b.extra && <div className="text-muted-foreground">{b.extra}</div>}
            {b.site && (
              <a
                href={b.site.startsWith("http") ? b.site : `https://${b.site}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
                onClick={(e) => e.stopPropagation()}
              >
                {b.site.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        </div>
      );
    }
    case "youtube": {
      const m = b.url?.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/);
      const id = m?.[1];
      return (
        <div style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
          {id ? (
            <div
              style={{
                position: "relative",
                width: "100%",
                maxWidth: b.width,
                margin: "0 auto",
                aspectRatio: "16 / 9",
                borderRadius: 8,
                overflow: "hidden",
                background: "#000",
              }}
            >
              <iframe
                src={`https://www.youtube.com/embed/${id}`}
                title={b.caption || "YouTube video"}
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
              />
            </div>
          ) : (
            <div className="bg-muted rounded p-8 text-xs text-muted-foreground">
              ▶ Cole a URL do YouTube no painel de propriedades
            </div>
          )}
          {b.caption && <div className="text-xs text-muted-foreground mt-1">{b.caption}</div>}
        </div>
      );
    }
    case "columns":
      return (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${b.cols}, 1fr)` }}>
          {b.children.map((col, i) => (
            <div key={i} className="border border-dashed rounded p-2 min-h-[40px] text-[10px] text-muted-foreground">
              Coluna {i + 1} ({col.length} blocos)
            </div>
          ))}
        </div>
      );
    case "raw":
      return <pre className="text-xs bg-muted/40 p-2 rounded overflow-auto"><code>{b.html.slice(0, 200)}</code></pre>;
  }
}

function SortableBlock({
  block, selected, onSelect, onMove, onDuplicate, onRemove, onChange, isDraggingFromPalette,
}: {
  block: EmailBlock;
  selected: boolean;
  onSelect: () => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onChange: (b: EmailBlock) => void;
  isDraggingFromPalette?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver, over } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const showDropLine = isOver && isDraggingFromPalette && over?.id === block.id;
  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      className={`group relative my-1 rounded border ${selected ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-border"}`}
    >
      <div className="absolute -left-7 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 rounded bg-background border shadow-sm"
        >
          <GripVertical className="h-3 w-3" />
        </button>
      </div>
      <div className={`absolute -top-3 right-2 z-10 flex items-center gap-0.5 bg-background border rounded shadow-sm p-0.5 ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition`}>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onMove(-1); }}><ArrowUp className="h-3 w-3" /></Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onMove(1); }}><ArrowDown className="h-3 w-3" /></Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onDuplicate(); }}><Copy className="h-3 w-3" /></Button>
        <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-destructive" onClick={(e) => { e.stopPropagation(); onRemove(); }}><Trash2 className="h-3 w-3" /></Button>
      </div>
      <div className="p-2">
        <BlockPreview b={block} selected={selected} onChange={onChange} />
      </div>
      {showDropLine && (
        <div className="absolute -bottom-1 left-0 right-0 h-1 bg-primary rounded shadow-[0_0_8px_hsl(var(--primary))]" />
      )}
    </div>
  );
}

export default function Canvas({ blocks, selectedId, onSelect, onMove, onDuplicate, onRemove, onChange, isDraggingFromPalette }: CanvasProps) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas-drop" });
  const showEmptyHighlight = isDraggingFromPalette;

  return (
    <div className="h-full overflow-auto bg-muted/30 p-6" onClick={() => onSelect("")}>
      <div
        ref={setNodeRef}
        className={`mx-auto bg-white rounded-lg shadow-sm border transition ${
          isOver && isDraggingFromPalette
            ? "ring-2 ring-primary border-primary"
            : showEmptyHighlight
              ? "border-primary/40 border-dashed"
              : ""
        }`}
        style={{ width: 600, maxWidth: "100%", minHeight: 400, padding: 24 }}
      >
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          {blocks.length === 0 ? (
            <div className={`text-center text-sm py-16 border-2 border-dashed rounded transition ${
              isOver && isDraggingFromPalette ? "border-primary text-primary bg-primary/5" : "text-muted-foreground"
            }`}>
              {isDraggingFromPalette ? "Solte aqui para adicionar o bloco" : "Arraste blocos da paleta para começar"}
            </div>
          ) : (
            blocks.map((b) => (
              <SortableBlock
                key={b.id}
                block={b}
                selected={selectedId === b.id}
                onSelect={() => onSelect(b.id)}
                onMove={(d) => onMove(b.id, d)}
                onDuplicate={() => onDuplicate(b.id)}
                onRemove={() => onRemove(b.id)}
                onChange={onChange}
                isDraggingFromPalette={isDraggingFromPalette}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}
