# AGENTS.md

Vite + React 18 SPA (Simplified-Chinese UI), deployed to Netlify, backed by Supabase. No test, lint, or typecheck tooling is configured.

## Commands

- `npm run dev` — Vite dev server. Requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` (gitignored, present locally); `src/services/supabase.js` throws at import if they are missing.
- `npm run build` — production build (what Netlify runs). Use this to verify changes.
- `npm run netlify:dev` — local Netlify emulation.

## Architecture

- Client-only SPA: the browser talks directly to Supabase via the anon-key JS client in `src/services/`. **There are no Netlify Functions** — `netlify.toml` references `netlify/functions`, but that directory does not exist. `docs/tech.md` describes an aspirational "all data via Netlify Functions" design the code does not implement; trust the code.
- The database schema lives only in the Supabase project — there are no SQL files or migrations in the repo. Tables in use: `websites`, `profiles`, `comments`, `website_likes`, plus view `websites_with_likes` (home list, ordered by `like_count`). Field/schema changes must be made in the Supabase dashboard.
- URL uniqueness is enforced at the app layer (`checkUrlExists` in `src/services/websites.js`), not only by DB constraints.
- Website preview images (`websites.image_url`, added via the Supabase dashboard): users can upload to the `screenshots` storage bucket (`uploadWebsiteImage` in `src/services/screenshot.js`), otherwise a full-page screenshot is auto-fetched client-side from Microlink's free API (`fetchWebsiteScreenshot`) at submit time and stored in `image_url`. Requires RLS policies on `storage.objects` and the `websites_with_likes` view to include `image_url`.
- Routes (`src/App.jsx`): `/`, `/website/:id`, `/website/:id/edit`, `/create`. `netlify.toml` has no SPA redirect rule, so hard-refreshing a deep link on the deployed site 404s.

## Conventions

- All UI text, code comments, and user-facing error messages are Simplified Chinese — keep new strings in Chinese.
- Named exports throughout (`export const` in services/hooks, `export function` for components). Pages in `src/pages/*.jsx`; data access in `src/services/*.js`; auth session state in `src/hooks/useAuth.js`.
- Styling is plain global CSS in `src/styles/`: `tokens.css` (design tokens), `global.css`, `animations.css` (classes prefixed `ym-`). Not CSS Modules/Styled Components despite the README claim.
- Auth is email-based under the hood: usernames are normalized to `username@nav.local` for Supabase auth (`src/services/auth.js`). A public `RegisterPage` exists even though `docs/project.md` says accounts are admin-created.
- Git/GitHub flow on `main`; branches named `feat/xxx` or `fix/xxx`; PRs use `Closes #issue`.
