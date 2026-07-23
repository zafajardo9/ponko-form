import starSvg from '#/lib/icons/star.svg'

interface StarIconProps {
  /** Icon size in pixels. Defaults to 24 (matches Lucide standard sizing). */
  size?: number
  /** Additional Tailwind classes (e.g., "text-[#cc785c]", "sm:h-6 sm:w-6"). */
  className?: string
  /** When true, renders the filled (activated) star. When false, renders the outline (inactive) star. */
  filled?: boolean
}

/**
 * A modern 5-point star SVG icon aligned with PonkoForm's warm, craft-oriented
 * design system. Uses `currentColor` — set the color via `className` (e.g.,
 * `text-[#cc785c]` or `text-[var(--ponko-primary,#cc785c)]`).
 *
 * @example
 * // Single filled (activated) star
 * <StarIcon size={20} filled className="text-[#cc785c]" />
 *
 * @example
 * // Single outline (inactive) star
 * <StarIcon size={20} filled={false} className="text-[#e6dfd8]" />
 *
 * @example
 * // 5-star rating row — first 3 activated, last 2 inactive
 * {[...Array(5)].map((_, i) => (
 *   <StarIcon key={i} size={16} filled={i < 3} className="text-[#cc785c]" />
 * ))}
 */
export function StarIcon({ size = 24, className, filled = true }: StarIconProps) {
  return (
    <img
      src={starSvg}
      alt=""
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    />
  )
}
