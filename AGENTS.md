# AGENTS.md

Vite + React 18 SPA (Simplified-Chinese UI), deployed to Netlify, backed by Supabase. No test, lint, or typecheck tooling is configured.

## Commands

- `npm run dev` — Vite dev server. Requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` (gitignored, present locally); `src/services/supabase.js` throws at import if they are missing.
- `npm run build` — production build (what Netlify runs). Use this to verify changes.
- `npm run netlify:dev` — local Netlify emulation.

## Architecture

- Mostly-client SPA: the browser talks directly to Supabase via the anon-key JS client in `src/services/`. **A few Netlify Functions do exist** in `netlify/functions/` (`contributors.mjs`, `screenshot.mjs`, `password-reset.mjs`) — they are Functions API v2 (`export default async (req) => Response`). They exist specifically for work that needs secrets the browser must never hold (`SUPABASE_SERVICE_ROLE_KEY`, mail-provider keys). Everything else still goes straight to Supabase. `docs/tech.md` describes an aspirational "all data via Netlify Functions" design the code does not implement; trust the code.
- Database migrations live in two places, both run in order: `sql/` (numbered, e.g. `000_diagnose.sql` diagnostic, `001_works_generalization.sql` works generalization + creator profiles + favorites/groups + storage buckets, `005_featured_admin_only.sql` featured admin trigger) and `supabase/migrations/` (dated, e.g. `20260808_backend_security_fix.sql`). **New migrations go in `supabase/migrations/`**; key ones are mirrored into `sql/` so either directory can bootstrap a fresh environment. Run them in Supabase Dashboard → SQL Editor in order. **`is_admin()` and `profiles.is_admin` are defined in `sql/006_is_admin_function.sql`** — never assume they exist from the console alone. Current schema (post-002): `works` (websites renamed, with `work_type`/`featured`/`cover_url`/`status`/`visibility`/`group_id`/`changelog`), `profiles` (creator-profile fields), `favorites`, `groups`, `partitions`, `comments`, `website_likes`; views `works_with_likes` (home list, RLS-aware, ordered by `like_count`) and `websites` (read-only compatibility view over `works`).
- URL uniqueness is enforced at the app layer (`checkUrlExists` in `src/services/websites.js`), not only by DB constraints.
- Website preview images (`websites.image_url`, added via the Supabase dashboard): users can upload to the `screenshots` storage bucket (`uploadWebsiteImage` in `src/services/screenshot.js`), otherwise a full-page screenshot is auto-fetched client-side from Microlink's free API (`fetchWebsiteScreenshot`) at submit time and stored in `image_url`. Requires RLS policies on `storage.objects` and the `websites_with_likes` view to include `image_url`.
- Routes (`src/App.jsx`): `/`, `/website/:id`, `/website/:id/edit`, `/create`, `/profile` (private), `/user/:id` (creator profile), `/forgot-password`, plus ideas/discover pages. `netlify.toml` now has the SPA redirect (`/*` → `/index.html`, 200), so deep links survive a hard refresh; `/.netlify/functions/*` is matched by Netlify first and is unaffected.

## Conventions

- All UI text, code comments, and user-facing error messages are Simplified Chinese — keep new strings in Chinese.
- Named exports throughout (`export const` in services/hooks, `export function` for components). Pages in `src/pages/*.jsx`; data access in `src/services/*.js`; auth session state in `src/hooks/useAuth.js`.
- Styling is plain global CSS in `src/styles/`: `tokens.css` (design tokens), `global.css`, `animations.css` (classes prefixed `ym-`). Not CSS Modules/Styled Components despite the README claim.
- Auth is email-based under the hood: usernames are normalized to `username@nav.local` for Supabase auth (`src/services/auth.js`). A public `RegisterPage` exists even though `docs/project.md` says accounts are admin-created.
- Password recovery works off a *real* contact stored in `profiles.email` / `profiles.phone` (not the `@nav.local` pseudo-email), bound via the `bind_contact()` SECURITY DEFINER RPC. Email codes go out through `netlify/functions/password-reset.mjs`; the SMS branch is intentionally stubbed to a 503 "部署中". Setup and Aliyun DirectMail env vars: `docs/password-reset.md`.
- Git/GitHub flow on `main`; branches named `feat/xxx` or `fix/xxx`; PRs use `Closes #issue`.
