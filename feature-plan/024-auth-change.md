# FT-024: Authentication Migration — Better Auth + Form Sharing

> **Feature Plan** — Migrate authentication to Better Auth with email/password accounts while keeping PonkoForm profiles as the stable ownership anchor. Simultaneously introduces a form-collaboration system: form owners can share editing or viewing access with other users, with full audit logging.

**Status:** 🟢 **Implemented locally with email/password sign-in and account creation**

**Dependencies:**
- ✅ **FT-002 (Integrations Hub)** — the `integrations` table is keyed by `profileId`; its `requireProfile()` function calls `auth()` and must be updated
- ✅ **FT-007 (Form Builder Revision)** — the unified form editor and all form CRUD server functions are the primary consumers of `auth()`; every ownership assertion needs updating
- ✅ **FT-011 (Form Templates)** — template creation and cloning use `ensureProfile()` and `ownedProfileIds()`
- ✅ **FT-012 (Homepage Redesign)** — the homepage uses Clerk's `<Show>`, `<SignInButton>`, `<SignUpButton>`, and `<UserButton>` components, all of which must be replaced
- ✅ **FT-013 (Invoice Builder)** — invoicing server functions use `auth()` for ownership checks
- ✅ **FT-014 (Satisfaction Field)** — part of the page builder, auth flows through form builder checks
- ✅ **FT-018 (Payment Links)** — payment link CRUD uses `auth()` and `ownedProfileIds()`
- 🚧 **FT-003 through FT-022 (all planned features)** — should be implemented after this migration to avoid building on Clerk patterns

---

## 1. Problem & Motivation

### 1.1 Why Replace Clerk?

Clerk is a hosted auth service that abstracts away user management, sessions, sign-in flows, and UI components. While this accelerates initial development, it creates several long-term problems:

| Concern | Impact |
|---|---|
| **Vendor lock-in** | User identities live in Clerk's database. Cannot add custom user metadata without syncing. |
| **Limited control** | Session duration, token refresh, and cookie behavior are configured in Clerk's dashboard, not in code. |
| **No multi-user form sharing** | Clerk has Organizations for B2B tenants, but PonkoForm needs per-form collaborator roles — a model Clerk doesn't natively support without a complex sync layer. |
| **No audit logging** | Clerk's event webhooks fire asynchronously; there's no built-in audit trail for who changed what permission. |
| **Build-time coupling** | Clerk's middleware parses session tokens on every request. The app can't run without Clerk's API being reachable. |
| **Cost at scale** | Clerk charges per monthly active user (MAU). For a form platform with many occasional respondents (who don't need accounts), Clerk's pricing is suboptimal since PonkoForm's authenticated user base is a small subset of total traffic. |

### 1.2 Why Better Auth?

Better Auth keeps identity, credential accounts, and sessions in PonkoForm's own
PostgreSQL database while providing a maintained framework-agnostic auth layer:

- **Email and password** — direct account creation and sign-in without an external identity provider
- **Owned identity data** — user, session, account, and verification records live locally
- **TanStack Start integration** — standard request handlers and cookie support
- **Drizzle adapter** — auth tables share the existing database and migration workflow
- **Extensibility** — additional methods and plugins can be introduced without another provider migration
- **Server-side verification** — protected operations use `auth.api.getSession()` with request headers

### 1.3 User Story

1. **As a creator**, I sign in with my email and password, land on my dashboard, and see all my forms.
2. **As a creator**, I open a form's sharing settings, enter another user's email, and grant them `editor` access. They can now edit my form.
3. **As a creator**, I can see who has access to each form and revoke access at any time.
4. **As a collaborator**, I receive an email notification that I've been added as an editor, sign in with my account, and see the shared form in my dashboard alongside my own forms.
5. **As an admin**, I can view the collaboration audit log to see who shared what, when, and with whom.

---

## 2. System Design — Database & Architecture

### 2.1 Schema Changes — `profiles` Table

The `profiles` table is the central user identity anchor. Currently it maps Clerk's external `userId` to an internal serial `id`.

```sql
-- BEFORE (current)
CREATE TABLE profiles (
  id                serial PRIMARY KEY,
  clerk_id          text NOT NULL UNIQUE,
  display_name      varchar(255),
  avatar_url        text,
  dashboard_currency varchar(3) NOT NULL DEFAULT 'USD',
  created_at        timestamp NOT NULL DEFAULT now()
);
```

```sql
-- AFTER (migration FT-024-001)
ALTER TABLE profiles RENAME COLUMN clerk_id TO auth_id;
ALTER TABLE profiles ADD COLUMN email        text;
ALTER TABLE profiles ADD COLUMN name         text;
ALTER TABLE profiles ADD COLUMN auth_provider text NOT NULL DEFAULT 'google';
ALTER TABLE profiles ADD COLUMN updated_at   timestamp NOT NULL DEFAULT now();

-- Rename index
ALTER INDEX profiles_clerk_id_idx RENAME TO profiles_auth_id_idx;

-- Add unique constraint on email
CREATE UNIQUE INDEX profiles_email_idx ON profiles (email) WHERE email IS NOT NULL;
```

**Drizzle definition after migration:**

```ts
// src/db/schema.ts — profiles (updated)
export const profiles = pgTable('profiles', {
  id:                serial('id').primaryKey(),
  authId:            text('auth_id').notNull().unique(),           // was clerk_id
  email:             text('email'),                                // NEW
  name:              text('name'),                                 // NEW
  displayName:       varchar('display_name', { length: 255 }),
  avatarUrl:         text('avatar_url'),
  dashboardCurrency: varchar('dashboard_currency', { length: 3 }).notNull().default('USD'),
  authProvider:      text('auth_provider').notNull().default('google'), // NEW
  createdAt:         timestamp('created_at').notNull().defaultNow(),
  updatedAt:         timestamp('updated_at').notNull().defaultNow(),   // NEW
}, (table) => [
  uniqueIndex('profiles_auth_id_idx').on(table.authId),
  uniqueIndex('profiles_email_idx').on(table.email).where(sql`email IS NOT NULL`),
])
```

**Migration strategy (non-breaking):**
- The column is **renamed** (not dropped and re-added), preserving all existing Clerk ID values. These serve as the initial `auth_id`.
- On first email/password sign-in post-migration, the existing `auth_id` becomes stale. We handle this by linking Better Auth's user to the existing profile via normalized email matching (see §2.4).
- `email` is nullable initially (existing rows won't have it), filled on first post-migration login.

### 2.2 Better Auth Tables

Better Auth's Drizzle adapter creates these tables automatically on first run. They live alongside the existing schema:

```sql
-- user — Better Auth's user table
CREATE TABLE user (
  id            text PRIMARY KEY,        -- UUID generated by Better Auth
  name          text NOT NULL,
  email         text NOT NULL UNIQUE,
  emailVerified boolean NOT NULL DEFAULT false,
  image         text,
  createdAt     timestamp NOT NULL,
  updatedAt     timestamp NOT NULL
);

-- session — Better Auth's session table
CREATE TABLE session (
  id         text PRIMARY KEY,
  expiresAt  timestamp NOT NULL,
  token      text NOT NULL UNIQUE,
  createdAt  timestamp NOT NULL,
  updatedAt  timestamp NOT NULL,
  ipAddress  text,
  userAgent  text,
  userId     text NOT NULL REFERENCES user(id) ON DELETE CASCADE
);

-- account — credential accounts linked to a user
CREATE TABLE account (
  id              text PRIMARY KEY,
  accountId       text NOT NULL,               -- Better Auth credential account ID
  providerId      text NOT NULL,               -- 'credential'
  userId          text NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  accessToken     text,
  refreshToken    text,
  idToken         text,
  accessTokenExpiresAt timestamp,
  refreshTokenExpiresAt timestamp,
  scope           text,
  password        text,                        -- securely hashed password
  createdAt       timestamp NOT NULL,
  updatedAt       timestamp NOT NULL
);

-- verification — email verification tokens
CREATE TABLE verification (
  id         text PRIMARY KEY,
  identifier text NOT NULL,
  value      text NOT NULL,
  expiresAt  timestamp NOT NULL,
  createdAt  timestamp,
  updatedAt  timestamp
);
```

**Relationship to existing `profiles` table:**
Better Auth's `user.id` is linked to `profiles.id` via a simple lookup: `profiles.auth_id = user.id`. When a user signs in, the flow resolves or creates a `profiles` row with `auth_id = user.id`.

### 2.3 Form Collaboration Tables

Two new tables for the sharing system:

```sql
-- form_collaborators — who has access to which form
CREATE TYPE collaborator_role AS ENUM ('editor', 'viewer');

CREATE TABLE form_collaborators (
  id          serial PRIMARY KEY,
  form_id     integer NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  profile_id  integer NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        collaborator_role NOT NULL DEFAULT 'editor',
  invited_by  integer NOT NULL REFERENCES profiles(id),  -- who invited them
  created_at  timestamp NOT NULL DEFAULT now(),
  updated_at  timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX form_collaborators_form_profile_idx
  ON form_collaborators (form_id, profile_id);
CREATE INDEX form_collaborators_profile_idx ON form_collaborators (profile_id);
```

```sql
-- collaboration_logs — immutable audit trail for all sharing actions
CREATE TYPE collaboration_action AS ENUM (
  'invited', 'role_changed', 'removed', 'accepted'
);

CREATE TABLE collaboration_logs (
  id          serial PRIMARY KEY,
  form_id     integer NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  actor_id    integer NOT NULL REFERENCES profiles(id),       -- who performed the action
  target_id   integer NOT NULL REFERENCES profiles(id),       -- who was affected
  action      collaboration_action NOT NULL,
  old_role    collaborator_role,                              -- previous role (for role_changed)
  new_role    collaborator_role,                              -- new role (for invited, role_changed)
  details     text,                                           -- human-readable summary
  created_at  timestamp NOT NULL DEFAULT now()
);

CREATE INDEX collaboration_logs_form_idx ON collaboration_logs (form_id);
CREATE INDEX collaboration_logs_actor_idx ON collaboration_logs (actor_id);
CREATE INDEX collaboration_logs_created_at_idx ON collaboration_logs (created_at);
```

**Drizzle definitions:**

```ts
// src/db/schema.ts — new tables
export const collaboratorRole = pgEnum('collaborator_role', ['editor', 'viewer'])
export const collaborationAction = pgEnum('collaboration_action', [
  'invited', 'role_changed', 'removed', 'accepted'
])

export const formCollaborators = pgTable('form_collaborators', {
  id:        serial('id').primaryKey(),
  formId:    integer('form_id').notNull().references(() => forms.id, { onDelete: 'cascade' }),
  profileId: integer('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  role:      collaboratorRole('role').notNull().default('editor'),
  invitedBy: integer('invited_by').notNull().references(() => profiles.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('form_collaborators_form_profile_idx').on(table.formId, table.profileId),
  index('form_collaborators_profile_idx').on(table.profileId),
])

export const collaborationLogs = pgTable('collaboration_logs', {
  id:        serial('id').primaryKey(),
  formId:    integer('form_id').notNull().references(() => forms.id, { onDelete: 'cascade' }),
  actorId:   integer('actor_id').notNull().references(() => profiles.id),
  targetId:  integer('target_id').notNull().references(() => profiles.id),
  action:    collaborationAction('action').notNull(),
  oldRole:   collaboratorRole('old_role'),
  newRole:   collaboratorRole('new_role'),
  details:   text('details'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('collaboration_logs_form_idx').on(table.formId),
  index('collaboration_logs_actor_idx').on(table.actorId),
  index('collaboration_logs_created_at_idx').on(table.createdAt),
])
```

### 2.4 Profile Linking Strategy (Existing Users)

When a user previously signed in through the legacy provider and now creates an email/password account:

1. Better Auth creates a new `user` row with an ID and normalized account email.
2. Before creating a new `profiles` row, we check if a profile with that email already exists (populated during migration or from a previous sync).
3. If found, we update `profiles.auth_id` to match Better Auth's `user.id` (linking the old profile to the new identity).
4. If not found, we create a new `profiles` row — this is a net-new user.

**Migration script (`drizzle/0033_auth_migration.sql`):**
```sql
-- Add email, name, auth_provider, updated_at to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auth_provider text NOT NULL DEFAULT 'google';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();

-- If clerk_id column hasn't been renamed yet, rename it
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'clerk_id'
  ) THEN
    ALTER TABLE profiles RENAME COLUMN clerk_id TO auth_id;
  END IF;
END $$;

-- Rename index if it still has the old name
ALTER INDEX IF EXISTS profiles_clerk_id_idx RENAME TO profiles_auth_id_idx;

-- Add email index
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_idx ON profiles (email) WHERE email IS NOT NULL;
```

### 2.5 Architecture — Request Flow

```
┌────────────────────────────────────────────────────────────┐
│                     Client Request                          │
└────────────────────────┬───────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│  src/start.ts                                              │
│  requestMiddleware: [betterAuthMiddleware(), csrfM...]      │
│                                                             │
│  betterAuthMiddleware():                                    │
│    1. Reads session token from cookie                       │
│    2. Looks up session row in DB                            │
│    3. Validates expiry                                      │
│    4. Attaches { user, session } to request context         │
└────────────────────────┬───────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │                             │
     Public routes               Authenticated routes
     (no auth needed)            (beforeLoad: requireAuth)
          │                             │
          │                      ┌──────┴──────────────┐
          │                      │                      │
          │                 Server Fns            Client Components
          │                 auth.getUserId()      useSession() hook
          │                 → auth_id             useUser() hook
          │                      │               UserAvatar dropdown
          │                      ▼
          │                 ┌──────────────────────┐
          │                 │  ensureProfile(authId)│
          │                 │  → profiles row      │
          │                 └──────────┬───────────┘
          │                            │
          │                 ┌──────────▼───────────┐
          │                 │  Access Control       │
          │                 │                       │
          │                 │  assertFormAccess(     │
          │                 │    formId, profileId   │
          │                 │  )                     │
          │                 │                        │
          │                 │  Checks:               │
          │                 │  1. forms.profileId    │
          │                 │     === profileId?     │
          │                 │  2. OR exists in       │
          │                 │     form_collaborators │
          │                 │     with role='editor' │
          │                 └───────────────────────┘
```

### 2.6 Access Control — `assertFormAccess` (Replaces `assertFormOwner`)

```ts
// src/lib/server-fns/flow-helpers.ts — NEW function

export type FormAccessRole = 'owner' | 'editor' | 'viewer'

/**
 * Determines the caller's access level to a form.
 * Returns the access role, or throws if the profile has no access.
 */
export async function assertFormAccess(
  formId: number,
  profileId: number,
): Promise<{ form: typeof forms.$inferSelect; role: FormAccessRole }> {
  // Check 1: Is the caller the form owner?
  const [owned] = await db
    .select({ form: forms })
    .from(forms)
    .where(and(eq(forms.id, formId), eq(forms.profileId, profileId)))
    .limit(1)

  if (owned) return { form: owned.form, role: 'owner' }

  // Check 2: Is the caller a collaborator?
  const [collab] = await db
    .select({ role: formCollaborators.role, form: forms })
    .from(formCollaborators)
    .innerJoin(forms, eq(formCollaborators.formId, forms.id))
    .where(and(
      eq(formCollaborators.formId, formId),
      eq(formCollaborators.profileId, profileId),
    ))
    .limit(1)

  if (collab) return { form: collab.form, role: collab.role as FormAccessRole }

  throw new Error('Not found')
}

/**
 * Asserts the caller can EDIT a form (owner or editor collaborator).
 */
export async function assertFormEditor(formId: number, profileId: number) {
  const { form, role } = await assertFormAccess(formId, profileId)
  if (role === 'viewer') throw new Error('You can view this form but not edit it')
  return form
}

/**
 * Asserts the caller can VIEW a form (owner, editor, or viewer collaborator).
 */
export async function assertFormViewer(formId: number, profileId: number) {
  const { form } = await assertFormAccess(formId, profileId)
  return form
}
```

### 2.7 Subquery-Based Access (Replaces `ownedProfileIds`)

For list/bulk operations (dashboard, form listing), we need a subquery that returns all profile IDs that have any access to a given form — either as owner or as collaborator:

```ts
// src/lib/server-fns/forms.ts — UPDATED helper

/**
 * Returns a subquery of profile IDs that own OR collaborate on any form
 * accessible to the given profile. Used with inArray(forms.id, accessibleFormIds(profileId)).
 */
function accessibleFormIds(profileId: number) {
  const owned = db
    .select({ id: forms.id })
    .from(forms)
    .where(eq(forms.profileId, profileId))

  const shared = db
    .select({ id: formCollaborators.formId })
    .from(formCollaborators)
    .where(eq(formCollaborators.profileId, profileId))

  return db
    .select({ id: owned.id })
    .from(owned.union(shared).as('accessible'))
}
```

---

## 3. UI Design — Components & Routes

### 3.1 Route Changes

| Route | Current | After Migration |
|---|---|---|
| `/sign-in/$` | Legacy provider-hosted sign-in | `src/routes/sign-in.tsx` — combined email/password sign-in and account creation |
| `/sign-up/$` | Legacy provider-hosted sign-up | **Removed** — account creation is a mode within `/sign-in` |
| `/api/auth/$` | **Does not exist** | Better Auth credential/session endpoints |
| `/sign-out` | Provider-owned sign-out | `src/routes/sign-out.tsx` — revokes the Better Auth session and redirects to `/` |

### 3.2 Sign-In Page (replaces `sign-in.$.tsx`)

The responsive page uses two modes in one form:

- **Sign in:** email, password, password visibility, and “keep me signed in.”
- **Create account:** name, email, password, confirmation, and inline password rules.
- **Shared states:** field validation, API errors, missing-configuration state,
  disabled/loading actions, safe post-auth return URL, and keyboard focus.
- **Desktop composition:** the form sits beside a PonkoForm-specific journey
  rail; mobile presents only the focused account form.

**Component:** `src/components/auth/SignInPage.tsx`
**Route:** `src/routes/sign-in.tsx` (new file-based route)

```tsx
// src/routes/sign-in.tsx
import { createFileRoute } from '@tanstack/react-router'
import { SignInPage } from '@/components/auth/SignInPage'

export const Route = createFileRoute('/sign-in')({
  component: SignInPage,
})
```

The page calls `authClient.signIn.email()` or `authClient.signUp.email()`.
Better Auth sets the session cookie through `/api/auth/$`; no external callback
page or identity-provider redirect is involved.

### 3.3 Credential Session Flow

Successful sign-in and account creation redirect to the validated internal
return URL. Invalid credentials use a non-enumerating error, duplicate accounts
are directed back to sign-in, and rate-limit errors ask the user to wait.

### 3.4 User Avatar Dropdown (replaces `<UserButton>`)

```
┌──────────────┐
│   [Avatar] ▾  │  ← click opens dropdown
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│  name@email.com   │  ← user info
│  ──────────────── │
│  Dashboard        │  ← link
│  Settings         │  ← link (when re-added)
│  ──────────────── │
│  Sign out         │  ← button
└──────────────────┘
```

**Component:** `src/components/auth/UserMenu.tsx`

Uses Better Auth's `useSession()` hook to get `{ user, session }`. Renders:
- User's generated initial avatar + name + email (from Better Auth `user` table)
- Navigation links (Dashboard, etc.)
- Sign out button that calls `authClient.signOut()` and navigates to `/`

### 3.5 Auth Shell Update — `AuthenticatedAppShell.tsx`

**Changes:**
- Remove `import { Show, UserButton } from '@clerk/tanstack-react-start'`
- Remove the old provider wrapper; Better Auth's React client does not require a root context provider
- Replace `<Show when="signed-in">` with `useSession()` hook → conditional render
- Replace `<Show when="signed-out">` with same hook
- Replace `<UserButton />` with `<UserMenu />`
- Update `navLinkClass` stays the same

### 3.6 `__root.tsx` — Provider-Free Client

Better Auth's React client owns its session store, so `__root.tsx` needs no
auth provider wrapper. Components import the centralized `useSession` export
from `src/lib/auth-client.ts`; server code remains isolated in `src/lib/auth.ts`.

### 3.7 Form Sharing UI — `ShareFormDialog`

```
┌──────────────────────────────────────────┐
│  Share "Customer Feedback Form"     [×]   │
│  ─────────────────────────────────────── │
│                                           │
│  Collaborators                            │
│  ┌─────────────────────────────────────┐ │
│  │ [Avatar] alice@example.com          │ │
│  │          Editor · Added 2 days ago  │ │
│  │                            [Remove] │ │
│  ├─────────────────────────────────────┤ │
│  │ [Avatar] bob@example.com            │ │
│  │          Viewer · Added 1 week ago  │ │
│  │                      [Change role ▾]│ │
│  └─────────────────────────────────────┘ │
│                                           │
│  Add collaborator                         │
│  ┌──────────────────────────┐ ┌────────┐ │
│  │ Email address...          │ │ Invite │ │
│  └──────────────────────────┘ └────────┘ │
│                              As: [editor ▾]│
│                                           │
│  ─────────────────────────────────────── │
│  Recent activity                          │
│  · Alice invited bob@example.com as       │
│    editor — 1 week ago                    │
│  · You changed bob@example.com to         │
│    viewer — 3 days ago                    │
└──────────────────────────────────────────┘
```

**Component:** `src/components/forms/ShareFormDialog.tsx`

**Props:**
```ts
interface ShareFormDialogProps {
  formId: number
  open: boolean
  onClose: () => void
}
```

**Server functions used:**
- `getCollaborators({ formId })` — via `useQuery`
- `getCollaborationLogs({ formId })` — via `useQuery`
- `inviteCollaborator({ formId, email, role })` — via `useMutation`
- `changeCollaboratorRole({ collaboratorId, role })` — via `useMutation`
- `removeCollaborator({ collaboratorId })` — via `useMutation`

**Placement:** Add a "Share" button to the form list card in the dashboard (`src/components/dashboard/FormCard.tsx`) and to the form editor workspace header (`src/routes/forms/$formId/edit.tsx`). The share dialog opens as a modal.

---

## 4. Server Functions — New & Modified

### 4.1 Better Auth Configuration

```ts
// src/lib/auth.ts — Better Auth server configuration
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@/db/index'
import * as schema from '@/db/schema'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 }, // 5 min server cache
  },
})
```

```ts
// src/lib/auth-client.ts — Better Auth client (browser-safe)
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: process.env.BETTER_AUTH_URL!, // e.g., https://ponkoform.com
})

export { SessionProvider, useSession, useUser } from 'better-auth/react'
```

### 4.2 Middleware Replacement

```ts
// src/start.ts — UPDATED
import { auth } from './lib/auth'               // Better Auth server instance
import { createStart, createCsrfMiddleware } from '@tanstack/react-start'

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
})

export const startInstance = createStart(() => {
  return {
    // Better Auth's handler processes /api/auth/* credential/session requests
    requestMiddleware: [
      (ctx) => auth.handler(ctx.request),
      csrfMiddleware,
    ],
  }
})
```

Wait — Better Auth's integration with TanStack Start requires a different approach. Better Auth needs its API routes mounted (`/api/auth/*`), so we register a catch-all route:

```ts
// src/routes/api/auth/$.ts — Better Auth API handler
import { auth } from '@/lib/auth'
import { createAPIFileRoute } from '@tanstack/react-start/api'

export const APIRoute = createAPIFileRoute('/api/auth/$')({
  GET: ({ request }) => auth.handler(request),
  POST: ({ request }) => auth.handler(request),
})
```

And the middleware is set up via Better Auth's `auth.api.getSession()` which is called inside `requireAuth`:

```ts
// src/lib/auth.ts — helper for getting session in server functions
import { auth as betterAuthServer } from './auth'
import { createServerFn } from '@tanstack/react-start'

export async function getSession(request: Request) {
  return betterAuthServer.api.getSession({ headers: request.headers })
}
```

For TanStack Start server functions, we pass headers from the request context:

```ts
// src/lib/server-fns/auth.ts — UPDATED requireAuth
export const requireAuth = createServerFn({ method: 'GET' })
  .validator((data?: { returnTo?: string }) => ({
    returnTo: safeAuthReturnTo(data?.returnTo),
  }))
  .handler(async ({ data, request }) => {
    const session = await betterAuth.api.getSession({
      headers: request.headers,
    })

    if (!session) {
      throw redirect({
        to: '/sign-in',
        search: { redirect_url: data.returnTo },
      })
    }

    return {
      userId: session.user.id,
      sessionId: session.session.id,
    }
  })
```

> **Note:** The exact API for accessing the request in TanStack Start server functions depends on the TanStack Start version in use. If `request` is not directly available in `.handler()`, we use `getRequestHeaders()` from `@tanstack/react-start/server` or access the event context.

### 4.3 Updated `auth.ts` — Auth Guards

```ts
// src/lib/server-fns/auth.ts — COMPLETE REWRITE
import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'
import { auth } from '@/lib/auth'

const DEFAULT_AUTH_RETURN_TO = '/forms'

export function safeAuthReturnTo(value: unknown): string {
  // Identical to current implementation — validates return URLs
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return DEFAULT_AUTH_RETURN_TO
  }
  try {
    const url = new URL(value, 'https://ponkoform.local')
    if (url.origin !== 'https://ponkoform.local') return DEFAULT_AUTH_RETURN_TO
    if (url.pathname.startsWith('/sign-in') || url.pathname.startsWith('/sign-up')) {
      return DEFAULT_AUTH_RETURN_TO
    }
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return DEFAULT_AUTH_RETURN_TO
  }
}

export const requireAuth = createServerFn({ method: 'GET' })
  .validator((data?: { returnTo?: string }) => ({
    returnTo: safeAuthReturnTo(data?.returnTo),
  }))
  .handler(async ({ data, request }) => {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      throw redirect({
        to: '/sign-in',
        search: { redirect_url: data.returnTo },
      })
    }
    return { userId: session.user.id, sessionId: session.session.id }
  })

export const redirectAuthenticatedUser = createServerFn({ method: 'GET' })
  .validator((data?: { returnTo?: string }) => ({
    returnTo: safeAuthReturnTo(data?.returnTo),
  }))
  .handler(async ({ data, request }) => {
    const session = await auth.api.getSession({ headers: request.headers })
    if (session) throw redirect({ href: data.returnTo })
    return { isAuthenticated: false as const }
  })
```

### 4.4 Updated Server Functions — `auth()` → `requireProfile()`

Every server function that currently calls `const { userId } = await auth()` must change. The pattern shifts from Clerk's `auth()` to a centralized `requireProfile()`:

```ts
// src/lib/server-fns/auth.ts — NEW helper
export async function resolveAuthId(request: Request): Promise<string> {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) throw new Error('Unauthorized')
  return session.user.id
}
```

All 15+ server functions update from:

```ts
// BEFORE (Clerk)
const { userId } = await auth()
if (!userId) throw new Error('Unauthorized')
```

To:

```ts
// AFTER (Better Auth)
import { resolveAuthId } from './auth'
const authId = await resolveAuthId(request)
```

And `ensureProfile(authId)` maps Better Auth's user ID to a `profiles` row, same as before but with `authId` instead of `clerkId`.

### 4.5 Form Sharing Server Functions

New file: `src/lib/server-fns/collaborators.ts`

```ts
// getCollaborators — list collaborators for a form
export const getCollaborators = createServerFn({ method: 'GET' })
  .validator((data: { formId: number }) => data)
  .handler(async ({ data, request }) => {
    const profile = await requireProfile(request)
    await assertFormEditor(data.formId, profile.id)

    const collaborators = await db
      .select({
        id: formCollaborators.id,
        role: formCollaborators.role,
        profileId: profiles.id,
        name: profiles.name,
        email: profiles.email,
        avatarUrl: profiles.avatarUrl,
        createdAt: formCollaborators.createdAt,
      })
      .from(formCollaborators)
      .innerJoin(profiles, eq(formCollaborators.profileId, profiles.id))
      .where(eq(formCollaborators.formId, data.formId))
      .orderBy(desc(formCollaborators.createdAt))

    return collaborators
  })

// inviteCollaborator — add a collaborator by email
export const inviteCollaborator = createServerFn({ method: 'POST' })
  .validator((data: { formId: number; email: string; role: 'editor' | 'viewer' }) => data)
  .handler(async ({ data, request }) => {
    const profile = await requireProfile(request)
    await assertFormEditor(data.formId, profile.id)

    // Find target profile by email
    const [target] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.email, data.email.toLowerCase().trim()))
      .limit(1)

    if (!target) {
      throw new Error(`No user found with email ${data.email}. They need to sign in first.`)
    }

    if (target.id === profile.id) {
      throw new Error('You already own this form.')
    }

    // Upsert collaborator
    const [collab] = await db
      .insert(formCollaborators)
      .values({
        formId: data.formId,
        profileId: target.id,
        role: data.role,
        invitedBy: profile.id,
      })
      .onConflictDoUpdate({
        target: [formCollaborators.formId, formCollaborators.profileId],
        set: { role: data.role, updatedAt: new Date() },
      })
      .returning()

    // Audit log
    await db.insert(collaborationLogs).values({
      formId: data.formId,
      actorId: profile.id,
      targetId: target.id,
      action: 'invited',
      newRole: data.role,
      details: `${profile.email || 'Owner'} invited ${data.email} as ${data.role}`,
      createdAt: new Date(),
    })

    return collab
  })

// removeCollaborator — revoke access
export const removeCollaborator = createServerFn({ method: 'POST' })
  .validator((data: { collaboratorId: number }) => data)
  .handler(async ({ data, request }) => {
    const profile = await requireProfile(request)

    const [collab] = await db
      .select()
      .from(formCollaborators)
      .where(eq(formCollaborators.id, data.collaboratorId))
      .limit(1)

    if (!collab) throw new Error('Collaborator not found')

    await assertFormEditor(collab.formId, profile.id)

    await db.delete(formCollaborators).where(eq(formCollaborators.id, data.collaboratorId))

    await db.insert(collaborationLogs).values({
      formId: collab.formId,
      actorId: profile.id,
      targetId: collab.profileId,
      action: 'removed',
      oldRole: collab.role,
      details: `${profile.email || 'Owner'} removed a collaborator`,
      createdAt: new Date(),
    })

    return { success: true }
  })

// changeCollaboratorRole — promote/demote a collaborator
export const changeCollaboratorRole = createServerFn({ method: 'POST' })
  .validator((data: { collaboratorId: number; role: 'editor' | 'viewer' }) => data)
  .handler(async ({ data, request }) => {
    const profile = await requireProfile(request)

    const [collab] = await db
      .select()
      .from(formCollaborators)
      .where(eq(formCollaborators.id, data.collaboratorId))
      .limit(1)

    if (!collab) throw new Error('Collaborator not found')
    await assertFormEditor(collab.formId, profile.id)

    const [updated] = await db
      .update(formCollaborators)
      .set({ role: data.role, updatedAt: new Date() })
      .where(eq(formCollaborators.id, data.collaboratorId))
      .returning()

    await db.insert(collaborationLogs).values({
      formId: collab.formId,
      actorId: profile.id,
      targetId: collab.profileId,
      action: 'role_changed',
      oldRole: collab.role,
      newRole: data.role,
      details: `${profile.email || 'Owner'} changed role from ${collab.role} to ${data.role}`,
      createdAt: new Date(),
    })

    return updated
  })

// getCollaborationLogs — audit trail
export const getCollaborationLogs = createServerFn({ method: 'GET' })
  .validator((data: { formId: number }) => data)
  .handler(async ({ data, request }) => {
    const profile = await requireProfile(request)
    await assertFormEditor(data.formId, profile.id)

    const logs = await db
      .select({
        id: collaborationLogs.id,
        action: collaborationLogs.action,
        oldRole: collaborationLogs.oldRole,
        newRole: collaborationLogs.newRole,
        details: collaborationLogs.details,
        createdAt: collaborationLogs.createdAt,
        actorName: profiles.name,
        actorEmail: profiles.email,
      })
      .from(collaborationLogs)
      .innerJoin(profiles, eq(collaborationLogs.actorId, profiles.id))
      .where(eq(collaborationLogs.formId, data.formId))
      .orderBy(desc(collaborationLogs.createdAt))
      .limit(50)

    return logs
  })
```

### 4.6 Updated Form Listing — `getForms`

The `getForms` server function must now include shared forms in the user's dashboard:

```ts
// src/lib/server-fns/forms.ts — UPDATED getForms handler
export const getForms = createServerFn({ method: 'GET' }).handler(async ({ request }) => {
  const profile = await requireProfile(request)

  // Forms the user OWNS
  const ownedForms = await db
    .select({ ...forms, accessRole: sql`'owner'`.as('access_role') })
    .from(forms)
    .where(eq(forms.profileId, profile.id))

  // Forms SHARED with the user
  const sharedForms = await db
    .select({
      ...forms,
      accessRole: formCollaborators.role.as('access_role'),
    })
    .from(formCollaborators)
    .innerJoin(forms, eq(formCollaborators.formId, forms.id))
    .where(eq(formCollaborators.profileId, profile.id))

  const allRows = [...ownedForms, ...sharedForms]
    .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0))

  // ... remainder of function (fetch payment configs, submission counts, etc.)
})
```

The returned type includes `accessRole: 'owner' | 'editor' | 'viewer'` so the dashboard can show a badge (`"Owner"`, `"Editor"`, `"Viewer"`) on each form card.

---

## 5. File Change Summary

| File | Action | Purpose |
|---|---|---|
| `drizzle/0036_better_auth_and_collaboration.sql` | **NEW** | Migration: rename `clerk_id` → `auth_id`, add profile identity fields, collaboration tables, and Better Auth tables |
| `src/db/schema.ts` | **MODIFY** | Update `profiles`, `formCollaborators`, and `collaborationLogs` |
| `src/db/auth-schema.ts` | **NEW** | Better Auth's CLI-compatible `user`, `session`, `account`, and `verification` schema |
| `src/lib/auth.ts` | **NEW** | Better Auth server configuration (email/password, Drizzle adapter, session config) |
| `src/lib/auth-client.ts` | **NEW** | Better Auth client (React hooks, `authClient`) |
| `src/lib/server-fns/auth.ts` | **REWRITE** | Replace Clerk `auth()` with Better Auth `getSession()`; `requireAuth`, `redirectAuthenticatedUser`, new `requireProfile` and `resolveAuthId` |
| `src/lib/server-fns/flow-helpers.ts` | **MODIFY** | Replace `assertFormOwner` / `assertFlowOwner` with `assertFormAccess`, `assertFormEditor`, `assertFormViewer`; add `accessibleFormIds` |
| `src/lib/server-fns/forms.ts` | **MODIFY** | Replace all `auth()` calls with `requireProfile(request)`; replace `ownedProfileIds` with `accessibleFormIds`; update `getForms` to include shared |
| `src/lib/server-fns/collaborators.ts` | **NEW** | `getCollaborators`, `inviteCollaborator`, `removeCollaborator`, `changeCollaboratorRole`, `getCollaborationLogs` |
| `src/start.ts` | **MODIFY** | Remove `clerkMiddleware()`, add Better Auth API route handler |
| `src/routes/api/auth/$.ts` | **NEW** | Better Auth API catch-all for credential and session management |
| `src/routes/sign-in.$.tsx` | **DELETE** | Remove Clerk sign-in page |
| `src/routes/sign-up.$.tsx` | **DELETE** | Remove Clerk sign-up page |
| `src/routes/sign-in.tsx` | **NEW** | Combined email/password sign-in and account-creation page |
| `src/routes/sign-out.tsx` | **NEW** | Sign-out route |
| `src/components/auth/SignInPage.tsx` | **NEW** | Responsive credential form with sign-in/sign-up modes |
| `src/components/auth/UserMenu.tsx` | **NEW** | User avatar dropdown (replaces `<UserButton>`) |
| `src/components/forms/ShareFormDialog.tsx` | **NEW** | Share dialog with collaborator list, invite form, activity log |
| `src/integrations/clerk/provider.tsx` | **DELETE** | No longer needed |
| `src/integrations/clerk/header-user.tsx` | **DELETE** | No longer needed |
| `src/components/layout/AuthenticatedAppShell.tsx` | **MODIFY** | Replace `<Show>`, `<UserButton>` with session hooks + `<UserMenu>` |
| `src/components/homepage/HomePage.tsx` | **MODIFY** | Replace `<Show>` with session hooks |
| `src/routes/__root.tsx` | **MODIFY** | Remove the provider-specific wrapper |
| `src/lib/server-fns/dashboard.ts` | **MODIFY** | Replace `auth()` calls |
| `src/lib/server-fns/email-surveys.ts` | **MODIFY** | Replace `auth()` calls |
| `src/lib/server-fns/fields.ts` | **MODIFY** | Replace `auth()` calls |
| `src/lib/server-fns/flow-nodes.ts` | **MODIFY** | Replace `auth()` calls |
| `src/lib/server-fns/flow-variables.ts` | **MODIFY** | Replace `auth()` calls |
| `src/lib/server-fns/flows.ts` | **MODIFY** | Replace `auth()` calls |
| `src/lib/server-fns/invoicing.ts` | **MODIFY** | Replace `auth()` calls |
| `src/lib/server-fns/page-forms.ts` | **MODIFY** | Replace `auth()` calls |
| `src/lib/server-fns/payments-view.ts` | **MODIFY** | Replace `auth()` calls |
| `src/lib/server-fns/references.ts` | **MODIFY** | Replace `auth()` calls |
| `src/lib/server-fns/submissions.ts` | **MODIFY** | Replace `auth()` calls |
| `src/lib/submissions/csv-response.server.ts` | **MODIFY** | Replace `auth()` calls |
| `src/lib/integrations/credentials.ts` | **MODIFY** | Replace `requireProfile` signature (takes `request` instead of calling `auth()` directly) |
| `src/routes/mcp.ts` | **MODIFY** | Replace `auth()` calls |
| `src/routes/dashboard/index.tsx` | **MODIFY** | `requireAuth` call stays same (same export name, different internals) |
| *(14 route files with `beforeLoad: requireAuth`)* | **NO CHANGE** | `requireAuth` keeps same signature — routes don't need updating |
| `src/components/layout/AuthenticatedAppShell.test.tsx` | **MODIFY** | Replace Clerk mocks with Better Auth session mock |
| `src/components/homepage/HomePage.test.tsx` | **MODIFY** | Replace Clerk mocks with Better Auth session mock |
| `src/lib/public-route.test.ts` | **MODIFY** | Update assertions from `@clerk/` → `@/lib/auth-client` |
| `.env.example` / `.env.local` | **MODIFY** | Remove Clerk keys; add `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` |
| `render.yaml` | **MODIFY** | Remove Clerk env vars, add Better Auth env vars |
| `package.json` | **MODIFY** | Remove `@clerk/tanstack-react-start`, `@clerk/shared`; add `better-auth` |

---

## 6. Step-by-Step Tasks

### Task 1: Database Migration
- [ ] Create `drizzle/0033_auth_migration.sql` with all schema changes (§2.1–2.3)
- [ ] Update `src/db/schema.ts` with new/updated table definitions
- [ ] Run `pnpm run db:generate` and verify migration SQL
- [ ] Run `pnpm run db:migrate` against staging database
- [ ] Verify existing data is preserved (check `profiles` rows, `forms` ownership)

### Task 2: Install & Configure Better Auth
- [ ] `pnpm add better-auth`
- [ ] Create `src/lib/auth.ts` — Better Auth server instance (§4.1)
- [ ] Create `src/lib/auth-client.ts` — Client hooks and `authClient` (§4.1)
- [ ] Create `src/routes/api/auth/$.ts` — API route handler (§4.2)
- [x] Enable Better Auth email/password accounts with an 8–128 character password policy
- [x] Add env vars: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`

### Task 3: Replace Auth Guards
- [ ] Rewrite `src/lib/server-fns/auth.ts` — replace Clerk `auth()` with `auth.api.getSession()` (§4.3)
- [ ] Add `requireProfile(request)` and `resolveAuthId(request)` helpers
- [ ] Update `src/lib/server-fns/flow-helpers.ts` — replace `assertFormOwner`/`assertFlowOwner` with `assertFormAccess`/`assertFormEditor`/`assertFormViewer` (§4.4)
- [ ] Add `accessibleFormIds(profileId)` helper for list operations (§4.4)

### Task 4: Update All Server Functions
- [ ] Update `src/lib/server-fns/forms.ts` — replace all `auth()` calls, update `ensureProfile`, update `getForms` to include shared forms
- [ ] Update `src/lib/server-fns/flows.ts`
- [ ] Update `src/lib/server-fns/flow-nodes.ts`
- [ ] Update `src/lib/server-fns/flow-variables.ts`
- [ ] Update `src/lib/server-fns/fields.ts`
- [ ] Update `src/lib/server-fns/dashboard.ts`
- [ ] Update `src/lib/server-fns/submissions.ts`
- [ ] Update `src/lib/server-fns/page-forms.ts`
- [ ] Update `src/lib/server-fns/payments-view.ts`
- [ ] Update `src/lib/server-fns/references.ts`
- [ ] Update `src/lib/server-fns/invoicing.ts`
- [ ] Update `src/lib/server-fns/email-surveys.ts`
- [ ] Update `src/lib/submissions/csv-response.server.ts`
- [ ] Update `src/lib/integrations/credentials.ts`
- [ ] Update `src/routes/mcp.ts`

### Task 5: Build Form Sharing System
- [ ] Create `src/lib/server-fns/collaborators.ts` with all 5 server functions (§4.5)
- [ ] Add `form_collaborators` and `collaboration_logs` to `src/db/schema.ts`
- [ ] Create `src/components/forms/ShareFormDialog.tsx` — share modal UI (§3.7)
- [ ] Add "Share" button to `src/components/dashboard/FormCard.tsx` (dashboard form list)
- [ ] Add "Share" button to `src/routes/forms/$formId/edit.tsx` (editor toolbar)
- [ ] Add `accessRole` badge to form cards in dashboard (Owner/Editor/Viewer)

### Task 6: Replace UI Components
- [ ] Remove `src/integrations/clerk/` directory entirely
- [x] Create `src/components/auth/SignInPage.tsx` with sign-in and account-creation forms (§3.2)
- [ ] Create `src/routes/sign-in.tsx` (new file route, replaces `sign-in.$.tsx`)
- [x] Mount Better Auth credential and session endpoints through `src/routes/api/auth/$.ts`
- [ ] Delete `src/routes/sign-in.$.tsx` and `src/routes/sign-up.$.tsx`
- [ ] Create `src/components/auth/UserMenu.tsx` — avatar dropdown (§3.4)
- [x] Keep client auth provider-free through the centralized Better Auth client
- [x] Update `src/routes/__root.tsx` — remove provider-specific wrappers
- [ ] Update `src/components/layout/AuthenticatedAppShell.tsx` — replace Clerk components with `useSession()` + `<UserMenu>`
- [ ] Update `src/components/homepage/HomePage.tsx` — replace `<Show>` with session hooks

### Task 7: Update Tests
- [ ] Update `src/components/layout/AuthenticatedAppShell.test.tsx` — mock Better Auth hooks instead of Clerk
- [ ] Update `src/components/homepage/HomePage.test.tsx` — mock Better Auth hooks instead of Clerk
- [ ] Update `src/lib/public-route.test.ts` — change assertion from `@clerk/` to `@/lib/auth-client`
- [ ] Run `pnpm run test` — fix any failing tests

### Task 8: Clean Up & Environment
- [ ] Remove `@clerk/tanstack-react-start` and `@clerk/shared` from `package.json`
- [ ] Run `pnpm install` to remove Clerk packages
- [ ] Remove `import { clerkMiddleware }` from `src/start.ts`
- [ ] Update `render.yaml` — remove Clerk env vars, add Better Auth vars
- [ ] Update `.env.example` if it exists
- [ ] Run `pnpm run build` — verify no Clerk imports remain
- [ ] Deploy to staging; test email/password auth, form sharing, and all protected routes

---

## 7. Risks & Open Questions

| Risk | Mitigation |
|---|---|
| **Existing users lose access after migration** | Profile linking strategy (§2.4) matches the normalized account email to the existing profile email. Users must create an account with that same email to retain ownership. Add a manual account-linking flow later if needed. |
| **Better Auth session cookie conflicts with existing Clerk cookie** | Clerk's `__session` cookie is removed when Clerk packages are uninstalled. Better Auth uses its own cookie name (`better-auth.session_token`). No overlap. |
| **TanStack Start request context access** | Better Auth needs `request.headers` for session resolution. If TanStack Start server functions don't expose `request` directly, fall back to `getRequestHeaders()` from `@tanstack/react-start/server` or use `getWebRequest()` from `@tanstack/react-start`. Test during Task 3. |
| **Better Auth's Drizzle adapter may not support `pg` provider perfectly** | Better Auth's adapter uses Drizzle's generic interface — any Drizzle-compatible driver works. Test with Neon HTTP driver and `pg` TCP driver. |
| **Server function signature changes break 14+ route files** | `requireAuth` keeps the same name and return shape (`{ userId, sessionId }`) — routes using `beforeLoad: requireAuth` don't change. The `auth()` → `requireProfile(request)` change is internal to server functions. |
| **Credential stuffing and brute-force attempts** | Better Auth rate limiting and non-enumerating sign-in errors reduce exposure. Production should add verified email delivery and stronger edge-level abuse controls as usage grows. |
| **Cold start impact from DB session lookup** | Better Auth's session lookup is a single indexed query (`WHERE token = ?`). Negligible compared to existing DB queries in server functions. Use `cookieCache` option (§4.1) to reduce DB lookups. |
| **Better Auth is newer than Clerk — less battle-tested** | Better Auth has an active community and well-maintained codebase. The Drizzle adapter and email/password flow are core features; authentication behavior is covered by focused and runtime tests. |

---

## 8. Validation / Testing

- [ ] `pnpm run build` completes with zero Clerk references in the bundle
- [ ] `pnpm run test` passes all existing tests
- [ ] Email/password account creation signs the user in and lands on the validated return URL
- [ ] Email/password sign-in rejects invalid credentials without revealing whether an account exists
- [ ] Sign out: click user menu "Sign out" → session destroyed → redirected to `/` → navbar shows "Sign in" instead of avatar
- [ ] Protected route: navigate to `/forms` while signed out → redirected to `/sign-in`
- [ ] Form listing: signed-in user sees forms they own AND forms shared with them, with correct `accessRole` badges
- [ ] Form editing: owner can edit; editor collaborator can edit; viewer collaborator cannot edit (receives error)
- [ ] Form sharing: owner opens share dialog, invites by email → collaborator sees form in their dashboard
- [ ] Role change: owner changes editor → viewer → collaborator's permissions update immediately
- [ ] Revoke access: owner removes collaborator → collaborator's form disappears from dashboard
- [ ] Audit log: all share/role-change/removal actions appear in `collaboration_logs`
- [ ] Public routes: `/forms/submit/:publicId`, `/forms/embed/:publicId`, `/flow/:executionId/complete`, `/pay/*` all work without authentication
- [ ] Integration settings: `/settings/integrations` loads, credentials save/load correctly under new auth
- [ ] Payment flow: creating a payment, returning from PayPal/Xendit continues to work
- [ ] Migration idempotency: running `db:prepare` twice does not error on column/index renames
