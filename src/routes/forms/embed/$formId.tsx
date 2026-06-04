import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { PublicFormView } from '../../../components/public-form/PublicFormView'

export const Route = createFileRoute('/forms/embed/$formId')({
  component: EmbedFormPage,
})

/**
 * Embeddable form page.
 *
 * Rendered bare (no app navigation, transparent background) so it can live
 * inside an <iframe> on any site. The form fills the iframe's width, and the
 * page reports its content height to the parent window via postMessage so the
 * host can size the iframe to fit — keeping the embed fully responsive to its
 * container with no scrollbars.
 */
function EmbedFormPage() {
  const { formId } = Route.useParams()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || window.parent === window) return

    function postHeight() {
      const height = containerRef.current?.scrollHeight ?? document.body.scrollHeight
      window.parent.postMessage(
        { type: 'ponkoform:resize', formId: Number(formId), height },
        '*',
      )
    }

    // Report on mount and whenever the content size changes (validation
    // errors, conditional fields, the thank-you screen, etc.).
    postHeight()
    const observer = new ResizeObserver(postHeight)
    if (containerRef.current) observer.observe(containerRef.current)
    window.addEventListener('load', postHeight)

    return () => {
      observer.disconnect()
      window.removeEventListener('load', postHeight)
    }
  }, [formId])

  return (
    <div ref={containerRef} className="min-h-0 w-full bg-transparent">
      <PublicFormView formId={Number(formId)} embed />
    </div>
  )
}
