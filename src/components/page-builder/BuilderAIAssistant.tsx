import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  ArrowUp,
  BookOpenText,
  Check,
  ImageIcon,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  WandSparkles,
  X,
} from 'lucide-react'
import { chatWithBuilderAI } from '../../lib/server-fns/ai-assistant'
import { renderMarkdown } from '../docs/MarkdownRenderer'
import type {
  AIAssistantMessage,
  AIAssistantMode,
  GeneratedFormCandidate,
} from '../../lib/ai/contracts'
import type { FormPage, FormReference, PageField, PageFieldOption, PageFieldType } from '../../lib/page-builder/types'
import { Button } from '../ui/Button'
import { useTransitionClose } from '../ui/useTransitionClose'

function truncate(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1))}…`
}

const greetings: Record<AIAssistantMode, AIAssistantMessage> = {
  guide: {
    role: 'assistant',
    content: 'Ask me how to structure a form, configure a field, or use a builder feature.',
  },
  generate: {
    role: 'assistant',
    content: 'Describe the form you need. I’ll turn the conversation into a draft you can review before it touches your canvas.',
  },
}

const guideStarterQuestions = [
  'Summarize what this form currently collects',
  'What could I improve in this form?',
  'Explain the references used in this form',
  'How can I add conditional logic?',
] as const

interface BuilderAIAssistantProps {
  formId: number
  formTitle: string | null
  open: boolean
  mode: AIAssistantMode
  pages: FormPage[]
  references: FormReference[]
  onModeChange: (mode: AIAssistantMode) => void
  onApply: (candidate: GeneratedFormCandidate) => void
  onClose: () => void
}

export function BuilderAIAssistant({
  formId,
  formTitle,
  open,
  mode,
  pages,
  references,
  onModeChange,
  onApply,
  onClose,
}: BuilderAIAssistantProps) {
  const [histories, setHistories] = useState<Record<AIAssistantMode, AIAssistantMessage[]>>({
    guide: [greetings.guide],
    generate: [greetings.generate],
  })
  const [input, setInput] = useState('')
  const [candidate, setCandidate] = useState<GeneratedFormCandidate | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastPrompt, setLastPrompt] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const messages = histories[mode]
  const { requestClose, transitionClass } = useTransitionClose(
    onClose,
    '--modal-close-dur',
    150,
    open,
  )

  const draft = useMemo(() => ({
    formTitle,
    pages: pages.slice(0, 8).map((page) => ({
      title: page.title,
      description: page.description ? truncate(page.description, 250) : null,
      isFinal: page.isFinal,
      fields: page.fields.slice(0, 20).map((field) => ({
        fieldType: field.fieldType,
        label: truncate(field.label, 120),
        required: field.required,
        bindVariable: field.bindVariable,
        placeholder: field.placeholder ? truncate(field.placeholder, 150) : null,
        options: field.options?.length
          ? field.options.slice(0, 8).map((option) => ({
              label: truncate(option.label, 60),
              value: truncate(option.value, 60),
            }))
          : null,
        width: field.width ?? 'full',
      })),
    })),
    references: references.slice(0, 50).map((reference) => ({
      key: reference.key,
      type: reference.type,
      value: truncate(reference.value, 100),
      label: reference.label ? truncate(reference.label, 120) : null,
      description: reference.description ? truncate(reference.description, 250) : null,
    })),
  }), [formTitle, pages, references])

  const mutation = useMutation({
    mutationFn: (payload: { activeMode: AIAssistantMode; requestMessages: AIAssistantMessage[] }) => {
      return chatWithBuilderAI({
        data: {
          formId,
          mode: payload.activeMode,
          messages: payload.requestMessages,
          draft,
          ...(payload.activeMode === 'generate' && candidate ? { candidate } : {}),
        },
      })
    },
    onSuccess: (response, variables) => {
      if (response.kind === 'error') {
        setError(response.message)
        return
      }
      setHistories((current) => ({
        ...current,
        [variables.activeMode]: [
          ...current[variables.activeMode],
          { role: 'assistant', content: response.message },
        ].slice(-24),
      }))
      if (response.kind === 'generation') setCandidate(response.candidate)
      setError(null)
    },
    onError: () => {
      setError('The assistant could not respond right now. Your form has not been changed.')
    },
  })

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        requestClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      document.querySelector<HTMLButtonElement>('button[aria-label="Ask Ponko"]')?.focus()
    }
  }, [open, requestClose])

  useEffect(() => {
    if (!open) return
    const scroller = scrollRef.current
    if (!scroller) return
    if (typeof scroller.scrollTo === 'function') {
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' })
    } else {
      scroller.scrollTop = scroller.scrollHeight
    }
  }, [candidate, messages, mutation.isPending, open])

  function send(prompt: string, recordUserMessage = true) {
    const clean = prompt.trim()
    if (!clean || mutation.isPending) return
    const activeMode = mode
    const conversation = histories[activeMode].slice(1)
    const requestMessages = recordUserMessage
      ? [...conversation, { role: 'user' as const, content: clean }].slice(-12)
      : conversation.slice(-12)
    if (recordUserMessage) {
      setHistories((current) => ({
        ...current,
        [activeMode]: [...current[activeMode], { role: 'user', content: clean }].slice(-24),
      }))
    }
    setInput('')
    setError(null)
    setLastPrompt(clean)
    mutation.mutate({ activeMode, requestMessages })
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    send(input)
  }

  if (!open) return null

  return (
    <div
      className={`t-overlay fixed inset-0 z-[70] flex items-center justify-center bg-[#141413]/35 p-2 backdrop-blur-[2px] sm:p-4 lg:p-6 ${transitionClass}`}
      aria-live="polite"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose()
      }}
    >
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="builder-ai-title"
        className={`t-modal relative flex h-[min(96dvh,940px)] w-[min(98vw,1480px)] flex-col overflow-hidden rounded-2xl border border-white/70 bg-[#fbfaf7] shadow-[0_30px_100px_rgba(32,26,21,0.28)] sm:h-[min(92dvh,940px)] ${transitionClass}`}
      >
        <header className="flex min-h-[68px] shrink-0 items-center justify-between gap-4 border-b border-[#e6dfd8] bg-white px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f1dfd7] text-[#a9583e]">
              <Sparkles size={17} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="builder-ai-title" className="truncate text-sm font-semibold text-[#141413]">Ponko assistant</h2>
              <p className="hidden truncate text-xs text-[#817d76] sm:block">Ask for guidance or build a form, then review it visually.</p>
            </div>
          </div>

          <div className="grid w-[min(46vw,310px)] grid-cols-2 rounded-lg bg-[#f2ede6] p-1" role="tablist" aria-label="Assistant mode">
            <ModeButton active={mode === 'guide'} disabled={mutation.isPending} icon={<BookOpenText size={14} />} onClick={() => onModeChange('guide')}>
              AI Guide
            </ModeButton>
            <ModeButton active={mode === 'generate'} disabled={mutation.isPending} icon={<WandSparkles size={14} />} onClick={() => onModeChange('generate')}>
              Generate Form
            </ModeButton>
          </div>

          <button
            type="button"
            aria-label="Close assistant"
            onClick={requestClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#6c6a64] transition-colors hover:bg-[#f2ede6] hover:text-[#141413] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:grid-cols-[minmax(350px,420px)_minmax(0,1fr)] lg:grid-rows-1">
          <div className="flex min-h-0 flex-col border-b border-[#e6dfd8] bg-[#fbfaf7] lg:border-b-0 lg:border-r">
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5">
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${
                      message.role === 'user'
                        ? 'rounded-br-md bg-[#cc785c] text-white'
                        : 'rounded-bl-md border border-[#e4ddd4] bg-white text-[#34322e] shadow-[0_2px_8px_rgba(45,37,31,0.04)]'
                    }`}>
                      {message.role === 'user' ? message.content : <ChatMarkdown content={message.content} />}
                    </div>
                  </div>
                ))}
                {mode === 'guide' && messages.length === 1 && !mutation.isPending && (
                  <div role="group" aria-label="Suggested questions" className="pt-1">
                    <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#8b857d]">
                      Start with your form
                    </p>
                    <div className="grid gap-2">
                      {guideStarterQuestions.map((question) => (
                        <button
                          key={question}
                          type="button"
                          onClick={() => send(question)}
                          className="group flex w-full items-center justify-between gap-3 rounded-xl border border-[#dfd7cd] bg-white px-3.5 py-3 text-left text-xs font-medium leading-5 text-[#4d4943] shadow-[0_2px_8px_rgba(45,37,31,0.03)] transition-[border-color,background-color,color,transform] duration-[var(--duration-quick)] hover:-translate-y-0.5 hover:border-[#d2a18f] hover:bg-[#fffaf7] hover:text-[#8f4b37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2 active:translate-y-0 motion-reduce:transition-none"
                        >
                          <span>{question}</span>
                          <ArrowUp
                            size={14}
                            className="shrink-0 rotate-45 text-[#b4ada4] transition-colors group-hover:text-[#cc785c]"
                            aria-hidden="true"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {mutation.isPending && (
                  <div role="status" className="flex items-center gap-2 text-xs text-[#817d76]">
                    <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    {mode === 'generate' ? 'Preparing the form draft…' : 'Thinking through your question…'}
                  </div>
                )}
                {error && (
                  <div role="alert" className="rounded-xl border border-[#e5c4bd] bg-[#fff8f5] p-3 text-sm text-[#8d3e32]">
                    <p>{error}</p>
                    {lastPrompt && (
                      <button
                        type="button"
                        onClick={() => send(lastPrompt, false)}
                        className="mt-2 inline-flex items-center gap-1.5 font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]"
                      >
                        <RotateCcw size={13} aria-hidden="true" /> Retry
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={submit} className="shrink-0 border-t border-[#e6dfd8] bg-white p-3 sm:p-4">
              <label htmlFor="builder-ai-prompt" className="sr-only">
                {mode === 'generate' ? 'Describe or refine your form' : 'Ask a builder question'}
              </label>
              <div className="flex items-end gap-2 rounded-xl border border-[#dcd4ca] bg-[#fbfaf7] p-2 shadow-inner focus-within:border-[#cc785c] focus-within:ring-2 focus-within:ring-[#cc785c]/15">
                <textarea
                  ref={inputRef}
                  id="builder-ai-prompt"
                  value={input}
                  onChange={(event) => setInput(event.target.value.slice(0, 2_000))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      send(input)
                    }
                  }}
                  rows={2}
                  maxLength={2_000}
                  placeholder={mode === 'generate' ? 'e.g. A workshop registration form…' : 'How do I add conditional logic?'}
                  className="max-h-28 min-h-11 flex-1 resize-none bg-transparent px-1.5 py-2 text-sm leading-5 text-[#141413] outline-none placeholder:text-[#9a968e]"
                />
                <button
                  type="submit"
                  aria-label="Send message"
                  disabled={!input.trim() || mutation.isPending}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#cc785c] text-white transition-colors hover:bg-[#a9583e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowUp size={16} aria-hidden="true" />
                </button>
              </div>
              <p className="mt-2 text-center text-[11px] text-[#969188]">Review generated content before saving your form.</p>
            </form>
          </div>

          <FormPreviewWorkspace
            pages={mode === 'generate' && candidate ? candidate.pages : pages}
            generated={mode === 'generate' && candidate !== null}
            onApply={candidate ? () => onApply(candidate) : undefined}
            onKeepEditing={() => inputRef.current?.focus()}
          />
        </div>
      </section>
    </div>
  )
}

function ChatMarkdown({ content }: { content: string }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const html = useMemo(() => renderMarkdown(content), [content])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let cancelled = false
    void import('../docs/SyntaxHighlighter')
      .then(async ({ highlightCodeBlocks }) => {
        if (cancelled) return
        await highlightCodeBlocks(root)
      })
      .catch(() => {
        // Highlighting is progressive enhancement; the escaped source stays readable.
      })
    return () => { cancelled = true }
  }, [html])

  return (
    <div
      ref={rootRef}
      className={`
        max-w-none text-sm leading-6 text-[#34322e]

        [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0

        [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-[#141413]
        [&_h3]:mt-3.5 [&_h3]:mb-1.5 [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:text-[#141413]
        [&_h4]:mt-3 [&_h4]:mb-1 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:uppercase [&_h4]:tracking-[0.08em] [&_h4]:text-[#766f66]

        [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1
        [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1
        [&_li]:pl-0.5 [&_li::marker]:font-semibold [&_li::marker]:text-[#c5775d]

        [&_strong]:font-semibold [&_strong]:text-[#1d1c1a]
        [&_em]:text-[#57544d]

        [&_a]:font-medium [&_a]:text-[#b95f43] [&_a]:underline [&_a]:underline-offset-2
        hover:[&_a]:text-[#8f432d]

        [&_code]:rounded [&_code]:border [&_code]:border-[#e3dbd0] [&_code]:bg-[#f5f0e8]
        [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:font-normal [&_code]:text-[#77539a]

        [&_blockquote]:my-3 [&_blockquote]:rounded-lg [&_blockquote]:border [&_blockquote]:border-l-4
        [&_blockquote]:border-[#e3d7ca] [&_blockquote]:border-l-[#cc785c] [&_blockquote]:bg-[#fbf7f1]
        [&_blockquote]:px-4 [&_blockquote]:py-2.5 [&_blockquote]:not-italic

        [&_hr]:my-4 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-[#e6dfd8]

        [&_img]:my-3 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg

        [&_.heading-anchor]:hidden

        [&_.code-block]:my-3 [&_.code-block]:overflow-hidden [&_.code-block]:rounded-lg
        [&_.code-block]:border [&_.code-block]:border-[#252320] [&_.code-block]:bg-[#181715]
        [&_.code-header]:flex [&_.code-header]:items-center [&_.code-header]:justify-between
        [&_.code-header]:gap-3 [&_.code-header]:border-b [&_.code-header]:border-[#34312c]
        [&_.code-header]:bg-[#252320] [&_.code-header]:px-3.5 [&_.code-header]:py-2
        [&_.code-title]:flex [&_.code-title]:min-w-0 [&_.code-title]:items-center [&_.code-title]:gap-2
        [&_.code-dot]:h-2 [&_.code-dot]:w-2 [&_.code-dot]:rounded-full
        [&_.code-lang]:truncate [&_.code-lang]:font-mono [&_.code-lang]:text-[10px]
        [&_.code-lang]:font-medium [&_.code-lang]:uppercase [&_.code-lang]:tracking-wide [&_.code-lang]:text-[#a09d96]
        [&_.code-copy]:shrink-0 [&_.code-copy]:rounded-md [&_.code-copy]:border [&_.code-copy]:border-[#474139]
        [&_.code-copy]:bg-[#181715] [&_.code-copy]:px-2 [&_.code-copy]:py-1
        [&_.code-copy]:text-[11px] [&_.code-copy]:font-medium [&_.code-copy]:text-[#faf9f5]
        [&_.code-copy]:transition-colors hover:[&_.code-copy]:border-[#cc785c] hover:[&_.code-copy]:text-[#cc785c]
        [&_.code-body]:bg-[#181715]
        [&_.code-pre]:!m-0 [&_.code-pre]:overflow-x-auto [&_.code-pre]:!bg-transparent
        [&_.code-pre]:!p-3.5 [&_.code-pre]:font-mono [&_.code-pre]:text-[12.5px] [&_.code-pre]:leading-5
        [&_.code-pre]:text-[#f5f0e8]
        [&_.code-pre_code]:!border-0 [&_.code-pre_code]:!bg-transparent [&_.code-pre_code]:!p-0
        [&_.code-pre_code]:!font-inherit [&_.code-pre_code]:!text-inherit

        [&_.docs-table-wrap]:my-3 [&_.docs-table-wrap]:overflow-x-auto [&_.docs-table-wrap]:rounded-lg
        [&_.docs-table-wrap]:border [&_.docs-table-wrap]:border-[#d8d0c5]
        [&_.docs-table]:w-full [&_.docs-table]:text-xs
        [&_.docs-table_th]:border-b [&_.docs-table_th]:border-[#d8d0c5] [&_.docs-table_th]:bg-[#efe9de]
        [&_.docs-table_th]:px-2.5 [&_.docs-table_th]:py-2 [&_.docs-table_th]:text-left [&_.docs-table_th]:font-semibold
        [&_.docs-table_td]:border-b [&_.docs-table_td]:border-[#e6dfd8] [&_.docs-table_td]:px-2.5 [&_.docs-table_td]:py-2
        [&_.docs-table_td]:align-top
        [&_.docs-table_tr:last-child_td]:border-b-0
      `}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function ModeButton( {
  active,
  disabled,
  icon,
  onClick,
  children,
}: {
  active: boolean
  disabled: boolean
  icon: ReactNode
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-[11px] font-medium transition-[color,background-color,box-shadow] sm:gap-2 sm:text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] disabled:cursor-wait disabled:opacity-60 ${
        active ? 'bg-white text-[#8f4b37] shadow-sm' : 'text-[#6c6a64] hover:text-[#141413]'
      }`}
    >
      {icon}<span className="truncate">{children}</span>
    </button>
  )
}

type PreviewField = Pick<PageField, 'fieldType' | 'label' | 'placeholder' | 'required' | 'options' | 'bindVariable' | 'width'>
type PreviewPage = {
  title: string
  description: string | null
  isFinal: boolean
  finalTemplate: string | null
  fields: PreviewField[]
}

function FormPreviewWorkspace({
  pages,
  generated,
  onApply,
  onKeepEditing,
}: {
  pages: PreviewPage[]
  generated: boolean
  onApply?: () => void
  onKeepEditing: () => void
}) {
  const [activePage, setActivePage] = useState(0)
  const safeIndex = Math.min(activePage, Math.max(0, pages.length - 1))
  const page = pages[safeIndex]
  const editable = pages.filter((item) => !item.isFinal)
  const fieldCount = editable.reduce((total, item) => total + item.fields.length, 0)

  useEffect(() => setActivePage(0), [pages])

  return (
    <section
      aria-label={generated ? 'Generated form preview' : 'Current form preview'}
      className="flex min-h-0 flex-col bg-[#f3f0eb]"
    >
      <div className="flex min-h-[58px] shrink-0 items-center justify-between gap-4 border-b border-[#ddd6cd] bg-[#f8f6f2] px-4 sm:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#7d7870]">
              {generated ? 'Generated preview' : 'Live form context'}
            </p>
            {generated && <span className="rounded-full bg-[#e8f3e8] px-2 py-0.5 text-[10px] font-medium text-[#3f7047]">Ready to review</span>}
          </div>
          <p className="mt-0.5 text-xs text-[#817d76]">{editable.length} {editable.length === 1 ? 'page' : 'pages'} · {fieldCount} fields · not saved</p>
        </div>
        <WandSparkles size={17} className={generated ? 'text-[#cc785c]' : 'text-[#aaa49b]'} aria-hidden="true" />
      </div>

      <div className="shrink-0 overflow-x-auto border-b border-[#ddd6cd] bg-white px-4 sm:px-6">
        <div className="flex min-w-max gap-1 py-2" role="tablist" aria-label="Preview pages">
          {pages.map((item, index) => (
            <button
              key={`${item.title}-${index}`}
              type="button"
              role="tab"
              aria-selected={safeIndex === index}
              onClick={() => setActivePage(index)}
              className={`rounded-md px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] ${
                safeIndex === index ? 'bg-[#eee7df] font-medium text-[#5f3f34]' : 'text-[#77726a] hover:bg-[#f6f2ed] hover:text-[#242320]'
              }`}
            >
              {item.isFinal ? 'Confirmation' : item.title}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-7 lg:p-10">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-[#ded8d0] bg-white px-5 py-7 shadow-[0_12px_40px_rgba(49,42,35,0.08)] sm:px-9 sm:py-10">
          {page ? (
            page.isFinal ? <FinalPagePreview page={page} /> : <EditablePagePreview page={page} />
          ) : (
            <div className="grid min-h-48 place-items-center text-center text-sm text-[#817d76]">No pages to preview yet.</div>
          )}
        </div>
      </div>

      {generated && onApply && (
        <div className="shrink-0 border-t border-[#ddd6cd] bg-white px-4 py-3 sm:px-6">
          <div className="flex flex-col-reverse items-stretch justify-between gap-2 sm:flex-row sm:items-center">
            <p className="text-[11px] leading-4 text-[#817d76]">Replacing updates only the unsaved pages and fields. Save remains separate.</p>
            <div className="flex shrink-0 gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={onKeepEditing}>Keep editing</Button>
              <Button type="button" size="sm" onClick={onApply}>Replace draft</Button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function EditablePagePreview({ page }: { page: PreviewPage }) {
  return (
    <>
      <div className="mb-8 border-b border-[#eee9e3] pb-6">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#a9583e]">Form page</p>
        <h3 className="text-2xl font-semibold tracking-[-0.025em] text-[#242320] sm:text-3xl">{page.title}</h3>
        {page.description && <p className="mt-3 max-w-2xl text-sm leading-6 text-[#77726a]">{stripMarkup(page.description)}</p>}
      </div>
      {page.fields.length ? (
        <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2">
          {page.fields.map((field, index) => (
            <div key={`${field.bindVariable}-${index}`} className={field.width === 'half' ? '' : 'sm:col-span-2'}>
              <PreviewControl field={field} />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid min-h-36 place-items-center rounded-xl border border-dashed border-[#ddd6cd] bg-[#faf9f7] text-sm text-[#928d85]">This page has no fields yet.</div>
      )}
    </>
  )
}

function FinalPagePreview({ page }: { page: PreviewPage }) {
  return (
    <div className="grid min-h-[320px] place-items-center text-center">
      <div className="max-w-lg">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#e9f2e8] text-[#4f7c54]">
          <Check size={22} aria-hidden="true" />
        </span>
        <h3 className="mt-5 text-2xl font-semibold tracking-[-0.02em] text-[#242320]">{page.title}</h3>
        <p className="mt-3 text-sm leading-6 text-[#77726a]">{stripMarkup(page.finalTemplate || 'Your response has been submitted.')}</p>
      </div>
    </div>
  )
}

function PreviewControl({ field }: { field: PreviewField }) {
  if (field.fieldType === 'content') {
    return <p className="text-sm leading-6 text-[#595650]">{stripMarkup(field.placeholder || field.label)}</p>
  }

  if (field.fieldType === 'media') {
    const type = optionValue(field.options, 'type') || 'image'
    const caption = optionValue(field.options, 'caption')
    const canShowImage = type === 'image' && isSafeMediaUrl(field.placeholder)
    return (
      <figure className="overflow-hidden rounded-xl border border-[#ded8d0] bg-[#f7f5f1]">
        {canShowImage ? (
          <img src={field.placeholder!} alt={caption || field.label || 'Form media'} className="max-h-[420px] w-full object-contain" />
        ) : (
          <div className="grid min-h-40 place-items-center text-[#aaa49b]">
            <div className="text-center"><ImageIcon size={24} className="mx-auto" aria-hidden="true" /><p className="mt-2 text-xs">{type === 'image' ? 'Image preview' : `${type} preview`}</p></div>
          </div>
        )}
        {caption && <figcaption className="border-t border-[#e4ded6] bg-white px-3 py-2 text-xs text-[#77726a]">{caption}</figcaption>}
      </figure>
    )
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-[#34322e]">{field.label}{field.required && <span className="ml-0.5 text-[#b74e3c]">*</span>}</p>
      <FieldShape field={field} />
    </div>
  )
}

function FieldShape({ field }: { field: PreviewField }) {
  const options = field.options ?? []
  const inputClass = 'flex min-h-11 items-center rounded-lg border border-[#d9d3cb] bg-white px-3 text-sm text-[#aaa49b] shadow-sm'

  if (field.fieldType === 'textarea') return <div className={`${inputClass} min-h-24 items-start py-3`}>{field.placeholder || 'Long answer'}</div>
  if (field.fieldType === 'select') return <div className={`${inputClass} justify-between`}><span>{field.placeholder || 'Select an option'}</span><span aria-hidden="true">⌄</span></div>
  if (field.fieldType === 'radio' || field.fieldType === 'checkbox') {
    return <div className="space-y-2">{options.map((option) => <ChoiceShape key={option.value} option={option} square={field.fieldType === 'checkbox'} />)}</div>
  }
  if (field.fieldType === 'satisfaction') {
    return <div className="grid grid-cols-5 gap-2">{options.slice(0, 5).map((option, index) => <div key={option.value} className="grid h-10 place-items-center rounded-lg border border-[#d9d3cb] bg-white text-xs text-[#77726a]">{option.emoji || index + 1}</div>)}</div>
  }
  if (field.fieldType === 'address') {
    return <div className="grid grid-cols-2 gap-2"><div className={`${inputClass} col-span-2`}>Street address</div><div className={inputClass}>City</div><div className={inputClass}>Postal code</div></div>
  }

  const hints: Partial<Record<PageFieldType, string>> = {
    email: 'name@example.com', number: '0', date: 'MM / DD / YYYY', time: 'HH : MM', datetime: 'Date and time',
  }
  return <div className={inputClass}>{field.placeholder || hints[field.fieldType] || 'Short answer'}</div>
}

function ChoiceShape({ option, square }: { option: PageFieldOption; square: boolean }) {
  return <div className="flex items-center gap-2.5 text-sm text-[#595650]"><span className={`h-4 w-4 border border-[#cfc8bf] bg-white ${square ? 'rounded' : 'rounded-full'}`} />{option.label}</div>
}

function stripMarkup(value: string) {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function optionValue(options: PageFieldOption[] | null, label: string) {
  return options?.find((option) => option.label === label)?.value ?? ''
}

function isSafeMediaUrl(value: string | null) {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}
