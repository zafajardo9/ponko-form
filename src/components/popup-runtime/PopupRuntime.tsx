import { useEffect, useState, type CSSProperties } from 'react'
import { ArrowRight, ExternalLink, Mail, Sparkles, X } from 'lucide-react'
import type { PopupButtonIcon, PopupElement, PopupStyle } from '../../lib/popup-builder/types'
import { popupRichTextHtml, sanitizePopupHtml, sanitizePopupUrl } from '../../lib/popup-builder/sanitize'

/**
 * PopupRuntime
 *
 * Renders a popup's design canvas — the single source of truth shared by the
 * public embed iframe (mode="embed": postMessage protocol, close button) and
 * the builder's live WYSIWYG canvas (mode="builder": static content only;
 * the builder overlays its own interaction layer).
 */

const FONT_STACKS: Record<NonNullable<PopupStyle['fontFamily']>, string> = {
  sans: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
  serif: '"Cormorant Garamond", "Times New Roman", serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
}

const FONT_WEIGHTS: Record<string, number> = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
}

const BUTTON_SHADOWS = {
  none: 'none',
  soft: '0 6px 16px rgba(20, 20, 19, 0.13)',
  strong: '0 12px 28px rgba(20, 20, 19, 0.22)',
} as const

export interface PopupRuntimeProps {
  publicId: string
  width: number
  height: number
  style?: PopupStyle
  elements: PopupElement[]
  mode?: 'embed' | 'builder'
}

export function PopupRuntime({
  publicId,
  width,
  height,
  style = {},
  elements,
  mode = 'embed',
}: PopupRuntimeProps) {
  const embed = mode === 'embed'
  const [showTick, setShowTick] = useState(0)

  function post(message: Record<string, unknown>) {
    if (!embed) return
    window.parent?.postMessage({ popupId: publicId, ...message }, '*')
  }

  // Ready on mount; listen for the host's "show" to replay the entrance.
  useEffect(() => {
    if (!embed) return
    post({ type: 'ponkoform:popup:ready' })
    const onMessage = (event: MessageEvent) => {
      const data = event.data
      if (event.source !== window.parent || !data || data.popupId !== publicId) return
      if (data.type === 'ponkoform:popup:show') setShowTick((tick) => tick + 1)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') post({ type: 'ponkoform:popup:close' })
    }
    window.addEventListener('message', onMessage)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('message', onMessage)
      window.removeEventListener('keydown', onKeyDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicId, embed])

  const cardStyle: CSSProperties = {
    position: 'relative',
    width,
    height,
    background: style.backgroundColor || '#ffffff',
    borderRadius: style.borderRadius == null ? 16 : style.borderRadius,
    fontFamily: FONT_STACKS[style.fontFamily ?? 'sans'],
    overflow: 'hidden',
  }

  const entranceClass = style.animation && style.animation !== 'none'
    ? `ponko-popup-enter-${style.animation}`
    : undefined

  return (
    <div
      key={showTick}
      style={cardStyle}
      className={entranceClass}
      data-popup-runtime={publicId}
    >
      {elements.map((element) => (
        <ElementView
          key={element.id}
          element={element}
          onButtonClick={(link, newTab) => post({ type: 'ponkoform:popup:click', link, newTab })}
          interactive={embed}
        />
      ))}

      {embed && style.closable !== false ? (
        <button
          type="button"
          aria-label="Close popup"
          onClick={() => post({ type: 'ponkoform:popup:close' })}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 9999,
            border: 'none',
            cursor: 'pointer',
            background: 'rgba(20, 20, 19, 0.06)',
            color: '#3d3d3a',
          }}
        >
          <X size={15} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}

function ElementView({
  element,
  onButtonClick,
  interactive,
}: {
  element: PopupElement
  onButtonClick: (link: string, newTab: boolean) => void
  interactive: boolean
}) {
  const positioned: CSSProperties = {
    position: 'absolute',
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    zIndex: element.zIndex,
    opacity: element.opacity,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
  }

  switch (element.type) {
    case 'heading':
      return (
        <div style={{
          ...positioned,
          color: element.color,
          fontSize: element.fontSize,
          fontWeight: FONT_WEIGHTS[element.fontWeight] ?? 600,
          textAlign: element.align,
          lineHeight: 1.2,
          display: 'flex',
          alignItems: element.verticalAlign === 'middle'
            ? 'center'
            : element.verticalAlign === 'bottom'
              ? 'flex-end'
              : 'flex-start',
          overflow: 'hidden',
        }}>
          <span style={{ width: '100%', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>
            {element.text}
          </span>
        </div>
      )
    case 'text':
      return (
        <div style={{
          ...positioned,
          color: element.color,
          fontSize: element.fontSize,
          lineHeight: element.lineHeight,
          textAlign: element.align,
          display: 'flex',
          alignItems: element.verticalAlign === 'middle'
            ? 'center'
            : element.verticalAlign === 'bottom'
              ? 'flex-end'
              : 'flex-start',
          overflow: 'hidden',
        }}>
          <div
            className="popup-rich-text"
            style={{ width: '100%', overflowWrap: 'break-word' }}
            dangerouslySetInnerHTML={{ __html: popupRichTextHtml(element.text) }}
          />
        </div>
      )
    case 'image':
      return element.src ? (
        <img
          src={element.src}
          alt={element.alt}
          style={{
            ...positioned,
            objectFit: element.fit,
            borderRadius: element.radius,
            display: 'block',
          }}
        />
      ) : (
        <div
          aria-label="Image placeholder"
          style={{
            ...positioned,
            borderRadius: element.radius,
            border: '1px dashed #cfc6ba',
            background: '#f7f4ef',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#8e8b82',
            fontSize: 12,
          }}
        >
          Image
        </div>
      )
    case 'button': {
      const hasLink = Boolean(element.link.trim())
      const icon = element.icon ?? 'none'
      const iconPosition = element.iconPosition ?? 'right'
      const buttonIcon = icon === 'none' ? null : <ButtonIcon icon={icon} size={Math.max(12, Math.min(22, element.fontSize))} />
      const horizontal = element.textAlign ?? 'center'
      const vertical = element.verticalAlign ?? 'middle'
      return (
        <button
          type="button"
          className="ponko-popup-button"
          data-hover-effect={element.hoverEffect ?? 'none'}
          data-interactive={interactive && hasLink ? 'true' : 'false'}
          disabled={interactive && !hasLink}
          onClick={() => {
            if (!interactive || !hasLink) return
            const safeLink = sanitizePopupUrl(element.link)
            if (safeLink) onButtonClick(safeLink, element.openInNewTab)
          }}
          style={{
            ...positioned,
            '--popup-button-base-transform': element.rotation ? `rotate(${element.rotation}deg)` : 'none',
            '--popup-button-hover-bg': element.hoverBgColor ?? element.bgColor,
            '--popup-button-hover-color': element.hoverTextColor ?? element.textColor,
            '--popup-button-shadow': BUTTON_SHADOWS[element.shadow ?? 'none'],
            transform: undefined,
            background: element.bgColor,
            color: element.textColor,
            borderColor: element.borderColor ?? element.bgColor,
            borderStyle: 'solid',
            borderWidth: element.borderWidth ?? 0,
            borderRadius: element.radius,
            fontSize: element.fontSize,
            fontWeight: FONT_WEIGHTS[element.fontWeight] ?? 500,
            fontStyle: element.fontStyle ?? 'normal',
            letterSpacing: element.letterSpacing ?? 0,
            textTransform: element.textTransform ?? 'none',
            cursor: interactive && hasLink ? 'pointer' : 'default',
            width: element.width,
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: vertical === 'top' ? 'flex-start' : vertical === 'bottom' ? 'flex-end' : 'center',
            justifyContent: horizontal === 'left' ? 'flex-start' : horizontal === 'right' ? 'flex-end' : 'center',
            gap: 8,
            padding: `${element.paddingY ?? 8}px ${element.paddingX ?? 16}px`,
            lineHeight: 1.15,
            textAlign: horizontal,
            boxSizing: 'border-box',
            whiteSpace: 'normal',
          } as CSSProperties}
        >
          {buttonIcon && iconPosition === 'left' ? buttonIcon : null}
          <span>{element.label || 'Button'}</span>
          {buttonIcon && iconPosition === 'right' ? buttonIcon : null}
        </button>
      )
    }
    case 'divider':
      return (
        <div aria-hidden="true" style={{ ...positioned, display: 'flex', alignItems: 'center' }}>
          <div style={{
            width: '100%',
            borderTopWidth: element.thickness,
            borderTopStyle: element.lineStyle,
            borderTopColor: element.color,
          }} />
        </div>
      )
    case 'html':
      return (
        <div
          style={{ ...positioned, overflow: 'hidden' }}
          dangerouslySetInnerHTML={{ __html: sanitizePopupHtml(element.html) }}
        />
      )
  }
}

function ButtonIcon({ icon, size }: { icon: Exclude<PopupButtonIcon, 'none'>; size: number }) {
  const props = { size, strokeWidth: 1.8, 'aria-hidden': true as const }
  if (icon === 'arrow-right') return <ArrowRight {...props} />
  if (icon === 'external-link') return <ExternalLink {...props} />
  if (icon === 'mail') return <Mail {...props} />
  return <Sparkles {...props} />
}
