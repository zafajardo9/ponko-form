import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Blocks, GripVertical } from 'lucide-react'
import type { CSSProperties } from 'react'
import {
  BlockEditor,
  SlashCommand,
  defaultSlashCommandItems,
  getSlashCommandSuggestion,
} from '../block-editor'
import '../block-editor/style.css'
import { formRichTextHtml } from '../../lib/form-rich-text'

const supportedCommands = new Set([
  'text', 'h1', 'h2', 'h3', 'bulletList', 'orderedList', 'blockquote', 'divider',
])

const formCommands = defaultSlashCommandItems.filter((item) => supportedCommands.has(item.id))

const editorTheme = {
  '--background': '#ffffff',
  '--foreground': '#141413',
  '--muted': '#f7f3ed',
  '--muted-foreground': '#8e8b82',
  '--popover': '#ffffff',
  '--popover-foreground': '#141413',
  '--border': '#e6dfd8',
  '--accent': '#efe9de',
  '--accent-foreground': '#141413',
  '--primary': '#cc785c',
  '--ring': '#cc785c',
  '--destructive': '#c64545',
  '--radius': '0.5rem',
} as CSSProperties

export default function FormBlockEditor({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (html: string) => void
  label: string
}) {
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    content: formRichTextHtml(value) || '<p></p>',
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
        underline: false,
        codeBlock: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      }),
      Placeholder.configure({ placeholder: 'Type / to add a content block…' }),
      SlashCommand.configure({ suggestion: getSlashCommandSuggestion(formCommands) }),
    ],
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-label': label,
        'aria-multiline': 'true',
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.isEmpty ? '' : formRichTextHtml(currentEditor.getHTML()))
    },
  })

  return (
    <div
      className="ponko-form-block-editor overflow-hidden rounded-lg border border-[#ded7ce] bg-white shadow-[0_2px_10px_rgba(45,37,31,0.04)] transition-[border-color,box-shadow] duration-[var(--duration-quick)] focus-within:border-[#cc785c] focus-within:shadow-[0_0_0_3px_rgba(204,120,92,0.13)] motion-reduce:transition-none"
      style={editorTheme}
    >
      <div aria-label="Block editor tips" className="flex items-center justify-between gap-3 border-b border-[#e6dfd8] bg-[#faf8f4] px-3 py-2 text-[10px] font-medium text-[#777169]">
        <span className="inline-flex items-center gap-1.5"><Blocks size={13} aria-hidden="true" /> Type <kbd className="rounded border border-[#ddd5ca] bg-white px-1 py-0.5 font-mono text-[9px] text-[#8f4b37]">/</kbd> for blocks</span>
        <span className="inline-flex items-center gap-1 max-sm:hidden"><GripVertical size={12} aria-hidden="true" /> Drag to reorder</span>
      </div>
      <BlockEditor editor={editor} />
    </div>
  )
}
