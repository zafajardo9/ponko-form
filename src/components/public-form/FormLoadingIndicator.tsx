interface FormLoadingIndicatorProps {
  message?: string
  className?: string
}

/**
 * The shared-form loader intentionally has one visual signal only. The form
 * remains on its configured background while metadata, runtime, or resume
 * state is loading; assistive technology receives the more specific message.
 */
export function FormLoadingIndicator({
  message = 'Loading form',
  className = '',
}: FormLoadingIndicatorProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading form"
      className={`flex min-h-[240px] items-center justify-center sm:min-h-[320px] ${className}`}
    >
      <svg
        viewBox="0 0 40 40"
        width="40"
        height="40"
        aria-hidden="true"
        className="animate-spin text-[var(--ponko-primary,#cc785c)] [animation-duration:1.15s] motion-reduce:animate-none"
      >
        <g
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2.5"
        >
          <path d="M20 4v6" opacity="1" />
          <path d="m31.31 8.69-4.24 4.24" opacity=".86" />
          <path d="M36 20h-6" opacity=".72" />
          <path d="m31.31 31.31-4.24-4.24" opacity=".58" />
          <path d="M20 36v-6" opacity=".44" />
          <path d="m8.69 31.31 4.24-4.24" opacity=".34" />
          <path d="M4 20h6" opacity=".24" />
          <path d="m8.69 8.69 4.24 4.24" opacity=".16" />
        </g>
      </svg>
      <span className="sr-only">{message}</span>
    </div>
  )
}
