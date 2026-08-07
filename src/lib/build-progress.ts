/**
 * Build progress data for the public /progress page.
 *
 * Milestones are linear: `status: true` means the step is complete, `false`
 * means it has not shipped yet. The first milestone with `status: false` is
 * the next planned step — the boundary where the timeline line switches from
 * completed to upcoming.
 */
export interface BuildMilestone {
  id: string
  date: string
  title: string
  summary: string
  tag: string
  details: string[]
  /** true = completed, false = not done yet. */
  status: boolean
}

export const BUILD_MILESTONES: BuildMilestone[] = [
  {
    id: 'foundation',
    date: 'May 2026',
    title: 'Foundation & workspace',
    summary: 'Accounts, databases, and the home for every form you build.',
    tag: 'Core',
    status: true,
    details: [
      'Email-and-password accounts with secure sessions',
      'PostgreSQL database with AES-256-GCM encrypted credentials',
      'Per-user profiles that anchor every form, payment, and setting',
      'Collaborators can view or edit a form with a full audit log',
    ],
  },
  {
    id: 'page-builder',
    date: 'Jun 2026',
    title: 'Page-builder forms',
    summary: 'A drag-and-drop builder with responsive, themed form pages.',
    tag: 'Builder',
    status: true,
    details: [
      'Drag-and-drop page builder with 19 field types',
      'Conditional visibility rules per field',
      'Responsive layout that reshapes for every screen',
      'Themes, logos, and per-form branding',
    ],
  },
  {
    id: 'flow-builder',
    date: 'Jun 2026',
    title: 'Flow builder',
    summary: 'Visual journeys with branches, calculations, and redirects.',
    tag: 'Logic',
    status: true,
    details: [
      'Node canvas: start, fields, groups, decisions, calculators, payments',
      'Branch on answers with decision nodes and saved references',
      'Calculator nodes with formulas and priced-option totals',
      'A runtime flow engine that resumes from payment on return',
    ],
  },
  {
    id: 'payments',
    date: 'Jul 2026',
    title: 'Payments',
    summary: 'Collect money with Xendit and PayPal, sandbox or live.',
    tag: 'Payments',
    status: true,
    details: [
      'Xendit and PayPal gateways with sandbox and live modes',
      'Payment pages from a fixed amount or the total of selected options',
      'Reusable payment links and per-link reminders',
      'Webhook verification and background reconciliation',
    ],
  },
  {
    id: 'templates',
    date: 'Jul 2026',
    title: 'Built-in templates',
    summary: 'A gallery of starting points, including product and service orders.',
    tag: 'Templates',
    status: true,
    details: [
      'Template gallery on the New Form page',
      'Product Purchase template with a single fixed price',
      'Products & Services Order template with priced options',
      'Every template is copied into an independent, editable form',
    ],
  },
  {
    id: 'email',
    date: 'Aug 2026',
    title: 'Email delivery & automations',
    summary: 'Confirmation emails, invoices, and platform notifications.',
    tag: 'Email',
    status: true,
    details: [
      'Connect your own Resend or SMTP account per form owner',
      'Invoice and confirmation email automations with delivery logs',
      'System emails through the platform Resend: welcome, sign-in alerts, reset links',
      'Test sends and one-click retry for failed deliveries',
    ],
  },
  {
    id: 'security',
    date: 'Aug 2026',
    title: 'Security & trust',
    summary: 'Encryption, reCAPTCHA, and payment verification.',
    tag: 'Trust',
    status: true,
    details: [
      'reCAPTCHA protection for public forms',
      'Integration secrets never leave the server unencrypted',
      'Signed public session tokens for in-progress submissions',
      'Payment status verified against gateway webhooks',
    ],
  },
  {
    id: 'integrations',
    date: 'Aug 2026',
    title: 'Internal Integration',
    summary: 'Connect PonkoForm with the internal system built for workflows (Calli)',
    tag: 'Integrations',
    status: false,
    details: [
      'Authenticated API access between PonkoForm and the internal system',
      'Two-way sync of forms, submissions, and payment records',
      'A shared identity so one account works across both products',
      'Event hooks that trigger internal workflows from form activity',
    ],
  },
  {
    id: 'security-deployment',
    date: 'Later',
    title: 'Security & deployment enhancements',
    summary: 'Harden the platform and ship with confidence across every environment.',
    tag: 'Platform',
    status: false,
    details: [
      'Rate limiting, audit logs, and expanded abuse protection on public routes',
      'Automated deployment pipelines for Render and Cloudflare',
      'Uptime monitoring, error tracking, and structured observability',
      'Performance budgets, caching, and delivery optimizations',
    ],
  },
]

export interface MilestoneProgress {
  completed: number
  total: number
  /** The first not-completed milestone — the next planned step. */
  nextUp: BuildMilestone | null
  nextUpIndex: number
}

export function milestoneProgress(
  milestones: BuildMilestone[] = BUILD_MILESTONES,
): MilestoneProgress {
  const completed = milestones.filter((milestone) => milestone.status).length
  const nextUpIndex = milestones.findIndex((milestone) => !milestone.status)
  return {
    completed,
    total: milestones.length,
    nextUp: nextUpIndex >= 0 ? milestones[nextUpIndex] : null,
    nextUpIndex,
  }
}
