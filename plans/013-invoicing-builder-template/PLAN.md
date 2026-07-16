# 013 Invoicing Builder Template

## 1. Goal

Give every authenticated form creator a consistent per-form navigation section with direct access to a polished Invoicing workspace. In that workspace, the form owner can design, preview, test, enable, and monitor branded respondent emails: a payment invoice/receipt sent only after a completed payment and a post-submission confirmation sent for successful non-payment submissions.

The implementation must preserve successful form submissions and payments even when email delivery fails, prevent duplicate invoices during repeated payment callbacks, assign invoice numbers safely under concurrency, and keep all template, integration, and delivery data scoped to the owning profile.

## 2. Context Summary

Confirmed repository facts:

- The application uses React 19, TanStack Start/Router/Query, TypeScript, Tailwind CSS, Drizzle ORM, PostgreSQL, Clerk authentication, Vitest, and pnpm.
- The current form editor header contains Build, Responses, and Payments navigation only in `src/routes/forms/$formId/edit.tsx`. Responses and Payments use separate breadcrumb/action layouts, so creators do not currently receive the same section navigation on every form-management page.
- Page-based submission completion is centralized in `src/lib/page-builder/complete-submission.ts`; paid page submissions reach it from `finalizePagePayment()` in `src/lib/server-fns/page-forms.ts`.
- Flow-based submissions complete in `completeExecution()` in `src/lib/server-fns/flow-executions.ts`. Flow payments are already linked to both `flow_execution_id` and a draft `form_submission_id`.
- Legacy public forms submit through `submitFormResponse()` in `src/lib/server-fns/submissions.ts`.
- Payment amounts are stored in minor units. Completed payment details, gateway identity, timestamps, and submission relationships already exist in `payments` and `payment_gateways`.
- The project has a working Resend sender for payment reminders and encrypted per-profile Resend/SMTP integration configuration. There is no shared transactional-email dispatcher and no SMTP delivery implementation yet.
- Tiptap StarterKit and Underline are already installed and used by the page builder. The existing page-builder rich-text editor is local to a large component and should not be imported from it.
- No shared `src/lib/template-engine.ts`, notification interpolation engine, invoicing schema, durable background job queue, or invoice delivery log exists.
- Form ownership guards already exist in `src/lib/server-fns/flow-helpers.ts`, although their argument order is `assertFormOwner(formId, clerkId)` and the rough feature brief shows the reverse order in places.

Assumptions used by this plan:

- “Each user creator” means every authenticated owner can reach Invoicing for each form they own, regardless of whether that form currently contains a payment step. The invoice controls explain and remain disabled when the form has no payment path; confirmation-email controls remain available.
- An invoice is sent only when a related payment is verified as `completed`. A successful free submission can send the separately configured confirmation template, but it must not consume an invoice number.
- Resend and SMTP should both be supported because both are presented as email integrations. SMTP support therefore requires a small transport dependency; if product scope chooses Resend-only for the first release, the SMTP transport work can be removed without changing the rest of the design.
- Rich email output is HTML with a plain-text fallback. PDF attachment generation, legal tax-invoice certification, and downloadable invoice documents are not required for this iteration.
- The existing `InvoicePDF` respondent component is a payment-completion display and is not a reusable email-template system; it may supply formatting ideas but should not become the data source for email invoices.

Missing product decisions to resolve before implementation:

- Confirm the default invoice prefix/start number and whether creators may change the start number after the first invoice has been allocated. This plan recommends `INV-` and `1000`, and locking the start number after allocation.
- Confirm the delivery-attempt retention period because recipient addresses, rendered subjects, and error details are personal data.
- Confirm whether confirmation emails are required in the first release or may be feature-flagged after invoice delivery. The source feature brief explicitly includes them, so this plan includes them.

## 3. Scope

- Add a reusable per-form creator navigation component containing Build, Responses, Payments, and Invoicing, with an accessible active state and horizontally scrollable mobile behavior.
- Show that navigation consistently in the editor, response list, payment list (including its empty state), and new invoicing route.
- Add an authenticated, owner-scoped Invoicing route for every form.
- Provide invoice and confirmation enablement, recipient email-field selection, subject editing, rich body editing, variable insertion, branding, optional payment-detail and submitted-field line items, plain-text fallback generation, live preview, explicit saving, test sending, and clear dirty/saved/error states.
- Discover template variables across page-builder fields, flow variables/form-field bindings, legacy fields, form references, payment data, and system metadata.
- Add safe HTML sanitization and context-aware template interpolation that escapes respondent-provided values.
- Add Resend and SMTP transactional-email transports behind a shared server-only interface and gate enable/test controls on an actually supported configured transport.
- Persist invoice/confirmation configurations and delivery attempts.
- Allocate invoice numbers atomically and make delivery creation idempotent per submission/template kind.
- Trigger invoice delivery after verified paid completion and confirmation delivery after successful non-payment completion across page, flow, and legacy submission paths.
- Show recent delivery attempts with status and owner-authorized retry for failed attempts.
- Add automated and manual validation for navigation, configuration, rendering, ownership, concurrency, idempotency, delivery, and regressions.

## 4. Out of Scope

- Changing payment gateway behavior, payment amounts, refunds, settlement, reconciliation rules, or webhook verification.
- Admin/new-response notifications covered by the separate form-notifications feature.
- PDF attachments, downloadable invoice files, fiscal/tax registration fields, tax calculations, jurisdiction-specific numbering rules, credit notes, and accounting-system exports.
- Product/catalog inventory, quantity calculations, or deriving the charged total from selected line items. The verified payment record remains the source of truth for the total.
- Logo file uploads or a new media-storage integration; this release accepts an optional validated HTTPS logo URL.
- A visual drag-and-drop email layout engine. The builder is a constrained rich-text editor with structured branding, payment, and line-item sections.
- Provider bounce/complaint webhooks and automatic provider-level delivery-status synchronization.
- A new general-purpose job queue. Delivery is a bounded best-effort attempt recorded in the database, with manual retry; a durable worker can consume the same queued records later.
- Allowing respondents or non-owners to read template configuration, delivery logs, integration status, or test/retry endpoints.

## 5. Affected Files and Folders

```txt
package.json
pnpm-lock.yaml
drizzle/
  0025_form_email_templates.sql                         (candidate generated name)
  meta/_journal.json                                   (generated)
  meta/0025_snapshot.json                              (generated candidate)
src/
  db/schema.ts
  routeTree.gen.ts                                     (generated)
  styles.css
  components/
    forms/FormSectionNav.tsx                           (new)
    forms/FormSectionNav.test.tsx                      (new)
    invoicing/
      InvoiceTemplateBuilder.tsx                       (new)
      InvoiceTemplateBuilder.test.tsx                  (new)
      TemplateRichTextEditor.tsx                       (new)
      InvoicePreview.tsx                               (new)
      DeliveryHistory.tsx                              (new)
  routes/forms/$formId/
    edit.tsx
    submissions.tsx
    payments.tsx
    invoicing.tsx                                      (new)
  lib/
    email/
      transactional.ts                                (new)
      resend.ts
      smtp.ts                                          (new)
      transactional.test.ts                            (new)
    invoicing/
      template.ts                                      (new)
      template.test.ts                                 (new)
      delivery.ts                                      (new, server-only)
      delivery.test.ts                                 (new)
      types.ts                                         (new)
    page-builder/complete-submission.ts
    server-fns/
      invoicing.ts                                     (new)
      invoicing.test.ts                                (new)
      page-forms.ts                                    (review/integration verification)
      flow-executions.ts
      submissions.ts
    integrations/
      credentials.ts                                   (review/reuse)
      types.ts                                         (review/reuse)
```

`src/components/forms/FormSectionNav.tsx` is the shared creator navigation. It should accept the form ID and active section rather than duplicating route markup in four pages.

`src/routes/forms/$formId/invoicing.tsx` owns route authentication, form ID parsing, queries/mutations, and top-level loading/not-found/error handling. Presentation and editor state remain in `src/components/invoicing/`.

`src/lib/invoicing/template.ts` contains pure, independently testable variable discovery, interpolation, formatting, HTML allow-list sanitization, and plain-text fallback behavior. Server-only database and credential access must remain outside client-reachable modules.

`src/lib/invoicing/delivery.ts` is the central completion hook used by all submission models. It creates/reuses a delivery record, allocates invoice numbers transactionally, renders a snapshot, sends through the selected transport, and records the result without changing the already-successful submission/payment outcome.

The exact Drizzle migration and snapshot filenames are generated by `pnpm db:generate`; do not hand-pick a conflicting migration number if the repository advances before implementation.

## 6. Step-by-Step Implementation Plan

1. Define the feature contracts and database model.
   - What to do: Finalize configuration types for invoice and confirmation templates, the allowed variable catalog, line-item rows, transport availability, and delivery statuses. Add Drizzle schema for one invoice configuration per form, one confirmation configuration per form, and a shared delivery-attempt table. Generate and inspect the migration.
   - Why it is needed: The UI, validation, renderer, idempotency rules, and dispatch logic need one authoritative contract before they are built.
   - Files or folders affected: `src/db/schema.ts`, `src/lib/invoicing/types.ts`, `drizzle/`.
   - Dependencies/sequencing: Resolve default numbering and retention decisions first. Complete this step before server functions or mutations.

2. Extract a reusable, safe template engine.
   - What to do: Build a pure variable catalog and two interpolation modes: plain text for subjects/text fallbacks and escaped HTML-value insertion for rich bodies. Support form/reference values plus `form_title`, `submission_id`, `submitted_at`, `payment_amount`, `payment_currency`, `payment_date`, `payment_gateway`, `payment_id`, and `invoice_number`. Format money from verified minor-unit payment data and dates with a deterministic locale/time-zone policy. Sanitize editor HTML against a strict email-safe tag/attribute/protocol allow-list after editing and again before sending.
   - Why it is needed: Respondent answers are untrusted and must never become active HTML, scripts, event handlers, or unsafe URLs. One engine keeps live preview, test email, production email, and retries consistent.
   - Files or folders affected: `src/lib/invoicing/template.ts`, `src/lib/invoicing/template.test.ts`, `package.json`, `pnpm-lock.yaml`.
   - Dependencies/sequencing: Depends on step 1 types. Select the sanitization dependency before implementation; do not reuse the current regex-only rich-text sanitizer as the security boundary.

3. Create the transactional email transport abstraction.
   - What to do: Generalize the existing Resend request into a server-only sender that accepts recipient, sender identity, subject, sanitized HTML, and text. Add SMTP delivery using the owner’s existing encrypted SMTP configuration and a maintained SMTP client dependency. Resolve the owner from the form rather than from the respondent request, prefer an explicitly selected supported provider if product adds that setting, and otherwise use a documented deterministic priority. Apply a bounded provider timeout and normalize provider message IDs/errors.
   - Why it is needed: The feature brief promises availability through configured email integrations, while the repository currently supports only a specialized Resend reminder function.
   - Files or folders affected: `src/lib/email/transactional.ts`, `src/lib/email/resend.ts`, `src/lib/email/smtp.ts`, `src/lib/email/transactional.test.ts`, `src/lib/integrations/credentials.ts` (reuse/review), `src/lib/integrations/types.ts` (reuse/review), `package.json`, `pnpm-lock.yaml`.
   - Dependencies/sequencing: Can proceed after the shared message shape from step 2. Credentials must never cross into route/component return values.

4. Build owner-scoped invoicing server functions and variable discovery.
   - What to do: Add read, save/upsert, send-test, list-deliveries, and retry server functions. Each function must authenticate with Clerk, parse a positive numeric form ID, call `assertFormOwner(formId, userId)`, return only safe integration availability, and validate input through Zod or equivalent strict schemas. Build a consolidated variable query that recognizes page fields/references, flow bindings/variables, and legacy fields, and marks only actual email fields as recipient candidates. Return form title/status, whether a payment path exists, both configurations, variables, transport availability, and recent delivery summaries in a single initial view where practical.
   - Why it is needed: The route needs a coherent owner-safe data model without importing database, crypto, or provider credentials into the client bundle.
   - Files or folders affected: `src/lib/server-fns/invoicing.ts`, `src/lib/server-fns/invoicing.test.ts`, `src/lib/server-fns/flow-helpers.ts` (reuse), relevant field/flow schema reads.
   - Dependencies/sequencing: Depends on steps 1–3. Complete read/save behavior before connecting the route.

5. Introduce consistent per-form section navigation.
   - What to do: Create `FormSectionNav` with Build, Responses, Payments, and Invoicing links, active semantics, keyboard focus states, compact labels/icons, and overflow handling. Replace the hard-coded editor tabs and add the component to Responses and all Payments render branches, including no-payment and no-results states. Add it to the new Invoicing header. Keep editor-only Preview, Settings, Share, Publish, and saving controls adjacent but outside the shared section navigation.
   - Why it is needed: A creator must be able to discover and reach the invoice builder from every form-management section, not only from Build.
   - Files or folders affected: `src/components/forms/FormSectionNav.tsx`, `src/components/forms/FormSectionNav.test.tsx`, `src/routes/forms/$formId/edit.tsx`, `src/routes/forms/$formId/submissions.tsx`, `src/routes/forms/$formId/payments.tsx`, `src/routes/forms/$formId/invoicing.tsx`.
   - Dependencies/sequencing: The component can be built independently, but the Invoicing link becomes fully navigable after step 6 creates the route.

6. Create the Invoicing route and page shell.
   - What to do: Add the authenticated TanStack file route, use the standard `requireAuth` guard, validate the form ID, fetch the consolidated owner view, and render loading, unauthorized/not-found, query-error, and empty-variable states. Regenerate the route tree. Lay out invoice and confirmation sections with an explicit Save action, dirty-state navigation warning, success/error feedback, and integration-setup banner linking to `/settings/integrations`.
   - Why it is needed: This is the stable creator entry point and state boundary for the feature.
   - Files or folders affected: `src/routes/forms/$formId/invoicing.tsx`, `src/routeTree.gen.ts`, `src/components/invoicing/`.
   - Dependencies/sequencing: Depends on step 4 read APIs; navigation integration from step 5 should land here.

7. Build the constrained invoice/confirmation template editor.
   - What to do: Extract a reusable Tiptap editor rather than importing the private page-builder editor. Provide headings, bold, italic, underline, lists, and safe links; add a searchable variable picker that inserts a token at the cursor; and preserve tokens through editor updates. Implement recipient selection, subject, from-name override, optional HTTPS logo, accent color, invoice prefix/start, payment-detail toggle, line-item selection/reordering, confirmation configuration, character counts, inline validation, and enablement prerequisites. Derive a plain-text fallback server-side unless the product explicitly exposes a separate text editor.
   - Why it is needed: Creators need a powerful editor without the security and compatibility risks of arbitrary raw HTML/CSS.
   - Files or folders affected: `src/components/invoicing/InvoiceTemplateBuilder.tsx`, `src/components/invoicing/TemplateRichTextEditor.tsx`, `src/styles.css`, `package.json`, `pnpm-lock.yaml` if the Tiptap Link extension is added.
   - Dependencies/sequencing: Depends on the variable catalog from step 2 and save contract from step 4.

8. Add deterministic live preview and test sending.
   - What to do: Render the current unsaved local draft with fixed sample values that match each real variable type, using the same interpolation/sanitization functions as delivery. Isolate HTML preview in a sandboxed preview surface and provide desktop split view plus a mobile Editor/Preview switch. Send-test must validate and save or explicitly send the current draft contract, use the signed-in owner’s requested test address, label the invoice number as a non-consuming test number, enforce a short per-form cooldown, and show provider acceptance/error feedback.
   - Why it is needed: Preview and test output must match production behavior without consuming invoice numbers or creating misleading customer delivery records.
   - Files or folders affected: `src/components/invoicing/InvoicePreview.tsx`, `src/components/invoicing/InvoiceTemplateBuilder.tsx`, `src/lib/server-fns/invoicing.ts`, `src/lib/invoicing/template.ts`.
   - Dependencies/sequencing: Depends on steps 2–4 and 7.

9. Implement idempotent delivery creation and atomic invoice numbering.
   - What to do: Centralize delivery orchestration around a submission ID. For an eligible paid submission, start a transaction that locks or atomically updates the form’s invoice counter, creates exactly one invoice delivery record, and reserves the formatted invoice number. Enforce unique database keys so repeated gateway returns, webhooks, user refreshes, or concurrent completion calls reuse the existing record instead of sending again. Confirmation deliveries use their own template-kind uniqueness key and never touch the counter. Store a non-secret template/settings snapshot for stable retries, transition delivery status through queued/sending/sent/failed, preserve the same invoice number on retry, and increment attempt metadata.
   - Why it is needed: Counting prior rows, as proposed in the rough brief, can allocate duplicates under concurrency and can reuse numbers after failed sends. Database-backed idempotency is required for payment callbacks.
   - Files or folders affected: `src/lib/invoicing/delivery.ts`, `src/lib/invoicing/delivery.test.ts`, `src/db/schema.ts`, generated migration.
   - Dependencies/sequencing: Depends on steps 1–3. This must be complete before adding completion hooks.

10. Connect delivery to every successful submission path.
    - What to do: After the submission row has been committed as completed, invoke the central orchestrator from `completePageSubmissionRecord()`, `completeExecution()`, and `submitFormResponse()`. The orchestrator must query the related completed payment itself: by `form_submission_id` for page/legacy data and by the already-linked submission/flow execution for flow data. Send an invoice only when the selected canonical payment is completed; otherwise send confirmation only when configured. Use a short bounded attempt and catch/log transport failure so the submission/payment response remains successful. Do not launch an untracked promise that may be terminated when a server request ends.
    - Why it is needed: Centralizing eligibility avoids divergent logic and covers current page, flow, and legacy form modes while keeping email failure outside the submission transaction.
    - Files or folders affected: `src/lib/page-builder/complete-submission.ts`, `src/lib/server-fns/flow-executions.ts`, `src/lib/server-fns/submissions.ts`, `src/lib/server-fns/page-forms.ts` (verification only), `src/lib/invoicing/delivery.ts`.
    - Dependencies/sequencing: Depends on step 9. Add one completion path at a time and run its regression tests before proceeding.

11. Add delivery history and safe retries.
    - What to do: Show recent invoice/confirmation deliveries with kind, invoice number where applicable, masked or minimally displayed recipient, status, attempts, amount, and timestamp. Add pagination or a conservative initial limit. Allow retry only for failed owner-scoped records, reuse the reserved number and template snapshot, block concurrent retry requests, cap rapid retries, and refresh the list after mutation. Do not expose raw provider payloads or credentials; show sanitized creator-actionable error summaries.
    - Why it is needed: A non-blocking delivery design needs visibility and recovery when providers reject or time out.
    - Files or folders affected: `src/components/invoicing/DeliveryHistory.tsx`, `src/lib/server-fns/invoicing.ts`, `src/lib/invoicing/delivery.ts`.
    - Dependencies/sequencing: Depends on steps 4 and 9–10.

12. Complete automated, migration, responsive, and accessibility verification.
    - What to do: Add unit/component/server tests from section 12, run `pnpm db:generate`, inspect the SQL and snapshot, run `pnpm db:check`, `pnpm test`, and `pnpm build`, and manually verify the four-section navigation and editor at narrow and wide breakpoints. Confirm focus order, labels, contrast, active navigation semantics, editor toolbar keyboard access, preview isolation, and error announcements. Update the source feature status only after implementation is accepted, not during planning.
    - Why it is needed: The feature crosses payment completion, public submissions, email providers, rich HTML, and owner-only administration; each boundary requires regression evidence.
    - Files or folders affected: Test files listed above, `drizzle/`, `src/routeTree.gen.ts`, and `feature-plan/013-invoicing-builder-template.md` only after completed delivery.
    - Dependencies/sequencing: Final step after all implementation work.

## 7. Database Changes

Add one migration, generated from `src/db/schema.ts`, with these logical records:

- `form_invoice_configs`, one row per form:
  - Foreign key `form_id` to `forms.id` with cascade delete and a unique index.
  - Enable flag, respondent email binding, subject template, sanitized body HTML, optional derived/stored plain text, from-name override, HTTPS logo URL, accent color, payment-details flag, line-items flag, and typed JSON line-item definitions.
  - Invoice prefix, immutable configured start number, and a mutable next-number counter. The counter is allocated with a transactional row lock or atomic update/returning operation; it is never derived from delivery-row count.
  - Optional `last_test_sent_at` for a database-backed test-send cooldown.
  - Created/updated timestamps.

- `form_confirmation_configs`, one row per form:
  - Foreign key `form_id` to `forms.id` with cascade delete and a unique index.
  - Enable flag, respondent email binding, subject/body templates, optional plain text, from-name override, and created/updated timestamps.
  - Branding may inherit invoice/form defaults; if independent confirmation branding is required, use the same validated fields explicitly rather than hidden fallback behavior.

- `email_delivery_logs`, one row per invoice or confirmation delivery:
  - Foreign keys to form and submission with cascade delete, optional payment with set-null delete, and optional source configuration/template identifiers if useful for joins.
  - Template kind constrained to `invoice` or `confirmation`; status constrained to `queued`, `sending`, `sent`, or `failed` using a check-backed varchar so rollback does not require removing PostgreSQL enum values.
  - Recipient, nullable invoice number, rendered subject, provider, provider message ID, normalized error message, attempt count, queued/last-attempt/sent timestamps, and a template/settings snapshot sufficient to repeat a failed send without allocating a new number.
  - Unique `(form_submission_id, template_kind)` to make each message kind idempotent for a submission.
  - Partial unique `(form_id, invoice_number)` for non-null invoice numbers.
  - Indexes for `(form_id, created_at)`, status, submission, and payment lookup.

Data and constraint rules:

- Existing forms receive no configuration rows and therefore remain disabled by default.
- No backfill sends historical invoices or confirmations.
- Deleting a form removes its templates/logs; deleting a payment keeps the delivery audit row but nulls its payment reference.
- Once an invoice number has been allocated, changing the start number is rejected. Prefix changes affect only future allocations; reserved/sent numbers remain unchanged.
- Test sends do not increment the counter and do not occupy the production delivery uniqueness keys.
- The migration must be safe for the repository’s prepare/check workflow and must update Drizzle journal/snapshot artifacts through the normal generator.

## 8. Backend Changes

- Add owner-authenticated server functions for initial invoicing view, configuration save, test send, paginated delivery history, and failed-delivery retry.
- Reuse `assertFormOwner(formId, clerkId)` consistently; do not duplicate profile/form ownership SQL in the new endpoints.
- Keep `credentials.ts`, SMTP/Resend configurations, database driver, encryption helpers, and transport selection in server-only modules.
- Resolve email availability from decrypted `resend` and `smtp` integration rows and return only booleans/provider labels and safe sender metadata.
- Build field/variable discovery for all three supported form models. Recipient candidates must be explicitly typed email fields where type metadata exists; legacy numeric field keys still need stable token aliases or a documented mapping.
- Validate configuration with strict schemas and reject unknown fields rather than spreading unvalidated request properties into an update.
- Use a shared transactional email interface for Resend and SMTP, normalize timeouts/errors, and retain the current specialized payment-reminder function or migrate it carefully without changing its behavior.
- Build invoice context only from the form, completed submission, canonical completed payment, gateway, and configuration owned by the same form. Reject or log cross-form foreign-key mismatches.
- Generate formatted payment totals from `paid_amount` when present and otherwise `amount`, always treating values as minor units and showing the stored currency.
- Persist a delivery record and reserved number before contacting the provider. Update that same record after the attempt; never insert a second failure row for the same submission/kind.
- Completion hooks run after the successful submission update/insert. Delivery failure is caught and recorded and must not roll back or change submission/payment status.
- Retry is owner-only, only for `failed`, uses an atomic status transition to prevent double-click concurrency, reuses the same invoice number, and observes a bounded attempt/rate policy.
- Test send is owner-only, never uses respondent data, uses obvious sample values, does not allocate a real invoice number, and applies a server-side cooldown.
- Logs should include correlation identifiers and delivery IDs but must not print credentials, full provider payloads, or full rendered message bodies.

## 9. Frontend Changes

- Add `FormSectionNav` to Build, Responses, Payments, and Invoicing so every creator section exposes the same four destinations and correct active item. Preserve the editor’s constrained-height layout and make the nav horizontally scrollable on small screens.
- Add an Invoicing page header with breadcrumb/form identity, status, integration state, explicit Save button, and navigation. Keep it usable for forms without payment steps so the confirmation editor remains accessible.
- Present two clearly separated configurations:
  - Invoice/receipt after a completed payment.
  - Confirmation after a successful non-payment submission.
- Gate invoice enablement on a payment path, at least one email recipient field, a supported email integration, valid subject/body, and valid numbering. Explain each missing prerequisite with a direct action link.
- Use local draft state and live validation. Do not autosave every Tiptap transaction. Show dirty, saving, saved, and failed states and warn before abandoning unsaved edits.
- Reuse the project’s Tiptap packages in a small dedicated editor. Add only email-safe formatting and link commands. Insert variables at the current cursor, render tokens distinctly if practical, and provide a searchable keyboard-accessible picker grouped by Respondent, Form, Payment, and System.
- Offer structured branding controls: sender display name, optional HTTPS logo URL with broken-image fallback, and accessible accent color with text/hex input.
- Let creators select submitted fields as display rows. Each row has a label and a valid binding; it displays submitted data but does not alter or recalculate the verified payment total.
- Render live preview through the same safe renderer as production with representative sample data. Use a two-column layout with sticky preview on large screens and an Editor/Preview switch on small screens.
- Disable test/send actions while pending, announce results accessibly, and distinguish provider acceptance from guaranteed inbox delivery.
- Show recent delivery rows with loading skeleton, empty state, sent/failed/queued badges, pagination/limit, and retry action for failures. Never place secret provider errors or credential values in the DOM.
- Keep styling aligned with current neutral palette, `#cc785c` default accent, existing Button/Card/Badge primitives, visible focus rings, and reduced-motion/user accessibility settings.

## 10. Validation Rules

- `formId`, submission ID, payment ID, configuration ID, and delivery ID must be positive finite integers and must resolve within the authenticated owner’s form.
- Invoice and confirmation enable flags are booleans; disabled configurations may be saved as drafts but enabling requires every prerequisite.
- Recipient binding is required when enabled and must match a current email-capable field for the same form. Missing/deleted bindings prevent enablement and production send.
- Subject is trimmed, required when enabled, maximum 255 characters after interpolation, and contains no CR/LF header injection.
- Body HTML is required when enabled, has a conservative stored/rendered size limit, and is sanitized to the supported email-safe allow-list.
- Template tokens must use the supported `{{snake_case_name}}` grammar. Unknown/malformed tokens are surfaced before enable/test; production must not silently expose raw unknown tokens to respondents.
- Form/reference values are stringified with explicit handling for arrays, booleans, dates, and objects, and are escaped according to text or HTML context.
- Logo URL is optional, trimmed, length-limited, and HTTPS only; reject credentials, data/javascript schemes, and control characters.
- Accent color is exactly a six-digit hex color and must meet minimum readable contrast for generated foreground choices.
- From name is optional, trimmed, excludes line breaks/control characters, and is length-limited; the actual sender address always comes from the verified integration.
- Invoice prefix is length-limited, printable, excludes braces/control characters, and combines with the numeric component to stay within the delivery column limit.
- Invoice start number is an integer within an agreed positive range. It cannot be lowered/reset or edited after any number has been reserved.
- Line-item rows have unique valid variable bindings, non-empty length-limited labels, a bounded row count, and no payment/system-only token where a submitted field is required.
- Invoice production eligibility requires a related `payments.status = completed`; confirmation eligibility requires a completed submission without a completed payment, preventing two respondent messages for the same path unless product explicitly changes that policy.
- Recipient address receives full server-side email syntax validation before provider calls.
- Test recipient must be a valid email, and test sends must satisfy cooldown/rate checks.
- Retry accepts only a failed delivery owned by the current creator; sent/sending/queued records cannot be retried.

## 11. Security Considerations

- Require Clerk authentication and form ownership on every configuration, integration-status, delivery-list, test, and retry operation. Return not-found semantics for another user’s form to avoid resource enumeration.
- Enforce tenant boundaries again when joining form, submission, payment, delivery, and configuration records; never trust client-supplied relationships.
- Keep decrypted Resend/SMTP secrets and sender addresses in server-only code. Client payloads receive only safe provider readiness metadata.
- Treat all form answers, references, labels, template HTML, subjects, URLs, and provider errors as untrusted input.
- Use an allow-list HTML sanitizer appropriate for email. Tiptap command restrictions and the existing regex sanitizer are not sufficient protection against pasted or crafted HTML.
- Escape every interpolated respondent/system value. Do not introduce raw/triple-brace variables in this release.
- Render preview in a sandboxed surface with scripts/forms/navigation disabled, and render only sanitized output.
- Restrict links and images to safe protocols; add safe link attributes and prevent `javascript:`, `data:`, embedded credentials, and event handlers.
- SMTP must use the configured TLS policy, provider timeouts, and no credential logging. Resend/SMTP responses should be normalized before storage/display.
- Add database idempotency constraints and atomic state transitions to prevent duplicate sends and duplicate invoice numbers from callbacks, refreshes, or retries.
- Apply server-side cooldowns/attempt caps to test and retry endpoints to limit authenticated email abuse. UI disabling alone is not a control.
- Minimize stored personal data. Do not store rendered bodies or raw provider responses unless required; prefer a tokenized template snapshot, recipient, subject, status, and sanitized error. Establish retention/deletion behavior for delivery logs.
- Do not include internal database IDs or sensitive form answers in provider logs beyond what the creator deliberately placed in the template.
- Preserve payment/submission integrity: email delivery code cannot change completed payment amounts/status or undo a successful submission.

## 12. Testing Plan

Automated unit tests:

- Variable interpolation for system, payment, reference, page, flow, and legacy values.
- HTML/text escaping for scripts, event handlers, unsafe links/images, quotes, arrays, objects, Unicode, and empty values.
- Unknown/malformed token rejection and subject header-injection prevention.
- Money formatting from minor units across USD/PHP and invalid currency fallback.
- Sanitizer allow-list behavior and plain-text fallback generation.
- Invoice prefix/start validation, line-item validation, and enablement prerequisites.
- Email transport selection, Resend/SMTP request construction, timeout, provider rejection, and secret-redaction behavior with mocked network/SMTP clients.

Automated database/service tests:

- Owner can read/save each configuration; unauthenticated users and other owners cannot.
- Integration readiness returns no secret-bearing fields.
- Page, flow, and legacy variable discovery returns the correct recipient candidates and tokens.
- Two concurrent allocations for the same form receive distinct sequential numbers.
- Repeated completion for the same submission/kind creates one delivery and one provider call.
- Failed send retains the reserved invoice number; retry reuses it and increments attempts.
- Concurrent retries allow one sender transition.
- Confirmation delivery does not allocate an invoice number and a paid submission follows the invoice-only default policy.
- A missing/invalid recipient creates a failed record without changing submission/payment success.
- Test sends use sample data, honor cooldown, and do not allocate/log a production invoice.
- Form deletion cascades configurations/deliveries; payment deletion preserves delivery with a null payment reference.

Automated component/route tests:

- FormSectionNav renders four links with the correct active state on all creator sections and remains keyboard navigable.
- Payments empty state and Responses page still expose Invoicing.
- Invoicing loading, not-found/error, no-payment, no-email-integration, no-email-field, and fully configured states.
- Draft edits, inline errors, Save success/failure, dirty warning, enable gating, and query invalidation.
- Variable picker inserts at the Tiptap cursor and works by keyboard.
- Preview uses current unsaved state, displays sample variables, and never executes unsafe HTML.
- Mobile Editor/Preview switching and desktop split layout.
- Delivery empty/loading/populated states and retry pending/success/error behavior.

Regression tests:

- Existing page free submission still completes when email is disabled or delivery fails.
- Page payment return still finalizes exactly once and shows success when invoice delivery fails/times out.
- Flow completion/payment remains linked to its submission and does not double-send on resume/refresh.
- Legacy public form submission continues to validate required fields and complete.
- Existing payment reminder emails still send after transport refactoring.
- Existing Build/Responses/Payments routes, editor actions, and route generation remain valid.

Manual verification:

- Configure Resend and SMTP separately and verify production-like test delivery, sender display name, HTML, plain text, links, logo fallback, and provider error feedback.
- Complete paid page and flow forms, verify one invoice with the stored amount/currency/gateway/date, and refresh/replay completion without a duplicate.
- Complete free page, flow, and legacy forms and verify confirmation behavior.
- Remove/rename the selected email field and confirm enablement/send is blocked with a clear remediation message.
- Test long content, many variables, missing optional values, non-Latin text, arrays, mobile widths, browser zoom, keyboard-only use, and screen-reader labels.
- Run `pnpm db:check`, `pnpm test`, and `pnpm build` after migration generation.

## 13. Rollback Plan

- Disable both template types through configuration or a temporary server-side feature flag first; with no enabled configuration, completion hooks become no-ops while submissions/payments continue normally.
- Revert the Invoicing route, shared navigation link, components, server functions, completion-hook calls, transport abstraction changes, and added dependencies as one coordinated code rollback. Restore the previous specialized Resend reminder path if its refactor was included.
- Regenerate the TanStack route tree and dependency lockfile for the reverted source state.
- Do not immediately drop delivery/configuration tables during an operational rollback. Retain them so allocated invoice numbers and audit history are not lost and so rollback does not accidentally permit number reuse.
- If schema rollback is later approved after retention/export review, drop child delivery records/table before configuration tables and remove Drizzle schema definitions/migration artifacts through a forward corrective migration. PostgreSQL check-backed varchar statuses avoid irreversible enum-value rollback issues.
- Never decrement or reset allocated counters during rollback. A later re-enable must continue from the highest reserved value.
- If a provider integration causes failures, disable only that transport and surface the integration prerequisite while leaving template drafts and delivery history readable.
- Verify rollback by completing paid and free submissions with no email side effects and by confirming Build, Responses, and Payments remain navigable.

## 14. Final Checklist

- [x] Plan reviewed
- [x] Files identified
- [x] Database changes checked
- [x] Backend changes checked
- [x] Frontend changes checked
- [x] Validation rules checked
- [x] Security considerations checked
- [x] Tests planned
- [x] Rollback plan reviewed
- [x] Assumptions and open questions resolved
