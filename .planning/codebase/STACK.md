---
last_mapped_commit: 15310b9043b62a1f115f333f51535da622f0d098
last_mapped_at: 2026-10-09
---
# Technology Stack

**Analysis Date:** 2026-10-09

## Languages

**Primary:**
- TypeScript `^5.7.3` — used in every workspace (`server/`, `web/`, `shared/`); all new code goes in `.ts`/`.tsx`
- SQL (via Prisma schema DSL) — data model lives in `server/prisma/schema.prisma`

**Secondary:**
- JavaScript (ESM config only) — `web/next.config.mjs`, `web/postcss.config.mjs` use ESM `export default`
- CSS (Tailwind directives + CSS variables) — `web/src/app/globals.css`, plus `packages/ui/src/study/study.css` imported by `web/src/app/layout.tsx`

## Runtime

**Environment:**
- Node.js — observed `v24.19.0` on this machine; type definitions pin `@types/node` `^22.13.1` in `server/package.json` and `web/package.json`
- Target `ES2022` in `server/tsconfig.json`, `shared/tsconfig.json`, and `web/tsconfig.json`

**Package Manager:**
- npm workspaces — declared in `package.json` (`"workspaces": ["shared", "server", "web"]`)
- Lockfile: present (`package-lock.json`, `lockfileVersion: 3`)
- No `engines` field, no `.nvmrc`, no `.node-version` — use the installed Node 22+ compatible runtime; do not assume a pinned version

## Frameworks

**Core:**
- Express `^4.21.2` — backend HTTP server; app wiring in `server/src/index.ts`, routers in `server/src/routes/`
- Prisma ORM `^6.3.1` (+ `@prisma/client` `^6.3.1`) — SQLite data access; client singleton in `server/src/db.ts`
- Next.js `15.1.6` (App Router) — frontend; root layout in `web/src/app/layout.tsx`, routes under `web/src/app/` (`ask/`, `lectures/`, `settings/`, `study/`)
- React `^19.0.0` + `react-dom` `^19.0.0` — UI components in `web/src/components/` (e.g. `web/src/components/QnAChat.tsx`, `web/src/components/LectureWorkspace.tsx`)

**Testing:**
- Vitest `^5.0.3` — server test runner (`"test": "vitest run"` in `server/package.json`); suite in `server/src/services/__tests__/services.test.ts`
- No test runner configured for `web/` — no `test` script in `web/package.json`, no `*.test.*`/`*.spec.*` under `web/src/`
- Legacy packages (`packages/core/`, `packages/server-routes/`, `packages/ui/`) pin Vitest `^2.1.0` plus `@testing-library/react`, `jsdom` in `packages/ui/package.json` — treat as prototype-only, not part of the active build

**Build/Dev:**
- `tsx` `^4.19.2` — dev server (`tsx watch src/index.ts`) and seed script (`tsx ../scripts/seed-demo.ts`) in `server/package.json`
- `tsc` — production build for `server/` and `shared/` (`"build": "tsc"` in both `server/package.json` and `shared/package.json`); type checks via `"typecheck": "tsc --noEmit"`
- `concurrently` `^9.1.2` — root `npm run dev` launches server + web together (see `package.json`)
- Next.js toolchain — `next dev -p 3000` / `next build` / `next start -p 3000` in `web/package.json`
- Vite `^6.0.7` — build/dev server for the standalone prototype only (`packages/ui/package.json`); never use Vite for `web/`

## Key Dependencies

**Critical:**
- `@lectern/shared` (`*` workspace link) — DTO contract (`LectureDTO`, `QnAResponseDTO`, `SystemStatusDTO`, …) in `shared/src/index.ts`; import it for all cross-boundary types in `server/src/` and `web/src/lib/api.ts`
- `@prisma/client` `^6.3.1` — generated DB client used in `server/src/db.ts`, `server/src/services/whisperService.ts`, `server/src/services/embeddingService.ts`, `server/src/services/pipelineOrchestrator.ts`, `server/src/routes/lectureRoutes.ts`
- `multer` `^1.4.5-lts.1` (+ `@types/multer`) — multipart audio upload with `diskStorage` into the uploads dir and a 500 MB limit in `server/src/routes/lectureRoutes.ts`
- Native `fetch` + `AbortSignal.timeout` — all Ollama HTTP calls (`server/src/services/embeddingService.ts`, `server/src/services/pipelineOrchestrator.ts`, `server/src/routes/qnaRoutes.ts`, `server/src/routes/statusRoutes.ts`); use this pattern for any new local-service HTTP call, not an added HTTP client
- Native `node:child_process` `execFile` (promisified) — all local-binary invocations (`server/src/services/whisperService.ts`, `server/src/services/audioService.ts`, `server/src/routes/statusRoutes.ts`); keep subprocess calls behind service classes, never inline in routes

**Infrastructure:**
- `cors` `^2.8.5` — enabled with open defaults (`app.use(cors())` in `server/src/index.ts`); tighten only if the deployment leaves localhost
- `dotenv` `^16.4.7` — loads env files at startup in `server/src/config.ts`
- `express` middleware stack — `express.json()`, `express.urlencoded()`, `express.static` for `/uploads` in `server/src/index.ts`
- `clsx` `^2.1.1` + `tailwind-merge` `^3.0.1` — classname composition in `web/`; use both together for conditional Tailwind classes
- `lucide-react` `^0.475.0` — icon set used across `web/src/components/` and `web/src/app/` pages
- `ecc-universal` `2.2.3` — agent skills/coding-guidance framework wired via `opencode.json`; not a runtime dependency

## Configuration

**Environment:**
- Central config object `CONFIG` in `server/src/config.ts` — read all tunables from `CONFIG`, never from `process.env` inline elsewhere
- Supported vars (all optional, every one has a working default): `PORT` (default `5000`), `NODE_ENV`, `OLLAMA_BASE_URL` (default `http://localhost:11434`), `OLLAMA_LLM_MODEL` (default `qwen2.5:14b`), `OLLAMA_EMBED_MODEL` (default `nomic-embed-text`), `WHISPER_CLI_PATH` (default `tools/whisper/Release/whisper-cli.exe`), `WHISPER_MODEL_PATH` (default `models/ggml-large-v3-turbo.bin`), `FFMPEG_CMD` (default `ffmpeg`)
- `web/.env.local` file present — existence noted only; never read or quote its contents
- No root or `server/` `.env` file present; `.gitignore` ignores `.env` and `.env*.local`

**Build:**
- `server/tsconfig.json` — `module`/`moduleResolution` `NodeNext`, `outDir` `./dist`, `rootDir` `./src`, `strict: true`
- `shared/tsconfig.json` — same NodeNext/strict setup plus `declaration`, `declarationMap`, `sourceMap`; entry `shared/src/index.ts`, output `shared/dist/`
- `web/tsconfig.json` — `moduleResolution` `bundler`, `jsx: preserve`, `@/*` → `./src/*` path alias, Next plugin
- `web/next.config.mjs` — proxies `/api/:path*` and `/uploads/:path*` to `http://localhost:5000`; extend `rewrites()` here when adding backend-mounted paths
- `web/tailwind.config.ts` (`darkMode: 'class'`, content under `web/src/`) + `web/postcss.config.mjs` (`tailwindcss` plugin) — keep Tailwind v3 syntax in `web/`; the v4-style or separate `packages/ui/tailwind.config.js` setup does not apply to `web/`

## Platform Requirements

**Development:**
- Windows x64 + NVIDIA GPU with CUDA (CUDA DLLs ship in `tools/whisper/Release/`, e.g. `ggml-cuda.dll`, `cublas64_12.dll`, `cudart64_12.dll`)
- FFmpeg `v9.0.1` full build on `PATH` (per `README.md`); binary name override via `FFMPEG_CMD`
- Ollama `v0.40.1` running locally with `nomic-embed-text` and `qwen2.5:14b` pulled (per `README.md`)
- whisper.cpp `v1.9.5` CUDA binaries in `tools/whisper/Release/` (notably `whisper-cli.exe`) and weights in `models/` (`ggml-large-v3-turbo.bin`, `ggml-large-v3-turbo-q5_0.bin`)
- Ports `5000` (Express, `server/src/index.ts`) and `3000` (Next.js, `web/package.json`) free; run via root `npm run dev` (see `package.json`)

**Production:**
- No production host, container, or deploy pipeline configured — no `Dockerfile`, no CI workflow, no hosting config in the repo; current deployment target is the local workstation only
- SQLite file DB (`server/prisma/dev.db`, gitignored per `.gitignore`) — back up the file itself; there is no managed database to provision
- `models/` and `tools/whisper/Release/` are gitignored (see `.gitignore`) — provision binaries + weights out-of-band on any new machine; `npm install` does not install them

---

*Stack analysis: 2026-10-09*
