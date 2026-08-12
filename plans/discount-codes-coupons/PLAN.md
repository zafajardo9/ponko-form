# Discount Codes & Coupons

## 1. Goal

Fully implement FT-021 as a secure, form-scoped discount system. Form owners and editors can create, update, activate/deactivate, and delete percentage or fixed-amount discount codes. Respondents can enter a code in a dedicated page-form field, receive server-validated pricing feedback, and pay the discounted amount. Successful payments create an auditable redemption record without allowing concurrent requests to exceed usage limits.

The implementation must preserve the original amount for auditability, calculate discounts in integer minor units where persisted, and treat the payment initiation endpoint as the final authority. Client-side validation is only a convenience.

## 2. Context Summary

Confirmed repository facts:

- PonkoForm uses TanStack Start, React 19, Drizzle ORM, PostgreSQL/Neon, Better Auth, TanStack Query, Tailwind, and Vitest.
- The page-builder model is stored in `forms`, `form_pages`, and `form_page_fields`; the existing `fieldTypeEnum` does not yet include `discount`.
- Public page sessions persist respondent answers in `form_submission_sessions.collectedData` and are accessed with a session id plus client token.
- `calculatePagePayment()` in `src/lib/page-builder/references.ts` computes the current page amount and returns a breakdown.
- `getPagePaymentOptions()` and `initiatePagePayment()` in `src/lib/server-fns/page-forms.ts` are the public payment read/write boundaries.
- Form administration uses `FormWorkspaceLayout`, `FormSectionNav`, and server functions with authenticated form access checks. Collaborators can have editor or viewer access, so discount mutations must require editor access.
- Existing page-form field rendering is dispatched through `FieldRenderer`; `PageFormView` owns answer state and page-session advancement.
- The latest visible migration files are in `drizzle/`; migration numbering and journal state must be checked before creating the next migration.
- Vitest tests already cover payment calculations, field rendering, page-form behavior, server functions, and payment verification.

Assumptions and decisions for implementation:

- FT-021 targets the current page-builder flow, not the legacy graph-flow payment node.
- A dedicated `discount` field type is preferred over a special `text` flag so the builder, renderer, and validation behavior are explicit.
- Codes are unique per form, normalized to uppercase, and limited to a safe printable code alphabet.
- A discount is redeemed only once a payment checkout is successfully created or, for zero-total orders, once the submission is completed through an explicit zero-payment path. Failed checkout creation must not consume a use.
- The respondent's email is optional for v1; per-email usage limits are out of scope unless the existing session data provides a reliable email binding. The database will still retain respondent email when available.
- Existing subscription payment behavior must remain unchanged unless the discount is explicitly applied to the initial checkout amount; recurring-cycle pricing is not discounted by this feature.

Open items to resolve during implementation:

- Confirm the migration journal's true latest applied tag before naming the new migration.
- Confirm whether the current page-builder editor exposes a form-level tab extension point without requiring changes to generated route metadata.
- Confirm the exact zero-amount payment/submission behavior and gateway minimum constraints before enabling free checkout.

## 3. Scope

- Add discount-code and redemption database tables plus indexes and foreign keys.
- Add the `discount` field type to the page-builder schema/types and editor palette/configuration.
- Implement authenticated discount CRUD for form owners/editors.
- Implement public, form-scoped server validation with start/end dates, active state, usage limits, minimum order amount, percentage caps, and non-negative final totals.
- Implement a respondent-facing discount field with apply/remove states and accessible success/error messaging.
- Recalculate and display the payment breakdown with the discount adjustment.
- Revalidate the code and atomically reserve/record a redemption during payment initiation.
- Preserve original, discount, and final amounts in redemption/payment audit data.
- Add automated tests for calculation, validation, authorization, concurrency-safe usage limits, field rendering, and payment integration.
- Update FT-021's status and task checklist after implementation is verified.

## 4. Out of Scope

- Discounting recurring subscription cycles after the initial checkout.
- Global coupons shared across multiple forms.
- Per-respondent redemption limits or account-based coupon restrictions.
- Stackable/multiple discount codes on one order.
- Affiliate attribution, campaign analytics dashboards, or advanced reporting beyond stored redemption data.
- Stripe, PayMongo, or Maya gateway implementation.
- Legacy flow-builder discount support.
- Unrelated form-builder redesign or DataTable work.

## 5. Affected Files and Folders

```txt
src/
  db/schema.ts
  lib/page-builder/types.ts
  lib/page-builder/server-data.ts
  lib/page-builder/references.ts
  lib/server-fns/discounts.ts                 (new)
  lib/server-fns/page-forms.ts
  lib/server-fns/forms.ts or lib/server-fns/flow-helpers.ts (access pattern only, if needed)
  components/form-builder/fields/FieldRenderer.tsx
  components/form-builder/fields/renderers/DiscountCodeField.tsx (new)
  components/form-builder/fields/renderers/index.ts
  components/form-builder/fields/FieldRendererUtils.ts (only if shared field typing needs it)
  components/page-form/PageFormView.tsx
  components/page-form/PagePaymentStep.tsx
  components/page-builder/... (field palette/editor/configuration)
  components/forms/FormSectionNav.tsx
  components/forms/CreateDiscountDialog.tsx (new)
  components/forms/DiscountCodeRow.tsx (new)
  routes/forms/$formId/discounts.tsx (new)
  routeTree.gen.ts (generated by the router/build workflow if required)

drizzle/
  <next-migration>_discount_codes.sql (new)

src/lib/page-builder/references.test.ts
src/components/form-builder/fields/FieldRenderer.test.tsx
src/components/page-form/PagePaymentStep.test.tsx
src/lib/server-fns/discounts.test.ts (new, or a focused unit/server test location)
src/lib/server-fns/page-forms.test.ts (new or existing focused coverage)
feature-plan/021-discount-codes-coupons.md
```

`src/db/schema.ts` is the source of truth for Drizzle tables and the `field_type` enum. `src/lib/server-fns/discounts.ts` owns creator mutations and public validation. The page-form server functions remain the authority for session access, pricing, checkout, and redemption. UI additions should follow existing workspace layout, dialog, toast, and field-renderer patterns.

## 6. Step-by-Step Implementation Plan

1. **Resolve migration and access conventions.**
   - Inspect the migration runner/journal and current form access helpers.
   - Identify the next safe migration number and the editor-level authorization helper.
   - This prevents a schema migration collision and avoids accidentally granting viewers mutation access.
   - Affects `drizzle/meta/_journal.json`, `scripts/migrate.ts`, `src/lib/server-fns/flow-helpers.ts`, and related server functions.

2. **Add the discount schema.**
   - Add `discount` to `fieldTypeEnum` and the corresponding TypeScript unions.
   - Add `discountCodes` with form ownership, normalized code, description, type, value, maximum discount, minimum order, usage limit/current uses, active flag, start/end timestamps, and timestamps.
   - Add `discountRedemptions` with code/form/payment/session/submission references, respondent email, original/discount/final amounts, currency, and creation time.
   - Add a unique `(form_id, code)` constraint and indexes for form listing, active lookup, and redemption history.
   - Add foreign keys with cascade behavior appropriate to form deletion and set-null behavior for optional payment/submission links.
   - Create and verify the migration using the repository's Drizzle workflow.

3. **Implement pure discount domain logic.**
   - Create a small reusable module for code normalization, eligibility checks, percentage/fixed calculation, cap application, minimum-order validation, and final-total clamping.
   - Keep arithmetic deterministic and integer-based for persisted minor-unit values; clearly convert at the page payment boundary where the existing system uses major units.
   - Return structured failure reasons suitable for both creator/API and respondent UI without exposing database details.
   - Add unit tests before wiring the logic into server functions.

4. **Implement authenticated discount management server functions.**
   - Add list, create, update, toggle-active, and delete operations in `src/lib/server-fns/discounts.ts`.
   - Require authenticated form editor access and verify the submitted `formId` owns the code being changed.
   - Normalize codes before lookup/write, reject duplicates, validate numeric/date boundaries, and reject invalid percentage/fixed combinations.
   - Return safe display data only; do not leak unrelated form records or internal authorization details.

5. **Build the creator discounts page.**
   - Add a Discounts section to `FormSectionNav` when appropriate for the form workspace.
   - Create `/forms/$formId/discounts` using the existing route authentication and `FormWorkspaceLayout` patterns.
   - Add a create/edit dialog with code, description, type, value, cap, minimum amount, maximum uses, start/end dates, and active state.
   - Add rows/cards showing usage, dates, eligibility, status, and actions for edit, toggle, and delete.
   - Handle loading, empty, validation, mutation errors, optimistic or post-success query invalidation, toast feedback, and mobile layout.

6. **Integrate the field type into the builder.**
   - Add the discount field to the page-builder palette and field configuration UI with a default binding reserved for the discount code value.
   - Prevent duplicate or conflicting discount bindings where the current builder enforces variable uniqueness.
   - Make the field available only where it is meaningful, with explanatory helper text that codes are applied to a payment page in the same form.
   - Ensure saved fields hydrate correctly through `server-data.ts` and existing page serialization.

7. **Implement the respondent discount field.**
   - Create `DiscountCodeField` using the existing field renderer contract and TanStack Query mutation/query conventions.
   - Apply calls the public validator with the current form/session context and current calculated amount; remove clears the stored discount state.
   - Preserve the entered code in normal session data while storing server-returned validated metadata in a reserved internal structure such as `__discount`.
   - Clear stale discount metadata whenever the code changes, the base amount changes, the form session advances, or server validation fails.
   - Add accessible labels, busy state, keyboard operation, success/error announcements, and no-sensitive-data logging.

8. **Wire discount data into page sessions and payment calculation.**
   - Extend page-session advancement/merge behavior so the reserved discount metadata cannot be forged by trusting client-calculated amounts or arbitrary discount ids.
   - Update `calculatePagePayment()` to apply only a validated discount representation and add a negative adjustment line plus the original subtotal.
   - Update `getPagePaymentOptions()` to calculate the displayed amount from the session and return the discount/breakdown data needed by the payment UI.
   - Ensure computed fields and page references continue to work and that a discount cannot affect unrelated non-payment pages.

9. **Make payment initiation authoritative and atomic.**
   - Extend `initiatePagePayment()` input only as needed, but always re-read the form, payment page, session data, and current discount code from the database.
   - Recalculate the undiscounted base amount server-side, re-check all eligibility rules, and compute the final amount server-side.
   - Atomically increment usage only if the code is active, within its date window, below its usage limit, and matches the form/code pair. Use a transaction or an equivalent conditional update with a clear rollback path.
   - Create the payment using the final amount and retain the original amount/discount metadata for later redemption recording.
   - If gateway creation fails, undo the reserved use or defer usage consumption until the provider checkout is successfully created, ensuring retries do not burn codes.
   - Record a redemption exactly once on successful checkout/payment completion, using a uniqueness guard tied to the payment/session.
   - Handle zero-total orders explicitly and safely, rather than sending a zero amount to a gateway that rejects it.

10. **Display and audit the result.**
    - Update `PagePaymentStep` to show subtotal, discount code/description, discount amount, and final total when applicable.
    - Ensure payment records contain the charged amount and redemption records contain the complete original/discount/final audit trail.
    - Keep existing payment recovery, return, reconciliation, and invoice paths compatible with the discounted payment amount.

11. **Add regression coverage and verify.**
    - Run focused unit/component/server tests, then the full Vitest suite and production build.
    - Apply the migration against a disposable or configured development database only after reviewing the generated SQL.
    - Manually test creator CRUD, viewer denial, respondent apply/remove, expired/not-started/inactive/exhausted/minimum-order codes, capped percentages, fixed discounts larger than the order, payment retry, and concurrent redemption attempts.
    - Update FT-021 with completed task checkboxes and an accurate implementation status only after the verification passes.

## 7. Database Changes

Add the following:

- `discount_codes`: one row per code per form. Required fields include `form_id`, uppercase `code`, `type`, `value`, `max_discount`, `min_amount`, `max_uses`, `current_uses`, `is_active`, `starts_at`, `expires_at`, and audit timestamps.
- `discount_redemptions`: immutable audit rows linked to the form and discount code, with optional payment/session/submission references, respondent email, currency, original amount, discount amount, final amount, and creation timestamp.
- `field_type` enum value `discount`.

Constraints and indexes:

- Unique `(form_id, code)`.
- Index active codes by `(form_id, is_active)` and lookup by form/code.
- Index redemptions by discount code, form, payment, and session as needed for usage/audit queries.
- Enforce positive values, non-negative caps/minimums, and non-negative usage counters in application validation; add SQL checks where compatible with the existing migration conventions.
- Use foreign keys to cascade form/code deletion while preserving payment records when existing payment semantics require it.

The migration must be numbered after the actual latest applied migration, not simply copied from the original FT-021 document's example number.

## 8. Backend Changes

- `src/lib/server-fns/discounts.ts`: authenticated CRUD and public validation.
- `src/lib/page-builder/references.ts`: discount adjustment in payment calculation and breakdown.
- `src/lib/server-fns/page-forms.ts`: session-safe discount handling, authoritative recalculation, atomic usage reservation/redemption, and payment amount propagation.
- `src/lib/page-builder/server-data.ts` and `src/lib/page-builder/types.ts`: type and hydration support.
- Existing form-access helpers: require editor access for mutations and form/session access for respondent validation.
- Payment/invoice/recovery code: verify it consumes the final `payments.amount` without recomputing an undiscounted amount.

Public validation may reveal whether a submitted code is valid for the current form and amount, but must not reveal database ids, current use counts, or sensitive owner data beyond the configured description and discount result.

## 9. Frontend Changes

- Add a responsive Discounts workspace page and navigation item.
- Add controlled create/edit dialog and code row/card components using existing button, input, badge, toast, and layout conventions.
- Add discount field configuration to the page builder.
- Add a respondent field renderer with apply/remove, pending, success, and error states.
- Ensure page-form state carries the validated discount into the payment step and invalidates payment options when it changes.
- Show an itemized payment breakdown and distinguish original amount from amount due.
- Use accessible form labels, `aria-live` status messages, disabled states during mutations, and clear retry behavior.

## 10. Validation Rules

- Code is trimmed, uppercased, non-empty, and limited to a documented safe alphabet and maximum length.
- Code uniqueness is scoped to a form.
- Percentage values are greater than 0 and at most 100.
- Fixed discount values are greater than 0 and expressed in the form/payment currency's minor units at persistence boundaries.
- Maximum discount and minimum order are non-negative when present.
- Maximum uses is a positive integer when present; current uses never becomes negative or exceeds it.
- Start date must not be after expiry date.
- Eligibility requires active state, start time reached, expiry not passed, usage remaining, and minimum order satisfied.
- Final amount is never negative.
- The payment endpoint recomputes all monetary values from current database state and ignores client-supplied discount amounts.
- A code must belong to the same form as the payment session.
- Duplicate redemption for the same payment/session is rejected or treated idempotently.

## 11. Security Considerations

- Require Better Auth and form editor authorization for all creator mutations.
- Enforce form ownership/collaborator boundaries on every code lookup and mutation; viewers are read-only.
- Treat all respondent discount input as untrusted. Never trust client-supplied discount ids, amounts, types, or final totals.
- Use conditional SQL updates/transactions to prevent usage-limit overselling under concurrency.
- Avoid exposing internal ids, usage counts, owner details, or database errors through public validation responses.
- Do not log submitted codes together with unnecessary respondent personal data; redact or minimize diagnostic logs.
- Keep payment amount and redemption writes consistent on retries, provider failures, and return/reconciliation flows.
- Validate description and text inputs according to existing UI/server limits; render descriptions as text, not unsanitized HTML.

## 12. Testing Plan

- Domain unit tests:
  - percentage and fixed calculations
  - maximum cap
  - minimum order
  - rounding and minor-unit boundaries
  - zero and over-discount totals
  - date window, inactive, and exhausted-code rejection
- Server tests:
  - creator list/create/update/toggle/delete
  - duplicate code rejection
  - owner/editor success and viewer/unauthorized denial
  - cross-form code/session rejection
  - client amount tampering resistance
  - atomic usage-limit behavior and idempotent retry
  - checkout failure does not consume a use
- Component tests:
  - renderer dispatch for `discount`
  - apply success/error/loading/remove states
  - payment breakdown rendering
  - discounts navigation visibility and CRUD feedback
- Regression tests:
  - existing page payment calculation without a discount
  - existing payment gateways and subscriptions
  - form submission and invoice/payment recovery behavior
  - full Vitest suite and production build
- Manual checks:
  - mobile and keyboard use
  - expired/not-yet-active/inactive/maxed-out codes
  - percentage cap and fixed discount greater than order
  - two simultaneous checkout attempts at the usage limit
  - payment return and reconciliation after a discounted checkout

## 13. Rollback Plan

- Revert application code while leaving the additive tables and enum value in place; unused discount tables are harmless and can be removed in a later migration after confirming no data exists.
- If a production issue affects payment amounts, disable all discount codes through the management UI or a controlled database update, then deploy the code rollback.
- Do not delete redemption history during an emergency rollback.
- If the migration itself fails before application rollout, fix or replace the unapplied migration and rerun it; do not edit an already-applied migration.
- If corrupted discount metadata is found, stop new code use, preserve payment records, and repair/reconcile redemption rows before re-enabling codes.

## 14. Final Checklist

- [ ] Plan reviewed
- [ ] Files identified
- [ ] Database changes checked
- [ ] Backend changes checked
- [ ] Frontend changes checked
- [ ] Validation rules checked
- [ ] Security considerations checked
- [ ] Tests planned
- [ ] Rollback plan reviewed
- [ ] Assumptions and open questions resolved
