export type BlockBase = { id: string };

export type HeadingBlock = BlockBase & {
  type: "heading";
  text: string;
  level: 1 | 2 | 3;
  align: "left" | "center" | "right";
  color: string;
};

export type ParagraphBlock = BlockBase & {
  type: "paragraph";
  html: string; // rich HTML from tiptap (sanitized on render)
  align: "left" | "center" | "right";
  color: string;
  fontSize: number;
};

export type ImageBlock = BlockBase & {
  type: "image";
  src: string;
  alt: string;
  width: number; // px (max 600)
  href?: string;
  align: "left" | "center" | "right";
};

export type CtaBlock = BlockBase & {
  type: "cta";
  text: string;
  href: string;
  bg: string;
  color: string;
  align: "left" | "center" | "right";
  radius: number;
  paddingX: number;
  paddingY: number;
  fullWidth?: boolean;
};

export type DividerBlock = BlockBase & {
  type: "divider";
  color: string;
  thickness: number;
};

export type SpacerBlock = BlockBase & {
  type: "spacer";
  height: number;
};

export type AvatarBlock = BlockBase & {
  type: "avatar";
  src: string;
  initials: string;
  size: number;
  align: "left" | "center" | "right";
};

export type SignatureBlock = BlockBase & {
  type: "signature";
  avatarSrc: string;
  avatarSize: number;
  name: string;
  role: string;
  extra: string;
  site: string;
};

export type YoutubeBlock = BlockBase & {
  type: "youtube";
  url: string;
  caption: string;
  width: number;
};

export type RawBlock = BlockBase & {
  type: "raw";
  html: string;
};

export type ColumnsBlock = BlockBase & {
  type: "columns";
  cols: 2 | 3;
  children: EmailBlock[][];
};

export type EmailBlock =
  | HeadingBlock
  | ParagraphBlock
  | ImageBlock
  | CtaBlock
  | DividerBlock
  | SpacerBlock
  | AvatarBlock
  | SignatureBlock
  | YoutubeBlock
  | RawBlock
  | ColumnsBlock;

export type BlockType = EmailBlock["type"];

export const BLOCK_LABELS: Record<BlockType, string> = {
  heading: "Título",
  paragraph: "Parágrafo",
  image: "Imagem",
  cta: "Botão (CTA)",
  divider: "Divisor",
  spacer: "Espaço",
  avatar: "Avatar",
  signature: "Assinatura",
  youtube: "YouTube",
  columns: "Colunas",
  raw: "HTML cru",
};

export function newBlock(type: BlockType): EmailBlock {
  const id = crypto.randomUUID();
  switch (type) {
    case "heading":
      return { id, type, text: "Título", level: 2, align: "left", color: "#111111" };
    case "paragraph":
      return { id, type, html: "<p>Escreva aqui…</p>", align: "left", color: "#333333", fontSize: 14 };
    case "image":
      return { id, type, src: "https://via.placeholder.com/600x300", alt: "", width: 600, align: "center" };
    case "cta":
      return { id, type, text: "Clique aqui", href: "https://", bg: "#2563eb", color: "#ffffff", align: "center", radius: 6, paddingX: 24, paddingY: 12 };
    case "divider":
      return { id, type, color: "#e5e7eb", thickness: 1 };
    case "spacer":
      return { id, type, height: 24 };
    case "avatar":
      return { id, type, src: "", initials: "AB", size: 64, align: "center" };
    case "signature": {
      let preset: Partial<SignatureBlock> = {};
      try {
        if (typeof window !== "undefined") {
          const raw = window.localStorage.getItem("email:default-signature");
          if (raw) preset = JSON.parse(raw);
        }
      } catch {}
      return {
        id,
        type,
        avatarSrc: preset.avatarSrc ?? "",
        avatarSize: preset.avatarSize ?? 80,
        name: preset.name ?? "Nome",
        role: preset.role ?? "Cargo",
        extra: preset.extra ?? "",
        site: preset.site ?? "",
      };
    }
    case "youtube":
      return { id, type, url: "https://www.youtube.com/watch?v=", caption: "", width: 560 };
    case "columns":
      return { id, type, cols: 2, children: [[], []] };
    case "raw":
      return { id, type, html: "<!-- HTML personalizado -->" };
  }
}
