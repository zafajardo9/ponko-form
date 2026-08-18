import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react'
import { useEffect } from 'react'
import { popupRichTextHtml, sanitizePopupRichText, sanitizePopupUrl } from '../../lib/popup-builder/sanitize'

export function PopupRichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        link: false,
        underline: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
    ],
    content: popupRichTextHtml(value),
    editorProps: {
      attributes: {
        class: 'popup-tiptap-content min-h-[108px] px-3 py-2.5 text-sm leading-5 text-[#141413] outline-none',
        role: 'textbox',
        'aria-label': 'Popup text content',
        'aria-multiline': 'true',
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(sanitizePopupRichText(currentEditor.getHTML()))
    },
  })

  const state = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      bold: currentEditor?.isActive('bold') ?? false,
      italic: currentEditor?.isActive('italic') ?? false,
      underline: currentEditor?.isActive('underline') ?? false,
      strike: currentEditor?.isActive('strike') ?? false,
      bulletList: currentEditor?.isActive('bulletList') ?? false,
      orderedList: currentEditor?.isActive('orderedList') ?? false,
      link: currentEditor?.isActive('link') ?? false,
      canUndo: currentEditor?.can().undo() ?? false,
      canRedo: currentEditor?.can().redo() ?? false,
    }),
  })

  useEffect(() => {
    if (!editor) return
    const nextHtml = popupRichTextHtml(value)
    if (sanitizePopupRichText(editor.getHTML()) !== nextHtml) {
      editor.commands.setContent(nextHtml, { emitUpdate: false })
    }
  }, [editor, value])

  function editLink() {
    if (!editor) return
    if (editor.isActive('link')) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    const requested = window.prompt('Link URL', 'https://')
    if (!requested) return
    const href = sanitizePopupUrl(requested)
    if (!href) return
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#dedbd5] bg-white transition-[border-color,box-shadow] duration-150 focus-within:border-[#cc785c] focus-within:ring-2 focus-within:ring-[#cc785c]/15 motion-reduce:transition-none">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-[#e6dfd8] bg-[#f7f3ed] p-1.5" role="toolbar" aria-label="Popup text formatting">
        <EditorButton label="Bold" active={state?.bold} onPress={() => editor?.chain().focus().toggleBold().run()}><Bold size={14} /></EditorButton>
        <EditorButton label="Italic" active={state?.italic} onPress={() => editor?.chain().focus().toggleItalic().run()}><Italic size={14} /></EditorButton>
        <EditorButton label="Underline" active={state?.underline} onPress={() => editor?.chain().focus().toggleUnderline().run()}><UnderlineIcon size={14} /></EditorButton>
        <EditorButton label="Strikethrough" active={state?.strike} onPress={() => editor?.chain().focus().toggleStrike().run()}><Strikethrough size={14} /></EditorButton>
        <span className="mx-1 h-5 w-px bg-[#dedbd5]" aria-hidden="true" />
        <EditorButton label="Bullet list" active={state?.bulletList} onPress={() => editor?.chain().focus().toggleBulletList().run()}><List size={14} /></EditorButton>
        <EditorButton label="Numbered list" active={state?.orderedList} onPress={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered size={14} /></EditorButton>
        <EditorButton label={state?.link ? 'Remove link' : 'Add link'} active={state?.link} onPress={editLink}><Link2 size={14} /></EditorButton>
        <span className="mx-1 h-5 w-px bg-[#dedbd5]" aria-hidden="true" />
        <EditorButton label="Undo" disabled={!state?.canUndo} onPress={() => editor?.chain().focus().undo().run()}><Undo2 size={14} /></EditorButton>
        <EditorButton label="Redo" disabled={!state?.canRedo} onPress={() => editor?.chain().focus().redo().run()}><Redo2 size={14} /></EditorButton>
      </div>
      {editor ? <EditorContent editor={editor} /> : <div className="h-[108px] animate-pulse bg-[#faf9f5] motion-reduce:animate-none" aria-label="Loading text editor" />}
    </div>
  )
}

function EditorButton({
  label,
  active = false,
  disabled = false,
  onPress,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onPress: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => {
        event.preventDefault()
        onPress()
      }}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition-[background-color,color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-none ${
        active
          ? 'bg-[#cc785c] text-white'
          : 'text-[#6c6a64] hover:bg-white hover:text-[#141413] active:scale-95 motion-reduce:active:scale-100'
      }`}
    >
      {children}
    </button>
  )
}
