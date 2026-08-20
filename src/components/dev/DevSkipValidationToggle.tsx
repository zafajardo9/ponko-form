import { setSkipValidation, useSkipValidation } from '@/lib/dev-test-mode'

/**
 * Floating pill shown only during local development (like react-grab). Toggles
 * form validation on/off so published forms can be submitted quickly without
 * filling in every required field.
 *
 * Positioned at the top-right of the form's content column (aligned to the same
 * `max-w-5xl` wrapper the form renders in), so it sits right by the form rather
 * than floating in a screen corner.
 */
export function DevSkipValidationToggle() {
  const skip = useSkipValidation()
  if (!import.meta.env.DEV) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] mx-auto w-full max-w-5xl px-3 sm:px-6 lg:px-8">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setSkipValidation(!skip)}
          aria-pressed={skip}
          title="Dev only — toggle form validation for fast testing"
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-[#e6dfd8] bg-white px-3 py-1.5 text-xs font-medium text-[#141413] shadow-md transition-colors hover:bg-[#faf9f5]"
        >
          <span
            aria-hidden
            className={`h-2 w-2 rounded-full ${skip ? 'bg-[#2f6f3f]' : 'bg-[#c64545]'}`}
          />
          {skip ? 'Validation off' : 'Validation on'}
        </button>
      </div>
    </div>
  )
}
