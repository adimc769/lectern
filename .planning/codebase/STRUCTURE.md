---
last_mapped_commit: 15310b9043b62a1f115f333f51535da622f0d098
last_mapped_at: 2026-10-09
---
# Codebase Structure

**Analysis Date:** 2026-10-09

## Directory Layout

```
./
├── server/               # Express + Prisma offline pipeline API (live backend)
│   ├── src/
│   │   ├── index.ts          # App bootstrap + route mounting
│   │   ├── config.ts         # Env-driven runtime config
│   │   ├── db.ts             # Prisma singleton
│   │   ├── routes/           # lectureRoutes, qnaRoutes, statusRoutes
│   │   └── services/         # audio, whisper, chunking, embedding, orchestrator
│   ├── prisma/
│   │   ├── schema.prisma     # SQLite data model
│   │   └── dev.db            # Local SQLite file
│   ├── dist/                 # Compiled JS output (tsc)
│   ├── package.json          # @lectern/server workspace
│   └── tsconfig.json         # NodeNext, rootDir src, outDir dist
├── web/                  # Next.js 15 App Router frontend (live UI)
│   ├── src/
│   │   ├── app/              # /, /lectures, /lectures/[id], /ask, /study/[id], /settings
│   │   ├── components/       # AppShell, LectureWorkspace, IntakeModal, QnAChat, ...
│   │   └── lib/
│   │       └── api.ts        # Typed client + offline fallback corpus
│   ├── next.config.mjs       # /api + /uploads rewrites to :5000
│   ├── tailwind.config.ts    # Design tokens
│   └── package.json          # @lectern/web workspace
├── shared/               # Cross-tier DTO contract (live dependency)
│   ├── src/
│   │   └── index.ts          # All DTO + enum types
│   ├── dist/                 # Compiled contract output
│   └── package.json          # @lectern/shared workspace
├── packages/             # Auxiliary pure-logic + design-system code (not in workspaces)
│   ├── core/src/             # Testable pipeline math (chunker, vector, ollama, pipeline)
│   ├── server-routes/src/    # Standalone route pack (not mounted by server/)
│   └── ui/src/               # Study players, SRS store, styles, mock API
├── scripts/              # Manual verification entry points (tsx)
│   ├── seed-demo.ts
│   ├── try-pipeline.ts
│   ├── benchmark.ts
│   └── audit-offline.ts
├── tools/whisper/        # Local whisper.cpp CUDA binaries (not source)
├── models/               # Local ggml whisper weights (not source)
├── uploads/              # Runtime audio intake + derived WAVs (gitignored artifacts)
├── .planning/codebase/   # Architecture/structure/convention maps
├── opencode.json         # Tooling config
└── package.json          # Root monorepo (workspaces: shared, server, web)
```

## Directory Purposes

**`server/`:**
- Purpose: Live offline API that owns ingestion, transcription, embeddings, summarization, Q&A, and diagnostics.
- Contains: Express routes, pipeline services, Prisma schema + SQLite file, Vitest suite.
- Key files: `server/src/index.ts`, `server/src/config.ts`, `server/src/db.ts`, `server/src/routes/lectureRoutes.ts`, `server/src/routes/qnaRoutes.ts`, `server/src/routes/statusRoutes.ts`, `server/src/services/pipelineOrchestrator.ts`, `server/prisma/schema.prisma`

**`server/src/routes/`:**
- Purpose: One router module per API surface; thin parsing + DTO mapping, no AI logic.
- Contains: `server/src/routes/lectureRoutes.ts`, `server/src/routes/qnaRoutes.ts`, `server/src/routes/statusRoutes.ts`
- Key files: `server/src/routes/lectureRoutes.ts` (all lecture CRUD + progress), `server/src/routes/qnaRoutes.ts` (RAG endpoint), `server/src/routes/statusRoutes.ts` (hardware probes)

**`server/src/services/`:**
- Purpose: One class + singleton per pipeline capability plus the orchestrator that sequences them.
- Contains: `server/src/services/audioService.ts`, `server/src/services/whisperService.ts`, `server/src/services/chunkingService.ts`, `server/src/services/embeddingService.ts`, `server/src/services/pipelineOrchestrator.ts`, `server/src/services/__tests__/services.test.ts`
- Key files: `server/src/services/pipelineOrchestrator.ts` (7-stage state machine), `server/src/services/embeddingService.ts` (embed + cosine retrieval)

**`server/prisma/`:**
- Purpose: Database contract and local data file.
- Contains: `server/prisma/schema.prisma`, `server/prisma/dev.db`
- Key files: `server/prisma/schema.prisma` (add models/fields here, then run `npm run db:push`)

**`web/`:**
- Purpose: Live student-facing UI; all pages are client components behind a persistent shell.
- Contains: App Router pages, study components, typed API client, Tailwind/PostCSS configs.
- Key files: `web/src/app/layout.tsx`, `web/src/app/page.tsx`, `web/src/lib/api.ts`, `web/next.config.mjs`, `web/tailwind.config.ts`

**`web/src/app/`:**
- Purpose: Route segments; each folder is a URL.
- Contains: `web/src/app/page.tsx` (home), `web/src/app/lectures/page.tsx` (archive), `web/src/app/lectures/[id]/page.tsx` (workspace loader), `web/src/app/ask/page.tsx` (RAG chat), `web/src/app/study/[id]/page.tsx` (SRS circuit), `web/src/app/settings/page.tsx` (diagnostics), `web/src/app/layout.tsx` (root shell), `web/src/app/globals.css`
- Key files: `web/src/app/lectures/[id]/page.tsx` (parse `?tab=` + `?t=` then render workspace), `web/src/app/ask/page.tsx` (citation chat), `web/src/app/study/[id]/page.tsx` (deck/quiz switch)

**`web/src/components/`:**
- Purpose: Reusable study UI; barrel-exported for page composition.
- Contains: `web/src/components/AppShell.tsx`, `web/src/components/AppSidebar.tsx`, `web/src/components/LectureWorkspace.tsx`, `web/src/components/IntakeModal.tsx`, `web/src/components/AudioUploader.tsx`, `web/src/components/AudioRecorder.tsx`, `web/src/components/QnAChat.tsx`, `web/src/components/AskPanel.tsx`, `web/src/components/PipelineProgress.tsx`, `web/src/components/TranscriptViewer.tsx`, `web/src/components/FlashcardDeck.tsx`, `web/src/components/FlashcardsUI.tsx`, `web/src/components/LectureViewer.tsx`, `web/src/components/UploadPanel.tsx`, `web/src/components/OfflineBadge.tsx`, `web/src/components/index.ts`
- Key files: `web/src/components/index.ts` (add new component exports here), `web/src/components/LectureWorkspace.tsx` (main study surface), `web/src/components/IntakeModal.tsx` (upload + record entry)

**`web/src/lib/`:**
- Purpose: Single frontend service boundary for all backend access.
- Contains: `web/src/lib/api.ts`
- Key files: `web/src/lib/api.ts` (put every new `fetch('/api/...')` helper here; keep `FALLBACK_*` and `BackendUnreachableError` handling in this file)

**`shared/`:**
- Purpose: Zero-dependency type contract imported by both tiers as `@lectern/shared`.
- Contains: `shared/src/index.ts`, compiled `shared/dist/`
- Key files: `shared/src/index.ts` (add every new DTO/enum here first, then rebuild)

**`packages/core/`:**
- Purpose: Framework-free pipeline algorithms usable without Express or Prisma.
- Contains: `packages/core/src/chunker.ts`, `packages/core/src/vector.ts`, `packages/core/src/ollama.ts`, `packages/core/src/whisper.ts`, `packages/core/src/pipeline.ts`, `packages/core/src/prompts.ts`, `packages/core/src/schemas.ts`, `packages/core/src/types.ts`
- Key files: `packages/core/src/pipeline.ts` (reference map-reduce + grounded-Q&A implementation), `packages/core/src/index.ts` (barrel)

**`packages/ui/`:**
- Purpose: Study-system design components + SRS state consumed by the web study route.
- Contains: `packages/ui/src/study/DeckPlayer.tsx`, `packages/ui/src/study/QuizPlayer.tsx`, `packages/ui/src/study/CompletionScreen.tsx`, `packages/ui/src/study/studyStore.ts`, `packages/ui/src/study/srs.ts`, `packages/ui/src/study/study.css`, `packages/ui/src/components/`, `packages/ui/src/api.ts`, `packages/ui/src/mockApi.ts`
- Key files: `packages/ui/src/study/studyStore.ts` (localStorage boxes/streaks), `packages/ui/src/study/DeckPlayer.tsx` (player used by study page)

**`packages/server-routes/`:**
- Purpose: Standalone route pack kept separate from the live `server/src/routes/` mount.
- Contains: Source and tests under `packages/server-routes/src/` and `packages/server-routes/test/`
- Key files: `packages/server-routes/src/` (inspect here before duplicating a lecture/Q&A route in `server/`)

**`scripts/`:**
- Purpose: Manual local verification scripts run with `tsx`, not part of the served bundle.
- Contains: `scripts/seed-demo.ts`, `scripts/try-pipeline.ts`, `scripts/benchmark.ts`, `scripts/audit-offline.ts`
- Key files: `scripts/seed-demo.ts` (wired to `server/package.json` `seed:demo`), `scripts/try-pipeline.ts` (end-to-end pipeline smoke)

**`tools/`, `models/`, `uploads/`:**
- Purpose: Runtime binaries, weights, and user audio — never source code.
- Contains: `tools/whisper/` CUDA release, `models/` ggml weights, `uploads/` intake WAVs + derived files
- Key files: Paths referenced by `server/src/config.ts` (`WHISPER_CLI_PATH`, `WHISPER_MODEL_PATH`, `UPLOADS_DIR`); do not commit large artifacts from these folders

## Key File Locations

**Entry Points:**
- `server/src/index.ts`: Express bootstrap — add new top-level routers and static mounts here
- `web/src/app/layout.tsx`: Next.js root layout — add global providers, styles, and shell wrappers here
- `web/src/app/page.tsx`: Home dashboard — add new-user onboarding and intake entry here
- `web/next.config.mjs`: Proxy table — add every new `/api/*` or static passthrough here or the frontend cannot reach it
- `scripts/seed-demo.ts`: Demo seeding — add new judge-mode fixtures here alongside `server/src/routes/lectureRoutes.ts` demo constants

**Configuration:**
- `server/src/config.ts`: Backend env map (`PORT`, `OLLAMA_BASE_URL`, `OLLAMA_LLM_MODEL`, `OLLAMA_EMBED_MODEL`, `WHISPER_CLI_PATH`, `WHISPER_MODEL_PATH`, `UPLOADS_DIR`, `FFMPEG_CMD`) — add new env knobs here with local defaults
- `server/tsconfig.json`: Backend compiler settings (`NodeNext`, `rootDir: src`, `outDir: dist`) — keep new server files under `server/src/`
- `web/tsconfig.json`: Frontend compiler settings with `@/*` → `web/src/*` path alias — use the alias for new web imports
- `web/tailwind.config.ts`: Theme tokens — add design tokens here, not inline hex in new components
- `web/postcss.config.mjs`: PostCSS pipeline — keep Tailwind wiring here
- `package.json`: Root workspaces (`shared`, `server`, `web`) and `dev`/`build`/`typecheck`/`db:*` scripts — add cross-workspace scripts here
- `server/package.json`: Backend scripts (`dev` via `tsx watch`, `db:generate`, `db:push`, `seed:demo`, `test` via Vitest) — add backend-only scripts here
- `web/package.json`: Frontend scripts (`dev -p 3000`, `build`, `typecheck`) — add frontend-only scripts here
- `shared/package.json`: Contract build (`tsc` → `shared/dist/`) — rebuild after editing `shared/src/index.ts`
- `opencode.json`: Tooling config at repo root — leave untouched unless changing agent tooling
- `.env` files (existence only): `web/.env.local` is present for local frontend config; backend reads env via `dotenv` in `server/src/config.ts`. Never read, quote, or commit secret values.

**Core Logic:**
- `server/src/services/pipelineOrchestrator.ts`: Pipeline sequence — add new AI stages here as explicit `updateProgress` steps
- `server/src/services/embeddingService.ts`: Retrieval math — add ranking/filter changes in `findTopK()` and `cosineSimilarity()`
- `server/src/services/chunkingService.ts`: Chunking math — tune `targetWords`/`overlapWords` defaults here
- `server/src/services/whisperService.ts`: ASR parsing — extend timestamp/JSON handling here
- `server/src/services/audioService.ts`: FFmpeg normalization — change sample-rate/channel/codec args here
- `shared/src/index.ts`: DTOs — add new API shapes here before touching routes or pages
- `web/src/lib/api.ts`: Frontend data access — add new backend calls here with `*WithSource` + fallback handling

**Testing:**
- `server/src/services/__tests__/services.test.ts`: Backend Vitest suite (audio/chunk/embed/whisper/orchestrator) — add service unit tests next to these describes
- `packages/core/test/`: Pure-logic tests — add algorithm tests here, not in `server/`
- `packages/server-routes/test/`: Route-pack tests — add isolated route tests here
- `packages/ui/src/study/__tests__/`: Study-system tests — add SRS/player tests here

## Naming Conventions

**Files:**
- Backend services use camelCase class files ending in `Service.ts`: `server/src/services/audioService.ts`, `server/src/services/whisperService.ts`, `server/src/services/chunkingService.ts`, `server/src/services/embeddingService.ts`
- Backend routes use `<domain>Routes.ts`: `server/src/routes/lectureRoutes.ts`, `server/src/routes/qnaRoutes.ts`, `server/src/routes/statusRoutes.ts`
- Frontend components use PascalCase matching the export: `web/src/components/LectureWorkspace.tsx` exports `LectureWorkspace`, `web/src/components/IntakeModal.tsx` exports `IntakeModal`, `web/src/components/QnAChat.tsx` exports `QnAChat`
- DTO interfaces use `<Noun>DTO` and request/response pairs use `QnARequestDTO` / `QnAResponseDTO`: see `shared/src/index.ts`
- App Router pages are always `page.tsx` inside a route folder: `web/src/app/ask/page.tsx`, `web/src/app/settings/page.tsx`, `web/src/app/lectures/page.tsx`
- Dynamic segments use bracket folders: `web/src/app/lectures/[id]/page.tsx`, `web/src/app/study/[id]/page.tsx`
- Unit tests use `*.test.ts` next to or under the module: `server/src/services/__tests__/services.test.ts`

**Directories:**
- Lowercase plural nouns for code groups: `server/src/routes/`, `server/src/services/`, `web/src/components/`, `web/src/app/lectures/`
- Singular capped `src/` per package: `server/src/`, `shared/src/`, `web/src/`, `packages/core/src/`
- Test colocations use `__tests__/`: `server/src/services/__tests__/`, `packages/ui/src/study/__tests__/`
- Route-group folders mirror URLs: `web/src/app/lectures/[id]/`, `web/src/app/study/[id]/`

## Where to Add New Code

**New Feature (end-to-end lecture capability):**
- Primary code: `server/src/services/` (new `XService.ts` class + singleton) wired through `server/src/services/pipelineOrchestrator.ts` as a new `PipelineStage`
- Contract first: `shared/src/index.ts` (extend `PipelineStage`, add DTOs), then rebuild `shared/dist/`
- UI: `web/src/components/` (new `XPanel.tsx`, export from `web/src/components/index.ts`) composed in `web/src/components/LectureWorkspace.tsx` or a new `web/src/app/` route
- Client access: `web/src/lib/api.ts` (new typed helper following the `fetchXWithSource` pattern)
- Tests: `server/src/services/__tests__/services.test.ts` for the service; colocated `__tests__/` for UI-adjacent pure logic

**New API Endpoint:**
- Implementation: `server/src/routes/` (extend the matching `lectureRoutes.ts` / `qnaRoutes.ts` / `statusRoutes.ts`, or add `<domain>Routes.ts` and mount it in `server/src/index.ts`)
- Proxy: `web/next.config.mjs` (add the `/api/<path>` rewrite when the path is new)
- Client: `web/src/lib/api.ts` (add the typed wrapper; throw `BackendUnreachableError` on transport failure)
- Contract: `shared/src/index.ts` (add request/response DTOs before writing the handler)

**New Frontend Page:**
- Implementation: `web/src/app/<route>/page.tsx` (copy the `'use client'` + `Suspense` + `fetchXWithSource` structure from `web/src/app/ask/page.tsx` or `web/src/app/lectures/page.tsx`)
- Navigation: `web/src/components/AppSidebar.tsx` (append to `NAV_ITEMS`)
- Shell behavior: `web/src/components/AppShell.tsx` (only for global chrome like toasts or status pills)

**New Pipeline Stage:**
- Implementation: `server/src/services/pipelineOrchestrator.ts` (`runPipeline()` sequence + `updateProgress()` call with the next percentage)
- Stage enum: `shared/src/index.ts` (extend `PipelineStage`)
- Progress UI: `web/src/components/PipelineProgress.tsx` (`STAGES` array) and `web/src/components/LectureWorkspace.tsx` (stepper grid) and `web/src/components/AudioUploader.tsx` (`STAGE_LABELS`)
- Simulation parity: `web/src/lib/api.ts` (`PROGRESS_STAGES` array) so offline fallback shows the same step

**New Retrieval / Q&A Behavior:**
- Implementation: `server/src/services/embeddingService.ts` (`findTopK()`, `cosineSimilarity()`) and prompt rules in `server/src/routes/qnaRoutes.ts`
- Reference copy: `packages/core/src/pipeline.ts` (`answerQuestion()`) and `packages/core/src/vector.ts` (`topK()`) for the pure-logic mirror
- UI: `web/src/app/ask/page.tsx` and `web/src/components/QnAChat.tsx` (citation chip rendering + deep links)

**Utilities:**
- Shared helpers: `shared/src/index.ts` for cross-tier types only — never put runtime helpers here
- Backend-only helpers: new file in `server/src/services/` following the class + singleton pattern
- Frontend-only helpers: `web/src/lib/api.ts` for data access; local format helpers stay inside the component file (see `formatMmSs` in `web/src/components/LectureWorkspace.tsx`)

## Special Directories

**`server/dist/`:**
- Purpose: Compiled backend output from `tsc`
- Generated: Yes (via `npm run build --workspace=server`)
- Committed: No — rebuild on deploy; never edit by hand

**`shared/dist/`:**
- Purpose: Compiled `@lectern/shared` contract consumed by `server/` and `web/`
- Generated: Yes (via `npm run build --workspace=shared`)
- Committed: No — rebuild after every `shared/src/index.ts` change

**`web/.next/`:**
- Purpose: Next.js build cache and type output
- Generated: Yes
- Committed: No

**`uploads/`:**
- Purpose: Runtime user audio, converted 16 kHz WAVs, and whisper JSON siblings
- Generated: Yes (at runtime via `multer` in `server/src/routes/lectureRoutes.ts` and `audioService`/`whisperService` derivatives)
- Committed: No (`.gitignore`d artifacts) — never store fixtures here; use `FALLBACK_LECTURES` in `web/src/lib/api.ts` for demo content

**`tools/whisper/` and `models/`:**
- Purpose: Local CUDA binaries and ggml weights resolved by `server/src/config.ts`
- Generated: No (vendored binaries, prebuilt outside the repo)
- Committed: Partially — keep paths stable; do not add source code here

**`server/prisma/dev.db`:**
- Purpose: Local development SQLite database file
- Generated: Yes (via `npm run db:push`)
- Committed: No — schema source of truth is `server/prisma/schema.prisma`

**`.planning/codebase/`:**
- Purpose: Living codebase maps consumed by planning and execution workflows
- Generated: No (hand-maintained analysis docs)
- Committed: Yes — update `ARCHITECTURE.md` and `STRUCTURE.md` when layers or directories change

---

*Structure analysis: 2026-10-09*
