---
last_mapped_commit: 15310b9043b62a1f115f333f51535da622f0d098
last_mapped_at: 2026-10-09
---
<!-- refreshed: 2026-10-09 -->

# Architecture

**Analysis Date:** 2026-10-09

## System Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js 15 Frontend (`web/`)                  │
├──────────────────┬──────────────────┬───────────────────────────┤
│   Intake &       │   Study          │   Cross-Lecture Q&A       │
│   Library Pages  │   Workspace      │   Chat                    │
│  `web/src/app/   │  `web/src/       │   `web/src/app/ask/       │
│   page.tsx`      │   components/    │    page.tsx`              │
│  `web/src/       │   LectureWork-   │   `web/src/components/    │
│   components/    │   space.tsx`     │    QnAChat.tsx`           │
│   IntakeModal.   │                  │                           │
│   tsx`           │                  │                           │
└────────┬─────────┴────────┬─────────┴────────────┬──────────────┘
         │  Next.js rewrites│                      │
         │  `web/next.      │                      │
         │   config.mjs:3`  │                      │
         ▼                  ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              Express 4 API (`server/src/index.ts`)              │
│  `/api/lectures`  │  `/api/qna`  │  `/api/status`  │ `/uploads` │
│  `server/src/routes/lectureRoutes.ts` │ `server/src/routes/     │
│                                       │  qnaRoutes.ts`          │
└────────┬──────────────────────────────┬─────────────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────────────────────┐  ┌────────────────────────────┐
│  Pipeline Orchestrator          │  │  Retrieval (Q&A)           │
│  `server/src/services/          │  │  `server/src/services/     │
│   pipelineOrchestrator.ts`      │  │   embeddingService.ts`     │
│  `server/src/services/          │  │                            │
│   audioService.ts`              │  │                            │
│  `server/src/services/          │  │                            │
│   whisperService.ts`            │  │                            │
│  `server/src/services/          │  │                            │
│   chunkingService.ts`           │  │                            │
└────────┬────────────────────────┘  └─────────────┬──────────────┘
         │                                         │
         ▼                                         ▼
┌─────────────────────────────────┐  ┌────────────────────────────┐
│  SQLite via Prisma              │  │  Local AI Runtimes (HTTP + │
│  `server/prisma/schema.prisma`  │  │  subprocess, no SDK)       │
│  `server/src/db.ts`             │  │  `tools/whisper/Release/`  │
│  `server/prisma/dev.db`         │  │  `models/`                 │
│                                 │  │  Ollama `http://localhost: │
│                                 │  │  11434` (`server/src/      │
│                                 │  │  config.ts`)               │
└─────────────────────────────────┘  └────────────────────────────┘
```

Shared contract layer underneath both tiers: `shared/src/index.ts` (`@lectern/shared`).

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

**Overall:** Offline-first monorepo with a layered Express pipeline orchestrator + Next.js App Router frontend + shared DTO contract + local-process AI backends. Thin controllers delegate to injected singleton services; one stateful orchestrator sequences subprocess and HTTP calls.

**Key Characteristics:**
- Upload returns fast; heavy AI work runs as a fire-and-forget background task polled by the client.
- No ORM-to-vector extension: embeddings are `JSON.stringify`'d 768-dim arrays in SQLite; retrieval is JS cosine sort in the API process.
- No cloud SDKs: whisper.cpp is a child process, Ollama is plain `fetch` to `http://localhost:11434`, FFmpeg is a child process.
- Frontend degrades to explicit seeded data (`FALLBACK_LECTURES`) via a typed error, never a silent empty state.
- Single shared type package (`@lectern/shared`) is the only cross-tier import allowed by the workspace.

## Layers

**HTTP API layer:**
- Purpose: Parse multipart/JSON input, enforce shape checks, map Prisma rows to DTOs.
- Location: `server/src/routes/lectureRoutes.ts`, `server/src/routes/qnaRoutes.ts`, `server/src/routes/statusRoutes.ts`
- Contains: `multer` storage config, `toPublicAudioPath` mapping, prompt assembly, status probes.
- Depends on: `server/src/db.ts`, `server/src/config.ts`, service singletons, `@lectern/shared` types.
- Used by: Next.js rewrite proxy in `web/next.config.mjs`, direct `fetch('/api/...')` calls in `web/src/lib/api.ts`.

**Orchestration layer:**
- Purpose: Own the 7-stage lecture lifecycle and progress state machine.
- Location: `server/src/services/pipelineOrchestrator.ts`
- Contains: `runPipeline()`, `startPipeline()` via `queueMicrotask`, `summarizeLectureWithOllama()`, `extractStudyAids()`, in-memory `progressMap`.
- Depends on: `server/src/services/audioService.ts`, `server/src/services/whisperService.ts`, `server/src/services/chunkingService.ts`, `server/src/services/embeddingService.ts`, `server/src/db.ts`.
- Used by: `server/src/routes/lectureRoutes.ts`.

**Domain service layer:**
- Purpose: Wrap one external capability each (FFmpeg, whisper-cli, chunking math, Ollama embeddings) with a small class + exported singleton.
- Location: `server/src/services/audioService.ts`, `server/src/services/whisperService.ts`, `server/src/services/chunkingService.ts`, `server/src/services/embeddingService.ts`
- Contains: `convertToWav()`, `transcribe()`, `chunkSegments()`, `getEmbedding()` / `generateAndSaveEmbeddings()` / `findTopK()` / `cosineSimilarity()`.
- Depends on: `server/src/config.ts` for binary paths and model names, `server/src/db.ts` for persistence where needed.
- Used by: `server/src/services/pipelineOrchestrator.ts` and `server/src/routes/qnaRoutes.ts`.

**Persistence layer:**
- Purpose: Durable lecture graph in a local file database.
- Location: `server/prisma/schema.prisma`, `server/src/db.ts`, `server/prisma/dev.db`
- Contains: `Lecture`, `TranscriptSegment`, `Chunk`, `Flashcard`, `KeyTerm` models with cascade deletes and `@@index([lectureId])`.
- Depends on: Prisma Client codegen (`@prisma/client`).
- Used by: All routes and all persisting services.

**Shared contract layer:**
- Purpose: Single source of truth for cross-tier shapes and stage enums.
- Location: `shared/src/index.ts`, built to `shared/dist/`
- Contains: `LectureDTO`, `TranscriptSegmentDTO`, `ChunkDTO`, `FlashcardDTO`, `KeyTermDTO`, `JobProgressDTO`, `CitationItem`, `QnARequestDTO`, `QnAResponseDTO`, `SystemStatusDTO`, `LectureStatus`, `PipelineStage`.
- Depends on: Nothing (zero runtime imports).
- Used by: Every file in `server/src/` and `web/src/` that touches lectures, progress, Q&A, or status.

**Frontend shell + page layer:**
- Purpose: Route-level composition and navigation chrome.
- Location: `web/src/app/layout.tsx`, `web/src/app/page.tsx`, `web/src/app/lectures/page.tsx`, `web/src/app/lectures/[id]/page.tsx`, `web/src/app/ask/page.tsx`, `web/src/app/study/[id]/page.tsx`, `web/src/app/settings/page.tsx`
- Contains: `'use client'` pages, `Suspense` wrappers for `useSearchParams`, per-page data fetching.
- Depends on: `web/src/lib/api.ts`, `web/src/components/AppShell.tsx`, `web/src/components/AppSidebar.tsx`.
- Used by: Next.js App Router directly.

**Frontend component + client-service layer:**
- Purpose: Reusable study UI and resilient backend access with offline fallback.
- Location: `web/src/components/`, `web/src/lib/api.ts`
- Contains: `LectureWorkspace.tsx`, `IntakeModal.tsx`, `AudioUploader.tsx`, `AudioRecorder.tsx`, `QnAChat.tsx`, `PipelineProgress.tsx`, `TranscriptViewer.tsx`, `FlashcardDeck.tsx`, `FALLBACK_LECTURES`, `BackendUnreachableError`.
- Depends on: `@lectern/shared` types only (plus `lucide-react` for icons).
- Used by: All files in `web/src/app/`.

**Auxiliary pure-logic packages (not in npm workspaces):**
- Purpose: Independently testable pipeline math and study-system UI outside the live `server/` + `web/` runtime.
- Location: `packages/core/src/`, `packages/server-routes/src/`, `packages/ui/src/`
- Contains: `packages/core/src/pipeline.ts`, `packages/core/src/chunker.ts`, `packages/core/src/vector.ts`, `packages/core/src/ollama.ts`, `packages/ui/src/study/DeckPlayer.tsx`, `packages/ui/src/study/studyStore.ts`, `packages/ui/src/study/srs.ts`.
- Depends on: Local types in `packages/core/src/types.ts` and `packages/ui/src/types.ts`.
- Used by: `web/src/app/study/[id]/page.tsx` imports `packages/ui/src/study/DeckPlayer.tsx` via a relative path; `web/src/app/layout.tsx` imports `packages/ui/src/study/study.css` via a relative path. Otherwise isolated.

## Data Flow

### Primary Request Path — Upload → Completed Lecture

1. Intake POSTs multipart audio (`web/src/components/IntakeModal.tsx:239`, `web/src/components/AudioUploader.tsx:107`, `web/src/lib/api.ts:418`)
   - Build `FormData` with `file` + `title`; `fetch('/api/lectures', { method: 'POST', body: formData })` hits the Next.js rewrite (`web/next.config.mjs:5`).
2. Express stores file and fires background job (`server/src/routes/lectureRoutes.ts:120`, `server/src/routes/lectureRoutes.ts:132`, `server/src/routes/lectureRoutes.ts:141`)
   - `multer.diskStorage` writes to `CONFIG.UPLOADS_DIR` with `${Date.now()}_${rand}${ext}` (`server/src/routes/lectureRoutes.ts:103`); create `Lecture` row with `status: 'PROCESSING'`; call `pipelineOrchestrator.startPipeline(lecture.id, req.file.path)`; return `201 { id, success: true }`.
3. Orchestrator marks PROCESSING and converts audio (`server/src/services/pipelineOrchestrator.ts:311`, `server/src/services/pipelineOrchestrator.ts:320`, `server/src/services/audioService.ts:25`)
   - `updateProgress(lectureId, 'CONVERTING_AUDIO', 15, ...)`; run `ffmpeg -y -i <input> -ar 16000 -ac 1 -c:a pcm_s16le <out>.wav` via `execFile`.
4. Transcribe with GPU whisper-cli (`server/src/services/pipelineOrchestrator.ts:324`, `server/src/services/whisperService.ts:76`)
   - Args `-m <model> -f <wav> -dev 0 -fa -oj -of <prefix>` (`server/src/services/whisperService.ts:99`); parse `<prefix>.json` `transcription[]` offsets/timestamps (`server/src/services/whisperService.ts:130`); fall back to stdout regex (`server/src/services/whisperService.ts:55`); `deleteMany` + `create` `TranscriptSegment` rows (`server/src/services/whisperService.ts:187`); update `Lecture.duration` (`server/src/services/pipelineOrchestrator.ts:327`).
5. Chunk for retrieval (`server/src/services/pipelineOrchestrator.ts:334`, `server/src/services/chunkingService.ts:19`)
   - Pure function groups segments to `targetWords: 250` with `overlapWords: 40`; each chunk keeps `startTime`/`endTime` of its slice for citations; IDs are `${lectureId}-chunk-${n}` (in-memory only at this stage).
6. Embed and persist vectors (`server/src/services/pipelineOrchestrator.ts:338`, `server/src/services/embeddingService.ts:63`, `server/src/services/embeddingService.ts:23`)
   - `deleteMany` prior `Chunk` rows; loop chunks calling Ollama `POST /api/embed { model, input }`; store `embeddingJson: JSON.stringify(vector)` per row (`server/src/services/embeddingService.ts:80`).
7. Map-reduce summarize (`server/src/services/pipelineOrchestrator.ts:342`, `server/src/services/pipelineOrchestrator.ts:78`)
   - Group chunks into ~1500-word sections; single section → one `POST /api/chat` call; multi-section → per-section map calls + final reduce call; write `Lecture.summary`.
8. Extract flashcards + key terms (`server/src/services/pipelineOrchestrator.ts:355`, `server/src/services/pipelineOrchestrator.ts:209`)
   - Two `POST /api/chat` calls with `format: 'json'`; `JSON.parse` message content; `deleteMany` + capped `create` (12 cards, 15 terms); swallow per-section errors so study aids never fail the lecture.
9. Mark COMPLETED (`server/src/services/pipelineOrchestrator.ts:358`)
   - Update `Lecture.status = 'COMPLETED'`; `updateProgress(lectureId, 'COMPLETED', 100, ...)`.
10. Client polls to completion (`web/src/components/PipelineProgress.tsx:60`, `web/src/lib/api.ts:524`, `server/src/routes/lectureRoutes.ts:182`, `server/src/services/pipelineOrchestrator.ts:16`)
    - `fetchProgress(lectureId)` → `GET /api/lectures/:id/progress` → `pipelineOrchestrator.getProgress()` (memory first, then DB fallback); on `COMPLETED` re-fetch `GET /api/lectures/:id` and render `web/src/components/LectureWorkspace.tsx`.

### Secondary Flow — Cross-Lecture Grounded Q&A

1. User submits question (`web/src/app/ask/page.tsx:76`, `web/src/components/QnAChat.tsx:52`, `web/src/lib/api.ts:557`)
   - `askQuestionWithSource(question)` POSTs `{ question }` to `/api/qna`.
2. Embed the query (`server/src/routes/qnaRoutes.ts:25`, `server/src/services/embeddingService.ts:23`)
   - `embeddingService.getEmbedding(question)` calls Ollama `/api/embed` with `CONFIG.OLLAMA_EMBED_MODEL`.
3. Retrieve top-K chunks by brute-force cosine (`server/src/routes/qnaRoutes.ts:28`, `server/src/services/embeddingService.ts:131`, `server/src/services/embeddingService.ts:106`)
   - Load all `Chunk` rows (+ parent `Lecture.title`), `JSON.parse` each `embeddingJson`, score with `cosineSimilarity`, sort desc, slice `topK` (default 6).
4. Build grounded prompt and call the LLM (`server/src/routes/qnaRoutes.ts:42`, `server/src/routes/qnaRoutes.ts:69`)
   - Numbered `Source [n] [title, mm:ss]` block + system rules ("Answer ONLY from sources", exact `Not covered in your lectures.` fallback, `[LectureTitle, mm:ss]` citation format); `POST /api/chat { model: CONFIG.OLLAMA_LLM_MODEL, messages, stream: false }` with 60 s timeout.
5. Shape citations and return (`server/src/routes/qnaRoutes.ts:90`, `server/src/routes/qnaRoutes.ts:106`)
   - Detect unsupported prefix; map each `topChunk` to `CitationItem` with `timestampLabel`; return `QnAResponseDTO`.
6. Render with deep links (`web/src/app/ask/page.tsx:238`, `web/src/components/QnAChat.tsx:174`)
   - Citation chips link to `/lectures/<id>?tab=transcript&t=<startTime>`; `web/src/app/lectures/[id]/page.tsx:14` parses `t` and `web/src/components/LectureWorkspace.tsx:227` seeks audio and switches to the transcript tab.

### Status / Diagnostics Flow

1. Shell and settings poll `GET /api/status` (`web/src/components/AppShell.tsx:94`, `web/src/app/settings/page.tsx:41`, `web/src/lib/api.ts:740`).
2. Server probes in parallel (`server/src/routes/statusRoutes.ts:133`): `nvidia-smi --query-gpu=name,memory.total` (`server/src/routes/statusRoutes.ts:35`), Ollama `GET /api/tags` (`server/src/routes/statusRoutes.ts:54`), `ffmpeg -version` (`server/src/routes/statusRoutes.ts:73`), plus a tiny embedding-throughput probe (`server/src/routes/statusRoutes.ts:87`); file-existence checks for whisper binary/model (`server/src/routes/statusRoutes.ts:139`); always respond 200 with `SystemStatusDTO` (`shared/src/index.ts:91`).

**State Management:**
- Server pipeline progress lives in a process-local `Map<string, JobProgressDTO>` in `server/src/services/pipelineOrchestrator.ts:11`; use `getProgress()` in `server/src/services/pipelineOrchestrator.ts:16` and `updateProgress()` in `server/src/services/pipelineOrchestrator.ts:58`. Treat it as ephemeral: a restart loses in-flight percentages and `GET /:id/progress` falls back to the coarse DB-derived `PROCESSING 50%` branch.
- Durable state lives in SQLite (`server/prisma/schema.prisma:10`): `Lecture.status` (`PENDING | PROCESSING | COMPLETED | FAILED`) is the source of truth; segments/chunks/cards/terms are rewritten per run with `deleteMany` + `create`.
- Frontend keeps no global store: per-page `useState` + `useEffect` polling (`web/src/app/page.tsx:49`, `web/src/components/PipelineProgress.tsx:57`, `web/src/components/LectureWorkspace.tsx:235`), `URL.createObjectURL` previews for recordings (`web/src/components/IntakeModal.tsx:157`), `localStorage` only for theme (`web/src/app/layout.tsx:21`, `web/src/app/settings/page.tsx:61`) and SRS boxes/streaks (`packages/ui/src/study/studyStore.ts`, consumed in `web/src/app/study/[id]/page.tsx:14`).
- Cross-component fallback signaling uses a DOM `CustomEvent('lectern:backend-fallback')` dispatched in `web/src/lib/api.ts:56` and consumed in `web/src/components/AppShell.tsx:21`.

## Key Abstractions

**Lecture aggregate:**
- Purpose: The unit of ingestion, study, and deletion; owns every derived artifact.
- Examples: `server/prisma/schema.prisma:10`, `shared/src/index.ts:46`
- Pattern: Prisma parent with `onDelete: Cascade` children (`segments`, `chunks`, `flashcards`, `keyTerms`); DTO projection in `server/src/routes/lectureRoutes.ts:210` and `server/src/routes/lectureRoutes.ts:244`.

**Timestamped segment vs. retrievable chunk:**
- Purpose: Segments preserve ASR timing; chunks preserve retrieval context plus citation timing.
- Examples: `server/prisma/schema.prisma:26`, `server/prisma/schema.prisma:38`, `server/src/services/chunkingService.ts:19`, `shared/src/index.ts:14`
- Pattern: Use segments for the transcript UI (`web/src/components/LectureWorkspace.tsx:881`); use chunks for embeddings and Q&A; never embed raw segments directly — always go through `chunkSegments()` first.

**Service singleton:**
- Purpose: One configured instance per capability, constructed from `CONFIG` with override-friendly constructors.
- Examples: `server/src/services/audioService.ts:66`, `server/src/services/whisperService.ts:223`, `server/src/services/chunkingService.ts:103`, `server/src/services/embeddingService.ts:167`, `server/src/services/pipelineOrchestrator.ts:387`
- Pattern: `export class XService` + `export const xService = new XService()`; import the singleton in routes/orchestrator; pass `options` overrides only in tests (`server/src/services/__tests__/services.test.ts:1`).

**Grounded citation:**
- Purpose: Every generated sentence traces to a stored chunk timestamp.
- Examples: `shared/src/index.ts:69`, `server/src/routes/qnaRoutes.ts:94`, `web/src/app/ask/page.tsx:248`
- Pattern: Carry `lectureId` + `lectureTitle` + `startTime`/`endTime` + `textSnippet` + `similarity` end to end; format display labels as `[Title, mm:ss]`; link citations to `?tab=transcript&t=`.

**Resilient client result:**
- Purpose: Make offline degradation explicit at the type level.
- Examples: `web/src/lib/api.ts:10`, `web/src/lib/api.ts:23`, `web/src/lib/api.ts:365`, `web/src/lib/api.ts:557`, `web/src/lib/api.ts:740`
- Pattern: Prefer `*WithSource()` variants returning `SourcedResult<T>` with `source: 'live' | 'fallback'`; throw `BackendUnreachableError` when callers must opt into `getFallbackLectures()` / `getFallbackLecture()` / `buildLocalAnswer()`; surface a toast via `notifyBackendFallback()`.

## Entry Points

**Express bootstrap:**
- Location: `server/src/index.ts`
- Triggers: `npm run dev:server` (`server/package.json:7` via `tsx watch src/index.ts`), `npm run dev` (root `package.json:13` runs server + web concurrently).
- Responsibilities: Ensure `uploads/` exists, enable CORS + JSON body parsing, mount `/api/status` + `/api/lectures` + `/api/qna`, serve `/uploads` statically, answer `GET /health`, listen on port 5000.

**Next.js App Router:**
- Location: `web/src/app/layout.tsx`, `web/src/app/page.tsx`
- Triggers: `npm run dev:web` (`web/package.json:6` via `next dev -p 3000`), browser navigation to `/`, `/lectures`, `/lectures/[id]`, `/ask`, `/study/[id]`, `/settings`.
- Responsibilities: Wrap every route in `AppShell` + `AppSidebar`; rewrite `/api/*` and `/uploads/*` to the Express origin (`web/next.config.mjs:3`).

**Lecture intake:**
- Location: `web/src/components/IntakeModal.tsx`, `web/src/components/AudioUploader.tsx`, `web/src/components/AudioRecorder.tsx`
- Triggers: "Add lecture" buttons in `web/src/app/page.tsx:205` and `web/src/app/lectures/page.tsx:97`.
- Responsibilities: Collect title + file or `MediaRecorder` blob; POST to the API; navigate to `/lectures/<id>` for progress display.

**Q&A intake:**
- Location: `web/src/app/ask/page.tsx`, `web/src/components/QnAChat.tsx`, `web/src/components/AskPanel.tsx`
- Triggers: `/ask` route, "Ask question about lecture" link in `web/src/components/LectureWorkspace.tsx:532`, embedded panels.
- Responsibilities: Send question JSON, render answer + citation chips, deep-link to transcript timestamps.

**Diagnostics intake:**
- Location: `web/src/app/settings/page.tsx`, `web/src/components/AppShell.tsx:87`
- Triggers: `/settings` route load (10 s poll) and shell mount (30 s poll).
- Responsibilities: Render GPU/whisper/Ollama/FFmpeg health from `SystemStatusDTO`.

**CLI / script entry points:**
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

**What happens:** `uploadLecture()` in `web/src/lib/api.ts:418` catches any POST failure and fabricates a `COMPLETED` lecture with synthetic summary/cards/segments, then unshifts it into `FALLBACK_LECTURES`.
**Why it's wrong:** The user sees a "completed" lecture that never ran transcription, chunking, or embeddings, so Q&A citations for it cannot resolve to real audio.
**Do this instead:** Follow the `fetchLectures()` pattern in `web/src/lib/api.ts:380`: throw `BackendUnreachableError`, let the caller in `web/src/components/IntakeModal.tsx:221` show the error notice, and keep the failed file selected for retry.

### Bypassing the workspace boundary with deep relative imports

**What happens:** `web/src/app/study/[id]/page.tsx:10` and `web/src/app/layout.tsx:3` reach directly into `packages/ui/src/...` with `../../../../../` paths.
**Why it's wrong:** `packages/` is outside the npm `workspaces` in `package.json:5`, so refactors of `packages/ui/` break web builds without a type or version signal.
**Do this instead:** Import study players through the package entry (`packages/ui/src/index.ts`) or move the consumed modules under `web/src/components/`; keep `shared/src/index.ts` as the model for a clean importable boundary.

### In-memory progress as the only live signal

**What happens:** `getProgress()` in `server/src/services/pipelineOrchestrator.ts:16` prefers `progressMap` and otherwise guesses `PROCESSING 50%`.
**Why it's wrong:** A server restart wipes stage detail for jobs the DB still marks `PROCESSING`, so `web/src/components/PipelineProgress.tsx:60` stalls on a coarse message.
**Do this instead:** Persist `stage`/`progressPercent` on the `Lecture` row (extend `server/prisma/schema.prisma:10`) inside `updateProgress()`, and keep the map only as a write-through cache.

### Sequential per-chunk embedding loop

**What happens:** `generateAndSaveEmbeddings()` in `server/src/services/embeddingService.ts:63` awaits one Ollama `/api/embed` call per chunk in a `for...of` loop.
**Why it's wrong:** Lecture ingestion time grows linearly with chunk count plus one SQLite round-trip per chunk.
**Do this instead:** Batch independent `getEmbedding()` calls with bounded concurrency (matching the `Promise.all` fan-out style already used in `web/src/app/page.tsx:84`), then bulk-insert the rows.

## Error Handling

**Strategy:** Fail the lecture, never the process. Per-request `try/catch` returns JSON errors; the orchestrator catches everything, marks `FAILED`, and records progress; the status route never returns 500; the frontend converts transport failures into explicit fallback mode.

**Patterns:**
- Return `400` for missing input (`server/src/routes/lectureRoutes.ts:122`, `server/src/routes/qnaRoutes.ts:18`), `404` for unknown lecture (`server/src/routes/lectureRoutes.ts:239`), `500 { error, details: String(error) }` for unexpected failures in every route handler.
- Wrap each pipeline stage in the single `try/catch` in `server/src/services/pipelineOrchestrator.ts:364`: on error update `Lecture.status = 'FAILED'` (with a nested `.catch(() => {})`) and `updateProgress(lectureId, 'FAILED', 0, ..., errorMsg)`. Keep study-aid sub-steps internally tolerant (`server/src/services/pipelineOrchestrator.ts:259`, `server/src/services/pipelineOrchestrator.ts:303`) so a flashcard JSON failure cannot fail the lecture.
- Validate subprocess preconditions with explicit messages before spawning: missing input (`server/src/services/audioService.ts:26`), missing whisper binary/model/wav (`server/src/services/whisperService.ts:84`), empty FFmpeg output (`server/src/services/audioService.ts:58`).
- Use `AbortSignal.timeout()` on every Ollama call: 30 s for embeddings (`server/src/services/embeddingService.ts:34`), 60 s for Q&A chat (`server/src/routes/qnaRoutes.ts:77`), 120 s for summarization/study aids (`server/src/services/pipelineOrchestrator.ts:123`).
- Degrade reads, not writes: `statusRouter.get('/')` in `server/src/routes/statusRoutes.ts:131` catches all probe failures and returns 200 with `fallbackStatus()`; frontend `*WithSource()` helpers in `web/src/lib/api.ts:365`, `web/src/lib/api.ts:557`, `web/src/lib/api.ts:740` return seeded data with `source: 'fallback'` and dispatch `lectern:backend-fallback` for the toast in `web/src/components/AppShell.tsx:21`.

## Cross-Cutting Concerns

**Logging:** `console.log` for boot (`server/src/index.ts:39`), `console.warn` for non-fatal summarization failures (`server/src/services/pipelineOrchestrator.ts:350`), `console.error` for pipeline failure (`server/src/services/pipelineOrchestrator.ts:366`) and rejected fetch details. Keep logs server-side; never echo `details` beyond the local API JSON. Add a structured logger before adding log volume.

**Validation:** Title trimming with filename fallback (`server/src/routes/lectureRoutes.ts:127`); `multer` 500 MB limit (`server/src/routes/lectureRoutes.ts:116`); audio extension allowlist on drop/select (`web/src/components/IntakeModal.tsx:100`, `web/src/components/AudioUploader.tsx:70`); `typeof question === 'string'` gate (`server/src/routes/qnaRoutes.ts:18`); JSON-shape guards for Ollama `format: 'json'` responses (`server/src/services/pipelineOrchestrator.ts:245`, `server/src/services/pipelineOrchestrator.ts:289`); word-count and empty-text guards in `server/src/services/chunkingService.ts:24`.

**Authentication:** None. CORS is open (`server/src/index.ts:17`), static audio is unauthenticated (`server/src/index.ts:22`), and all lecture/Q&A/status routes skip auth. Treat the API as localhost-only until an auth layer is added.

---

*Architecture analysis: 2026-10-09*
