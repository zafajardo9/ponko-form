import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bold,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Underline as UnderlineIcon,
} from 'lucide-react'

type ToolbarState = {
  bold: boolean
  italic: boolean
  underline: boolean
  heading1: boolean
  heading2: boolean
  bulletList: boolean
  orderedList: boolean
}

const EMPTY_TOOLBAR: ToolbarState = {
  bold: false,
  italic: false,
  underline: false,
  heading1: false,
  heading2: false,
  bulletList: false,
  orderedList: false,
}

function normalizedHtml(value: string) {
  return value || '<p></p>'
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
      ? String(document.queryCommandValue(command)).toLowerCase().replace(/[<>]/g, '')
      : ''
  } catch {
    return ''
  }
}

export default function RichTextEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (html: string) => void
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const lastHtmlRef = useRef(normalizedHtml(value))
  const savedRangeRef = useRef<Range | null>(null)
  const [toolbar, setToolbar] = useState(EMPTY_TOOLBAR)

  const updateToolbar = useCallback(() => {
    const selection = window.getSelection()
    const anchor = selection?.anchorNode
    if (!anchor || !editorRef.current?.contains(anchor)) {
      setToolbar(EMPTY_TOOLBAR)
      return
    }

    const block = commandValue('formatBlock')
    setToolbar({
      bold: commandState('bold'),
      italic: commandState('italic'),
      underline: commandState('underline'),
      heading1: block === 'h1',
      heading2: block === 'h2',
      bulletList: commandState('insertUnorderedList'),
      orderedList: commandState('insertOrderedList'),
    })
  }, [])

  const rememberSelection = useCallback(() => {
    const selection = window.getSelection()
    if (!selection?.rangeCount) return
    const range = selection.getRangeAt(0)
    if (!editorRef.current?.contains(range.commonAncestorContainer)) return
    savedRangeRef.current = range.cloneRange()
    updateToolbar()
  }, [updateToolbar])

  const restoreSelection = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()

    const selection = window.getSelection()
    if (!selection || !savedRangeRef.current) return
    selection.removeAllRanges()
    selection.addRange(savedRangeRef.current)
  }, [])

  const emitChange = useCallback(() => {
    const html = normalizedHtml(editorRef.current?.innerHTML ?? '')
    lastHtmlRef.current = html
    onChange(html)
    rememberSelection()
  }, [onChange, rememberSelection])

  const runCommand = useCallback((command: string, value?: string) => {
    restoreSelection()
    if (typeof document.execCommand === 'function') {
      document.execCommand(command, false, value)
    }
    emitChange()
  }, [emitChange, restoreSelection])

  useEffect(() => {
    const editor = editorRef.current
    const nextHtml = normalizedHtml(value)
    if (!editor || nextHtml === lastHtmlRef.current) return
    lastHtmlRef.current = nextHtml
    if (editor.innerHTML !== nextHtml) editor.innerHTML = nextHtml
  }, [value])

  useEffect(() => {
    if (typeof document.execCommand === 'function') {
      document.execCommand('defaultParagraphSeparator', false, 'p')
    }
    document.addEventListener('selectionchange', updateToolbar)
    return () => document.removeEventListener('selectionchange', updateToolbar)
  }, [updateToolbar])

  return (
    <div className="overflow-hidden rounded-md border border-[#e6dfd8] focus-within:border-[#cc785c] focus-within:ring-2 focus-within:ring-[#cc785c]/20">
      <div
        className="flex flex-wrap gap-1 border-b border-[#e6dfd8] bg-white p-1.5"
        role="toolbar"
        aria-label="Text formatting"
      >
        <ToolbarButton active={toolbar.bold} label="Bold" onPress={() => runCommand('bold')}>
          <Bold size={15} />
        </ToolbarButton>
        <ToolbarButton active={toolbar.italic} label="Italic" onPress={() => runCommand('italic')}>
          <Italic size={15} />
        </ToolbarButton>
        <ToolbarButton active={toolbar.underline} label="Underline" onPress={() => runCommand('underline')}>
          <UnderlineIcon size={15} />
        </ToolbarButton>
        <ToolbarButton
          active={toolbar.heading1}
          label="Heading 1"
          onPress={() => runCommand('formatBlock', toolbar.heading1 ? 'p' : 'h1')}
        >
          <Heading1 size={15} />
        </ToolbarButton>
        <ToolbarButton
          active={toolbar.heading2}
          label="Heading 2"
          onPress={() => runCommand('formatBlock', toolbar.heading2 ? 'p' : 'h2')}
        >
          <Heading2 size={15} />
        </ToolbarButton>
        <ToolbarButton
          active={toolbar.bulletList}
          label="Bullet list"
          onPress={() => runCommand('insertUnorderedList')}
        >
          <List size={15} />
        </ToolbarButton>
        <ToolbarButton
          active={toolbar.orderedList}
          label="Numbered list"
          onPress={() => runCommand('insertOrderedList')}
        >
          <ListOrdered size={15} />
        </ToolbarButton>
      </div>
      <div
        ref={editorRef}
        role="textbox"
        aria-label="Rich text content"
        aria-multiline="true"
        contentEditable
        suppressContentEditableWarning
        className="rich-text-content min-h-40 bg-[#faf9f5] px-3 py-3 text-sm leading-6 text-[#141413] outline-none"
        dangerouslySetInnerHTML={{ __html: normalizedHtml(value) }}
        onInput={emitChange}
        onFocus={rememberSelection}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        onBlur={rememberSelection}
      />
    </div>
  )
}

export function RichTextEditorLoading() {
  return (
    <div
      role="status"
      aria-label="Loading rich text editor"
      className="h-48 animate-pulse rounded-md border border-[#e6dfd8] bg-[#faf9f5]"
    />
  )
}

function ToolbarButton({
  active,
  label,
  onPress,
  children,
}: {
  active: boolean
  label: string
  onPress: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(event) => {
        event.preventDefault()
        onPress()
      }}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
        active ? 'bg-[#cc785c] text-white' : 'text-[#6c6a64] hover:bg-[#efe9de] hover:text-[#141413]'
      }`}
    >
      {children}
    </button>
  )
}
