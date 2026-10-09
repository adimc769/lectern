---
last_mapped_commit: 15310b9043b62a1f115f333f51535da622f0d098
last_mapped_at: 2026-10-09
---
# External Integrations

**Analysis Date:** 2026-10-09

## APIs & External Services

**Local LLM (Ollama — required, localhost HTTP, no SDK):**
- Ollama chat completions — map-reduce summarization and study-aid extraction
  - Call it with native `fetch` `POST {OLLAMA_BASE_URL}/api/chat`, `{ stream: false }` — see `server/src/services/pipelineOrchestrator.ts`
  - Model: `CONFIG.OLLAMA_LLM_MODEL` (default `qwen2.5:14b`, see `server/src/config.ts`)
  - Structured output: pass `format: 'json'` and `JSON.parse(data.message.content)` for flashcards/key-terms — see `server/src/services/pipelineOrchestrator.ts`
  - Timeouts: `AbortSignal.timeout(120000)` for pipeline calls, `AbortSignal.timeout(60000)` for Q&A in `server/src/routes/qnaRoutes.ts`
- Ollama embeddings — single-text vectors and liveness probe
  - Canonical path: `POST {OLLAMA_BASE_URL}/api/embed` with `{ model, input }`, accepting either `embeddings[0]` or `embedding` — see `server/src/services/embeddingService.ts` (`getEmbedding`, 30 s timeout)
  - Health-probe path only: `POST {OLLAMA_BASE_URL}/api/embeddings` with `{ model, prompt }` — see `server/src/routes/statusRoutes.ts` (`probeEmbeddingThroughput`); use `/api/embed` for all new embedding code
  - Model: `CONFIG.OLLAMA_EMBED_MODEL` (default `nomic-embed-text`, 768-dim per `server/prisma/schema.prisma` comment)
- Ollama model inventory — `GET {OLLAMA_BASE_URL}/api/tags`, 2 s timeout, returns `ollamaModels[]` — see `server/src/routes/statusRoutes.ts` (`probeOllama`)
- Auth: none (localhost trusted); base URL override via `OLLAMA_BASE_URL` env var (see `server/src/config.ts`)

**Local speech-to-text (whisper.cpp — subprocess, no SDK):**
- `whisper-cli.exe` invoked via promisified `execFile` with flags `-m <model> -f <wav> -dev <gpuId> -fa|-nfa -oj -of <prefix>` — see `server/src/services/whisperService.ts`
- Binary path: `CONFIG.WHISPER_CLI_PATH` (default `tools/whisper/Release/whisper-cli.exe`); weights: `CONFIG.WHISPER_MODEL_PATH` (default `models/ggml-large-v3-turbo.bin`); both presence-checked with `fs.existsSync` before execution
- Output parsing: read `<prefix>.json` (`transcription[]` with `offsets` ms or `timestamps`), fall back to stdout `[HH:MM:SS,mmm --> HH:MM:SS,mmm]` regex, then to a single trimmed-stdout segment; always delete the JSON artifact after parsing — see `server/src/services/whisperService.ts`
- GPU flags: `-dev 0` + flash-attention `-fa` by default (`WhisperOptions` in `server/src/services/whisperService.ts`)

**Local media transcoding (FFmpeg — external binary on PATH):**
- Conversion: `ffmpeg -y -i <input> -ar 16000 -ac 1 -c:a pcm_s16le <out>.wav`, output validated by existence + non-zero size — see `server/src/services/audioService.ts`
- Binary name override via `FFMPEG_CMD` env var / `CONFIG.FFMPEG_CMD` (see `server/src/config.ts`)
- Liveness: `ffmpeg -version` with 2 s timeout, surfaced as `ffmpegReady` — see `server/src/routes/statusRoutes.ts`

**Local GPU introspection (nvidia-smi — subprocess probe):**
- `nvidia-smi --query-gpu=name,memory.total --format=csv,noheader` with 2 s timeout; on any failure return hardcoded fallback (`NVIDIA GeForce RTX 5060 Ti`, `16283` MB, `nvidiaSmiOk: false`) — see `server/src/routes/statusRoutes.ts`
- Use the `{ gpuName, vramTotalMB, nvidiaSmiOk }` probe shape for any new hardware check; never shell out with string concatenation — keep `execFile(cmd, args[])`

**Cloud / SaaS APIs:**
- None — zero cloud dependencies by design (see `README.md`, `server/src/index.ts` `mode: 'offline'`, `SystemStatusDTO.offline` in `shared/src/index.ts`)

## Data Storage

**Databases:**
- SQLite file DB via Prisma `^6.3.1`
  - Connection: `file:./dev.db` datasource in `server/prisma/schema.prisma` (resolves to `server/prisma/dev.db`)
  - Client: `PrismaClient` singleton with dev/prod log levels in `server/src/db.ts`
  - Models: `Lecture`, `TranscriptSegment`, `Chunk`, `Flashcard`, `KeyTerm` (cascade deletes, `@@index([lectureId])` on children) — see `server/prisma/schema.prisma`
  - Vectors: no vector extension — 768-dim embeddings stored as serialized JSON in `Chunk.embeddingJson`; retrieval is brute-force cosine similarity in JS (`findTopK`/`cosineSimilarity` in `server/src/services/embeddingService.ts`)
  - Migrations: `prisma db push` / `prisma generate` via root `db:push` / `db:generate` scripts (see `package.json`); no migration history directory
  - Seed: idempotent demo lecture via `POST /api/lectures/seed-demo` in `server/src/routes/lectureRoutes.ts`, mirrored by `scripts/seed-demo.ts` (`npm --workspace=server run seed:demo`)

**File Storage:**
- Local filesystem only — `uploads/` dir at repo root (path from `CONFIG.UPLOADS_DIR` in `server/src/config.ts`; created at startup in `server/src/index.ts`)
- Uploads: `multer` `diskStorage`, randomized filenames, 500 MB cap — see `server/src/routes/lectureRoutes.ts`
- Serving: `express.static` at `/uploads` in `server/src/index.ts`, proxied by Next.js rewrites in `web/next.config.mjs`; public path mapping via `toPublicAudioPath()` in `server/src/routes/lectureRoutes.ts`
- `Lecture.audioPath` stores the absolute disk path; the API maps it to `/uploads/<file>` before responding

**Caching:**
- None — no Redis, no HTTP cache headers, no memoization layer; progress is an in-memory `Map` in `server/src/services/pipelineOrchestrator.ts` (lost on restart, DB status is the fallback)

## Authentication & Identity

**Auth Provider:**
- None — no login, no sessions, no tokens, no middleware
  - Implementation: open localhost API; `cors()` with default (allow-all) options in `server/src/index.ts`
- Add authentication at the Express layer in `server/src/index.ts` (before the `/api/*` mounts) if the server ever binds beyond localhost; the frontend calls same-origin `/api/...` via `fetch` in `web/src/lib/api.ts`, so cookie-based auth fits the existing call pattern

## Monitoring & Observability

**Error Tracking:**
- None — no Sentry/PostHog/equivalent; failures surface as `status: 'FAILED'` on `Lecture` plus `{ error, details }` JSON bodies (see `server/src/services/pipelineOrchestrator.ts`, `server/src/routes/lectureRoutes.ts`, `server/src/routes/qnaRoutes.ts`)

**Logs:**
- `console.log`/`console.warn`/`console.error` only (startup lines in `server/src/index.ts`, pipeline warnings/errors in `server/src/services/pipelineOrchestrator.ts`)
- Operational telemetry is the `GET /api/status` endpoint (always HTTP 200 with safe fallbacks) consumed by the settings UI via `fetchSystemStatusWithSource()` in `web/src/lib/api.ts` — see `server/src/routes/statusRoutes.ts`

## CI/CD & Deployment

**Hosting:**
- Local workstation only — Express on `http://localhost:5000` (`server/src/index.ts`), Next.js on `http://localhost:3000` (`web/package.json`); Next.js rewrites couple the two origins (see `web/next.config.mjs`)

**CI Pipeline:**
- None detected — no workflow configs in the repo; verification is manual (`npm run typecheck --workspaces`, `npm --workspace=server run test`, `npm run build --workspaces` per `package.json` and `server/package.json`)

## Environment Configuration

**Required env vars:**
- None strictly required — every `CONFIG` key in `server/src/config.ts` has a default, so the server boots with zero env configuration
- Effective (functional) requirements, all local:
  - `OLLAMA_BASE_URL` reachable with `nomic-embed-text` + `qwen2.5:14b` pulled when the defaults are kept (`ollama pull nomic-embed-text`, `ollama pull qwen2.5:14b` per `README.md`)
  - `WHISPER_CLI_PATH` + `WHISPER_MODEL_PATH` files present (defaults: `tools/whisper/Release/whisper-cli.exe`, `models/ggml-large-v3-turbo.bin`)
  - `ffmpeg` resolvable on `PATH` (or set `FFMPEG_CMD`); `PORT` free (default `5000`)
- `web/.env.local` file present — existence noted only; contents never read or quoted

**Secrets location:**
- No secrets exist in this architecture — no API keys, tokens, or credentials; `.gitignore` already excludes `.env`, `.env*.local`, `*.db`, `uploads/`, `models/`, and `tools/whisper/Release/`
- Keep it that way: never add a cloud key to `server/src/config.ts` or `web/.env.local` without a secrets manager; localhost Ollama/whisper/FFmpeg need no credentials

## Webhooks & Callbacks

**Incoming:**
- None — no webhook receivers; the only mutation endpoints are `POST /api/lectures` (multipart `file` + `title`), `POST /api/lectures/seed-demo`, `POST /api/qna` (`{ question, topK }`), and `DELETE /api/lectures/:id` (see `server/src/routes/lectureRoutes.ts`, `server/src/routes/qnaRoutes.ts`)

**Outgoing:**
- None — no outbound webhooks, no event bus, no SSE/WebSocket; the frontend polls `GET /api/lectures/:id/progress` (see `fetchProgress` in `web/src/lib/api.ts` and `getProgress` in `server/src/services/pipelineOrchestrator.ts`)

---

*Integration audit: 2026-10-09*
