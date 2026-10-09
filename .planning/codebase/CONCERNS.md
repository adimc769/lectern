---
last_mapped_commit: 15310b9043b62a1f115f333f51535da622f0d098
last_mapped_at: 2026-10-09
---
# Codebase Concerns

**Analysis Date:** 2026-10-09

## Tech Debt

**Duplicate pipeline implementations (shipped vs tested code diverge):**
- Issue: Two parallel pipeline stacks exist. The running backend in `server/src/services/pipelineOrchestrator.ts`, `server/src/services/embeddingService.ts`, `server/src/services/whisperService.ts`, `server/src/services/chunkingService.ts`, `server/src/services/audioService.ts` duplicates logic in `packages/core/src/pipeline.ts`, `packages/core/src/chunker.ts`, `packages/core/src/ollama.ts`, `packages/core/src/whisper.ts`, `packages/core/src/vector.ts` and route logic in `packages/server-routes/src/handlers.ts` + `packages/server-routes/src/sqlite-repository.ts`. Defaults already diverge (`server/src/config.ts` uses `qwen2.5:14b` / `nomic-embed-text`; `packages/server-routes/src/handlers.ts` and `packages/core/src/pipeline.ts` default to `qwen2.5:7b` / `nomic-embed-text:latest`). Bug fixes in one tree do not reach the other.
- Files: `server/src/services/pipelineOrchestrator.ts`, `server/src/services/embeddingService.ts`, `packages/core/src/pipeline.ts`, `packages/server-routes/src/handlers.ts`, `packages/server-routes/src/sqlite-repository.ts`
- Impact: Doubles maintenance cost; tests in `packages/core/test/` and `packages/server-routes/test/handlers.test.ts` exercise code that is not the code serving traffic.
- Fix approach: Delete one stack. Keep `server/src/` as the runtime and move pure helpers (`chunkSegments`, `cosineSimilarity`/`topK`, prompt builders) into `shared/` or `packages/core` as imports. Gate with a test that asserts a single `summarizeLecture` / `chunkSegments` import graph.

**In-memory job progress with no eviction or persistence:**
- Issue: `server/src/services/pipelineOrchestrator.ts` stores every lecture's `JobProgressDTO` in `private progressMap = new Map<...>()` and never deletes entries. `getProgress()` prefers memory over `prisma.lecture` state, so stale memory wins after completion.
- Files: `server/src/services/pipelineOrchestrator.ts`
- Impact: Unbounded memory growth (one entry per lecture processed since boot); stale progress survives after DB says `COMPLETED`/`FAILED`; restart wipes memory and strands `PROCESSING` lectures at a generic 50%.
- Fix approach: Remove the map or bound it (LRU, TTL, delete on `COMPLETED`/`FAILED`). Make `prisma.lecture.status` the source of truth and persist stage + percent columns.

**Fire-and-forget background jobs with no queue or admission control:**
- Issue: `server/src/services/pipelineOrchestrator.ts` (`startPipeline()` via `queueMicrotask`) and `packages/server-routes/src/handlers.ts` (`queueMicrotask` in `handlePostLectures`) launch full GPU pipelines with no concurrency limit, no retry, no cancellation, no persistence across restarts.
- Files: `server/src/services/pipelineOrchestrator.ts`, `packages/server-routes/src/handlers.ts`, `server/src/routes/lectureRoutes.ts`
- Impact: Concurrent uploads spawn concurrent `whisper-cli` + Ollama jobs that contend for GPU VRAM; a crash/restart orphans `PROCESSING` rows forever; no backpressure under hackathon demo load.
- Fix approach: Add a single-slot (or GPU-count-slot) async job queue with persisted job rows, a `POST /api/lectures/:id/retry` and `POST /api/lectures/:id/cancel` endpoint, and process-supervised execution.

**Silent-failure catch blocks everywhere:**
- Issue: Bare `catch {}` / `catch { // Continue }` / `.catch(() => {})` in `server/src/services/pipelineOrchestrator.ts` (flashcard/key-term extraction, final `prisma.lecture.update().catch(() => {})`), `server/src/services/embeddingService.ts` (`catch { // ignore parse error }`), `server/src/services/whisperService.ts` (cleanup ignore), `server/src/routes/statusRoutes.ts` (all probes), `server/src/routes/lectureRoutes.ts` (`copySeedAudio`, `pickSeedAudioPath`).
- Files: `server/src/services/pipelineOrchestrator.ts`, `server/src/services/embeddingService.ts`, `server/src/services/whisperService.ts`, `server/src/routes/statusRoutes.ts`, `server/src/routes/lectureRoutes.ts`, `web/src/lib/api.ts`
- Impact: Root causes (Ollama down, corrupt embeddings, missing binaries) are invisible; lectures complete with empty summaries/flashcards and no signal why.
- Fix approach: Log with lecture context at `warn`/`error` level, attach `errorMessage` to the lecture row, surface it in `GET /api/lectures/:id` and `GET /api/lectures/:id/progress`. Enforce an `eslint` no-empty rule.

**Multi-write pipelines without transactions:**
- Issue: `deleteMany` + N×`create` sequences for segments (`server/src/services/whisperService.ts`), chunks (`server/src/services/embeddingService.ts`), flashcards/keyTerms (`server/src/services/pipelineOrchestrator.ts`) run as separate statements. A crash mid-loop leaves half-written lectures.
- Files: `server/src/services/whisperService.ts`, `server/src/services/embeddingService.ts`, `server/src/services/pipelineOrchestrator.ts`
- Impact: Partial transcripts/chunks/embeddings produce wrong Q&A citations and summaries with no way to detect incompleteness.
- Fix approach: Wrap each stage in `prisma.$transaction([...])` or stage into temp rows then swap. Add a `chunkCount`/`segmentCount` consistency check before marking `COMPLETED`.

**N+1 database writes (one round-trip per row):**
- Issue: Per-segment `prisma.transcriptSegment.create()` in `server/src/services/whisperService.ts`, per-chunk `prisma.chunk.create()` in `server/src/services/embeddingService.ts`, per-card `prisma.flashcard.create()` / `prisma.keyTerm.create()` in `server/src/services/pipelineOrchestrator.ts`.
- Files: `server/src/services/whisperService.ts`, `server/src/services/embeddingService.ts`, `server/src/services/pipelineOrchestrator.ts`
- Impact: A 2-hour lecture (hundreds of segments, dozens of chunks) issues hundreds of sequential SQLite round-trips on top of already-slow sequential Ollama calls.
- Fix approach: Use `prisma.<model>.createMany()` per stage (single statement per table).

**Oversized frontend modules:**
- Issue: `web/src/components/LectureWorkspace.tsx` (~1153 lines, 1267 with exports/helpers for markdown/Anki export, audio player, polling, tabs), `web/src/lib/api.ts` (~763 lines mixing live client, `FALLBACK_LECTURES` corpus, keyword Q&A matcher, upload simulator, progress simulator, status fallback), `packages/ui/src/mockApi.ts` (~747 lines), `packages/ui/src/dev/App.tsx` (~709 lines), `packages/ui/src/components/LecturePage.tsx` (~607 lines).
- Files: `web/src/components/LectureWorkspace.tsx`, `web/src/lib/api.ts`, `packages/ui/src/mockApi.ts`, `packages/ui/src/dev/App.tsx`, `web/src/components/UploadPanel.tsx`
- Impact: Slow review/HMR, merge conflicts, duplicated fallback/Q&A logic between `web/src/lib/api.ts` and `packages/ui/src/mockApi.ts`.
- Fix approach: Split `web/src/lib/api.ts` into `client.ts`, `fallbackLectures.ts`, `localAnswer.ts`, `uploadSimulator.ts`; extract `LectureWorkspace.tsx` player/export/tabs into subcomponents. Enforce a ~400-line soft limit via review checklist.

**Deep relative imports bypassing workspace packages:**
- Issue: `web/src/app/study/[id]/page.tsx` imports `../../../../../packages/ui/src/types`, `../../../../../packages/ui/src/study/DeckPlayer`, `QuizPlayer`, `CompletionScreen`, `StudyMascot`, `srs`, `studyStore` by relative path instead of the `@lectern/*` workspace export.
- Files: `web/src/app/study/[id]/page.tsx`
- Impact: Breaks if `packages/ui` build layout changes; duplicates types; Next.js compiles source outside `web/` with different configs.
- Fix approach: Export study components from `packages/ui/src/index.ts` (currently only `export * from './mockApi'`) and import via `@lectern/ui` with a lint rule banning `../../packages/` imports.

**Hardcoded demo/fallback knowledge scattered across layers:**
- Issue: `DEMO_TITLE`/`DEMO_SUMMARY`/`DEMO_SEGMENTS`/`DEMO_FLASHCARDS`/`DEMO_KEY_TERMS` in `server/src/routes/lectureRoutes.ts`, `FALLBACK_LECTURES` + `buildLocalAnswer()` keyword matcher in `web/src/lib/api.ts`, `FALLBACK_GPU_NAME`/`FALLBACK_VRAM_MB` in `server/src/routes/statusRoutes.ts`, `buildFallbackStatus()` in `web/src/lib/api.ts`.
- Files: `server/src/routes/lectureRoutes.ts`, `web/src/lib/api.ts`, `server/src/routes/statusRoutes.ts`
- Impact: Demo content drifts from real pipeline output; keyword Q&A matcher (`raft`/`transformer`/`ssa` branches) gives false confidence during judging and masks backend outages.
- Fix approach: Centralize demo fixtures in `shared/` or one `fixtures/` module, tag every fallback response with `source: 'fallback'`, and never synthesize a `COMPLETED` lecture for a failed upload (see Known Bugs).

**Status endpoint always returns 200:**
- Issue: `server/src/routes/statusRoutes.ts` (`GET /api/status — always answers 200 ... never throws 500`) and `fallbackStatus()` mask total outages. The frontend `web/src/lib/api.ts` (`fetchSystemStatusWithSource`) then reports a healthy-looking fallback (`whisperReady: true, ollamaReady: true`) while the real backend in `server/src/routes/statusRoutes.ts` reports `whisperReady: false, ollamaReady: false`.
- Files: `server/src/routes/statusRoutes.ts`, `web/src/lib/api.ts`, `web/src/components/AppShell.tsx`
- Impact: Operators and judges cannot distinguish "fully local and healthy" from "Ollama/whisper missing"; contradictory `whisperReady` values between layers.
- Fix approach: Return truthful `503` with per-dependency booleans from the backend; let the frontend decide display. Align fallback shapes so `whisperReady` means the same thing in both files.

**No schema validation library:**
- Issue: Manual `if (!question || typeof question !== 'string')` in `server/src/routes/qnaRoutes.ts`, manual `if (!req.file)` in `server/src/routes/lectureRoutes.ts`, no validation of `topK`, `title` length, or `:id` shape. No `zod`/`yup`/`express-validator` in `server/package.json`.
- Files: `server/src/routes/qnaRoutes.ts`, `server/src/routes/lectureRoutes.ts`, `server/package.json`
- Impact: Invalid inputs reach Prisma/Ollama prompts (e.g. unbounded `topK`, megabyte questions) and produce 500s instead of 400s.
- Fix approach: Add `zod` schemas for `QnARequestDTO`, upload fields, and route params; return `400` with field errors; clamp `topK` to 1–20.

## Known Bugs

**DELETE lecture orphans audio files on disk:**
- Symptoms: `DELETE /api/lectures/:id` returns success but original upload, converted `_16k_*.wav`, and whisper `whisper_*_*.json` artifacts remain in `uploads/`. Local `uploads/` listing shows `1791545573944_s3fllw.wav`, `1791545573944_s3fllw_16k_1791545573962.wav`, and a `demo-seed` copy accumulating.
- Files: `server/src/routes/lectureRoutes.ts`, `server/src/config.ts`, `server/src/services/audioService.ts`, `server/src/services/whisperService.ts`
- Trigger: Delete any lecture via API, then list `uploads/`.
- Workaround: Manually delete `uploads/*_16k_*.wav` and orphaned uploads.
- Fix approach: On delete, read `audioPath`, derive converted-whisper prefixes, `fs.unlink` all three, then `prisma.lecture.delete`. Return deleted byte count.

**Failed uploads fabricate a successful lecture on the client:**
- Symptoms: `uploadLecture()` in `web/src/lib/api.ts` catches any network/HTTP failure and synthesizes a `COMPLETED` lecture (`Local offline analysis for "..."`, generic key terms/flashcards/segments), `FALLBACK_LECTURES.unshift(generatedLecture)`, returning `{ id: mockId, status: 'COMPLETED' }`. The UI navigates to a lecture that exists only in tab memory.
- Files: `web/src/lib/api.ts`, `web/src/components/UploadPanel.tsx`, `web/src/components/AudioUploader.tsx`, `web/src/components/IntakeModal.tsx`
- Trigger: Stop the Express server (`npm run dev:server` off) and upload or record audio.
- Workaround: None user-visible; the toast says fallback but the lecture looks real.
- Fix approach: Never synthesize `COMPLETED` on upload failure. Throw `BackendUnreachableError`, keep the recording blob locally marked `PENDING_UPLOAD`, and offer explicit Retry.

**Live Q&A answers with zero citations are discarded as failures:**
- Symptoms: `askQuestionWithSource()` in `web/src/lib/api.ts` requires `data.citations.length > 0` to accept a live answer. A legitimate `unsupported: true` / `Not covered in your lectures.` response (empty citations by design in `server/src/routes/qnaRoutes.ts`) falls through to `buildLocalAnswer()` keyword matching, which can return a confident Raft/Transformer/SSA answer for an unrelated question.
- Files: `web/src/lib/api.ts`, `server/src/routes/qnaRoutes.ts`
- Trigger: Ask anything uncovered while the backend is up; observe a keyword-matched fallback answer labeled as if local knowledge.
- Workaround: None.
- Fix approach: Accept any `2xx` Q&A payload with a string `answer` as live; only fall back on network/non-OK. Preserve `unsupported: true` verbatim.

**Quiz tab is always empty — backend route does not exist:**
- Symptoms: `web/src/app/study/[id]/page.tsx` (`fetchQuiz`) and `web/src/app/study/page.tsx` call `GET /api/lectures/:id/quiz`, but `server/src/index.ts` mounts only `/api/status`, `/api/lectures`, `/api/qna`, and `server/src/routes/lectureRoutes.ts` defines only `/`, `/seed-demo`, `/:id/progress`, `/`, `/:id`, `/:id` (DELETE). All quiz fetches return `[]` silently.
- Files: `web/src/app/study/[id]/page.tsx`, `web/src/app/study/page.tsx`, `server/src/index.ts`, `server/src/routes/lectureRoutes.ts`
- Trigger: Open any Study Circuit quiz tab.
- Workaround: None (flashcard deck works).
- Fix approach: Implement `GET /api/lectures/:id/quiz` (Ollama-generated or derived from flashcards) or remove the quiz tab until it exists. At minimum surface the 404 instead of `return []`.

**Whisper parse failure injects raw CLI stdout as transcript:**
- Symptoms: `server/src/services/whisperService.ts` last-ditch branch pushes `{ startTime: 0, endTime: 0, text: stdout.trim() }` when segment parsing yields nothing but stdout is non-empty. CLI logs/progress text becomes lecture content, then flows into chunking, embeddings, and summaries.
- Files: `server/src/services/whisperService.ts`
- Trigger: Corrupt audio or whisper.cpp flag mismatch that prints logs but no parseable segments.
- Workaround: None.
- Fix approach: Throw `whisper-cli produced no parseable segments` instead of fabricating content; mark lecture `FAILED` with stderr attached.

**Malformed whisper timestamps silently become 0:**
- Symptoms: `parseTimestampToSeconds()` in `server/src/services/whisperService.ts` returns `0` for any non-`hh:mm:ss` input (including `NaN` from `parseFloat` on garbage). Overlapping `0 → 0` segments break citation ordering and `duration` (computed as last segment `endTime` in `server/src/services/pipelineOrchestrator.ts`).
- Files: `server/src/services/whisperService.ts`, `server/src/services/pipelineOrchestrator.ts`
- Trigger: Unexpected whisper JSON timestamp shape.
- Workaround: None.
- Fix approach: Return `NaN`/throw on unparseable input, skip the segment with a warning, and compute duration as `max(endTime)`.

**Demo seeding can clone arbitrary audio:**
- Symptoms: `pickSeedAudioPath()` in `server/src/routes/lectureRoutes.ts` falls back to the smallest `.wav` in `uploads/` when `demo-60s.wav` is absent, copies it via `copySeedAudio()`, but seeds fixed Raft `DEMO_SEGMENTS`/`DEMO_SUMMARY` regardless of actual audio content.
- Files: `server/src/routes/lectureRoutes.ts`
- Trigger: Delete `uploads/demo-60s.wav`, upload any small WAV, hit `POST /api/lectures/seed-demo`.
- Workaround: Keep `uploads/demo-60s.wav` present.
- Fix approach: Seed only from the bundled demo asset or fail with `404 demo audio missing`; never attach unrelated audio to hardcoded transcripts.

**Server restart strands in-flight lectures at 50%:**
- Symptoms: Jobs launched by `queueMicrotask` die with the process. After restart, `getProgress()` in `server/src/services/pipelineOrchestrator.ts` finds no memory entry, sees `status === 'PROCESSING'`, and returns generic `{ stage: 'PROCESSING', progressPercent: 50 }` forever since nothing resumes the job.
- Files: `server/src/services/pipelineOrchestrator.ts`, `server/src/routes/lectureRoutes.ts`
- Trigger: Upload a long lecture, restart `npm run dev:server` mid-transcription, poll progress.
- Workaround: Delete and re-upload the lecture.
- Fix approach: On boot, reset `PROCESSING` rows to `PENDING`/`FAILED` with `errorMessage: 'server restarted'`, or add a startup sweeper that resumes them.

**Unrevoked object URLs in upload fallback leak memory:**
- Symptoms: `uploadLecture()` fallback in `web/src/lib/api.ts` calls `URL.createObjectURL(file)` and never calls `URL.revokeObjectURL()`. Other components (`web/src/components/AudioRecorder.tsx`, `web/src/components/IntakeModal.tsx`, `web/src/components/LectureWorkspace.tsx`) do revoke; this path does not.
- Files: `web/src/lib/api.ts`
- Trigger: Repeated failed uploads in one tab session.
- Workaround: Reload the tab.
- Fix approach: Revoke after playback/navigation or store the blob without an object URL until needed.

**Unbounded client `topK` reaches the retrieval prompt:**
- Symptoms: `server/src/routes/qnaRoutes.ts` destructures `topK = 6` from the body with no type/range check and passes it to `embeddingService.findTopK(queryEmbedding, topK)`. A client can request `topK: 100000` (full-table scan + gigantic `sourcesText` prompt) or `topK: 0`/`-1`/string.
- Files: `server/src/routes/qnaRoutes.ts`, `server/src/services/embeddingService.ts`
- Trigger: `POST /api/qna` with `{"question":"x","topK":100000}`.
- Workaround: None.
- Fix approach: Clamp to `1–20` server-side; validate with `zod`.

## Security Considerations

**Open CORS + no auth on a destructive API:**
- Risk: `app.use(cors())` in `server/src/index.ts` allows any origin; no tokens, sessions, or API keys guard `POST /api/lectures`, `DELETE /api/lectures/:id`, `POST /api/lectures/seed-demo`, or `POST /api/qna`. Any local web page or process can upload 500 MB files, delete the library, or spam GPU jobs.
- Files: `server/src/index.ts`, `server/src/routes/lectureRoutes.ts`, `server/src/routes/qnaRoutes.ts`
- Current mitigation: Binds to `localhost` default port `5000` (`server/src/config.ts`); not exposed beyond the machine unless port-forwarded.
- Recommendations: Restrict `cors({ origin: 'http://localhost:3000' })`, add a local token for mutating routes, and require confirmation + auth for `DELETE`.

**Unrestricted file upload served back as static content:**
- Risk: `multer` in `server/src/routes/lectureRoutes.ts` sets only `limits.fileSize: 500MB` with no `fileFilter`, preserves attacker-influenced extensions (`path.extname(file.originalname)`), and everything under `CONFIG.UPLOADS_DIR` is served via `express.static` in `server/src/index.ts`. An uploaded HTML/SVG/JS file becomes a hosted same-origin payload.
- Files: `server/src/routes/lectureRoutes.ts`, `server/src/index.ts`
- Current mitigation: Randomized multer filenames (`Date.now()_rand.ext`) limit guessing; `toPublicAudioPath()` only rewrites to `/uploads/<basename>`.
- Recommendations: Whitelist audio MIME/extensions (`.wav/.mp3/.m4a/.webm/.mp4/.ogg`), verify magic bytes, serve uploads with `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`, and store outside the static tree with a controller that sets audio content types.

**Internal error details leak to clients:**
- Risk: `details: String(error)` in every `lectureRoutes` 500, `details: String(error)` in `qnaRoutes`, and `Ollama embed error (...): <body>` / `whisper-cli execution failed ... Stderr:` in `server/src/services/embeddingService.ts` / `server/src/services/whisperService.ts` expose filesystem paths (`WHISPER_CLI_PATH`, `WHISPER_MODEL_PATH`, upload paths), Ollama status bodies, and CLI stderr to any caller.
- Files: `server/src/routes/lectureRoutes.ts`, `server/src/routes/qnaRoutes.ts`, `server/src/services/embeddingService.ts`, `server/src/services/whisperService.ts`
- Current mitigation: None beyond localhost binding.
- Recommendations: Return generic `error` codes to clients, log full details server-side with lecture IDs, and add an Express error middleware that strips `details` in `NODE_ENV=production`.

**Missing security headers and rate limiting:**
- Risk: No `helmet`, no CSP/HSTS, no rate limiter in `server/package.json` or `server/src/index.ts`. Expensive endpoints (`POST /api/lectures` 500 MB uploads, `POST /api/qna` GPU inference, `POST /api/lectures/seed-demo`) can be hammered without throttling.
- Files: `server/src/index.ts`, `server/package.json`
- Current mitigation: None.
- Recommendations: Add `helmet`, `express-rate-limit` (tight bucket on upload/Q&A/seed-demo), and `express.json({ limit: '1mb' })` instead of the unbounded default.

**Unbounded request bodies and prompt injection surface:**
- Risk: `express.json()` with no size cap plus unvalidated `question` length in `server/src/routes/qnaRoutes.ts` lets oversized questions inflate the Ollama prompt (`Sources:\n...\n\nQuestion: ${question}`). The question is interpolated into system-grounded prompts in `server/src/routes/qnaRoutes.ts` and `packages/core/src/pipeline.ts` (`citedQAMessages`) with no delimiting/sanitization, so crafted questions can attempt to override the "answer ONLY from sources" instruction.
- Files: `server/src/index.ts`, `server/src/routes/qnaRoutes.ts`, `packages/core/src/pipeline.ts`
- Current mitigation: Grounded system prompt instructing exact `Not covered in your lectures.` refusal.
- Recommendations: Cap question length (e.g. 2000 chars), wrap untrusted content in explicit `<question>`/`<sources>` delimiters, and truncate `sourcesText` to a token budget before sending.

**Child-process execution without timeouts:**
- Risk: `execFileAsync(ffmpegPath, args)` in `server/src/services/audioService.ts` and `execFileAsync(cli, args, { maxBuffer: 100MB })` in `server/src/services/whisperService.ts` set no `timeout`/`killSignal`. A hung FFmpeg/whisper.cpp process blocks a pipeline slot forever. `FFMPEG_CMD`/`WHISPER_CLI_PATH` come from env (`server/src/config.ts`), so a poisoned env redirects execution.
- Files: `server/src/services/audioService.ts`, `server/src/services/whisperService.ts`, `server/src/config.ts`, `server/src/routes/statusRoutes.ts`
- Current mitigation: `execFile` (argv, no shell) avoids shell injection; `statusRoutes` probes do set a 2 s timeout.
- Recommendations: Add `timeout: 30 min` (FFmpeg) / `timeout: 60 min` (whisper) with kill + `FAILED` transition, validate binary paths at startup, and never derive them from unsanitized request input.

**Secrets handling posture:**
- Risk: No secrets are required (fully offline), but `server/src/config.ts` calls `dotenv.config()` and reads `PORT`/`OLLAMA_BASE_URL`/`WHISPER_*`/`FFMPEG_CMD` from the environment. Secret-looking values must never be committed if added later.
- Files: `server/src/config.ts`, `.gitignore`, `server/prisma/dev.db`
- Current mitigation: No `.env` files exist in the repo root, `server/`, or `web/` (verified by existence check only, contents never read); `.gitignore` excludes `.env`, `.env*.local`, `*.db`, `uploads/`, `models/`, `tools/whisper/Release/`.
- Recommendations: Keep `.env` out of git, validate required paths at startup with a fail-fast message, and add a pre-commit secret scan before any cloud credentials are ever introduced.

## Performance Bottlenecks

**Sequential per-chunk Ollama embeddings + per-row inserts:**
- Problem: `generateAndSaveEmbeddings()` in `server/src/services/embeddingService.ts` awaits one `POST /api/embed` per chunk then one `prisma.chunk.create()` per chunk. `packages/server-routes/src/handlers.ts` has the same sequential `ollama.embed` loop.
- Files: `server/src/services/embeddingService.ts`, `packages/server-routes/src/handlers.ts`
- Cause: No batching (`options.batchSize` is accepted but ignored), no `createMany`, no concurrency limit.
- Improvement path: Batch embed requests (4–8 concurrent with `p-limit`), then single `createMany`. Honor `batchSize` or remove the option.

**In-JS full-table vector search:**
- Problem: `findTopK()` in `server/src/services/embeddingService.ts` (`prisma.chunk.findMany` with no `take`, `JSON.parse` every `embeddingJson`, JS `cosineSimilarity`, full sort, slice) and `getAllChunks()` in `packages/server-routes/src/sqlite-repository.ts` scan the entire corpus per question.
- Files: `server/src/services/embeddingService.ts`, `packages/server-routes/src/sqlite-repository.ts`, `packages/server-routes/src/handlers.ts`, `server/src/routes/qnaRoutes.ts`
- Cause: 768-dim vectors stored as JSON text in SQLite (`server/prisma/schema.prisma` `Chunk.embeddingJson`) with no vector index.
- Improvement path: Short term, add `take`/prefilter by lecture, cache parsed vectors, early-exit; medium term, migrate to `sqlite-vec`/`sqlite-vss` or an embedded ANN index once lectures exceed dozens.

**Unbounded full-lecture prompts to Ollama:**
- Problem: `extractStudyAids()` in `server/src/services/pipelineOrchestrator.ts` sends `chunks.map(c => c.text).join('\n\n')` (the entire lecture) to two separate `format: 'json'` chat calls; `summarizeLectureWithOllama()` map step is sequential with 120 s timeout per section. `packages/core/src/pipeline.ts` (`summarizeLecture`, `makeFlashcards`, `extractKeyTerms`, `answerQuestion`) has the same whole-corpus pattern.
- Files: `server/src/services/pipelineOrchestrator.ts`, `packages/core/src/pipeline.ts`
- Cause: No token budgeting, truncation, or parallelism.
- Improvement path: Cap study-aid input (e.g. first N chars + section-summary fallback), parallelize map calls with concurrency 2–3, stream reduce input, and record token counts in `SystemStatusDTO`.

**Blocking non-streaming LLM calls with long timeouts:**
- Problem: All chat calls use `stream: false` with `AbortSignal.timeout(60000–120000)` (`server/src/services/pipelineOrchestrator.ts`, `server/src/routes/qnaRoutes.ts`, `server/src/services/embeddingService.ts` 30 s). Slow Ollama responses hold the pipeline slot and the HTTP handler with no progress feedback.
- Files: `server/src/services/pipelineOrchestrator.ts`, `server/src/routes/qnaRoutes.ts`, `server/src/services/embeddingService.ts`
- Cause: Simplest integration; no streaming/SSE.
- Improvement path: Stream summaries/Q&A to the client (SSE), shorten Q&A timeout with one retry, and move long jobs fully async with cancellable polling.

**Lecture list N+1 counts:**
- Problem: `GET /api/lectures` in `server/src/routes/lectureRoutes.ts` includes `_count` for `segments`, `flashcards`, `keyTerms`, `chunks` on every row with no pagination.
- Files: `server/src/routes/lectureRoutes.ts`
- Cause: Convenience include; fine for a handful of lectures, linear cost growth after.
- Improvement path: Add `?limit&cursor` pagination, drop `_count` from the list (fetch counts lazily per lecture), or maintain counter columns.

**Aggressive frontend polling:**
- Problem: `web/src/components/PipelineProgress.tsx` (`setInterval(poll, pollIntervalMs)`), `web/src/components/UploadPanel.tsx`, `web/src/components/AudioUploader.tsx`, `web/src/components/LectureWorkspace.tsx` (`setTimeout(poll, 1200)`), and `web/src/components/AppShell.tsx` (`setInterval(load, 30000)`) poll fixed intervals with no backoff or abort guarantees.
- Files: `web/src/components/PipelineProgress.tsx`, `web/src/components/UploadPanel.tsx`, `web/src/components/AudioUploader.tsx`, `web/src/components/LectureWorkspace.tsx`, `web/src/components/AppShell.tsx`
- Cause: Simple progress UX without SSE/websockets.
- Improvement path: Exponential backoff + `AbortController` cleanup on unmount; switch progress to SSE when the backend supports it.

**Status endpoint pays embedding-probe latency on every call:**
- Problem: `probeEmbeddingThroughput()` in `server/src/routes/statusRoutes.ts` POSTs to `${OLLAMA_BASE_URL}/api/embeddings` (note: real code uses `/api/embed` in `server/src/services/embeddingService.ts`), awaits it serially after the main `Promise.all`, and derives tokens/sec from a 4-token ping. A slow Ollama makes every status poll slow; the endpoint mismatch means it likely always returns `undefined`.
- Files: `server/src/routes/statusRoutes.ts`, `server/src/services/embeddingService.ts`
- Cause: Liveness probe conflated with benchmark, wrong path, serial await.
- Improvement path: Fix the path to `/api/embed`, run the probe concurrently with a short timeout, cache the result for 30–60 s, and never block status on it.

**Uploads directory scanned synchronously per seed:**
- Problem: `pickSeedAudioPath()` in `server/src/routes/lectureRoutes.ts` does `readdirSync` + `statSync` on every file in `uploads/` on each `POST /seed-demo`.
- Files: `server/src/routes/lectureRoutes.ts`
- Cause: Convenience fallback when the demo asset is missing.
- Improvement path: Remove the scan; require the bundled demo asset or return `404`.

## Fragile Areas

**Whisper binary/model path mismatch breaks transcription out of the box:**
- Files: `server/src/config.ts`, `server/src/services/whisperService.ts`, `README.md`
- Why fragile: Default `WHISPER_CLI_PATH` is `tools/whisper/Release/whisper-cli.exe` (Windows-only) and default `WHISPER_MODEL_PATH` is `models/ggml-large-v3-turbo.bin`, while `README.md` documents `models/ggml-large-v3-turbo-q5_0.bin`. Both paths are gitignored (`models/`, `tools/whisper/Release/`), so a fresh clone has neither file and every pipeline fails at Stage 2 with `Whisper CLI binary not found` / `model weights not found`.
- Safe modification: Validate both paths at startup with a clear message and expected filenames; keep the README filename and config default identical; add a `npm run doctor` script that checks binary + model + FFmpeg + Ollama.
- Test coverage: Only timestamp/stdout parsing is tested (`server/src/services/__tests__/services.test.ts`); no startup-path or missing-binary test.

**Ollama endpoint and model-name drift across layers:**
- Files: `server/src/services/embeddingService.ts`, `server/src/routes/statusRoutes.ts`, `server/src/config.ts`, `packages/core/src/pipeline.ts`, `packages/server-routes/src/handlers.ts`
- Why fragile: Embeddings use `/api/embed` in production code but the status probe posts to `/api/embeddings`; chat-model defaults are `qwen2.5:14b` in `server/src/config.ts` but `qwen2.5:7b` in `packages/core`/`server-routes`; embedding defaults are `nomic-embed-text` vs `nomic-embed-text:latest`. A model rename or Ollama version change breaks one layer silently.
- Safe modification: Centralize `OLLAMA_*` constants and endpoint paths in `shared/`; add a contract test asserting all layers use the same URLs and default model strings.
- Test coverage: One mocked `/api/embed` assertion in `server/src/services/__tests__/services.test.ts`; no probe-path or default-model test.

**SQLite single-file store with JSON-vector blobs:**
- Files: `server/prisma/schema.prisma`, `server/prisma/dev.db`, `server/src/services/embeddingService.ts`, `packages/server-routes/src/sqlite-repository.ts`
- Why fragile: `Chunk.embeddingJson` stores 768 floats as text per chunk; `TranscriptSegment`/`Chunk`/`Flashcard`/`KeyTerm` all cascade-delete from `Lecture` with no soft delete. `dev.db` is gitignored but present locally, so schema drift between developers is invisible until `prisma db push` (no migrations directory) rewrites it.
- Safe modification: Treat `dev.db` as disposable; back it up before `db push`; add a migration workflow (`prisma migrate`) before any production use; never hand-edit the DB file.
- Test coverage: Chunking/cosine math only; no repository round-trip or cascade-delete test for the Prisma schema.

**Windows-only path assumptions:**
- Files: `server/src/config.ts`, `server/src/services/whisperService.ts`, `web/next.config.mjs`
- Why fragile: `.exe` default binary, backslash-agnostic `path.join` mixed with hardcoded `http://localhost:5000` rewrites in `web/next.config.mjs` and `http://localhost:11434` in `server/src/config.ts`. Moving to WSL/Docker/another port breaks frontend rewrites, Ollama routing, and transcription simultaneously.
- Safe modification: Derive URLs from env (`NEXT_PUBLIC_*` / `OLLAMA_BASE_URL`), probe `whisper-cli` vs `whisper-cli.exe` at startup, and document the supported OS matrix.
- Test coverage: None for config resolution.

**Demo-seed idempotency on title only:**
- Files: `server/src/routes/lectureRoutes.ts`
- Why fragile: `POST /seed-demo` dedupes on `title === 'DEMO: Raft in 60s'`. Renaming the demo lecture lets judges create duplicates; deleting it then re-seeding copies whatever smallest WAV exists (see Known Bugs).
- Safe modification: Dedupe on a stable `seedKey` column or check for the seeded segment/flashcard signature, not the editable title.
- Test coverage: None.

## Scaling Limits

**Single SQLite file + JSON vectors:**
- Current capacity: Fine for the hackathon corpus (a few lectures, hundreds of chunks). `server/prisma/dev.db` is ~70 KB with demo data.
- Limit: `findTopK` full-scan + `JSON.parse` per chunk degrades linearly; thousand-chunk corpora make every Q&A seconds-long and memory-heavy; concurrent writes from parallel pipelines hit SQLite locking.
- Scaling path: Page `findTopK` by lecture, cache vectors in-process, then adopt `sqlite-vec` or a dedicated vector store; move long jobs to a real queue with one GPU worker.

**Unbounded disk growth in `uploads/`:**
- Current capacity: 500 MB per file cap (`server/src/routes/lectureRoutes.ts`), but no total quota, no cleanup on delete/failure, and each upload fans out into original + `_16k_*.wav` + whisper JSON artifacts (+ `demo-seed` copies).
- Limit: A day of lecture uploads fills a student laptop SSD; `uploads/` is gitignored so growth is invisible to git status.
- Scaling path: Delete derived files on completion/failure (keep only replayable original or none), enforce per-library quota, expose storage usage in `GET /api/status`, and add a retention prune script.

**Single GPU worker, no admission control:**
- Current capacity: One 16 GB NVIDIA GPU (defaults assume `RTX 5060 Ti` in `server/src/routes/statusRoutes.ts`) running whisper.cpp CUDA + Ollama `qwen2.5:14b`.
- Limit: Two concurrent 2-hour lectures exhaust VRAM/timeouts (120 s per section × many sections); `queueMicrotask` offers no backpressure.
- Scaling path: Single-flight pipeline executor with `429 Retry-After` when busy; downshift default model to `qwen2.5:7b` on low VRAM; document minimum VRAM.

**Prompt size ceiling on long lectures:**
- Current capacity: Map-reduce at ~1500-word sections (`server/src/services/pipelineOrchestrator.ts`, `packages/core/src/pipeline.ts`) handles typical 60–120 min lectures.
- Limit: Whole-lecture `extractStudyAids` input grows without bound; multi-hour lectures exceed Ollama context and produce truncated/invalid JSON (silently swallowed).
- Scaling path: Budget study-aid input from section summaries instead of raw text; validate JSON against schema and retry once before giving up.

**List endpoints with no pagination:**
- Current capacity: `GET /api/lectures` returns the whole library (`server/src/routes/lectureRoutes.ts`); `getAllChunks()` loads every vector (`packages/server-routes/src/sqlite-repository.ts`).
- Limit: Dozens of lectures make lecture-list and Q&A payloads MB-scale.
- Scaling path: Cursor pagination on lectures, `topK` clamping on Q&A, and never return `embeddingJson` to clients.

## Dependencies at Risk

**`multer@1.4.5-lts.1` (upload gatekeeper):**
- Risk: 1.x line is effectively legacy; the `-lts` fork lags upstream fixes. It is the sole guard between arbitrary uploads and `express.static` hosting.
- Impact: Any upload-parsing vulnerability exposes stored-file hosting directly.
- Migration plan: Upgrade to actively maintained multipart handling (`multer@2.x` or `busboy`/`formidable` + explicit `fileFilter`/size caps) and add extension/MIME allowlisting in `server/src/routes/lectureRoutes.ts`.

**`express@4.21.2` without hardening middleware:**
- Risk: Express 4 is in maintenance mode while Express 5 is current; more importantly the app ships with no `helmet`, no rate limiting, and unbounded `express.json()` (`server/src/index.ts`).
- Impact: Every DoS/abuse concern above is one dependency addition away from mitigation but currently unmitigated.
- Migration plan: Add `helmet` + `express-rate-limit` now; evaluate Express 5 in a branch (breaking `req.params`/`wildcard` behavior) before committing.

**Native SQLite drivers (`better-sqlite3` / `node:sqlite` fallback):**
- Risk: `packages/server-routes/src/sqlite-repository.ts` (`createSqliteDb`) `require()`s `better-sqlite3` then `node:sqlite` (`DatabaseSync`, Node 22+). Native builds break across Node upgrades and Windows toolchains; `require` in ESM/TS is itself fragile.
- Impact: `packages/server-routes` tests/dev break on Node version bumps even though the shipping backend uses Prisma (`@prisma/client@6.3.1`).
- Migration plan: Pin the Node version (`.nvmrc`/Volta), prefer one driver, and keep `packages/server-routes` aligned with the Prisma backend or delete it (see Tech Debt).

**Bleeding-edge frontend (`next@15.1.6` + `react@19`):**
- Risk: Major-version React + Next App Router churn; `lucide-react@0.475`, `tailwindcss@3.4` move fast. `web/.next/` build output is present locally, masking clean-build failures.
- Impact: Upgrades break `LectureWorkspace`/`AppShell` behavior; build cache hides it until CI or judging machines build fresh.
- Migration plan: Lock versions, add a clean `next build` CI step, and clear `web/.next/` from any shared environments.

**Unmanaged local-AI runtime (not in npm):**
- Risk: `whisper.cpp v1.9.5 CUDA`, `ggml-large-v3-turbo` weights, `Ollama v0.40.1` + `qwen2.5:14b/7b` + `nomic-embed-text`, `FFmpeg v9.0.1` live outside `package.json` in gitignored `tools/`, `models/`, system PATH, and the Ollama daemon. A fresh clone has transcription, embeddings, summarization, and Q&A all red.
- Impact: Highest demo-day risk: everything works on the author's GPU and nothing works on a clean machine.
- Migration plan: Add `scripts/doctor.*` + `scripts/setup.*` that verify/pin each binary and model hash, and document exact download URLs and VRAM minimums in `README.md`.

**`ecc-universal@2.2.3` as a production dependency:**
- Risk: Root `package.json` lists `ecc-universal` (agent skills/framework) under `dependencies`, so every `npm install`/`npm ci` and any future deployment bundle pulls dev tooling into the runtime.
- Impact: Bloat, slower installs, wider supply chain for no runtime benefit.
- Migration plan: Move to `devDependencies` or remove from the shipped workspace.

**Fragmented lockfiles:**
- Risk: Root `package-lock.json` plus nested `packages/ui/package-lock.json`, `packages/core/package-lock.json`, `packages/server-routes/package-lock.json` indicate independent installs that drift from the workspace root.
- Impact: Different developers resolve different transitive versions; `npm ci` at root does not reproduce `packages/*` builds.
- Migration plan: Single workspace-managed lockfile; delete nested lockfiles; document one install command.

## Missing Critical Features

**No retry/cancel for failed or stuck pipelines:**
- Problem: Lectures reaching `FAILED` (or stranded `PROCESSING`) in `server/prisma/schema.prisma` (`status` string field) have no `POST /retry`, no `POST /cancel`, and `GET /:id/progress` surfaces only a generic message. The only recovery is delete + re-upload.
- Blocks: Demo recovery when transcription or Ollama flakes mid-judge-run.
- Fix: Add retry-from-stage using preserved `audioPath`, plus cancel that kills the child process and marks `FAILED` with reason.

**No storage management:**
- Problem: No endpoint or UI shows `uploads/` usage, no quota, no prune, and delete does not free disk (see Known Bugs). `web/src/app/settings/page.tsx` has cache/status UI but no storage controls.
- Blocks: Multi-lecture semester use on limited laptop SSDs.
- Fix: Expose bytes used/file count in `GET /api/status`, add `DELETE` file cleanup, and a settings-pane prune for derived artifacts.

**No lecture editing or reprocessing:**
- Problem: Titles are set once at upload (`server/src/routes/lectureRoutes.ts`); summaries/flashcards/key terms cannot be regenerated without re-uploading. No `PATCH /api/lectures/:id`.
- Blocks: Fixing typos, re-running a better model, or refreshing study aids after transcript corrections.
- Fix: Add title rename plus `POST /api/lectures/:id/regenerate` (summary/cards/terms only, reusing stored chunks).

**No real quiz backend:**
- Problem: Study Circuit UI (`web/src/app/study/[id]/page.tsx`, `web/src/app/study/page.tsx`, `packages/ui/src/study/QuizPlayer.tsx`) expects `GET /api/lectures/:id/quiz`, which no router implements.
- Blocks: Half the study experience (quiz tab always empty).
- Fix: Implement quiz generation (Ollama JSON schema over chunks, cached per lecture) or remove the tab and `QuizPlayer` wiring until it exists.

**No pagination, search, or filtering on lectures:**
- Problem: `GET /api/lectures` returns everything ordered by `createdAt`; client-side search in `web/src/app/lectures/page.tsx` filters only loaded rows.
- Blocks: Semester-scale libraries (dozens of 2-hour lectures).
- Fix: Server-side `?q&limit&cursor` with title/summary/chunk-text search.

**No observability:**
- Problem: `console.log`/`console.error`/`console.warn` only (`server/src/index.ts`, `server/src/services/pipelineOrchestrator.ts`); Prisma logs warnings/errors only in development (`server/src/db.ts`); no request IDs, no structured logs, no metrics beyond the fragile tokens/sec probe.
- Blocks: Diagnosing judge-demo failures and performance regressions.
- Fix: Adopt a logger (`pino`), log lecture/job/duration/model on every stage, and include `requestId` in 500 payloads (without internal details).

**No API documentation or contract tests:**
- Problem: DTOs live in `shared/src/index.ts` but no OpenAPI/spec, and frontend/backend drift is already visible (`/quiz` missing, `topK` unclamped, status shape mismatch).
- Blocks: Safe parallel frontend/backend work and judging-environment integration.
- Fix: Generate OpenAPI from routers (or at least a `docs/API.md` verified by contract tests for every `fetch*` in `web/src/lib/api.ts`).

## Test Coverage Gaps

**Routes and Q&A have zero tests:**
- What's not tested: `POST /` upload flow, `POST /seed-demo` idempotency, `GET /:id/progress`, `GET /` mapping, `GET /:id` mapping, `DELETE /:id`, and the entire grounded Q&A flow in `server/src/routes/qnaRoutes.ts` (empty-corpus refusal, Ollama failure, citation mapping, `topK` handling).
- Files: `server/src/routes/lectureRoutes.ts`, `server/src/routes/qnaRoutes.ts`, `server/src/routes/statusRoutes.ts`, `server/src/services/__tests__/services.test.ts`
- Risk: Highest. Every Known Bug above (orphaned files, fabricated uploads, citation swallowing, missing quiz) ships through untested routes.
- Priority: High. Add `supertest` route tests with mocked `pipelineOrchestrator`/`embeddingService`/Prisma before any refactor.

**Pipeline failure paths are untested:**
- What's not tested: Ollama non-OK on summary/flashcards/terms, `JSON.parse` of malformed LLM output, empty-chunk short-circuits in `extractStudyAids`/`summarizeLectureWithOllama`, whisper missing-binary/missing-model/missing-audio errors, FFmpeg failure, restart-stranded `PROCESSING`.
- Files: `server/src/services/pipelineOrchestrator.ts`, `server/src/services/whisperService.ts`, `server/src/services/audioService.ts`, `server/src/services/embeddingService.ts`
- Risk: Silent empty summaries/cards (the `catch {}` paths) are the default behavior under Ollama outages and are never asserted.
- Priority: High. Mock `fetch` rejection/non-OK/partial-JSON and assert `FAILED` vs degraded-`COMPLETED` explicitly.

**Duplicate-stack tests do not cover shipped code:**
- What's not tested (in production): The well-tested `packages/core/test/` (`pipeline.test.ts`, `ollama.test.ts`, `audit.test.ts`) and `packages/server-routes/test/handlers.test.ts` cover `packages/*` logic, while traffic runs `server/src/*` logic tested only by `server/src/services/__tests__/services.test.ts` (chunking/cosine/timestamp/stdout/progress-memory).
- Files: `packages/core/test/pipeline.test.ts`, `packages/core/test/ollama.test.ts`, `packages/server-routes/test/handlers.test.ts`, `server/src/services/__tests__/services.test.ts`
- Risk: Green tests give false confidence; a fix in `packages/core/src/pipeline.ts` never reaches users.
- Priority: High. Consolidate to one stack, then move the mock-Ollama/whisper suites onto the surviving implementation.

**Frontend `web/src` has no tests:**
- What's not tested: `fetchLecturesWithSource`/`fetchLectureWithSource`/`askQuestionWithSource` fallback branching, `uploadLecture` simulator, `fetchProgress` simulator, `seedDemoLecture` error shapes, and all polling/upload/record components (`web/src/components/UploadPanel.tsx`, `web/src/components/AudioUploader.tsx`, `web/src/components/AudioRecorder.tsx`, `web/src/components/LectureWorkspace.tsx`, `web/src/components/PipelineProgress.tsx`).
- Files: `web/src/lib/api.ts`, `web/src/components/*.tsx`, `web/src/app/**/page.tsx`
- Risk: The three fallback bugs (fabricated upload, swallowed unsupported answers, fake progressive progress in `web/src/lib/api.ts` via `mockProgressMap`/`PROGRESS_STAGES`) are unasserted and user-facing.
- Priority: High. Add `vitest` + Testing Library tests for `web/src/lib/api.ts` branching (live vs fallback vs error) before touching fallback behavior. (`packages/ui` component tests in `packages/ui/src/__tests__/` do not cover `web/src`.)

**No upload, large-file, or binary-integration tests:**
- What's not tested: 500 MB limit enforcement, non-audio file rejection (currently absent), `uploads/` cleanup, whisper/FFmpeg missing-binary errors, Ollama-down behavior, concurrent uploads.
- Files: `server/src/routes/lectureRoutes.ts`, `server/src/services/audioService.ts`, `server/src/services/whisperService.ts`
- Risk: Medium. Demo-day failures (missing `tools/whisper/Release/whisper-cli.exe`, missing `models/*.bin`, Ollama not running) are the most likely incident and the least tested.
- Priority: Medium. Add a `doctor` integration test (binary/model/FFmpeg/Ollama presence reporting) plus multer limit/filter tests.

**No E2E or performance tests:**
- What's not tested: Upload → progress → transcript → summary → flashcards → Q&A with citations; long-lecture prompt budgeting; Q&A latency vs corpus size; `web/.next/` clean-build health.
- Files: `server/src/index.ts`, `web/next.config.mjs`, `web/src/app/page.tsx`, `web/src/app/lectures/page.tsx`, `web/src/app/ask/page.tsx`
- Risk: Medium. Regressions in rewrite routing (`/api/:path*` → `localhost:5000`), polling, and retrieval quality ship unseen.
- Priority: Medium. Add one Playwright smoke (seed-demo → lecture → ask with citation) and a `next build` + `tsc --noEmit` CI gate (`web/package.json` has `typecheck` but no test runner).

---

*Concerns audit: 2026-10-09*
