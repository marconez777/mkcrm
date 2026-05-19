import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { FontFamily } from "@tiptap/extension-font-family";
import { Extension } from "@tiptap/core";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon, List, ListOrdered, Quote, Eraser } from "lucide-react";
import { useEffect } from "react";

interface Props {
  value: string;
  onChange: (html: string) => void;
}

const FontSize = Extension.create({
  name: "fontSize",
  addOptions() {
    return { types: ["textStyle"] as string[] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.fontSize?.replace(/['"]+/g, "") || null,
            renderHTML: (attrs: any) => {
              if (!attrs.fontSize) return {};
              return { style: `font-size: ${attrs.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }: any) =>
          chain().setMark("textStyle", { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }: any) =>
          chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    } as any;
  },
});

const SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px"];

export default function TipTapEditor({ value, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ openOnClick: false, autolink: true }),
      TextStyle,
      Color,
      FontSize,
      FontFamily.configure({ types: ["textStyle"] }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none",
      },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value, { emitUpdate: false });
  }, [value, editor]);

  if (!editor) return null;

  const currentSize: string = (editor.getAttributes("textStyle") as any).fontSize || "";

  return (
    <div className="border rounded">
      <div className="flex flex-wrap items-center gap-1 border-b p-1 bg-muted/40">
        <Button
          type="button" size="icon" variant={editor.isActive("bold") ? "secondary" : "ghost"} className="h-7 w-7"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button" size="icon" variant={editor.isActive("italic") ? "secondary" : "ghost"} className="h-7 w-7"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button" size="icon" variant={editor.isActive("strike") ? "secondary" : "ghost"} className="h-7 w-7"
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </Button>

        <div className="mx-1 h-5 w-px bg-border" />

        <Select
          value={currentSize || "default"}
          onValueChange={(v) => {
            if (v === "default") (editor.chain().focus() as any).unsetFontSize().run();
            else (editor.chain().focus() as any).setFontSize(v).run();
          }}
        >
          <SelectTrigger className="h-7 w-[88px] text-xs"><SelectValue placeholder="Tamanho" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Padrão</SelectItem>
            {SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select
          value={
            editor.isActive("heading", { level: 1 }) ? "h1" :
            editor.isActive("heading", { level: 2 }) ? "h2" :
            editor.isActive("heading", { level: 3 }) ? "h3" : "p"
          }
          onValueChange={(v) => {
            const c = editor.chain().focus();
            if (v === "p") c.setParagraph().run();
            else c.toggleHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 }).run();
          }}
        >
          <SelectTrigger className="h-7 w-[80px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="p">Texto</SelectItem>
            <SelectItem value="h1">Título 1</SelectItem>
            <SelectItem value="h2">Título 2</SelectItem>
            <SelectItem value="h3">Título 3</SelectItem>
          </SelectContent>
        </Select>

        <div className="mx-1 h-5 w-px bg-border" />

        <Button
          type="button" size="icon" variant={editor.isActive("bulletList") ? "secondary" : "ghost"} className="h-7 w-7"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button" size="icon" variant={editor.isActive("orderedList") ? "secondary" : "ghost"} className="h-7 w-7"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button" size="icon" variant={editor.isActive("blockquote") ? "secondary" : "ghost"} className="h-7 w-7"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-3.5 w-3.5" />
        </Button>

        <div className="mx-1 h-5 w-px bg-border" />

        <Button
          type="button" size="icon" variant={editor.isActive("link") ? "secondary" : "ghost"} className="h-7 w-7"
          onClick={() => {
            const url = prompt("URL:", editor.getAttributes("link").href || "https://");
            if (url === null) return;
            if (url === "") editor.chain().focus().unsetLink().run();
            else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
          }}
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </Button>
        <input
          type="color"
          className="h-7 w-7 border rounded cursor-pointer"
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          title="Cor do texto"
        />
        <Button
          type="button" size="icon" variant="ghost" className="h-7 w-7"
          title="Limpar formatação"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        >
          <Eraser className="h-3.5 w-3.5" />
        </Button>
      </div>
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-3 min-h-[160px] focus:outline-none leading-relaxed [&_p]:my-2 [&_h1]:mt-3 [&_h1]:mb-2 [&_h2]:mt-3 [&_h2]:mb-2 [&_h3]:mt-2 [&_h3]:mb-1 [&_ul]:my-2 [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:pl-5 [&_li]:my-0.5 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:my-2"
      />
    </div>
  );
}
