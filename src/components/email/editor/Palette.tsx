import { useDraggable } from "@dnd-kit/core";
import { BLOCK_LABELS, type BlockType } from "@/lib/email/types";
import {
  Heading, Pilcrow, Image as ImageIcon, MousePointerClick, Minus, MoveVertical,
  User, Signature, Youtube, Columns, Code,
} from "lucide-react";

const ICONS: Record<BlockType, React.ComponentType<{ className?: string }>> = {
  heading: Heading,
  paragraph: Pilcrow,
  image: ImageIcon,
  cta: MousePointerClick,
  divider: Minus,
  spacer: MoveVertical,
  avatar: User,
  signature: Signature,
  youtube: Youtube,
  columns: Columns,
  raw: Code,
};

const ORDER: BlockType[] = [
  "heading", "paragraph", "image", "cta", "divider", "spacer",
  "columns", "avatar", "signature", "youtube", "raw",
];

function PaletteItem({ type }: { type: BlockType }) {
  const Icon = ICONS[type];
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { source: "palette", blockType: type },
  });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-2 w-full rounded border px-2.5 py-2 text-xs text-left hover:bg-accent hover:border-primary/40 transition ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span>{BLOCK_LABELS[type]}</span>
    </button>
  );
}

export default function Palette() {
  return (
    <div className="space-y-1.5 p-3 overflow-auto">
      <div className="text-[11px] font-semibold uppercase text-muted-foreground mb-2">Blocos</div>
      {ORDER.map((t) => <PaletteItem key={t} type={t} />)}
    </div>
  );
}
