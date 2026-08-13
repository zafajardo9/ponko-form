# AI Guide and Form Generator

## 1. Goal

Deliver a production-ready AI assistant inside the page builder with two user-facing entry points: AI Guide for contextual builder questions and Generate Form for conversational page-form generation. Provider selection must remain invisible to users, generated content must be reviewed before it changes the local draft, and the existing Save changes workflow must remain the only persistence boundary.

## 2. Context Summary

PonkoForm uses React 19, TanStack Start server functions, TanStack Query, TypeScript, Zod, and Vitest. The page builder keeps edits in local component state and persists the complete page form atomically through `savePageForm`.

The working tree already contains the core implementation:

- `CanvasAskMenu` exposes AI Guide and Generate Form actions.
- `BuilderAIAssistant` provides the shared session-only near-full-width modal, chat histories, large visual form preview, retry behavior, focus handling, and responsive UI.
- `PageBuilderWorkspace` converts an approved candidate into temporary page/field records, marks the form dirty, and supports Undo before further edits or saving.
- The AI backend routes to Gemini or DeepSeek using server-only environment variables, falls back only for retryable failures, validates generated output, and checks form-editor permission.
- Targeted AI tests and the production build pass. The full suite currently has three unrelated stale `SignInPage` test failures, and TypeScript reports two unrelated unused variables.

Assumptions: v1 remains page-builder-only, generated forms use the safe core field set, conversations are ephemeral, and form title/description/theme/references are preserved.

## 3. Scope

- AI Guide and Generate Form actions in the page builder's existing gooey menu.
- One provider-neutral assistant modal with separate in-memory Guide and Generate conversations and a Notion/ClickUp-style two-pane workspace.
- Current unsaved page-form context sent in a bounded, compact shape.
- Fixed server-side routing: Gemini answers Guide questions and DeepSeek generates form drafts.
- Structured page-form generation, server-side normalization, preview, explicit draft replacement, Undo, and normal manual saving.
- Authentication, editor authorization, input/output limits, sanitization, stable error categories, automated tests, deployment configuration, and rollout verification.

## 4. Out of Scope

- Flow-canvas node or edge generation.
- Persisted conversation history, cross-device chat, attachments, streaming, web search, or AI usage billing.
- User-facing provider selection or use of per-user Gemini integration credentials.
- Generated payments, subscriptions, computations, discount codes, uploads, media, reCAPTCHA, references, or conditional rules.
- Automatic saving or replacing form title, description, theme, and reference definitions.
- A platform administration screen for provider keys or routing.

## 5. Affected Files and Folders

```txt
.env.example
src/
├── components/page-builder/
│   ├── CanvasAskMenu.tsx
│   ├── BuilderAIAssistant.tsx
│   ├── PageBuilderWorkspace.tsx
│   └── *.test.tsx
├── lib/ai/
│   ├── contracts.ts
│   ├── generated-form.server.ts
│   ├── provider.server.ts
│   └── *.test.ts
└── lib/server-fns/
    └── ai-assistant.ts
```

- `.env.example` documents the two server-only provider keys and configurable model identifiers.
- `src/components/page-builder/` owns entry-point accessibility, modal state, candidate preview, draft application, Undo, and UI tests.
- `src/lib/ai/` owns the shared request/response contract, safe candidate schema, normalization, sanitization, mode-specific provider routing, and unit tests.
- `src/lib/server-fns/ai-assistant.ts` is the authenticated client/server boundary and must keep database, authentication, and provider-only imports out of the browser bundle.

## 6. Step-by-Step Implementation Plan

1. **Finalize the shared AI contract.** Define bounded chat messages, compact draft context, generated page/field candidates, discriminated responses, and stable error codes. Keep the safe v1 field allowlist explicit. Affects `src/lib/ai/contracts.ts`; this contract must be stable before provider and UI integration.
2. **Finalize candidate validation and normalization.** Parse provider JSON with strict Zod schemas; enforce page topology, supported types, page/field/text limits, unique snake-case bindings, valid choice options, compatible validation ranges, and sanitized rich text. Affects `src/lib/ai/generated-form.server.ts` and tests; provider adapters depend on this step.
3. **Implement and harden provider adapters.** Translate Guide requests to Gemini plain-text responses and Generate requests to DeepSeek JSON mode, apply configurable model names and timeouts, and classify failures without cross-provider fallback. Affects `src/lib/ai/provider.server.ts`; depends on steps 1–2.
4. **Secure the server-function boundary.** Validate the request before handler execution, authenticate the caller, require owner/editor access to the supplied form, dynamically import server-only dependencies inside the handler, and map internal failures to provider-neutral client errors. Affects `src/lib/server-fns/ai-assistant.ts`; depends on step 3.
5. **Replace documentation links with AI actions.** Preserve the liquid menu's animation, outside-click closing, Escape handling, focus restoration, hidden-item tab behavior, labels, tooltips, and reduced-motion behavior while wiring the two modes. Affects `CanvasAskMenu.tsx` and its test.
6. **Complete the shared assistant modal.** Maintain separate Guide and Generate histories for the mounted editor session; include message input, Enter/Shift+Enter behavior, loading state, retry, error recovery, focus trap, scroll lock, responsive layout, and a large page-by-page visual preview beside chat. Affects `BuilderAIAssistant.tsx` and its test; depends on steps 1 and 4.
7. **Integrate generation with local builder state.** Convert an approved candidate to `EditablePage` records with temporary page/field IDs, reset unsupported advanced settings, preserve references and form metadata, select the first editable page, close the modal, and expose Undo. Clear Undo after another edit or successful save. Affects `PageBuilderWorkspace.tsx` and its integration test; depends on step 6.
8. **Configure deployment environments.** Set `GEMINI_API_KEY` for AI Guide and `DEEPSEEK_API_KEY` for Generate Form, plus optional model overrides in each target environment. Never expose these values through client-prefixed variables or integration status responses. Affects deployment secrets and `.env.example`; depends on step 3.
9. **Run verification and repair regressions.** Run targeted AI tests, the complete Vitest suite, TypeScript checks, and production builds. Resolve the unrelated stale sign-in assertions and unused-variable errors separately so CI provides a clean baseline. Verify desktop/mobile accessibility and each mode's missing-key behavior without saving test forms. Depends on all implementation steps.
10. **Roll out conservatively.** Configure both providers in a non-production environment, exercise Guide and Generate with representative prompts, then promote the same server-only configuration to production. Monitor server errors and provider rate limits without logging prompts, credentials, full form drafts, or raw provider responses.

## 7. Database Changes

No database changes required.

## 8. Backend Changes

- Expose one POST server function accepting `formId`, mode, bounded messages, compact draft context, and an optional previous candidate for refinement.
- Authorize with the existing authenticated form-editor guard; viewers, unauthenticated callers, and users without form access receive `unauthorized` without revealing form existence.
- Route Guide requests only to Gemini and Generate requests only to DeepSeek. Return `not_configured` when the provider required by that mode has no server key.
- Keep provider identifiers, keys, upstream payloads, and raw errors server-side.
- Build prompts from curated page-builder capabilities and save invariants rather than database or deployment documentation.
- Use timeouts and output-token limits. Return stable provider-neutral errors for authentication/configuration rejection, availability, rate limits, and invalid output without routing a request to the other mode's provider.
- Parse both provider results through the same normalization function before returning a generation candidate.

## 9. Frontend Changes

- The gooey Ask control expands to AI Guide and Generate Form buttons and sends the selected mode to `PageBuilderWorkspace`.
- The workspace owns modal visibility, active mode, generated-draft application, and one-level Undo state.
- The modal preserves separate Guide and Generate message arrays only while the editor remains mounted.
- Guide displays text answers and never claims to mutate the form.
- Generate carries the last approved candidate into follow-up requests, renders a page/field preview, and requires Replace draft before any local mutation.
- Replace draft closes the modal, updates the existing live draft callback, marks the builder unsaved, and leaves persistence to Save changes.
- Loading disables duplicate sends and mode changes; errors retain the last request for retry using provider-neutral language.
- The modal must be nearly full-width on larger screens with chat and visual preview side by side, stack both panes on narrow screens, trap keyboard focus, close on Escape/backdrop, restore focus, lock background scrolling, and honor reduced motion.

## 10. Validation Rules

- Accept 1–12 non-empty user/assistant messages, each no longer than 2,000 characters, and reject oversized serialized requests.
- Accept at most 8 context/candidate pages, 20 fields per candidate page, and 30 generated fields in total.
- Require at least one editable page and exactly one field-free final page; normalize the final page to the end.
- Allow only text, email, number, textarea, select, checkbox, radio, date, time, datetime, content, address, and satisfaction fields.
- Require non-empty bounded page titles and field labels, supported widths, and unique valid snake-case bindings.
- Require 2–20 unique options for choice/rating fields and reject options on incompatible fields.
- Enforce sensible numeric/text validation boundaries and reject minimum values greater than maximum values.
- Sanitize content placeholders and final confirmation HTML to the approved text-formatting tag allowlist with no attributes, scripts, URLs, expressions, or executable markup.
- Preserve references separately and do not allow generated bindings to redefine or mutate reference records.

## 11. Security Considerations

- Store Gemini and DeepSeek keys only as server secrets; never serialize, log, mask-and-return, or place them in browser environment variables.
- Authenticate every AI request and authorize against the requested form using owner/editor access.
- Treat messages, draft context, previous candidates, and provider responses as untrusted input; delimit them as reference content and validate all structured output locally.
- Do not log full prompts or form drafts because they may contain personal or commercially sensitive content.
- Keep request, context, output, and timeout limits to control denial-of-service risk and provider cost.
- Map errors to stable categories so raw provider details do not leak to the user.
- Confirm provider data-retention and regional/privacy settings before production use because form context is sent to external AI services.
- Add distributed rate limiting before broad or paid rollout; the current request bounds do not prevent repeated calls across instances.

## 12. Testing Plan

- **Happy paths:** Guide returns an answer; Generate returns a valid preview; refinement replaces the prior preview; Replace draft updates local pages; Save persists through the existing atomic path; Undo restores the previous local draft.
- **Provider behavior:** Guide-to-Gemini and Generate-to-DeepSeek request translation, JSON mode for generation, per-mode missing-key behavior, timeout, rate limit, invalid JSON/output, and authentication rejection without cross-provider routing.
- **Schema edge cases:** unsupported or unknown fields, extra properties, missing/multiple final pages, fields on final page, duplicate/invalid bindings, duplicate/empty options, invalid ranges, unsafe HTML, excessive text/page/field/request sizes, and malformed JSON.
- **Permissions:** owner and editor success; viewer, unauthenticated, unrelated-user, and cross-form requests rejected without data leakage.
- **UI/accessibility:** menu labels and tab order, outside click, Escape and focus restoration, mode histories, focus trap, Enter versus Shift+Enter, loading disablement, retry, mobile layout, reduced motion, and background scroll lock.
- **Regression:** preview alone does not change the draft; Replace does not call `savePageForm`; references and form metadata remain unchanged; subsequent manual edits clear Undo; successful save clears Undo.
- **Commands:** run targeted Vitest files, `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm run build`, and Cloudflare build verification when that deployment target is used.

## 13. Rollback Plan

- Remove or disable the AI menu actions and modal integration while leaving the existing page builder and Save workflow untouched.
- Remove AI provider secrets or leave both keys unset to make the server function return a neutral unavailable/not-configured response.
- Revert the assistant server function and AI modules without a data rollback because no AI state, candidate, or conversation is stored in the database.
- Any generated draft not saved disappears on reload; saved page-form changes remain ordinary form edits and can be manually restored from a known form copy if necessary.
- If one provider is faulty, disable only its corresponding assistant mode while leaving the other provider and the rest of the builder available.

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
