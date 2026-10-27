import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Redo2,
  Underline,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button, Modal, Tip } from "../../components/ui/primitives";
import { personalisationTokens } from "../../types/campaigns";
import { sanitizeEmailHtml } from "./EmailPreview";

export function EmailComposer({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [link, setLink] = useState(false);
  const [image, setImage] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const editorInstance = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, protocols: ["http", "https", "mailto"] },
      }),
      Placeholder.configure({ placeholder: "Write a thoughtful message…" }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({ allowBase64: true }),
    ],
    content: sanitizeEmailHtml(value),
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": "Email message",
        "aria-multiline": "true",
      },
    },
  });
  const editor =
    editorInstance && !editorInstance.isDestroyed ? editorInstance : null;
  useEffect(() => {
    if (editor && !editor.isDestroyed && value !== editor.getHTML())
      editor.commands.setContent(sanitizeEmailHtml(value), {
        emitUpdate: false,
      });
  }, [value, editor]);
  return (
    <>
      <div className="campaign-composer">
        <div
          className="campaign-editor-toolbar"
          role="toolbar"
          aria-label="Email formatting"
        >
          {[
            {
              label: "Bold",
              icon: Bold,
              active: editor?.isActive("bold"),
              run: () => editor?.chain().focus().toggleBold().run(),
            },
            {
              label: "Italic",
              icon: Italic,
              active: editor?.isActive("italic"),
              run: () => editor?.chain().focus().toggleItalic().run(),
            },
            {
              label: "Underline",
              icon: Underline,
              active: editor?.isActive("underline"),
              run: () => editor?.chain().focus().toggleUnderline().run(),
            },
            {
              label: "Heading",
              icon: Heading2,
              active: editor?.isActive("heading"),
              run: () =>
                editor?.chain().focus().toggleHeading({ level: 2 }).run(),
            },
            {
              label: "Bullet list",
              icon: List,
              active: editor?.isActive("bulletList"),
              run: () => editor?.chain().focus().toggleBulletList().run(),
            },
            {
              label: "Numbered list",
              icon: ListOrdered,
              active: editor?.isActive("orderedList"),
              run: () => editor?.chain().focus().toggleOrderedList().run(),
            },
            {
              label: "Align left",
              icon: AlignLeft,
              active: editor?.isActive({ textAlign: "left" }),
              run: () => editor?.chain().focus().setTextAlign("left").run(),
            },
            {
              label: "Align centre",
              icon: AlignCenter,
              active: editor?.isActive({ textAlign: "center" }),
              run: () => editor?.chain().focus().setTextAlign("center").run(),
            },
            {
              label: "Align right",
              icon: AlignRight,
              active: editor?.isActive({ textAlign: "right" }),
              run: () => editor?.chain().focus().setTextAlign("right").run(),
            },
            {
              label: "Insert link",
              icon: Link2,
              active: editor?.isActive("link"),
              run: () => setLink(true),
            },
            {
              label: "Insert image",
              icon: ImagePlus,
              run: () => setImage(true),
            },
            {
              label: "Undo",
              icon: Undo2,
              run: () => editor?.chain().focus().undo().run(),
            },
            {
              label: "Redo",
              icon: Redo2,
              run: () => editor?.chain().focus().redo().run(),
            },
          ].map((item) => (
            <Tip label={item.label} key={item.label}>
              <button
                type="button"
                disabled={!editor}
                className={`icon-button ${item.active ? "active" : ""}`}
                aria-label={item.label}
                aria-pressed={!!item.active}
                onClick={item.run}
              >
                <item.icon size={15} />
              </button>
            </Tip>
          ))}
        </div>
        <EditorContent editor={editor} />
        <div className="campaign-editor-footer">
          <select
            aria-label="Insert personalisation token"
            value=""
            onChange={(e) => {
              editor
                ?.chain()
                .focus()
                .insertContent(`{{${e.target.value}}}`)
                .run();
            }}
          >
            <option value="">Insert personalisation…</option>
            {personalisationTokens.map((t) => (
              <option key={t} value={t}>{`{{${t}}}`}</option>
            ))}
          </select>
        </div>
      </div>
      <Modal
        open={link}
        onOpenChange={setLink}
        title="Insert a link"
        description="Use a full web address or a mailto address."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const url = String(new FormData(e.currentTarget).get("url")).trim();
            if (!/^(https?:\/\/|mailto:)/i.test(url)) {
              toast.error("Use an http://, https://, or mailto: address.");
              return;
            }
            editor
              ?.chain()
              .focus()
              .extendMarkRange("link")
              .setLink({ href: url })
              .run();
            setLink(false);
          }}
        >
          <div className="form-body">
            <label>
              Link URL
              <input
                name="url"
                required
                defaultValue={editor?.getAttributes("link").href ?? ""}
                placeholder="https://"
              />
            </label>
          </div>
          <div className="modal-footer">
            <Button
              type="button"
              onClick={() => {
                editor?.chain().focus().unsetLink().run();
                setLink(false);
              }}
            >
              Remove link
            </Button>
            <Button variant="primary" type="submit">
              Insert link
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={image}
        onOpenChange={setImage}
        title="Insert an image"
        description="Use an HTTPS image or upload a PNG, JPEG, GIF, or WebP under 150 KB."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const url = String(f.get("url"));
            if (!/^https:\/\//i.test(url)) {
              toast.error("Use an HTTPS image URL.");
              return;
            }
            editor
              ?.chain()
              .focus()
              .setImage({ src: url, alt: String(f.get("alt")) })
              .run();
            setImage(false);
          }}
        >
          <div className="form-body">
            <label>
              Image URL
              <input name="url" type="url" required placeholder="https://" />
            </label>
            <label>
              Alternative text
              <input name="alt" placeholder="Describe the image" />
            </label>
            <Button type="button" onClick={() => imageInput.current?.click()}>
              Upload an image
            </Button>
            <input
              hidden
              type="file"
              ref={imageInput}
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (
                  file.size > 150000 ||
                  ![
                    "image/png",
                    "image/jpeg",
                    "image/gif",
                    "image/webp",
                  ].includes(file.type)
                ) {
                  toast.error("Choose a PNG, JPEG, GIF, or WebP under 150 KB.");
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                  editor
                    ?.chain()
                    .focus()
                    .setImage({ src: String(reader.result), alt: file.name })
                    .run();
                  setImage(false);
                };
                reader.readAsDataURL(file);
                e.target.value = "";
              }}
            />
          </div>
          <div className="modal-footer">
            <Button type="button" onClick={() => setImage(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Insert image
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
