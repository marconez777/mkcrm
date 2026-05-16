import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Button } from "@/components/ui/button";
import { Bold, Italic, Link as LinkIcon } from "lucide-react";
import { useEffect } from "react";

interface Props {
  value: string;
  onChange: (html: string) => void;
}

export default function TipTapEditor({ value, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      TextStyle,
      Color,
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value, { emitUpdate: false });
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="border rounded">
      <div className="flex items-center gap-1 border-b p-1 bg-muted/40">
        <Button
          type="button"
          size="icon"
          variant={editor.isActive("bold") ? "secondary" : "ghost"}
          className="h-7 w-7"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant={editor.isActive("italic") ? "secondary" : "ghost"}
          className="h-7 w-7"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant={editor.isActive("link") ? "secondary" : "ghost"}
          className="h-7 w-7"
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
          className="h-7 w-7 border rounded ml-1 cursor-pointer"
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          title="Cor do texto"
        />
      </div>
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-2 min-h-[80px] focus:outline-none [&_p]:my-1"
      />
    </div>
  );
}
