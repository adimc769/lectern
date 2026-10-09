<!-- GSD:project-start source:PROJECT.md -->

## Project

**Lectern**

Lectern is a local-first, offline-capable AI study assistant for students. Students import audio lectures (uploaded or browser-recorded) and documents (PDF, DOCX, TXT, notes) and turn them into summaries, key terms, flashcards, practice exams, study guides, and cited Q&A — with 100% of AI inference running on-device and zero cloud dependencies.

**Core Value:** A student can import real lecture materials and study from them with grounded, cited AI help — without the internet and without their data leaving the machine.

### Constraints

- **Local-first**: no cloud AI APIs, no runtime CDN/fonts/network calls — why: privacy + offline core value
- **Stack**: keep Next.js + Express + Prisma + SQLite + whisper.cpp + Ollama unless a concrete compat problem forces change — why: working pipeline, hackathon time budget
- **Offline truthfulness**: never claim offline-ready when a local service is down — why: demo credibility
- **Provenance**: every generated answer carries verifiable source refs; failures explain themselves — why: trust + acceptance criteria
- **Planning discipline**: plan before implementing, one phase at a time, stop per phase for approval — why: user-locked workflow for this scope

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript `^5.7.3` — used in every workspace (`server/`, `web/`, `shared/`); all new code goes in `.ts`/`.tsx`
- SQL (via Prisma schema DSL) — data model lives in `server/prisma/schema.prisma`
- JavaScript (ESM config only) — `web/next.config.mjs`, `web/postcss.config.mjs` use ESM `export default`
- CSS (Tailwind directives + CSS variables) — `web/src/app/globals.css`, plus `packages/ui/src/study/study.css` imported by `web/src/app/layout.tsx`

## Runtime

- Node.js — observed `v24.19.0` on this machine; type definitions pin `@types/node` `^22.13.1` in `server/package.json` and `web/package.json`
- Target `ES2022` in `server/tsconfig.json`, `shared/tsconfig.json`, and `web/tsconfig.json`
- npm workspaces — declared in `package.json` (`"workspaces": ["shared", "server", "web"]`)
- Lockfile: present (`package-lock.json`, `lockfileVersion: 3`)
- No `engines` field, no `.nvmrc`, no `.node-version` — use the installed Node 22+ compatible runtime; do not assume a pinned version

## Frameworks

- Express `^4.21.2` — backend HTTP server; app wiring in `server/src/index.ts`, routers in `server/src/routes/`
- Prisma ORM `^6.3.1` (+ `@prisma/client` `^6.3.1`) — SQLite data access; client singleton in `server/src/db.ts`
- Next.js `15.1.6` (App Router) — frontend; root layout in `web/src/app/layout.tsx`, routes under `web/src/app/` (`ask/`, `lectures/`, `settings/`, `study/`)
- React `^19.0.0` + `react-dom` `^19.0.0` — UI components in `web/src/components/` (e.g. `web/src/components/QnAChat.tsx`, `web/src/components/LectureWorkspace.tsx`)
- Vitest `^5.0.3` — server test runner (`"test": "vitest run"` in `server/package.json`); suite in `server/src/services/__tests__/services.test.ts`
- No test runner configured for `web/` — no `test` script in `web/package.json`, no `*.test.*`/`*.spec.*` under `web/src/`
- Legacy packages (`packages/core/`, `packages/server-routes/`, `packages/ui/`) pin Vitest `^2.1.0` plus `@testing-library/react`, `jsdom` in `packages/ui/package.json` — treat as prototype-only, not part of the active build
- `tsx` `^4.19.2` — dev server (`tsx watch src/index.ts`) and seed script (`tsx ../scripts/seed-demo.ts`) in `server/package.json`
- `tsc` — production build for `server/` and `shared/` (`"build": "tsc"` in both `server/package.json` and `shared/package.json`); type checks via `"typecheck": "tsc --noEmit"`
- `concurrently` `^9.1.2` — root `npm run dev` launches server + web together (see `package.json`)
- Next.js toolchain — `next dev -p 3000` / `next build` / `next start -p 3000` in `web/package.json`
- Vite `^6.0.7` — build/dev server for the standalone prototype only (`packages/ui/package.json`); never use Vite for `web/`

## Key Dependencies

- `@lectern/shared` (`*` workspace link) — DTO contract (`LectureDTO`, `QnAResponseDTO`, `SystemStatusDTO`, …) in `shared/src/index.ts`; import it for all cross-boundary types in `server/src/` and `web/src/lib/api.ts`
- `@prisma/client` `^6.3.1` — generated DB client used in `server/src/db.ts`, `server/src/services/whisperService.ts`, `server/src/services/embeddingService.ts`, `server/src/services/pipelineOrchestrator.ts`, `server/src/routes/lectureRoutes.ts`
- `multer` `^1.4.5-lts.1` (+ `@types/multer`) — multipart audio upload with `diskStorage` into the uploads dir and a 500 MB limit in `server/src/routes/lectureRoutes.ts`
- Native `fetch` + `AbortSignal.timeout` — all Ollama HTTP calls (`server/src/services/embeddingService.ts`, `server/src/services/pipelineOrchestrator.ts`, `server/src/routes/qnaRoutes.ts`, `server/src/routes/statusRoutes.ts`); use this pattern for any new local-service HTTP call, not an added HTTP client
- Native `node:child_process` `execFile` (promisified) — all local-binary invocations (`server/src/services/whisperService.ts`, `server/src/services/audioService.ts`, `server/src/routes/statusRoutes.ts`); keep subprocess calls behind service classes, never inline in routes
- `cors` `^2.8.5` — enabled with open defaults (`app.use(cors())` in `server/src/index.ts`); tighten only if the deployment leaves localhost
- `dotenv` `^16.4.7` — loads env files at startup in `server/src/config.ts`
- `express` middleware stack — `express.json()`, `express.urlencoded()`, `express.static` for `/uploads` in `server/src/index.ts`
- `clsx` `^2.1.1` + `tailwind-merge` `^3.0.1` — classname composition in `web/`; use both together for conditional Tailwind classes
- `lucide-react` `^0.475.0` — icon set used across `web/src/components/` and `web/src/app/` pages
- `ecc-universal` `2.2.3` — agent skills/coding-guidance framework wired via `opencode.json`; not a runtime dependency

## Configuration

- Central config object `CONFIG` in `server/src/config.ts` — read all tunables from `CONFIG`, never from `process.env` inline elsewhere
- Supported vars (all optional, every one has a working default): `PORT` (default `5000`), `NODE_ENV`, `OLLAMA_BASE_URL` (default `http://localhost:11434`), `OLLAMA_LLM_MODEL` (default `qwen2.5:14b`), `OLLAMA_EMBED_MODEL` (default `nomic-embed-text`), `WHISPER_CLI_PATH` (default `tools/whisper/Release/whisper-cli.exe`), `WHISPER_MODEL_PATH` (default `models/ggml-large-v3-turbo.bin`), `FFMPEG_CMD` (default `ffmpeg`)
- `web/.env.local` file present — existence noted only; never read or quote its contents
- No root or `server/` `.env` file present; `.gitignore` ignores `.env` and `.env*.local`
- `server/tsconfig.json` — `module`/`moduleResolution` `NodeNext`, `outDir` `./dist`, `rootDir` `./src`, `strict: true`
- `shared/tsconfig.json` — same NodeNext/strict setup plus `declaration`, `declarationMap`, `sourceMap`; entry `shared/src/index.ts`, output `shared/dist/`
- `web/tsconfig.json` — `moduleResolution` `bundler`, `jsx: preserve`, `@/*` → `./src/*` path alias, Next plugin
- `web/next.config.mjs` — proxies `/api/:path*` and `/uploads/:path*` to `http://localhost:5000`; extend `rewrites()` here when adding backend-mounted paths
- `web/tailwind.config.ts` (`darkMode: 'class'`, content under `web/src/`) + `web/postcss.config.mjs` (`tailwindcss` plugin) — keep Tailwind v3 syntax in `web/`; the v4-style or separate `packages/ui/tailwind.config.js` setup does not apply to `web/`

## Platform Requirements

- Windows x64 + NVIDIA GPU with CUDA (CUDA DLLs ship in `tools/whisper/Release/`, e.g. `ggml-cuda.dll`, `cublas64_12.dll`, `cudart64_12.dll`)
- FFmpeg `v9.0.1` full build on `PATH` (per `README.md`); binary name override via `FFMPEG_CMD`
- Ollama `v0.40.1` running locally with `nomic-embed-text` and `qwen2.5:14b` pulled (per `README.md`)
- whisper.cpp `v1.9.5` CUDA binaries in `tools/whisper/Release/` (notably `whisper-cli.exe`) and weights in `models/` (`ggml-large-v3-turbo.bin`, `ggml-large-v3-turbo-q5_0.bin`)
- Ports `5000` (Express, `server/src/index.ts`) and `3000` (Next.js, `web/package.json`) free; run via root `npm run dev` (see `package.json`)
- No production host, container, or deploy pipeline configured — no `Dockerfile`, no CI workflow, no hosting config in the repo; current deployment target is the local workstation only
- SQLite file DB (`server/prisma/dev.db`, gitignored per `.gitignore`) — back up the file itself; there is no managed database to provision
- `models/` and `tools/whisper/Release/` are gitignored (see `.gitignore`) — provision binaries + weights out-of-band on any new machine; `npm install` does not install them

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- Use PascalCase for React components: `UploadPanel.tsx`, `LectureViewer.tsx`, `TranscriptViewer.tsx`, `FlashcardDeck.tsx` in `web/src/components/` and `AskPanel.tsx`, `LectureList.tsx`, `LecturePage.tsx` in `packages/ui/src/components/`
- Use camelCase for services, utilities, and stores: `chunkingService.ts`, `pipelineOrchestrator.ts`, `audioService.ts`, `embeddingService.ts`, `whisperService.ts` in `server/src/services/`; `studyStore.ts`, `srs.ts`, `mockApi.ts` in `packages/ui/src/`; `chunker.ts`, `vector.ts`, `pipeline.ts`, `prompts.ts`, `schemas.ts` in `packages/core/src/`
- Use camelCase + `Routes` suffix for Express routers: `lectureRoutes.ts`, `qnaRoutes.ts`, `statusRoutes.ts` in `server/src/routes/`
- Use lowercase directory names: `server/src/services/`, `server/src/routes/`, `web/src/components/`, `web/src/lib/`, `packages/core/src/`, `packages/core/test/`
- Use `__tests__` for colocated test dirs (`server/src/services/__tests__/`, `packages/ui/src/__tests__/`, `packages/ui/src/study/__tests__/`) and `test/` for sibling test dirs (`packages/core/test/`, `packages/server-routes/test/`); test files are `*.test.ts` / `*.test.tsx`
- Use `index.ts` barrels only at package roots and component dirs: `packages/core/src/index.ts`, `packages/ui/src/index.ts`, `web/src/components/index.ts`, `shared/src/index.ts`
- Use camelCase verb-first names for all functions and methods: `chunkSegments`, `countWords`, `cosine`, `topK`, `getEmbedding`, `transcribe`, `convertToWav`, `summarizeLecture`, `extractKeyTerms`, `makeFlashcards`, `answerQuestion`, `groupChunksIntoSections`, `formatTimestamp`, `fetchLecturesWithSource`, `seedDemoLecture` (see `packages/core/src/chunker.ts`, `packages/core/src/vector.ts`, `packages/core/src/pipeline.ts`, `web/src/lib/api.ts`)
- Use `get*` for readers (`getProgress` in `server/src/services/pipelineOrchestrator.ts`, `getLectures` / `getLecture` / `getLectureProgress` / `getQuiz` in `packages/ui/src/api.ts`, `getBox` / `getAllBoxes` / `getStreak` / `getLectureStats` in `packages/ui/src/study/studyStore.ts`), `handle*` for framework-free route handlers (`handlePostLectures`, `handleGetLectures`, `handleGetLectureById`, `handlePostAsk`, `runLectureProcessingJob` in `packages/server-routes/src/handlers.ts`), `probe*` for status checks (`probeGpu`, `probeOllama`, `probeFfmpeg`, `probeEmbeddingThroughput` in `server/src/routes/statusRoutes.ts`), `parse*` for private parsers (`parseTimestampToSeconds`, `parseStdoutFallback` in `server/src/services/whisperService.ts`)
- Use `is*` boolean guards returning type predicates where narrowing matters: `isBackendUnreachableError` in `web/src/lib/api.ts`, `isDayKey` in `packages/ui/src/study/studyStore.ts`
- Use camelCase for locals and properties: `targetWords`, `overlapWords`, `startIdx`, `currentWords`, `validSegments` in `server/src/services/chunkingService.ts` and `packages/core/src/chunker.ts`; `wavPath`, `queryEmbedding`, `topChunks` in `server/src/services/pipelineOrchestrator.ts` and `server/src/routes/qnaRoutes.ts`
- Use SCREAMING_SNAKE_CASE for module constants: `NOT_COVERED_RESPONSE` in `packages/core/src/prompts.ts`, `STORAGE_KEY` in `packages/ui/src/study/studyStore.ts`, `MIN_BOX` / `MAX_BOX` / `MASTERED_BOX` in `packages/ui/src/study/srs.ts`, `FALLBACK_GPU_NAME` / `FALLBACK_VRAM_MB` / `PROBE_TIMEOUT_MS` in `server/src/routes/statusRoutes.ts`, `DEMO_TITLE` / `DEMO_SUMMARY` / `DEMO_SEGMENTS` in `server/src/routes/lectureRoutes.ts`, `PROGRESS_STAGES` in `web/src/lib/api.ts`, `CONFIG` in `server/src/config.ts`
- Use `UPPER_SNAKE` env-derived keys inside the single `CONFIG` object in `server/src/config.ts`: `PORT`, `OLLAMA_BASE_URL`, `OLLAMA_LLM_MODEL`, `OLLAMA_EMBED_MODEL`, `WHISPER_CLI_PATH`, `WHISPER_MODEL_PATH`, `UPLOADS_DIR`, `FFMPEG_CMD`
- Prefix throwaway/compat identifiers explicitly: `_req` for unused Express params in `server/src/index.ts`, `server/src/routes/lectureRoutes.ts`, `server/src/routes/statusRoutes.ts`; `temp-${idx}` for non-persisted DTO ids in `server/src/services/whisperService.ts`
- Use PascalCase for all classes, interfaces, and type aliases; suffix shared wire contracts with `DTO`: `LectureDTO`, `ChunkDTO`, `TranscriptSegmentDTO`, `FlashcardDTO`, `KeyTermDTO`, `JobProgressDTO`, `QnARequestDTO`, `QnAResponseDTO`, `SystemStatusDTO`, `CitationItem` in `shared/src/index.ts`
- Use PascalCase + `Service` / `Client` / `Error` suffixes for behavior classes: `ChunkingService`, `AudioService`, `EmbeddingService`, `WhisperService`, `PipelineOrchestrator` in `server/src/services/`; `OllamaClient`, `WhisperClient`, `LecternApi`, `MockLecternApi` in `packages/core/src/ollama.ts`, `packages/core/src/whisper.ts`, `packages/ui/src/api.ts`, `packages/ui/src/mockApi.ts`; `OllamaError` / `OllamaDownError` / `OllamaModelNotFoundError` / `OllamaTimeoutError` in `packages/core/src/ollama.ts`, `WhisperError` in `packages/core/src/whisper.ts`, `RouteError` in `packages/server-routes/src/handlers.ts`, `BackendUnreachableError` in `web/src/lib/api.ts`, `ApiError` in `packages/ui/src/api.ts`
- Use PascalCase + `Options` / `Params` / `Response` / `Request` for shapes: `ChunkingOptions`, `AudioConversionOptions`, `WhisperOptions`, `EmbeddingOptions` in `server/src/services/`; `OllamaClientOptions`, `ChatParams`, `EmbedParams`, `ChatResponse`, `EmbedResponse`, `PipelineOptions`, `AnswerResult` in `packages/core/src/ollama.ts` and `packages/core/src/pipeline.ts`; `ServerContext`, `PostLecturesRequest`, `PostLecturesResponse` in `packages/server-routes/src/handlers.ts` and `packages/server-routes/src/types.ts`; `ApiClientOptions`, `LecternApiClient` in `packages/ui/src/api.ts`; `SourcedResult<T>`, `SourcedAnswer`, `SystemDiagnostics`, `DataSource` in `web/src/lib/api.ts`
- Use string-literal unions for state machines, never numeric enums: `LectureStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'` and `PipelineStage = 'IDLE' | 'CONVERTING_AUDIO' | ... | 'FAILED'` in `shared/src/index.ts`; `LectureStatus = 'converting' | 'transcribing' | ... | 'failed'` in `packages/ui/src/types.ts`
- Export singletons in lowercase camelCase alongside the class: `chunkingService` in `server/src/services/chunkingService.ts`, `audioService` in `server/src/services/audioService.ts`, `embeddingService` in `server/src/services/embeddingService.ts`, `whisperService` in `server/src/services/whisperService.ts`, `pipelineOrchestrator` in `server/src/services/pipelineOrchestrator.ts`, `defaultOllamaClient` / `defaultWhisperClient` in `packages/core/src/ollama.ts` and `packages/core/src/whisper.ts`, `prisma` in `server/src/db.ts`, `CONFIG` in `server/src/config.ts`

## Code Style

- No formatter is configured — no Prettier, ESLint, or Biome config exists in first-party code (only `node_modules` stubs and `packages/ui/postcss.config.js`, `packages/ui/tailwind.config.js`, `web/tailwind.config.ts`, `web/postcss.config.mjs`, `web/next.config.mjs`). Match the existing style by hand.
- Use single quotes, semicolons, 2-space indentation, and trailing commas in multiline literals. Example from `packages/core/src/vector.ts`:
- Use strict TypeScript everywhere: `"strict": true` in `server/tsconfig.json`, `web/tsconfig.json`, `shared/tsconfig.json`, `packages/core/tsconfig.json`; `packages/core/tsconfig.json` additionally sets `"noImplicitAny": true`. Run `npm run typecheck --workspaces` (root) which covers `server`, `web`, `shared` via `tsc --noEmit`.
- Use ESM (`"type": "module"` in `packages/core/package.json`, `packages/ui/package.json`, `packages/server-routes/package.json`; `"module": "NodeNext"` in `server/tsconfig.json` and `packages/core/tsconfig.json`). Target `ES2022` in `server/tsconfig.json`, `packages/core/tsconfig.json`, `web/tsconfig.json`.
- Prefer `const`, arrow callbacks, template literals, optional chaining (`?.`), nullish coalescing (`??`), and `Array.prototype` helpers over manual loops where the file already does so (see `packages/core/src/pipeline.ts`, `packages/ui/src/study/studyStore.ts`).
- No linter is configured and no `lint` script exists in any `package.json`. Do not add lint-only churn.
- Self-enforce the de-facto rules instead: no `any` without a cast site (`as unknown as OllamaClient` in `packages/server-routes/test/handlers.test.ts` is the accepted escape hatch), no unused imports, `err instanceof Error ? err.message : String(err)` normalization at every catch boundary (see `server/src/services/whisperService.ts`, `server/src/services/audioService.ts`, `packages/core/src/whisper.ts`, `packages/server-routes/src/handlers.ts`).

## Import Organization

- Use `@/*` → `./src/*` only in `web/` (declared in `web/tsconfig.json`). Do not use it in `server/`, `shared/`, or `packages/`.
- Use `@lectern/shared` for all shared DTOs in `server/src/routes/lectureRoutes.ts`, `server/src/routes/qnaRoutes.ts`, `server/src/services/chunkingService.ts`, `web/src/lib/api.ts`, `web/src/components/AskPanel.tsx`
- Use `@lectern/core` only inside `packages/server-routes/src/handlers.ts` (`import { OllamaClient, WhisperClient, chunkSegments, ... } from '@lectern/core'`). `server/` does not import `@lectern/core`; it keeps its own service copies.
- Use explicit `.js` extensions on every relative import in NodeNext code, even though sources are `.ts`. Do this in `server/src/` and `packages/*/src/`:
- Use `node:`-prefixed builtins in newer files; keep the bare specifiers (`fs`, `path`, `child_process`, `util`) only where they already exist (`server/src/services/audioService.ts`, `server/src/services/whisperService.ts`, `server/src/index.ts`). New code uses:
- Use `import type` for types and barrel `export *` for package public API:
- Mark client components with the `'use client'` directive as the first line (see `web/src/components/AppShell.tsx`, `web/src/components/AskPanel.tsx`).

## Error Handling

- Define a typed `Error` subclass per failure domain, set `this.name`, and carry machine-readable fields. Copy these shapes for new errors:
- Normalize caught values with `err instanceof Error ? err.message : String(err)` at every boundary. Use this exact idiom (from `server/src/services/pipelineOrchestrator.ts`):
- Return `{ error, details: String(error) }` JSON from Express routes with the right status (`400` for bad input, `404` for missing rows, `500` for failures). Use this shape (from `server/src/routes/lectureRoutes.ts`):
- Validate request input manually at the top of each handler and return early (no zod/yup in the repo). Follow `server/src/routes/qnaRoutes.ts` and `packages/server-routes/src/handlers.ts`:
- Never let background work throw unhandled: wrap pipeline jobs in try/catch, record `FAILED` state, and swallow the secondary write failure (see `runLectureProcessingJob` in `packages/server-routes/src/handlers.ts` and `runPipeline` in `server/src/services/pipelineOrchestrator.ts`). Launch fire-and-forget work via `queueMicrotask(() => { void runPipeline(...); })` as in `server/src/services/pipelineOrchestrator.ts` (`startPipeline`) and `packages/server-routes/src/handlers.ts` (`handlePostLectures`).
- Never return 500 from `/api/status`: catch everything and answer `200` with safe fallbacks (see `server/src/routes/statusRoutes.ts`):
- Never throw from persistence helpers in `packages/ui/src/study/studyStore.ts`: guard every storage access with `typeof window` checks plus try/catch, sanitize parsed JSON, and fall back to an in-memory shim or safe default. New storage helpers must keep the `// Never throw` contract:
- Degrade to explicit seeded demo data on the frontend instead of failing silently: throw / catch `BackendUnreachableError`, return `SourcedResult<T> = { data, source: 'live' | 'fallback' }`, and surface a toast. Follow `web/src/lib/api.ts`:
- Time out every outbound `fetch` with `AbortSignal.timeout(...)` (`30000` for embeds in `server/src/services/embeddingService.ts`, `60000` for chat in `server/src/routes/qnaRoutes.ts`, `120000` for pipeline LLM calls in `server/src/services/pipelineOrchestrator.ts`, `PROBE_TIMEOUT_MS = 2000` for status probes in `server/src/routes/statusRoutes.ts`). Wrap `OllamaClient` calls in the built-in retry helper `executeWithRetry` in `packages/core/src/ollama.ts` (retry 5xx with linear backoff, never retry 404 — throw `OllamaModelNotFoundError` immediately).

## Logging

- Use `console.log` only for startup lines in `server/src/index.ts`:
- Use `console.warn` for recoverable degradation (pipeline continues): summarization warning in `server/src/services/pipelineOrchestrator.ts`, upload-to-simulation fallback in `web/src/lib/api.ts`:
- Use `console.error` for terminal step failure or UI data-load failure: `[Pipeline Error]` in `server/src/services/pipelineOrchestrator.ts`, `'Failed to load lecture detail:'` in `packages/ui/src/dev/App.tsx`, `'Error polling progress:'` in `packages/ui/src/components/UploadPanel.tsx`.
- Prefix backend logs with a bracketed tag (`[Lectern Server]`, `[Pipeline]`, `[Pipeline Error]`, `[Lectern API]`) and include the `lectureId` or endpoint in the message. Do not log secrets: env files (`web/.env.local` present, gitignored via `.gitignore`) are read only through `server/src/config.ts` (`dotenv.config()` + `process.env` defaults) and never printed.
- Swallow expected cleanup/parse noise silently with an annotated empty catch (`// ignore`, `// ignore cleanup errors`, `// ignore parse error`, `// Continue even if flashcard extraction fails`) as in `server/src/services/whisperService.ts`, `server/src/services/embeddingService.ts`, `server/src/services/pipelineOrchestrator.ts`, `packages/ui/src/mockApi.ts`.

## Comments

- Document every public service method with a `/** ... */` block stating contract, units, and side effects (stages, word budgets, formats). Follow `server/src/services/audioService.ts`, `server/src/services/chunkingService.ts`, `server/src/services/whisperService.ts`:
- Add module-header comments for purity and environment contracts that callers must respect (`packages/ui/src/study/srs.ts`, `packages/ui/src/study/studyStore.ts`):
- Explain degraded-mode and non-obvious branches inline: `// Never throw 500: status must always answer 200 with safe fallbacks.` in `server/src/routes/statusRoutes.ts`, `// Network failure — explicit seeded fallback below, never silent.` in `web/src/lib/api.ts`, `// Clamp between -1 and 1 to eliminate floating-point precision artifacts` in `packages/core/src/vector.ts`.
- Keep `TODO`-style markers out: no `TODO`/`FIXME`/`HACK` convention exists in first-party sources; file tracked work instead of inline markers.
- Use `/** */` for exported functions, classes, and methods; include units (`// in seconds` on DTO time fields in `shared/src/index.ts`) and stage/percent contracts (`JobProgressDTO.progressPercent // 0 - 100`).
- Do not add `@param`/`@returns` tags — the repo documents intent and constraints in prose, with types carrying the rest (see `packages/core/src/whisper.ts`, `packages/ui/src/mockApi.ts`, `packages/ui/src/types.ts` field comments like `/** Seconds into the lecture audio this card came from. ... */`).

## Function Design

- Destructure shared config at call time with `??` fallbacks (`ctx.chatModel ?? 'qwen2.5:7b'`, `ctx.embedModel ?? 'nomic-embed-text:latest'` in `packages/server-routes/src/handlers.ts`; `options.targetWords ?? 250` in `packages/core/src/chunker.ts`).

## Module Design

- Export Express routers as named consts (`export const lectureRouter`, `export const qnaRouter`, `export const statusRouter`) and mount them in `server/src/index.ts` under `/api/status`, `/api/lectures`, `/api/qna`.
- Export React components as named function exports (`export function AskPanel`, `export function AppShell`, `export function OfflineBadge`) and re-export them from `web/src/components/index.ts`. Keep component `Props`/`type Props` local to the file (see `web/src/components/AskPanel.tsx`, `web/src/components/AppShell.tsx`).
- Keep one concept per file: `chunker.ts` (chunking), `vector.ts` (similarity), `prompts.ts` (prompt builders + `NOT_COVERED_RESPONSE`), `schemas.ts` (JSON schemas as `as const`), `pipeline.ts` (orchestration), `types.ts` (shapes) in `packages/core/src/`.

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Express bootstrap | Create app, ensure uploads dir, mount routers, serve `/uploads`, listen on `CONFIG.PORT` | `server/src/index.ts` |
| Runtime config | Resolve `PORT`, Ollama URLs/models, whisper paths, `UPLOADS_DIR`, `FFMPEG_CMD` from env with local defaults | `server/src/config.ts` |
| Prisma singleton | Export one `PrismaClient`, cache on `globalThis` in non-production | `server/src/db.ts` |
| Lecture routes | Multipart upload, demo seed, list/detail/delete, progress proxy | `server/src/routes/lectureRoutes.ts` |
| Q&A routes | Embed query, retrieve top-K chunks, prompt Ollama chat, shape grounded citations | `server/src/routes/qnaRoutes.ts` |
| Status routes | Probe `nvidia-smi`, Ollama `/api/tags`, `ffmpeg -version`, embedding throughput; always return 200 | `server/src/routes/statusRoutes.ts` |
| Pipeline orchestrator | Run 7-stage background pipeline, track in-memory progress, map-reduce summarization, study-aid extraction | `server/src/services/pipelineOrchestrator.ts` |
| Audio service | Normalize any upload to 16 kHz mono 16-bit PCM WAV via `ffmpeg` subprocess | `server/src/services/audioService.ts` |
| Whisper service | Execute `whisper-cli` with CUDA flags, parse JSON/stdout timestamps, persist `TranscriptSegment` rows | `server/src/services/whisperService.ts` |
| Chunking service | Group segments into ~250-word overlapping chunks preserving `startTime` for citations | `server/src/services/chunkingService.ts` |
| Embedding service | Call Ollama `/api/embed`, persist `embeddingJson`, brute-force cosine `findTopK` across SQLite rows | `server/src/services/embeddingService.ts` |
| Shared DTOs | Define `LectureDTO`, `ChunkDTO`, `QnARequestDTO`, `QnAResponseDTO`, `SystemStatusDTO`, `JobProgressDTO`, `PipelineStage` | `shared/src/index.ts` |
| Frontend API client | Typed `fetch` wrappers, `BackendUnreachableError`, seeded `FALLBACK_LECTURES`, local answer builder, progress simulation | `web/src/lib/api.ts` |
| App shell | Sidebar layout, global fallback toast on `lectern:backend-fallback`, GPU status pill polling `/api/status` | `web/src/components/AppShell.tsx` |
| Sidebar | Desktop persistent + mobile drawer nav (`/`, `/lectures`, `/ask`, `/settings`), offline-ready footer card | `web/src/components/AppSidebar.tsx` |
| Intake modal | Upload-file and live-record (`MediaRecorder`) tabs, `FormData` POST, route to workspace | `web/src/components/IntakeModal.tsx` |
| Lecture workspace | 4-tab study UI (summary/transcript/flashcards/keyTerms), audio player with speech fallback, polling stepper, Markdown/Anki/print export | `web/src/components/LectureWorkspace.tsx` |
| Q&A surfaces | Full-page chat with citation accordions and deep links | `web/src/app/ask/page.tsx` |
| Embedded Q&A widget | Compact embeddable chat with citation chips and `onCitationClick` seek callback | `web/src/components/QnAChat.tsx` |
| SRS study circuit | Spaced-repetition deck/quiz players, Leitner boxes in `localStorage`, streak tracking | `packages/ui/src/study/DeckPlayer.tsx` |
| Pure pipeline library | Testable Ollama/chunker/vector/summarize/Q&A helpers, no Express or Prisma imports | `packages/core/src/pipeline.ts` |

## Pattern Overview

- Upload returns fast; heavy AI work runs as a fire-and-forget background task polled by the client.
- No ORM-to-vector extension: embeddings are `JSON.stringify`'d 768-dim arrays in SQLite; retrieval is JS cosine sort in the API process.
- No cloud SDKs: whisper.cpp is a child process, Ollama is plain `fetch` to `http://localhost:11434`, FFmpeg is a child process.
- Frontend degrades to explicit seeded data (`FALLBACK_LECTURES`) via a typed error, never a silent empty state.
- Single shared type package (`@lectern/shared`) is the only cross-tier import allowed by the workspace.

## Layers

- Purpose: Parse multipart/JSON input, enforce shape checks, map Prisma rows to DTOs.
- Location: `server/src/routes/lectureRoutes.ts`, `server/src/routes/qnaRoutes.ts`, `server/src/routes/statusRoutes.ts`
- Contains: `multer` storage config, `toPublicAudioPath` mapping, prompt assembly, status probes.
- Depends on: `server/src/db.ts`, `server/src/config.ts`, service singletons, `@lectern/shared` types.
- Used by: Next.js rewrite proxy in `web/next.config.mjs`, direct `fetch('/api/...')` calls in `web/src/lib/api.ts`.
- Purpose: Own the 7-stage lecture lifecycle and progress state machine.
- Location: `server/src/services/pipelineOrchestrator.ts`
- Contains: `runPipeline()`, `startPipeline()` via `queueMicrotask`, `summarizeLectureWithOllama()`, `extractStudyAids()`, in-memory `progressMap`.
- Depends on: `server/src/services/audioService.ts`, `server/src/services/whisperService.ts`, `server/src/services/chunkingService.ts`, `server/src/services/embeddingService.ts`, `server/src/db.ts`.
- Used by: `server/src/routes/lectureRoutes.ts`.
- Purpose: Wrap one external capability each (FFmpeg, whisper-cli, chunking math, Ollama embeddings) with a small class + exported singleton.
- Location: `server/src/services/audioService.ts`, `server/src/services/whisperService.ts`, `server/src/services/chunkingService.ts`, `server/src/services/embeddingService.ts`
- Contains: `convertToWav()`, `transcribe()`, `chunkSegments()`, `getEmbedding()` / `generateAndSaveEmbeddings()` / `findTopK()` / `cosineSimilarity()`.
- Depends on: `server/src/config.ts` for binary paths and model names, `server/src/db.ts` for persistence where needed.
- Used by: `server/src/services/pipelineOrchestrator.ts` and `server/src/routes/qnaRoutes.ts`.
- Purpose: Durable lecture graph in a local file database.
- Location: `server/prisma/schema.prisma`, `server/src/db.ts`, `server/prisma/dev.db`
- Contains: `Lecture`, `TranscriptSegment`, `Chunk`, `Flashcard`, `KeyTerm` models with cascade deletes and `@@index([lectureId])`.
- Depends on: Prisma Client codegen (`@prisma/client`).
- Used by: All routes and all persisting services.
- Purpose: Single source of truth for cross-tier shapes and stage enums.
- Location: `shared/src/index.ts`, built to `shared/dist/`
- Contains: `LectureDTO`, `TranscriptSegmentDTO`, `ChunkDTO`, `FlashcardDTO`, `KeyTermDTO`, `JobProgressDTO`, `CitationItem`, `QnARequestDTO`, `QnAResponseDTO`, `SystemStatusDTO`, `LectureStatus`, `PipelineStage`.
- Depends on: Nothing (zero runtime imports).
- Used by: Every file in `server/src/` and `web/src/` that touches lectures, progress, Q&A, or status.
- Purpose: Route-level composition and navigation chrome.
- Location: `web/src/app/layout.tsx`, `web/src/app/page.tsx`, `web/src/app/lectures/page.tsx`, `web/src/app/lectures/[id]/page.tsx`, `web/src/app/ask/page.tsx`, `web/src/app/study/[id]/page.tsx`, `web/src/app/settings/page.tsx`
- Contains: `'use client'` pages, `Suspense` wrappers for `useSearchParams`, per-page data fetching.
- Depends on: `web/src/lib/api.ts`, `web/src/components/AppShell.tsx`, `web/src/components/AppSidebar.tsx`.
- Used by: Next.js App Router directly.
- Purpose: Reusable study UI and resilient backend access with offline fallback.
- Location: `web/src/components/`, `web/src/lib/api.ts`
- Contains: `LectureWorkspace.tsx`, `IntakeModal.tsx`, `AudioUploader.tsx`, `AudioRecorder.tsx`, `QnAChat.tsx`, `PipelineProgress.tsx`, `TranscriptViewer.tsx`, `FlashcardDeck.tsx`, `FALLBACK_LECTURES`, `BackendUnreachableError`.
- Depends on: `@lectern/shared` types only (plus `lucide-react` for icons).
- Used by: All files in `web/src/app/`.
- Purpose: Independently testable pipeline math and study-system UI outside the live `server/` + `web/` runtime.
- Location: `packages/core/src/`, `packages/server-routes/src/`, `packages/ui/src/`
- Contains: `packages/core/src/pipeline.ts`, `packages/core/src/chunker.ts`, `packages/core/src/vector.ts`, `packages/core/src/ollama.ts`, `packages/ui/src/study/DeckPlayer.tsx`, `packages/ui/src/study/studyStore.ts`, `packages/ui/src/study/srs.ts`.
- Depends on: Local types in `packages/core/src/types.ts` and `packages/ui/src/types.ts`.
- Used by: `web/src/app/study/[id]/page.tsx` imports `packages/ui/src/study/DeckPlayer.tsx` via a relative path; `web/src/app/layout.tsx` imports `packages/ui/src/study/study.css` via a relative path. Otherwise isolated.

## Data Flow

### Primary Request Path — Upload → Completed Lecture

### Secondary Flow — Cross-Lecture Grounded Q&A

### Status / Diagnostics Flow

- Server pipeline progress lives in a process-local `Map<string, JobProgressDTO>` in `server/src/services/pipelineOrchestrator.ts:11`; use `getProgress()` in `server/src/services/pipelineOrchestrator.ts:16` and `updateProgress()` in `server/src/services/pipelineOrchestrator.ts:58`. Treat it as ephemeral: a restart loses in-flight percentages and `GET /:id/progress` falls back to the coarse DB-derived `PROCESSING 50%` branch.
- Durable state lives in SQLite (`server/prisma/schema.prisma:10`): `Lecture.status` (`PENDING | PROCESSING | COMPLETED | FAILED`) is the source of truth; segments/chunks/cards/terms are rewritten per run with `deleteMany` + `create`.
- Frontend keeps no global store: per-page `useState` + `useEffect` polling (`web/src/app/page.tsx:49`, `web/src/components/PipelineProgress.tsx:57`, `web/src/components/LectureWorkspace.tsx:235`), `URL.createObjectURL` previews for recordings (`web/src/components/IntakeModal.tsx:157`), `localStorage` only for theme (`web/src/app/layout.tsx:21`, `web/src/app/settings/page.tsx:61`) and SRS boxes/streaks (`packages/ui/src/study/studyStore.ts`, consumed in `web/src/app/study/[id]/page.tsx:14`).
- Cross-component fallback signaling uses a DOM `CustomEvent('lectern:backend-fallback')` dispatched in `web/src/lib/api.ts:56` and consumed in `web/src/components/AppShell.tsx:21`.

## Key Abstractions

- Purpose: The unit of ingestion, study, and deletion; owns every derived artifact.
- Examples: `server/prisma/schema.prisma:10`, `shared/src/index.ts:46`
- Pattern: Prisma parent with `onDelete: Cascade` children (`segments`, `chunks`, `flashcards`, `keyTerms`); DTO projection in `server/src/routes/lectureRoutes.ts:210` and `server/src/routes/lectureRoutes.ts:244`.
- Purpose: Segments preserve ASR timing; chunks preserve retrieval context plus citation timing.
- Examples: `server/prisma/schema.prisma:26`, `server/prisma/schema.prisma:38`, `server/src/services/chunkingService.ts:19`, `shared/src/index.ts:14`
- Pattern: Use segments for the transcript UI (`web/src/components/LectureWorkspace.tsx:881`); use chunks for embeddings and Q&A; never embed raw segments directly — always go through `chunkSegments()` first.
- Purpose: One configured instance per capability, constructed from `CONFIG` with override-friendly constructors.
- Examples: `server/src/services/audioService.ts:66`, `server/src/services/whisperService.ts:223`, `server/src/services/chunkingService.ts:103`, `server/src/services/embeddingService.ts:167`, `server/src/services/pipelineOrchestrator.ts:387`
- Pattern: `export class XService` + `export const xService = new XService()`; import the singleton in routes/orchestrator; pass `options` overrides only in tests (`server/src/services/__tests__/services.test.ts:1`).
- Purpose: Every generated sentence traces to a stored chunk timestamp.
- Examples: `shared/src/index.ts:69`, `server/src/routes/qnaRoutes.ts:94`, `web/src/app/ask/page.tsx:248`
- Pattern: Carry `lectureId` + `lectureTitle` + `startTime`/`endTime` + `textSnippet` + `similarity` end to end; format display labels as `[Title, mm:ss]`; link citations to `?tab=transcript&t=`.
- Purpose: Make offline degradation explicit at the type level.
- Examples: `web/src/lib/api.ts:10`, `web/src/lib/api.ts:23`, `web/src/lib/api.ts:365`, `web/src/lib/api.ts:557`, `web/src/lib/api.ts:740`
- Pattern: Prefer `*WithSource()` variants returning `SourcedResult<T>` with `source: 'live' | 'fallback'`; throw `BackendUnreachableError` when callers must opt into `getFallbackLectures()` / `getFallbackLecture()` / `buildLocalAnswer()`; surface a toast via `notifyBackendFallback()`.

## Entry Points

- Location: `server/src/index.ts`
- Triggers: `npm run dev:server` (`server/package.json:7` via `tsx watch src/index.ts`), `npm run dev` (root `package.json:13` runs server + web concurrently).
- Responsibilities: Ensure `uploads/` exists, enable CORS + JSON body parsing, mount `/api/status` + `/api/lectures` + `/api/qna`, serve `/uploads` statically, answer `GET /health`, listen on port 5000.
- Location: `web/src/app/layout.tsx`, `web/src/app/page.tsx`
- Triggers: `npm run dev:web` (`web/package.json:6` via `next dev -p 3000`), browser navigation to `/`, `/lectures`, `/lectures/[id]`, `/ask`, `/study/[id]`, `/settings`.
- Responsibilities: Wrap every route in `AppShell` + `AppSidebar`; rewrite `/api/*` and `/uploads/*` to the Express origin (`web/next.config.mjs:3`).
- Location: `web/src/components/IntakeModal.tsx`, `web/src/components/AudioUploader.tsx`, `web/src/components/AudioRecorder.tsx`
- Triggers: "Add lecture" buttons in `web/src/app/page.tsx:205` and `web/src/app/lectures/page.tsx:97`.
- Responsibilities: Collect title + file or `MediaRecorder` blob; POST to the API; navigate to `/lectures/<id>` for progress display.
- Location: `web/src/app/ask/page.tsx`, `web/src/components/QnAChat.tsx`, `web/src/components/AskPanel.tsx`
- Triggers: `/ask` route, "Ask question about lecture" link in `web/src/components/LectureWorkspace.tsx:532`, embedded panels.
- Responsibilities: Send question JSON, render answer + citation chips, deep-link to transcript timestamps.
- Location: `web/src/app/settings/page.tsx`, `web/src/components/AppShell.tsx:87`
- Triggers: `/settings` route load (10 s poll) and shell mount (30 s poll).
- Responsibilities: Render GPU/whisper/Ollama/FFmpeg health from `SystemStatusDTO`.
- Location: `scripts/seed-demo.ts`, `scripts/try-pipeline.ts`, `scripts/benchmark.ts`, `scripts/audit-offline.ts`
- Triggers: Manual `tsx` runs (e.g. `npm --workspace=server run seed:demo` in `server/package.json:14`).
- Responsibilities: Seed or exercise the pipeline outside the HTTP path; use these for local verification, not for serving traffic.

## Architectural Constraints

- **Threading:** Single Node.js event loop per tier. Long AI work never blocks a request: `startPipeline()` in `server/src/services/pipelineOrchestrator.ts:380` defers via `queueMicrotask` and all subprocess/HTTP calls are async. Do not add synchronous `execFileSync` or blocking loops to request handlers.
- **Global state:** One Prisma singleton in `server/src/db.ts:7`; one `progressMap` in `server/src/services/pipelineOrchestrator.ts:11`; one `CONFIG` object in `server/src/config.ts:8`. Do not create additional `PrismaClient` instances — import `prisma` from `server/src/db.ts`.
- **Circular imports:** None. Allowed direction is routes → orchestrator → services → `config`/`db`; `shared/` imports nothing. Do not import from `server/src/routes/` inside `server/src/services/`.
- **Localhost coupling:** Backend assumes FFmpeg on `PATH`, whisper binary + weights on disk, and Ollama on `http://localhost:11434` (see `server/src/config.ts:11`). The web tier assumes the API at `http://localhost:5000` via `web/next.config.mjs:7`. Do not hardcode alternate hosts inside services — extend `CONFIG` and `SystemStatusDTO` instead.
- **No auth / no multi-tenancy:** Any local caller can list, read, and delete any lecture (`server/src/routes/lectureRoutes.ts:193`, `server/src/routes/lectureRoutes.ts:281`). Do not treat `lectureId` as a capability; add an auth layer before exposing beyond localhost.
- **SQLite + file storage:** Uploads live in `uploads/` (served by `server/src/index.ts:22`); derived WAVs and whisper JSON siblings live next to the upload. Deleting a lecture row does not delete audio files — handle file cleanup explicitly when adding retention logic.
- **Embedding scale ceiling:** `findTopK()` in `server/src/services/embeddingService.ts:131` loads every `Chunk` row and parses every vector per question. Keep this for the current single-user scale; move to a vector index before supporting large libraries.

## Anti-Patterns

### Fire-and-forget upload fallback that invents a lecture

### Bypassing the workspace boundary with deep relative imports

### In-memory progress as the only live signal

### Sequential per-chunk embedding loop

## Error Handling

- Return `400` for missing input (`server/src/routes/lectureRoutes.ts:122`, `server/src/routes/qnaRoutes.ts:18`), `404` for unknown lecture (`server/src/routes/lectureRoutes.ts:239`), `500 { error, details: String(error) }` for unexpected failures in every route handler.
- Wrap each pipeline stage in the single `try/catch` in `server/src/services/pipelineOrchestrator.ts:364`: on error update `Lecture.status = 'FAILED'` (with a nested `.catch(() => {})`) and `updateProgress(lectureId, 'FAILED', 0, ..., errorMsg)`. Keep study-aid sub-steps internally tolerant (`server/src/services/pipelineOrchestrator.ts:259`, `server/src/services/pipelineOrchestrator.ts:303`) so a flashcard JSON failure cannot fail the lecture.
- Validate subprocess preconditions with explicit messages before spawning: missing input (`server/src/services/audioService.ts:26`), missing whisper binary/model/wav (`server/src/services/whisperService.ts:84`), empty FFmpeg output (`server/src/services/audioService.ts:58`).
- Use `AbortSignal.timeout()` on every Ollama call: 30 s for embeddings (`server/src/services/embeddingService.ts:34`), 60 s for Q&A chat (`server/src/routes/qnaRoutes.ts:77`), 120 s for summarization/study aids (`server/src/services/pipelineOrchestrator.ts:123`).
- Degrade reads, not writes: `statusRouter.get('/')` in `server/src/routes/statusRoutes.ts:131` catches all probe failures and returns 200 with `fallbackStatus()`; frontend `*WithSource()` helpers in `web/src/lib/api.ts:365`, `web/src/lib/api.ts:557`, `web/src/lib/api.ts:740` return seeded data with `source: 'fallback'` and dispatch `lectern:backend-fallback` for the toast in `web/src/components/AppShell.tsx:21`.

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-fast` for a trivial task inline, with no subagents and no PLAN.md
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
