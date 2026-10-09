---
last_mapped_commit: 15310b9043b62a1f115f333f51535da622f0d098
last_mapped_at: 2026-10-09
---
# Coding Conventions

**Analysis Date:** 2026-10-09

## Naming Patterns

**Files:**
- Use PascalCase for React components: `UploadPanel.tsx`, `LectureViewer.tsx`, `TranscriptViewer.tsx`, `FlashcardDeck.tsx` in `web/src/components/` and `AskPanel.tsx`, `LectureList.tsx`, `LecturePage.tsx` in `packages/ui/src/components/`
- Use camelCase for services, utilities, and stores: `chunkingService.ts`, `pipelineOrchestrator.ts`, `audioService.ts`, `embeddingService.ts`, `whisperService.ts` in `server/src/services/`; `studyStore.ts`, `srs.ts`, `mockApi.ts` in `packages/ui/src/`; `chunker.ts`, `vector.ts`, `pipeline.ts`, `prompts.ts`, `schemas.ts` in `packages/core/src/`
- Use camelCase + `Routes` suffix for Express routers: `lectureRoutes.ts`, `qnaRoutes.ts`, `statusRoutes.ts` in `server/src/routes/`
- Use lowercase directory names: `server/src/services/`, `server/src/routes/`, `web/src/components/`, `web/src/lib/`, `packages/core/src/`, `packages/core/test/`
- Use `__tests__` for colocated test dirs (`server/src/services/__tests__/`, `packages/ui/src/__tests__/`, `packages/ui/src/study/__tests__/`) and `test/` for sibling test dirs (`packages/core/test/`, `packages/server-routes/test/`); test files are `*.test.ts` / `*.test.tsx`
- Use `index.ts` barrels only at package roots and component dirs: `packages/core/src/index.ts`, `packages/ui/src/index.ts`, `web/src/components/index.ts`, `shared/src/index.ts`

**Functions:**
- Use camelCase verb-first names for all functions and methods: `chunkSegments`, `countWords`, `cosine`, `topK`, `getEmbedding`, `transcribe`, `convertToWav`, `summarizeLecture`, `extractKeyTerms`, `makeFlashcards`, `answerQuestion`, `groupChunksIntoSections`, `formatTimestamp`, `fetchLecturesWithSource`, `seedDemoLecture` (see `packages/core/src/chunker.ts`, `packages/core/src/vector.ts`, `packages/core/src/pipeline.ts`, `web/src/lib/api.ts`)
- Use `get*` for readers (`getProgress` in `server/src/services/pipelineOrchestrator.ts`, `getLectures` / `getLecture` / `getLectureProgress` / `getQuiz` in `packages/ui/src/api.ts`, `getBox` / `getAllBoxes` / `getStreak` / `getLectureStats` in `packages/ui/src/study/studyStore.ts`), `handle*` for framework-free route handlers (`handlePostLectures`, `handleGetLectures`, `handleGetLectureById`, `handlePostAsk`, `runLectureProcessingJob` in `packages/server-routes/src/handlers.ts`), `probe*` for status checks (`probeGpu`, `probeOllama`, `probeFfmpeg`, `probeEmbeddingThroughput` in `server/src/routes/statusRoutes.ts`), `parse*` for private parsers (`parseTimestampToSeconds`, `parseStdoutFallback` in `server/src/services/whisperService.ts`)
- Use `is*` boolean guards returning type predicates where narrowing matters: `isBackendUnreachableError` in `web/src/lib/api.ts`, `isDayKey` in `packages/ui/src/study/studyStore.ts`

**Variables:**
- Use camelCase for locals and properties: `targetWords`, `overlapWords`, `startIdx`, `currentWords`, `validSegments` in `server/src/services/chunkingService.ts` and `packages/core/src/chunker.ts`; `wavPath`, `queryEmbedding`, `topChunks` in `server/src/services/pipelineOrchestrator.ts` and `server/src/routes/qnaRoutes.ts`
- Use SCREAMING_SNAKE_CASE for module constants: `NOT_COVERED_RESPONSE` in `packages/core/src/prompts.ts`, `STORAGE_KEY` in `packages/ui/src/study/studyStore.ts`, `MIN_BOX` / `MAX_BOX` / `MASTERED_BOX` in `packages/ui/src/study/srs.ts`, `FALLBACK_GPU_NAME` / `FALLBACK_VRAM_MB` / `PROBE_TIMEOUT_MS` in `server/src/routes/statusRoutes.ts`, `DEMO_TITLE` / `DEMO_SUMMARY` / `DEMO_SEGMENTS` in `server/src/routes/lectureRoutes.ts`, `PROGRESS_STAGES` in `web/src/lib/api.ts`, `CONFIG` in `server/src/config.ts`
- Use `UPPER_SNAKE` env-derived keys inside the single `CONFIG` object in `server/src/config.ts`: `PORT`, `OLLAMA_BASE_URL`, `OLLAMA_LLM_MODEL`, `OLLAMA_EMBED_MODEL`, `WHISPER_CLI_PATH`, `WHISPER_MODEL_PATH`, `UPLOADS_DIR`, `FFMPEG_CMD`
- Prefix throwaway/compat identifiers explicitly: `_req` for unused Express params in `server/src/index.ts`, `server/src/routes/lectureRoutes.ts`, `server/src/routes/statusRoutes.ts`; `temp-${idx}` for non-persisted DTO ids in `server/src/services/whisperService.ts`

**Types:**
- Use PascalCase for all classes, interfaces, and type aliases; suffix shared wire contracts with `DTO`: `LectureDTO`, `ChunkDTO`, `TranscriptSegmentDTO`, `FlashcardDTO`, `KeyTermDTO`, `JobProgressDTO`, `QnARequestDTO`, `QnAResponseDTO`, `SystemStatusDTO`, `CitationItem` in `shared/src/index.ts`
- Use PascalCase + `Service` / `Client` / `Error` suffixes for behavior classes: `ChunkingService`, `AudioService`, `EmbeddingService`, `WhisperService`, `PipelineOrchestrator` in `server/src/services/`; `OllamaClient`, `WhisperClient`, `LecternApi`, `MockLecternApi` in `packages/core/src/ollama.ts`, `packages/core/src/whisper.ts`, `packages/ui/src/api.ts`, `packages/ui/src/mockApi.ts`; `OllamaError` / `OllamaDownError` / `OllamaModelNotFoundError` / `OllamaTimeoutError` in `packages/core/src/ollama.ts`, `WhisperError` in `packages/core/src/whisper.ts`, `RouteError` in `packages/server-routes/src/handlers.ts`, `BackendUnreachableError` in `web/src/lib/api.ts`, `ApiError` in `packages/ui/src/api.ts`
- Use PascalCase + `Options` / `Params` / `Response` / `Request` for shapes: `ChunkingOptions`, `AudioConversionOptions`, `WhisperOptions`, `EmbeddingOptions` in `server/src/services/`; `OllamaClientOptions`, `ChatParams`, `EmbedParams`, `ChatResponse`, `EmbedResponse`, `PipelineOptions`, `AnswerResult` in `packages/core/src/ollama.ts` and `packages/core/src/pipeline.ts`; `ServerContext`, `PostLecturesRequest`, `PostLecturesResponse` in `packages/server-routes/src/handlers.ts` and `packages/server-routes/src/types.ts`; `ApiClientOptions`, `LecternApiClient` in `packages/ui/src/api.ts`; `SourcedResult<T>`, `SourcedAnswer`, `SystemDiagnostics`, `DataSource` in `web/src/lib/api.ts`
- Use string-literal unions for state machines, never numeric enums: `LectureStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'` and `PipelineStage = 'IDLE' | 'CONVERTING_AUDIO' | ... | 'FAILED'` in `shared/src/index.ts`; `LectureStatus = 'converting' | 'transcribing' | ... | 'failed'` in `packages/ui/src/types.ts`
- Export singletons in lowercase camelCase alongside the class: `chunkingService` in `server/src/services/chunkingService.ts`, `audioService` in `server/src/services/audioService.ts`, `embeddingService` in `server/src/services/embeddingService.ts`, `whisperService` in `server/src/services/whisperService.ts`, `pipelineOrchestrator` in `server/src/services/pipelineOrchestrator.ts`, `defaultOllamaClient` / `defaultWhisperClient` in `packages/core/src/ollama.ts` and `packages/core/src/whisper.ts`, `prisma` in `server/src/db.ts`, `CONFIG` in `server/src/config.ts`

## Code Style

**Formatting:**
- No formatter is configured — no Prettier, ESLint, or Biome config exists in first-party code (only `node_modules` stubs and `packages/ui/postcss.config.js`, `packages/ui/tailwind.config.js`, `web/tailwind.config.ts`, `web/postcss.config.mjs`, `web/next.config.mjs`). Match the existing style by hand.
- Use single quotes, semicolons, 2-space indentation, and trailing commas in multiline literals. Example from `packages/core/src/vector.ts`:

```typescript
export function cosine(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }
  // ...
  return Math.max(-1, Math.min(1, similarity));
}
```

- Use strict TypeScript everywhere: `"strict": true` in `server/tsconfig.json`, `web/tsconfig.json`, `shared/tsconfig.json`, `packages/core/tsconfig.json`; `packages/core/tsconfig.json` additionally sets `"noImplicitAny": true`. Run `npm run typecheck --workspaces` (root) which covers `server`, `web`, `shared` via `tsc --noEmit`.
- Use ESM (`"type": "module"` in `packages/core/package.json`, `packages/ui/package.json`, `packages/server-routes/package.json`; `"module": "NodeNext"` in `server/tsconfig.json` and `packages/core/tsconfig.json`). Target `ES2022` in `server/tsconfig.json`, `packages/core/tsconfig.json`, `web/tsconfig.json`.
- Prefer `const`, arrow callbacks, template literals, optional chaining (`?.`), nullish coalescing (`??`), and `Array.prototype` helpers over manual loops where the file already does so (see `packages/core/src/pipeline.ts`, `packages/ui/src/study/studyStore.ts`).

**Linting:**
- No linter is configured and no `lint` script exists in any `package.json`. Do not add lint-only churn.
- Self-enforce the de-facto rules instead: no `any` without a cast site (`as unknown as OllamaClient` in `packages/server-routes/test/handlers.test.ts` is the accepted escape hatch), no unused imports, `err instanceof Error ? err.message : String(err)` normalization at every catch boundary (see `server/src/services/whisperService.ts`, `server/src/services/audioService.ts`, `packages/core/src/whisper.ts`, `packages/server-routes/src/handlers.ts`).

## Import Organization

**Order:**
1. External packages (`express`, `cors`, `multer`, `lucide-react`, `react`, `vitest`, `@testing-library/react`)
2. Workspace packages (`@lectern/shared`, `@lectern/core`)
3. Node builtins with `node:` prefix where the file uses it (`node:child_process`, `node:util`, `node:fs`, `node:path`, `node:os` in `server/src/routes/statusRoutes.ts`, `packages/core/src/whisper.ts`, `packages/server-routes/src/handlers.ts`)
4. Relative modules with explicit `.js` extensions in Node-targeted code
5. Type-only imports via `import type` (always separated from value imports)

**Path Aliases:**
- Use `@/*` → `./src/*` only in `web/` (declared in `web/tsconfig.json`). Do not use it in `server/`, `shared/`, or `packages/`.
- Use `@lectern/shared` for all shared DTOs in `server/src/routes/lectureRoutes.ts`, `server/src/routes/qnaRoutes.ts`, `server/src/services/chunkingService.ts`, `web/src/lib/api.ts`, `web/src/components/AskPanel.tsx`
- Use `@lectern/core` only inside `packages/server-routes/src/handlers.ts` (`import { OllamaClient, WhisperClient, chunkSegments, ... } from '@lectern/core'`). `server/` does not import `@lectern/core`; it keeps its own service copies.

**Patterns to follow:**
- Use explicit `.js` extensions on every relative import in NodeNext code, even though sources are `.ts`. Do this in `server/src/` and `packages/*/src/`:

```typescript
import { CONFIG } from './config.js';
import { pipelineOrchestrator } from '../services/pipelineOrchestrator.js';
import type { LectureDTO } from '@lectern/shared';
// from server/src/routes/lectureRoutes.ts
```

```typescript
import type { Segment, Chunk } from './types.js';
import { countWords } from './chunker.js';
// from packages/core/src/pipeline.ts
```

- Use `node:`-prefixed builtins in newer files; keep the bare specifiers (`fs`, `path`, `child_process`, `util`) only where they already exist (`server/src/services/audioService.ts`, `server/src/services/whisperService.ts`, `server/src/index.ts`). New code uses:

```typescript
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
// from server/src/routes/statusRoutes.ts
```

- Use `import type` for types and barrel `export *` for package public API:

```typescript
export * from './types.js';
export * from './ollama.js';
export * from './whisper.js';
// from packages/core/src/index.ts
```

```typescript
export { AudioRecorder } from './AudioRecorder';
export { AppShell } from './AppShell';
// from web/src/components/index.ts
```

- Mark client components with the `'use client'` directive as the first line (see `web/src/components/AppShell.tsx`, `web/src/components/AskPanel.tsx`).

## Error Handling

**Patterns:**
- Define a typed `Error` subclass per failure domain, set `this.name`, and carry machine-readable fields. Copy these shapes for new errors:

```typescript
export class OllamaDownError extends OllamaError {
  constructor(baseUrl: string, cause?: unknown) {
    super(`Ollama is down or unreachable at ${baseUrl}. Ensure Ollama is running on your machine.`, cause);
    this.name = 'OllamaDownError';
  }
}
// from packages/core/src/ollama.ts
```

```typescript
export class RouteError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'RouteError';
  }
}
// from packages/server-routes/src/handlers.ts
```

```typescript
export class BackendUnreachableError extends Error {
  source: 'fallback' = 'fallback';
  endpoint: string;
  status?: number;
  constructor(endpoint: string, message?: string, status?: number) {
    super(message || `Backend unreachable at ${endpoint} — showing seeded demo data`);
    this.name = 'BackendUnreachableError';
    this.endpoint = endpoint;
    this.status = status;
  }
}
// from web/src/lib/api.ts
```

- Normalize caught values with `err instanceof Error ? err.message : String(err)` at every boundary. Use this exact idiom (from `server/src/services/pipelineOrchestrator.ts`):

```typescript
} catch (err) {
  const errorMsg = err instanceof Error ? err.message : String(err);
  console.error(`[Pipeline Error] Lecture ${lectureId} failed:`, errorMsg);
  await prisma.lecture.update({ where: { id: lectureId }, data: { status: 'FAILED' } }).catch(() => {});
  this.updateProgress(lectureId, 'FAILED', 0, 'Processing failed', errorMsg);
}
```

- Return `{ error, details: String(error) }` JSON from Express routes with the right status (`400` for bad input, `404` for missing rows, `500` for failures). Use this shape (from `server/src/routes/lectureRoutes.ts`):

```typescript
lectureRouter.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No audio file provided in multipart upload' });
      return;
    }
    // ...
    res.status(201).json({ id: lecture.id, success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create lecture upload', details: String(error) });
  }
});
```

- Validate request input manually at the top of each handler and return early (no zod/yup in the repo). Follow `server/src/routes/qnaRoutes.ts` and `packages/server-routes/src/handlers.ts`:

```typescript
if (!question || typeof question !== 'string') {
  res.status(400).json({ error: 'Question parameter is required' });
  return;
}
```

```typescript
if (!req.file || req.file.length === 0) {
  throw new RouteError(400, 'No file uploaded.');
}
```

- Never let background work throw unhandled: wrap pipeline jobs in try/catch, record `FAILED` state, and swallow the secondary write failure (see `runLectureProcessingJob` in `packages/server-routes/src/handlers.ts` and `runPipeline` in `server/src/services/pipelineOrchestrator.ts`). Launch fire-and-forget work via `queueMicrotask(() => { void runPipeline(...); })` as in `server/src/services/pipelineOrchestrator.ts` (`startPipeline`) and `packages/server-routes/src/handlers.ts` (`handlePostLectures`).
- Never return 500 from `/api/status`: catch everything and answer `200` with safe fallbacks (see `server/src/routes/statusRoutes.ts`):

```typescript
statusRouter.get('/', async (_req, res) => {
  try {
    // ...probeGpu(), probeOllama(), probeFfmpeg()
    res.status(200).json(status);
  } catch {
    // Never throw 500: status must always answer 200 with safe fallbacks.
    res.status(200).json(fallbackStatus());
  }
});
```

- Never throw from persistence helpers in `packages/ui/src/study/studyStore.ts`: guard every storage access with `typeof window` checks plus try/catch, sanitize parsed JSON, and fall back to an in-memory shim or safe default. New storage helpers must keep the `// Never throw` contract:

```typescript
/** Box for a card (default 1). Never throws. */
export function getBox(lectureId: string, cardKey: string): number {
  try {
    const state = loadState();
    // ...
    return clampBox(value);
  } catch {
    return MIN_BOX;
  }
}
```

- Degrade to explicit seeded demo data on the frontend instead of failing silently: throw / catch `BackendUnreachableError`, return `SourcedResult<T> = { data, source: 'live' | 'fallback' }`, and surface a toast. Follow `web/src/lib/api.ts`:

```typescript
export async function fetchLectures(): Promise<LectureDTO[]> {
  const result = await fetchLecturesWithSource();
  if (result.source === 'live') return result.data;
  throw new BackendUnreachableError('/api/lectures');
}
```

- Time out every outbound `fetch` with `AbortSignal.timeout(...)` (`30000` for embeds in `server/src/services/embeddingService.ts`, `60000` for chat in `server/src/routes/qnaRoutes.ts`, `120000` for pipeline LLM calls in `server/src/services/pipelineOrchestrator.ts`, `PROBE_TIMEOUT_MS = 2000` for status probes in `server/src/routes/statusRoutes.ts`). Wrap `OllamaClient` calls in the built-in retry helper `executeWithRetry` in `packages/core/src/ollama.ts` (retry 5xx with linear backoff, never retry 404 — throw `OllamaModelNotFoundError` immediately).

## Logging

**Framework:** `console` only — no pino, winston, or structured logger exists in any `package.json`.

**Patterns:**
- Use `console.log` only for startup lines in `server/src/index.ts`:

```typescript
app.listen(CONFIG.PORT, () => {
  console.log(`[Lectern Server] Running offline on http://localhost:${CONFIG.PORT}`);
  console.log(`[Lectern Server] Uploads directory: ${CONFIG.UPLOADS_DIR}`);
});
```

- Use `console.warn` for recoverable degradation (pipeline continues): summarization warning in `server/src/services/pipelineOrchestrator.ts`, upload-to-simulation fallback in `web/src/lib/api.ts`:

```typescript
console.warn(`[Pipeline] Summarization warning for ${lectureId}:`, sumErr);
```

- Use `console.error` for terminal step failure or UI data-load failure: `[Pipeline Error]` in `server/src/services/pipelineOrchestrator.ts`, `'Failed to load lecture detail:'` in `packages/ui/src/dev/App.tsx`, `'Error polling progress:'` in `packages/ui/src/components/UploadPanel.tsx`.
- Prefix backend logs with a bracketed tag (`[Lectern Server]`, `[Pipeline]`, `[Pipeline Error]`, `[Lectern API]`) and include the `lectureId` or endpoint in the message. Do not log secrets: env files (`web/.env.local` present, gitignored via `.gitignore`) are read only through `server/src/config.ts` (`dotenv.config()` + `process.env` defaults) and never printed.
- Swallow expected cleanup/parse noise silently with an annotated empty catch (`// ignore`, `// ignore cleanup errors`, `// ignore parse error`, `// Continue even if flashcard extraction fails`) as in `server/src/services/whisperService.ts`, `server/src/services/embeddingService.ts`, `server/src/services/pipelineOrchestrator.ts`, `packages/ui/src/mockApi.ts`.

## Comments

**When to Comment:**
- Document every public service method with a `/** ... */` block stating contract, units, and side effects (stages, word budgets, formats). Follow `server/src/services/audioService.ts`, `server/src/services/chunkingService.ts`, `server/src/services/whisperService.ts`:

```typescript
/**
 * Chunks transcript segments into ~250-word chunks with overlap,
 * preserving startTime from the earliest segment in the chunk for citations.
 */
```

```typescript
/**
 * Converts any input audio file (mp3, wav, m4a, webm, mp4, etc.)
 * to 16kHz mono 16-bit PCM WAV format required by Whisper.
 */
```

- Add module-header comments for purity and environment contracts that callers must respect (`packages/ui/src/study/srs.ts`, `packages/ui/src/study/studyStore.ts`):

```typescript
/**
 * Pure Leitner-box SRS helpers for the Study Circuit.
 *
 * PURE module: no DOM, no storage, no imports. Safe for SSR and unit tests.
 */
```

- Explain degraded-mode and non-obvious branches inline: `// Never throw 500: status must always answer 200 with safe fallbacks.` in `server/src/routes/statusRoutes.ts`, `// Network failure — explicit seeded fallback below, never silent.` in `web/src/lib/api.ts`, `// Clamp between -1 and 1 to eliminate floating-point precision artifacts` in `packages/core/src/vector.ts`.
- Keep `TODO`-style markers out: no `TODO`/`FIXME`/`HACK` convention exists in first-party sources; file tracked work instead of inline markers.

**JSDoc/TSDoc:**
- Use `/** */` for exported functions, classes, and methods; include units (`// in seconds` on DTO time fields in `shared/src/index.ts`) and stage/percent contracts (`JobProgressDTO.progressPercent // 0 - 100`).
- Do not add `@param`/`@returns` tags — the repo documents intent and constraints in prose, with types carrying the rest (see `packages/core/src/whisper.ts`, `packages/ui/src/mockApi.ts`, `packages/ui/src/types.ts` field comments like `/** Seconds into the lecture audio this card came from. ... */`).

## Function Design

**Size:** Keep functions focused on one stage; the largest accepted shape is the per-stage pipeline runner (~65 lines for `runPipeline` in `server/src/services/pipelineOrchestrator.ts`, `runLectureProcessingJob` in `packages/server-routes/src/handlers.ts`). Extract stage helpers (`summarizeLectureWithOllama`, `extractStudyAids`, `parseStdoutFallback`, `sanitizeState`, `loadState`/`saveState`) instead of growing a handler.

**Parameters:** Use small positional params for pure helpers (`cosine(a, b)` in `packages/core/src/vector.ts`, `chunkSegments(segments, lectureId, options?)` in `server/src/services/chunkingService.ts`, `rate(box, known)` in `packages/ui/src/study/srs.ts`) and a single options object with defaults for anything configurable:

```typescript
constructor(options: OllamaClientOptions = {}) // from packages/core/src/ollama.ts
async transcribe(wavPath: string, lectureId?: string, options: WhisperOptions = {}) // from server/src/services/whisperService.ts
export function chunkSegments(segments: Segment[], options: ChunkOptions = {}) // from packages/core/src/chunker.ts
export async function summarizeLecture(chunks: Chunk[], options: PipelineOptions = {}) // from packages/core/src/pipeline.ts
```

- Destructure shared config at call time with `??` fallbacks (`ctx.chatModel ?? 'qwen2.5:7b'`, `ctx.embedModel ?? 'nomic-embed-text:latest'` in `packages/server-routes/src/handlers.ts`; `options.targetWords ?? 250` in `packages/core/src/chunker.ts`).

**Return Values:** Return DTO arrays/objects, never raw ORM rows at module boundaries (map Prisma rows to `LectureDTO` in `server/src/routes/lectureRoutes.ts`; map SQLite rows to `ChunkDTO & { similarity }` in `server/src/services/embeddingService.ts`). Return `[]` / `''` / `NOT_COVERED_RESPONSE`-with-`[]`-citations for empty inputs (`chunkSegments`, `topK`, `summarizeLecture`, `extractKeyTerms`, `answerQuestion` in `packages/core/src/`). Return defensive copies from shared state (`{ ...lec }`, `{ ...progress }`, `choices: [...q.choices]`, `{ ...(state.boxes[lectureId] ?? {}) }` in `packages/ui/src/mockApi.ts` and `packages/ui/src/study/studyStore.ts`); never hand out live references.

## Module Design

**Exports:** Export the class plus a ready-made singleton from each service module (`export class ChunkingService` + `export const chunkingService` in `server/src/services/chunkingService.ts`, same for `audioService`, `embeddingService`, `whisperService`, `pipelineOrchestrator`; `export class OllamaClient` + `export const defaultOllamaClient` + top-level `chat`/`embed` helpers in `packages/core/src/ollama.ts`). Import the singleton in routes/orchestrators, instantiate with overrides only in tests.
- Export Express routers as named consts (`export const lectureRouter`, `export const qnaRouter`, `export const statusRouter`) and mount them in `server/src/index.ts` under `/api/status`, `/api/lectures`, `/api/qna`.
- Export React components as named function exports (`export function AskPanel`, `export function AppShell`, `export function OfflineBadge`) and re-export them from `web/src/components/index.ts`. Keep component `Props`/`type Props` local to the file (see `web/src/components/AskPanel.tsx`, `web/src/components/AppShell.tsx`).
- Keep one concept per file: `chunker.ts` (chunking), `vector.ts` (similarity), `prompts.ts` (prompt builders + `NOT_COVERED_RESPONSE`), `schemas.ts` (JSON schemas as `as const`), `pipeline.ts` (orchestration), `types.ts` (shapes) in `packages/core/src/`.

**Barrel Files:** Use barrels only at package boundaries (`packages/core/src/index.ts` re-exports all eight modules; `web/src/components/index.ts` re-exports all components; `packages/ui/src/index.ts` is the library entry in `packages/ui/vite.config.ts`). Import deep paths inside a package (`../services/audioService.js`), never through the barrel, to avoid cycles.

---

*Convention analysis: 2026-10-09*
