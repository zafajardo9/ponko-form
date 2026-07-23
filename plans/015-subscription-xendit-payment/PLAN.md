# Xendit Subscription Payments

## 1. Goal

Add Xendit recurring subscriptions to page-builder payment pages while preserving the existing one-time payment flow. Creators can configure a billing schedule, respondents enroll through Xendit's hosted checkout, PonkoForm tracks the subscription and its billing cycles, and creators can see lifecycle status in the existing Payments view.

The implementation must extend the repository's existing payment idempotency, reconciliation, owner-scoped credentials, webhook audit, and submission-completion paths instead of creating a parallel payment system.

Implementation status (July 23, 2026): complete in the application and migration source. The provider contract is covered by mocked gateway/lifecycle tests and checked against Xendit's current `2026-01-01` documentation. Applying migration `0026_subscription_xendit.sql`, configuring the listed webhook topics, and completing an account-specific test-mode checkout remain deployment steps because they require the target Xendit/Neon environments.

## 2. Context Summary

Confirmed repository facts:

- The stack is TanStack Start/Router, React 19, Drizzle/PostgreSQL, Clerk, Vitest, and pnpm.
- Page payment configuration lives on form_pages. savePageForm normalizes at most one non-final payment page.
- Amounts may be fixed or respondent-dependent through fields, priced options, number fields, and formula adjustments.
- initiatePagePayment creates an idempotent PonkoForm payment draft and currently creates a one-time gateway checkout.
- Return verification, Xendit webhooks, manual verification, and stale reconciliation converge on src/lib/payments/reconciliation.ts.
- Xendit credentials are encrypted per owner and environment. Webhook paths are owner-scoped and callback-token verified.
- payment_events already provides deduplicated, sanitized audit history.
- Payment controls currently live directly in PageBuilderWorkspace.tsx; PaymentConfigSection.tsx does not exist.

Current Xendit facts that correct the supplied feature brief:

- Current hosted subscription checkout uses POST /sessions with session_type SUBSCRIPTION and mode PAYMENT_LINK. It returns a payment-session ID, payment-link URL, and recurring-plan ID.
- Schedule units are DAY, WEEK, and MONTH. Quarterly, semiannual, and annual map to MONTH with counts 3, 6, and 12.
- The recurring plan belongs to one respondent/customer and their reusable payment method. It is not a reusable product template, so a plan ID must not be cached in form_pages or shared across respondents.
- Checkout/session completion, recurring-plan activation, and recurring-cycle payment are separate lifecycle events. Existing invoice verification alone cannot verify them.
- Official references: [How subscriptions work](https://docs.xendit.co/docs/how-subscriptions-work), [Create Payment Session](https://docs.xendit.co/apidocs/create-session), [Fixed amount subscriptions](https://docs.xendit.co/docs/fixed-amount-subscriptions), and [Create Subscription Plan](https://docs.xendit.co/apidocs/create-recurring-plan).

Confirmed product decisions:

- Phase 1 supports page-builder payments only; flow-builder payment nodes stay one-time.
- Xendit is the only subscription-capable gateway.
- One payments row represents subscription enrollment; separate cycle rows represent recurring charges.
- The form is completed after Xendit confirms successful hosted-checkout enrollment and the recurring plan is active. Form completion does not wait for a cycle payment to settle.
- Initial and later automatic debits are tracked independently as subscription cycles linked to the original payment, submission, and respondent.
- Form completion/confirmation email is sent once. Recurring cycle events never call the form-completion email path and do not send another PonkoForm email in phase 1.
- Cancellation is performed by the subscriber/creator through Xendit in phase 1. PonkoForm consumes the lifecycle webhook and displays the cancelled status and effective/end date.
- Creators explicitly bind earlier Name and Email fields for the Xendit customer; label guessing is not allowed.

Xendit automatically attempts later deductions only through a successfully linked reusable payment method on a channel that supports Merchant-Initiated Transactions. PonkoForm must not assume every Xendit checkout channel supports auto-debit; incompatible channels must be excluded by Xendit/account configuration and verified during the integration spike.

## 3. Scope

- Add one-time/subscription mode to page-builder payment settings.
- Support weekly, monthly, quarterly, semiannual, and annual schedules.
- Support optional trial days and optional maximum cycles, subject to sandbox confirmation.
- Require Xendit for subscription mode.
- Create one hosted Xendit Subscription Payment Session per respondent.
- Store payment-session and recurring-plan identifiers separately.
- Track enrollment status and individual billing cycles.
- Extend authenticated Xendit webhooks, event deduplication, sanitization, and scheduled reconciliation.
- Keep form completion idempotent when return requests and webhooks race.
- Show subscription schedule, status, next charge, and cycle history in the creator Payments view.
- Add automated and sandbox tests.
- Document Xendit API version, permissions, compatible payment channels, and webhook topics.

Trial support remains included in phase 1 because it is part of the supplied feature brief. Its anchor-date and immediate-payment behavior must still be confirmed in Xendit sandbox before coding.

## 4. Out of Scope

- Flow-builder subscriptions in phase 1.
- PayPal subscriptions.
- Reusing a recurring plan between respondents.
- Usage-based billing, proration, upgrades, downgrades, coupons, taxes, setup fees, and split payments.
- Customer self-service billing portal.
- Backfilling historical payments.
- Automatically changing existing subscriptions when form configuration changes.
- Storing payment tokens, bank/card details, or full webhook/customer payloads.
- PonkoForm-generated recurring invoices.

## 5. Affected Files and Folders

~~~txt
plans/015-subscription-xendit-payment/
└── PLAN.md
src/
├── db/schema.ts
├── integrations/payments/
│   ├── base.ts
│   ├── types.ts
│   └── xendit/
│       ├── gateway.ts
│       └── gateway.test.ts                         (candidate)
├── lib/
│   ├── page-builder/
│   │   ├── server-data.ts
│   │   └── types.ts
│   ├── payments/
│   │   ├── reconciliation.ts
│   │   ├── reconciliation-utils.ts
│   │   ├── reconciliation.test.ts
│   │   ├── xendit-subscriptions.ts                (candidate)
│   │   ├── xendit-subscriptions.test.ts           (candidate)
│   │   ├── xendit-webhook.ts
│   │   └── xendit-webhook.test.ts
│   └── server-fns/
│       ├── page-forms.ts
│       └── payments-view.ts
├── components/
│   ├── page-builder/
│   │   ├── PageBuilderWorkspace.tsx
│   │   └── SubscriptionConfigFields.tsx            (candidate)
│   └── page-form/
│       ├── PagePaymentStep.tsx
│       └── PagePaymentStep.test.tsx
└── routes/
    ├── api/webhooks/xendit/$endpointKey.ts
    ├── forms/$formId/payments.tsx
    └── forms/payment-return.tsx                    (review)
drizzle/
├── 0026_*.sql                                     (generated candidate)
└── meta/
    ├── _journal.json
    └── 0026_snapshot.json                          (generated candidate)
scripts/
└── reconcile-payments.ts
~~~

schema.ts is the configuration, enrollment, and cycle source of truth. The migration filename must come from Drizzle.

gateway.ts owns Xendit HTTP operations and response normalization, not database mutations. reconciliation.ts remains the orchestration boundary. The webhook route stays a thin authenticated adapter.

PageBuilderWorkspace.tsx currently contains payment controls. Extract only the new schedule controls if useful; do not refactor the whole builder for this feature.

## 6. Step-by-Step Implementation Plan

1. Confirm the lifecycle contract and Xendit prerequisites.
   - In test mode, confirm Subscription Payment Sessions are enabled for the Philippines account, the required api-version, a Merchant-Initiated Transaction-compatible channel, immediate_payment behavior, and actual session/plan/cycle webhook payloads.
   - Verify which Philippine channels produce a reusable payment method that Xendit can automatically debit on later cycles; do not advertise subscription mode for ordinary one-time-only channels.
   - Confirm the exact session/plan states that prove successful enrollment. That verified active-enrollment state completes the form for both immediate and trial subscriptions; cycle settlement is tracked separately.
   - This is a hard gate for provider status mapping, but the product completion rule is resolved.

2. Define provider-neutral domain types and gateway capabilities.
   - Add SubscriptionConfig for mode, normalized interval/count, optional trial/max cycles, and customer field bindings.
   - Add subscription-session request/result and normalized session/plan/cycle detail types.
   - Add an explicit supports-subscriptions capability and default unsupported gateway methods so PayPal remains unchanged.
   - Centralize and test preset-to-Xendit interval mapping.

3. Add the database model and migration.
   - Add nullable subscription_config JSONB to form_pages; never put Xendit plan IDs in it.
   - Add payment_kind and enrollment fields to payments: recurring-plan ID/status, checkout status, schedule snapshot, trial/anchor date, current/next charge times, ended time, and last subscription sync.
   - Continue using gateway_payment_id for the checkout resource: an invoice ID for existing Xendit payments and a Payment Session ID for new subscription enrollment. Store recurring-plan ID separately.
   - Add subscription_cycles linked to payments with provider cycle ID, sequence, status, schedule, amount/currency, paid/failed timestamps, failure code, and verification source/last verified time as needed for backtracking.
   - Add unique plan/cycle lookups and indexes for active stale-subscription scans.
   - Generate and review a backward-compatible Drizzle migration; existing payments become one_time.

4. Persist and validate page configuration.
   - Extend FormPage, hydration, new-page defaults, draft serialization, save input, and normalized persistence.
   - Persist null config for one-time/disabled payment pages and validated config for subscription pages.
   - Require a selected Xendit gateway for subscription mode.
   - Validate customer bindings exist on earlier pages and have compatible field types.
   - Do not call Xendit during builder save; no respondent or payment method exists then, and edits affect future enrollments only.

5. Add builder controls.
   - Add Payment Mode, schedule presets, optional trial/max cycles, and customer identity bindings inside the existing payment card.
   - Normalize weekly to WEEK/1; monthly, quarterly, semiannual, and annual to MONTH/1, 3, 6, and 12.
   - Prefer presets over arbitrary interval input unless custom schedules are explicitly required.
   - Lock/filter the gateway to Xendit and show actionable missing-integration/field errors.
   - Preserve responsive and unsaved-draft behavior.

6. Implement Xendit subscription Payment Session operations.
   - Create hosted checkout through POST /sessions using SUBSCRIPTION, PAYMENT_LINK, PH, PHP, a unique server-owned reference/customer reference, schedule, return URLs, and allow-listed metadata.
   - Use owner/environment credentials and the verified current API version.
   - Return normalized payment-session ID, recurring-plan ID, payment-link URL, expiry, and status.
   - Implement session and plan fetch plus cycle list/fetch operations needed by return/manual/cron reconciliation.
   - Bound calls using existing timeout conventions and sanitize provider failures.

7. Branch page payment initiation.
   - Include authoritative subscription metadata and Xendit-only gateways in getPagePaymentOptions.
   - Reuse ensurePaymentDraft and the existing payment row; snapshot amount/schedule before the external call.
   - Resolve customer values from server-side session data and create the Subscription Payment Session.
   - Save session ID, plan ID, link/expiry, environment, and sanitized schedule metadata.
   - Reuse an unexpired active session on retry; replace only terminal/expired sessions with concurrency protection.
   - Leave one-time gateway.createPayment behavior unchanged.

8. Handle return and form completion idempotently.
   - Fetch Xendit state on return; never trust the browser redirect as proof.
   - Complete the form only after Xendit API/webhook evidence confirms that hosted enrollment succeeded and the recurring plan is active. Do not wait for the first or a later cycle to be paid.
   - Treat enrollment completion and money receipt as separate facts: the parent payment records subscription enrollment, while each Xendit cycle records whether that scheduled debit was actually received, pending, retrying, or failed.
   - Ensure return/webhook races cannot duplicate submissions, emails, audit events, or cycles.
   - Invoke completePaidPageSubmission at most once for activation. Never invoke it for recurring-cycle webhooks, preventing repeated form confirmation/invoice emails.
   - Distinguish “subscription active” from “cycle payment received” in respondent and creator copy.

9. Extend webhook parsing and reconciliation.
   - Recognize Payment Session, recurring.plan activation/status, and recurring.cycle events using captured current payloads.
   - Resolve by session reference, allow-listed payment metadata, plan ID, or cycle parent plan while enforcing the owner-scoped webhook profile.
   - Route mutations through reconciliation services; upsert every initial and subsequent cycle and update plan/current-period/next-charge fields.
   - Link each cycle through the parent enrollment payment to the original form submission and explicit respondent identity, providing a payment history for that subscriber.
   - Map paid/succeeded cycle events to received payments and retain pending, retrying, failed, and recovered outcomes so creators can verify whether each scheduled debit was actually collected.
   - Consume plan cancellation/deactivation events, store the provider status and effective/end date, and display them without initiating cancellation from PonkoForm.
   - Reuse payment_events deduplication and expand sanitization only for required subscription fields.
   - Define non-retrying handling for authenticated but irrelevant events to avoid webhook retry storms.

10. Extend scheduled/manual reconciliation.
    - Scan stale active subscriptions separately from pending one-time payments.
    - Fetch plan and recent cycles to repair missed webhook state.
    - Keep bounded batches, per-record error isolation, and indexed queries.
    - Route creator Verify correctly. Do not show one-time replace-link actions after activation.

11. Update respondent and creator interfaces.
    - Show Subscribe — amount/interval, trial disclosure, pending activation, active, and failure states.
    - Extend PaymentViewRow and the table/detail view with respondent name/email, subscription badge, plan status, schedule, next billing, cancellation/end date, and a cycle timeline showing whether each debit was received.
    - Preserve one-time rows/actions and make the wide table usable on narrow screens.
    - Display cancellation synchronized from Xendit and show Manage in Xendit; do not add a PonkoForm cancellation mutation in phase 1.

12. Verify and document rollout.
    - Run focused and full Vitest suites, build/type validation, schema checks, and migration against a disposable/local database.
    - Sandbox-test immediate/trial enrollment, abandoned checkout, webhook races, failed/recovered cycle, cancellation, edits after enrollment, and cron repair.
    - Confirm persisted payloads/logs contain no credentials, payment tokens, card/bank data, or unnecessary PII.
    - Deploy webhook/parser support before enabling the creator toggle.

## 7. Database Changes

- Add nullable form_pages.subscription_config with provider-neutral schedule and customer-field bindings.
- Add payments.payment_kind with default one_time.
- Add nullable enrollment fields to payments: recurring-plan ID/status, checkout status, interval/count, max cycles, trial/anchor, current/next charge, ended/cancelled, and last sync.
- Add a unique/indexed non-null recurring-plan lookup and stale-active-subscription index.
- Add subscription_cycles with a cascading payment foreign key, unique provider cycle ID, sequence/status, amount/currency, lifecycle timestamps/failure code, and verification metadata needed to audit whether payment was received.
- Reuse payment_events for sanitized audit history; do not duplicate raw payloads in cycles.
- Preserve existing one-time data and constraints.
- Generate and validate the migration through pnpm db:generate, pnpm db:migrate, and pnpm db:check in a non-production environment.

## 8. Backend Changes

- Extend the gateway contract with subscription capability and create/fetch operations.
- Implement current Xendit Payment Sessions and plan/cycle reads with merchant credentials.
- Validate builder config without external calls.
- Branch payment options/initiation while retaining amount computation and idempotent drafts.
- Add separate normalization for one-time payment, subscription session, plan, and cycle states.
- Extend webhook identity/sanitization and scheduled reconciliation.
- Add enrollment/cycle and respondent identity fields to owner-checked creator payment queries.
- Keep activation completion side effects isolated from cycle reconciliation so recurring debits cannot resend form emails.
- Keep flow-based initiatePayment unchanged in phase 1.

## 9. Frontend Changes

- Add subscription mode, schedule, trial/max-cycle, and customer-binding controls in the existing payment settings.
- Constrain subscription mode to Xendit and surface missing prerequisites before save.
- Include subscription config in draft snapshots/dirty detection.
- Add schedule-aware checkout, trial, pending, error, and active copy.
- Add respondent identity, subscription status/schedule, cancellation state, and received/pending/failed cycle history to Payments.
- Hide inapplicable one-time recovery actions.
- Maintain accessibility, visual conventions, and responsive layout.

## 10. Validation Rules

- Subscription is allowed only on the normalized non-final payment page.
- Gateway must be an active owner-configured Xendit integration in the recorded environment.
- Currency is PHP.
- Amount must be finite, positive, converted exactly once to minor units, and within confirmed Xendit/channel limits.
- Schedules must be one of WEEK/1 or MONTH/1, 3, 6, 12.
- Counts are positive safe integers within confirmed Xendit limits.
- Trial days are non-negative and within the confirmed limit; derived anchors obey timezone rules and Xendit's maximum month day of 28.
- Customer/session references are unique, stable, server-derived, and satisfy length/character rules.
- Explicit Name and Email bindings are required, exist before the payment page, and resolve to values meeting Xendit requirements. Automatic label guessing is rejected.
- Metadata contains only reconciliation identifiers.
- Unknown webhook statuses never downgrade terminal states.
- Cycle/event writes are idempotent.
- Existing enrollment snapshots never recalculate after form edits.

## 11. Security Considerations

- Require Clerk authentication and form ownership for builder, creator view, verification, and future cancellation.
- Bind public operations to the server-created page session; never accept amount, customer, plan, or schedule from the browser.
- Use only the owner’s encrypted Xendit credentials and recorded environment.
- Retain constant-time callback-token checks, owner-scoped paths, body limits, and JSON guards.
- Confirm webhook ownership before mutations.
- Verify redirects through Xendit API/webhook state.
- Deduplicate before completion emails or other side effects.
- Cycle events must never invoke form-completion or confirmation-email side effects.
- Never store/log API keys, payment tokens, raw authorization data, card/bank data, full customer objects, or unnecessary PII.
- Use timeouts, bounded batches, rate-limit-aware retry/backoff, and ownership-safe detail queries.
- Audit lifecycle changes through payment_events.

## 12. Testing Plan

- Unit:
  - Schedule mapping and anchor/trial calculation, including month-end/timezone cases.
  - Config, earlier-field, currency, amount, and gateway validation.
  - Xendit session/plan/cycle request and response normalization.
  - Webhook identity/sanitization.
  - Monotonic enrollment/cycle transitions and duplicate/out-of-order events.

- Server/integration with mocked Xendit:
  - Immediate enrollment completes on verified active plan without waiting for cycle settlement.
  - Trial enrollment completes on verified active plan while its first charge remains scheduled for later.
  - Dynamic amount snapshot remains stable after form edits.
  - Double-click/retry reuses active checkout.
  - Return/webhook race produces one completion and one form email.
  - Initial and subsequent paid cycle webhooks create/update cycle records without resending form email.
  - Abandoned/expired checkout, missing identity/credentials, provider error, amount/currency mismatch.
  - Paid, retrying, failed, recovered, completed, deactivated, and cancelled cycles/plans, including visible cancellation/end dates.
  - Cron/manual repair of missed events.
  - Wrong-owner webhook and creator access rejection.

- Components:
  - Mode switch, stale-config clearing, gateway constraints, validation, schedule/trial copy, loading/error/pending/active states.
  - One-time rows remain unchanged; subscription rows and cycle history render correctly.

- Regression:
  - Existing Xendit invoice and PayPal flows, webhooks, recovery links, and reconciliation pass.
  - Page navigation follows the agreed completion state.
  - Flow-builder behavior is unchanged.

- Manual sandbox:
  - Philippine Subscription Payment Link with a compatible active channel.
  - Immediate/trial billing, replayed/delayed webhooks, failed retry, Xendit-dashboard cancellation, and scheduled repair.
  - Confirm API version and payload assumptions from Step 1.

## 13. Rollback Plan

- Put the creator toggle behind a server-controlled feature flag until sandbox verification.
- To stop new enrollments, disable the toggle/initiation while continuing webhooks and reconciliation for existing subscriptions.
- Revert UI/initiation code without deleting subscription/cycle data.
- Keep additive columns/tables during application rollback so delayed events and accounting history are not lost.
- Drop schema only after backup and confirmation no subscription data exists.
- Active Xendit plans keep billing after application rollback; reconcile or cancel them explicitly in Xendit.
- Recover missed state using stored plan IDs and Xendit plan/cycle reads.

## 14. Final Checklist

- [x] Plan reviewed
- [x] Files identified
- [x] Database changes checked
- [x] Backend changes checked
- [x] Frontend changes checked
- [x] Validation rules checked
- [x] Security considerations checked
- [x] Tests planned and automated coverage added
- [x] Rollback plan reviewed
- [x] Assumptions and open questions resolved
