import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import LinkExtension from '@tiptap/extension-link'
import { Bold, Heading1, Italic, Link as LinkIcon, List, ListOrdered, Underline as UnderlineIcon } from 'lucide-react'
import type { TemplateVariable } from '../../lib/invoicing/types'

export function TemplateRichTextEditor({
  value,
  onChange,
  variables,
}: {
  value: string
  onChange: (html: string) => void
  variables: TemplateVariable[]
}) {
  const lastHtml = useRef(value)
  const [, refresh] = useState(0)
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      Underline,
      LinkExtension.configure({ openOnClick: false, protocols: ['https', 'mailto'] }),
    ],
    content: value || '<p></p>',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'rich-text-content min-h-52 bg-white px-4 py-3 text-sm leading-6 text-[#141413] outline-none',
      },
    },
    onUpdate: ({ editor: current }) => {
      lastHtml.current = current.getHTML()
      onChange(lastHtml.current)
      refresh((version) => version + 1)
    },
    onSelectionUpdate: () => refresh((version) => version + 1),
  })

  useEffect(() => {
    if (!editor || value === lastHtml.current) return
    lastHtml.current = value
    editor.commands.setContent(value || '<p></p>', { emitUpdate: false })
  }, [editor, value])

  if (!editor) return <div className="h-64 animate-pulse rounded-lg bg-[#efe9de]" />

  const toolbarButton = (label: string, active: boolean, action: () => void, icon: React.ReactNode) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(event) => { event.preventDefault(); action() }}
      className={`flex h-8 w-8 items-center justify-center rounded-md ${active ? 'bg-[#cc785c] text-white' : 'text-[#6c6a64] hover:bg-[#efe9de]'}`}
    >
      {icon}
    </button>
  )

  return (
    <div className="overflow-hidden rounded-lg border border-[#e6dfd8] focus-within:ring-2 focus-within:ring-[#cc785c]/20">
      <div className="flex flex-wrap items-center gap-1 border-b border-[#e6dfd8] bg-[#faf9f5] p-2">
        {toolbarButton('Bold', editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), <Bold size={15} />)}
        {toolbarButton('Italic', editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), <Italic size={15} />)}
        {toolbarButton('Underline', editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), <UnderlineIcon size={15} />)}
        {toolbarButton('Heading', editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), <Heading1 size={15} />)}
        {toolbarButton('Bullet list', editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), <List size={15} />)}
        {toolbarButton('Numbered list', editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered size={15} />)}
        {toolbarButton('Add link', editor.isActive('link'), () => {
          const href = window.prompt('HTTPS or mailto link')
          if (!href) return
          if (!/^(https:\/\/|mailto:)/i.test(href)) return
          editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
        }, <LinkIcon size={15} />)}
        <select
          aria-label="Insert template variable"
          defaultValue=""
          onChange={(event) => {
            if (event.target.value) editor.chain().focus().insertContent(`{{${event.target.value}}}`).run()
            event.target.value = ''
          }}
          className="ml-auto h-8 rounded-md border border-[#e6dfd8] bg-white px-2 text-xs text-[#6c6a64]"
        >
          <option value="">Insert variable…</option>
          {(['respondent', 'form', 'payment', 'system'] as const).map((category) => (
            <optgroup key={category} label={category[0].toUpperCase() + category.slice(1)}>
              {variables.filter((variable) => variable.category === category).map((variable) => (
                <option key={variable.key} value={variable.key}>{variable.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

