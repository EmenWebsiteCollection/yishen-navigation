# AGENTS.md

Vite + React 18 SPA (Simplified-Chinese UI), deployed to **GitHub Pages** (static, project path `/yishen-navigation/`), with server-side functions on a **Cloudflare Worker**, backed by Supabase. Node's built-in test runner covers pure logic in `src/services/*.test.js`; there is no lint or typecheck tooling.

## Commands

- `npm run dev` — Vite dev server. Requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` (gitignored, present locally); `src/services/supabase.js` throws at import if they are missing.
- `npm run build` — production build (root base path). `npm run build:pages` — GitHub Pages build (`VITE_BASE=/yishen-navigation/` + `404.html` fallback + `.nojekyll`). Both are what CI/Pages run; use `build:pages` to verify Pages-specific changes.
- `npm test` — Node test runner over `src/services/*.test.js`.
- `npm run worker:smoke` — runs the Cloudflare Worker entry (`workers/index.mjs`) in-process and checks routes, CORS, `data-proxy`, and the MCP endpoint against real Supabase (reads `.env.local`).
- `npm run worker:dev` / `npm run worker:deploy` — `wrangler dev` / `wrangler deploy` (wrangler is not a devDependency; `npx` fetches it).
- `node scripts/mcp-smoke.mjs --local` (or `npm run mcp:smoke -- --local`) — offline smoke test of the MCP server. Pass a Worker URL instead of `--local` to test the live endpoint. See `docs/mcp.md`.

## Architecture

- Mostly-client SPA: the browser talks directly to Supabase via the anon-key JS client in `src/services/`. Server-side work lives in a **single Cloudflare Worker** (`workers/index.mjs`) that routes to `workers/functions/*.mjs` — `data-proxy`, `screenshot`, `password-reset`, `export-idea`, `yili-chat`, `el-memory`, and `mcp`. Those files are `export default async (req) => Response` (web-standard), the same shape as before the Netlify→Workers move. The frontend resolves function URLs through `src/services/functionsBase.js` (`VITE_FUNCTIONS_BASE`, falling back to the legacy `/.netlify/functions/*`). `docs/tech.md` describes an aspirational "all data via functions" design the code does not implement; trust the code.
- GitHub Pages has no server runtime: SPA deep links rely on `dist/404.html` (a copy of `index.html`), and **response headers from the old `netlify.toml` (CSP, X-Frame-Options…) are gone** — Pages cannot set headers. Deployment steps, Worker secrets and CORS are documented in `docs/deploy-github-pages.md`.
- Database migrations live in two places, both run in order: `sql/` (numbered, e.g. `000_diagnose.sql` diagnostic, `001_works_generalization.sql` works generalization + creator profiles + favorites/groups + storage buckets, `005_featured_admin_only.sql` featured admin trigger) and `supabase/migrations/` (dated, e.g. `20260808_backend_security_fix.sql`). **New migrations go in `supabase/migrations/`**; key ones are mirrored into `sql/` so either directory can bootstrap a fresh environment. Run them in Supabase Dashboard → SQL Editor in order. **`is_admin()` and `profiles.is_admin` are defined in `sql/006_is_admin_function.sql`** — never assume they exist from the console alone. Current schema (post-002): `works` (websites renamed, with `work_type`/`featured`/`cover_url`/`status`/`visibility`/`group_id`/`changelog`), `profiles` (creator-profile fields), `favorites`, `groups`, `partitions`, `comments`, `website_likes`; views `works_with_likes` (home list, RLS-aware, ordered by `like_count`) and `websites` (read-only compatibility view over `works`).
- URL uniqueness is enforced at the app layer (`checkUrlExists` in `src/services/websites.js`), not only by DB constraints.
- Website preview images (`websites.image_url`, added via the Supabase dashboard): users can upload to the `screenshots` storage bucket (`uploadWebsiteImage` in `src/services/screenshot.js`), otherwise a full-page screenshot is auto-fetched client-side from Microlink's free API (`fetchWebsiteScreenshot`) at submit time and stored in `image_url`. Requires RLS policies on `storage.objects` and the `websites_with_likes` view to include `image_url`.
- Routes (`src/App.jsx`): `/`, `/website/:id`, `/website/:id/edit`, `/create`, `/profile` (private), `/user/:id` (creator profile), `/forgot-password`, plus ideas/discover pages. Router basename comes from `import.meta.env.BASE_URL` (`src/main.jsx`), so the Pages project path works; deep links survive a hard refresh via `404.html`.

## Conventions

- All UI text, code comments, and user-facing error messages are Simplified Chinese — keep new strings in Chinese.
- Named exports throughout (`export const` in services/hooks, `export function` for components). Pages in `src/pages/*.jsx`; data access in `src/services/*.js`; auth session state in `src/hooks/useAuth.js`.
- Styling is plain global CSS in `src/styles/`: `tokens.css` (design tokens), `global.css`, `animations.css` (classes prefixed `ym-`). Not CSS Modules/Styled Components despite the README claim.
- Auth is email-based under the hood: usernames are normalized to `username@nav.local` for Supabase auth (`src/services/auth.js`). A public `RegisterPage` exists even though `docs/project.md` says accounts are admin-created.
- Password recovery works off a *real* contact stored in `profiles.email` / `profiles.phone` (not the `@nav.local` pseudo-email), bound via the `bind_contact()` SECURITY DEFINER RPC. Email codes go out through `netlify/functions/password-reset.mjs`; the SMS branch is intentionally stubbed to a 503 "部署中". Setup and Aliyun DirectMail env vars: `docs/password-reset.md`.
- **Secrets policy (#147)**: every `VITE_*` env var is bundled into the public JS and must be treated as public information — never put real secrets there. Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, mail/LLM provider keys) live only in Netlify environment variables, never in `.env*` files that could be committed.
- Git/GitHub flow on `main`; branches named `feat/xxx` or `fix/xxx`; PRs use `Closes #issue`.
