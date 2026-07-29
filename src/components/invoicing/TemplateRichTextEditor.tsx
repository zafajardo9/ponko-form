import { useCallback, useEffect, useRef, useState } from 'react'
import { Bold, Heading1, Italic, Link as LinkIcon, List, ListOrdered, Underline as UnderlineIcon } from 'lucide-react'
import type { TemplateVariable } from '../../lib/invoicing/types'

type ToolbarState = {
  bold: boolean
  italic: boolean
  underline: boolean
  heading: boolean
  bulletList: boolean
  orderedList: boolean
  link: boolean
}

const EMPTY_TOOLBAR: ToolbarState = {
  bold: false,
  italic: false,
  underline: false,
  heading: false,
  bulletList: false,
  orderedList: false,
  link: false,
}

function commandState(command: string) {
  try {
    return typeof document.queryCommandState === 'function'
      ? document.queryCommandState(command)
      : false
  } catch {
    return false
  }
}

function commandValue(command: string) {
  try {
    return typeof document.queryCommandValue === 'function'
      ? String(document.queryCommandValue(command)).toLowerCase()
      : ''
  } catch {
    return ''
  }
}

export function TemplateRichTextEditor({
  value,
  onChange,
  variables,
}: {
  value: string
  onChange: (html: string) => void
  variables: TemplateVariable[]
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  // Keep the live contentEditable DOM uncontrolled. Rendering `value` through
  // React on every keystroke replaces its contents and moves the caret.
  // `null` ensures the initial value is still written on mount.
  const lastHtml = useRef<string | null>(null)
  const savedRange = useRef<Range | null>(null)
  const [toolbar, setToolbar] = useState(EMPTY_TOOLBAR)

  const updateToolbar = useCallback(() => {
    const selection = window.getSelection()
    const anchor = selection?.anchorNode
    if (!anchor || !editorRef.current?.contains(anchor)) {
      setToolbar(EMPTY_TOOLBAR)
      return
    }
    const format = commandValue('formatBlock').replace(/[<>]/g, '')
    setToolbar({
      bold: commandState('bold'),
      italic: commandState('italic'),
      underline: commandState('underline'),
      heading: format === 'h1',
      bulletList: commandState('insertUnorderedList'),
      orderedList: commandState('insertOrderedList'),
      link: commandState('createLink'),
    })
  }, [])

  const rememberSelection = useCallback(() => {
    const selection = window.getSelection()
    if (!selection?.rangeCount) return
    const range = selection.getRangeAt(0)
    if (!editorRef.current?.contains(range.commonAncestorContainer)) return
    savedRange.current = range.cloneRange()
    updateToolbar()
  }, [updateToolbar])

  const restoreSelection = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    const selection = window.getSelection()
    if (!selection || !savedRange.current) return
    selection.removeAllRanges()
    selection.addRange(savedRange.current)
  }, [])

  const emitChange = useCallback(() => {
    const html = editorRef.current?.innerHTML || '<p></p>'
    lastHtml.current = html
    onChange(html)
    rememberSelection()
  }, [onChange, rememberSelection])

  const runCommand = useCallback((command: string, commandValue?: string) => {
    restoreSelection()
    if (typeof document.execCommand === 'function') {
      document.execCommand(command, false, commandValue)
    }
    emitChange()
  }, [emitChange, restoreSelection])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || value === lastHtml.current) return
    lastHtml.current = value
    editor.innerHTML = value || '<p></p>'
    savedRange.current = null
  }, [value])

  useEffect(() => {
    if (typeof document.execCommand === 'function') {
      document.execCommand('defaultParagraphSeparator', false, 'p')
    }
  }, [])

  const toolbarButton = (
    label: string,
    active: boolean,
    action: () => void,
    icon: React.ReactNode,
  ) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(event) => {
        event.preventDefault()
        action()
      }}
      className={`flex h-8 w-8 items-center justify-center rounded-md ${
        active ? 'bg-[#cc785c] text-white' : 'text-[#6c6a64] hover:bg-[#efe9de]'
      }`}
    >
      {icon}
    </button>
  )

  return (
    <div className="overflow-hidden rounded-lg border border-[#e6dfd8] focus-within:ring-2 focus-within:ring-[#cc785c]/20">
      <div className="flex flex-wrap items-center gap-1 border-b border-[#e6dfd8] bg-[#faf9f5] p-2">
        {toolbarButton('Bold', toolbar.bold, () => runCommand('bold'), <Bold size={15} />)}
        {toolbarButton('Italic', toolbar.italic, () => runCommand('italic'), <Italic size={15} />)}
        {toolbarButton('Underline', toolbar.underline, () => runCommand('underline'), <UnderlineIcon size={15} />)}
        {toolbarButton(
          'Heading',
          toolbar.heading,
          () => runCommand('formatBlock', toolbar.heading ? 'p' : 'h1'),
          <Heading1 size={15} />,
        )}
        {toolbarButton('Bullet list', toolbar.bulletList, () => runCommand('insertUnorderedList'), <List size={15} />)}
        {toolbarButton('Numbered list', toolbar.orderedList, () => runCommand('insertOrderedList'), <ListOrdered size={15} />)}
        {toolbarButton('Add link', toolbar.link, () => {
          const href = window.prompt('HTTPS or mailto link')
          if (!href || !/^(https:\/\/|mailto:)/i.test(href)) return
          runCommand('createLink', href)
        }, <LinkIcon size={15} />)}
        <select
          aria-label="Insert template variable"
          defaultValue=""
          onMouseDown={rememberSelection}
          onChange={(event) => {
            const key = event.target.value
            if (key) runCommand('insertText', `{{${key}}}`)
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
      <div
        ref={editorRef}
        role="textbox"
        aria-label="Email body editor"
        aria-multiline="true"
        contentEditable
        suppressContentEditableWarning
        className="rich-text-content min-h-52 bg-white px-4 py-3 text-sm leading-6 text-[#141413] outline-none"
        onInput={emitChange}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        onFocus={rememberSelection}
        onBlur={rememberSelection}
      />
    </div>
  )
}
