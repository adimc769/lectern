# Stack Research

**Domain:** Local-first offline AI study assistant — document ingestion (PDF/DOCX/TXT) + grounded practice-exam generation (local LLM, JSON-schema validated) + mixed-source retrieval
**Researched:** 2026-10-09
**Confidence:** HIGH (extraction + validation libs version-verified via npm registry 2026-09/10); MEDIUM (Ollama structured-output adherence on qwen2.5 — official docs verified, model-specific behavior needs benchmarking)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| unpdf | ^1.8.1 | PDF text extraction with per-page output | Returns text as a per-page array (`extractText` → `{ totalPages, text: string[] }`), which maps 1:1 onto the required `[Doc, p. N]` citation model with zero bookkeeping. Pure-JS wrapper over Mozilla PDF.js (serverless build bundled, no worker files, no native compilation — critical on Windows where every native dep is a CUDA-toolchain risk). unjs-maintained, MIT, ~6.1M weekly downloads, updated 2026-08-13. `extractTextItems` also exposes positioned items (x/y/fontSize) if section-heading detection is ever needed — no second library required. |
| mammoth | ^1.13.0 | DOCX text + structure extraction | The standard DOCX→text library for Node (~10M weekly downloads, updated 2026-09-26, BSD-2-Clause, pure JS, zero native deps). Two APIs that together cover both milestone needs: `extractRawText` for fast plain-text ingestion, and `convertToHtml` with style-map (`Heading 1` → `h1`) so section headings survive for `[Doc, section]` citations. Buffer input (`{ buffer }`) fits the multer disk/memory flow without temp-file juggling. |
| Node native `node:fs` + `TextDecoder` | built-in (Node 24) | TXT ingestion | TXT needs no dependency. Read the buffer, decode UTF-8, split on line breaks into pseudo-pages/sections. Adding a library here is pure supply-chain surface for zero benefit. |
| zod | ^4.5.4 | Runtime schema validation for exam JSON + upload/request DTOs | Already flagged as missing in the codebase audit (`CONCERNS.md`: "No schema validation library" — manual `typeof` checks, unclamped `topK`). Zod 4 is stable (4.5.4 published 2026-08-29, MIT, ~275M weekly downloads, zero dependencies) and does double duty: (1) validates every LLM exam payload with `safeParse` before persistence, and (2) serializes the *same* schema to JSON Schema via native `z.toJSONSchema()` for the Ollama `format` parameter — one source of truth from prompt constraint to runtime validation, exactly the pattern in Ollama's official structured-outputs docs. Also use it to clamp `topK` (1–20) and validate upload fields, closing two known bugs at once. |
| Ollama `/api/chat` via native `fetch` with `format: <JSON Schema>` | Ollama ≥ 0.11.x server-side (structured outputs); existing `qwen2.5:14b` model | Grounded exam generation (MCQ, true/false, identification) | Keep the codebase's established integration pattern (native `fetch` + `AbortSignal.timeout`, no SDK — see `INTEGRATIONS.md`) and upgrade only the `format` argument: today the pipeline sends `format: 'json'` and hand-parses; the milestone should send `format: <JSON Schema object>` (officially supported per `docs.ollama.com/capabilities/structured-outputs`, with curl + JS + Python examples). Constraining output to the exam schema at generation time is strictly more reliable than generating free JSON and validating after. Keep `qwen2.5:14b` for the exam path (larger model = better schema adherence); temperature `0` per official guidance for deterministic structured output. |
| Prisma + SQLite (existing) | ^6.3.1 (no change) | Persist `Document`, `DocumentChunk`, `Exam`, `ExamQuestion` rows | No new database or vector extension. Document chunks reuse the proven pattern: text + `embeddingJson` (768-dim `nomic-embed-text`) + brute-force cosine `findTopK` in `embeddingService.ts`. New tables mirror the existing `Lecture → Chunk/Flashcard/KeyTerm` aggregate shape, so the mixed-source retrieval change is a union over two chunk tables, not a new retrieval engine. |
| multer | ^2.3.0 (upgrade from `1.4.5-lts.1`) | Document upload gatekeeping with type allowlisting | The 1.x `-lts` fork is legacy; 2.3.0 is current (registry, updated 2026-08-28, 21M weekly downloads). The upgrade's value is security, not features: `fileFilter` (whitelist `.pdf/.docx/.txt` by extension + MIME) + `limits: { fileSize, files: 1 }` directly mitigates the "unrestricted file upload served back as static content" concern already on record. Same API shape as the existing `diskStorage` config — a version bump plus ~15 lines, not a migration. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pdfjs-dist | ~6.4.299 (only if unpdf's bundled build proves insufficient) | Direct PDF.js API access | If a PDF needs worker-based parsing off the event loop or custom `getDocument` options. Note the engine constraint: pdfjs-dist 6.x requires Node `>=22.13.0` — satisfied (repo runs Node 24.19.0) but worth pinning an `engines` note. Do **not** install preemptively alongside unpdf; unpdf already bundles a serverless PDF.js build. |
| file-type | ^21.x (verify at install; training-data version — MEDIUM confidence) | Magic-byte verification of uploads | When `fileFilter` extension/MIME checks are deemed insufficient (server audit recommends verifying magic bytes: PDF `%PDF`, DOCX zip `PK\x03\x04`, TXT heuristic). Cheap defense-in-depth for a milestone that accepts arbitrary student files. Skip for the first slice if time-pressed — extension + MIME allowlisting covers the demo threat model on localhost. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `scripts/doctor` (new, repo-owned) | Verify PDF/DOCX toolchain at startup | Pure-JS milestone adds no binaries, so the doctor check is trivial: assert `unpdf`/`mammoth`/`zod` resolve and Ollama `/api/tags` lists `qwen2.5:14b`. Extends the existing `GET /api/status` probe pattern; catches `npm install` skew before it becomes a demo-day failure. |
| vitest (existing) | Exam-schema + extractor unit tests | Already configured (`server/package.json`). Priority tests: Zod schemas accept golden exam JSON / reject malformed LLM output; extractor returns expected page counts on fixture PDF/DOCX; retry-on-parse-failure path triggers exactly once. |

## Installation

```bash
# Core (server workspace)
npm install --workspace=server unpdf mammoth zod

# Upload hardening (upgrade in place)
npm install --workspace=server multer@^2.3.0

# Supporting (only if magic-byte checks are in scope)
npm install --workspace=server file-type

# No changes needed: express, @prisma/client, ollama access via native fetch, whisper.cpp, FFmpeg
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| unpdf ^1.8.1 | pdf-parse v2 (^2.4.5) | If the team prefers a class-based API (`new PDFParse({ url/data })` → `getText()/getTable()/getImage`) or needs table/image extraction helpers out of the box. pdf-parse v2 is a pure-TS rewrite (no `pdfjs` worker-file pain of v1), but its v1→v2 breaking rewrite is younger and less battle-tested in this repo's context than the PDF.js engine family the team already implicitly depends on. Either is defensible; do not use both. |
| unpdf ^1.8.1 | pdfjs-dist ^6.4.299 direct | If per-page iteration, custom worker configuration, or rendering is needed beyond `extractText`/`extractTextItems`. Costs ~40 lines of `getDocument` boilerplate (worker setup, per-page loop, cleanup) that unpdf already encapsulates. |
| mammoth ^1.13.0 | docx (^9.x) | `docx` is a *generator* (creates DOCX files), not an extractor — only relevant if the milestone later adds exam-paper export to Word. For ingestion it is the wrong tool entirely. |
| zod ^4.5.4 | yup / joi / express-validator / valibot | `express-validator` covers request-shape validation only and cannot serialize schemas to JSON Schema for the Ollama `format` param — it would leave the exam-generation half of the problem unsolved. valibot is smaller but lacks Zod 4's native `z.toJSONSchema()` + official Ollama-docs endorsement. Standardize on Zod; it is also the direct fix for the recorded "no schema validation library" debt. |
| native `fetch` + JSON-Schema `format` | ollama npm package (^0.6.4) | The official `ollama` JS client (0.6.4, 2026-09-29, MIT) is a thin REST wrapper — `ollama.chat({ model, messages, format })` with the same Zod pattern in its docs. It buys TypeScript request types at the cost of a new dependency and a second calling convention next to the four existing native-`fetch` call sites. Adopt it only if the team wants typed clients everywhere (a larger refactor); for this milestone, one consistent pattern wins. |
| native `fetch` + JSON-Schema `format` | Raw `format: 'json'` + hand `JSON.parse` (status quo) | Never for the new exam path. The existing flashcards/key-terms flow already suffers silent empty results from malformed LLM JSON (recorded in `CONCERNS.md`); repeating that pattern for graded exam content multiplies the trust damage. Schema-constrained generation + `safeParse` + one retry is the whole point of this milestone's reliability story. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| pdf-parse 1.x (`~1.1.1`) | Legacy API (`dataBuffer` + callback-style), amalgam of old `pdf.js` + fragile test assets; superseded by the v2 rewrite. Any tutorial pinning `pdf-parse@1.x` is stale. | unpdf ^1.8.1 (or pdf-parse v2 if its API is preferred) |
| Tesseract.js / any OCR engine | Scanned-PDF OCR is explicitly out of scope (`PROJECT.md`); OCR adds a WASM/native payload plus language-data downloads that break the offline-provisioning story for zero milestone value. | Text-layer extraction via unpdf; return "scanned document, no text layer" as an honest readiness state |
| Cloud OCR/parsing APIs (Adobe PDF Services, hosted unstructured.io) | Violates the local-first constraint — network calls + API keys + data leaving the machine. Kills the core value proposition. | Local unpdf/mammoth pipeline |
| LangChain / LlamaIndex | Heavyweight orchestration frameworks for a pipeline that is already built (chunk → embed → retrieve → grounded prompt). They add version-churn surface and abstraction over Ollama calls the team already controls line-by-line. Hackathon budget says no. | Existing `embeddingService` + `chunkingService` + a `documentService`/`examService` following the service-singleton pattern |
| zod-to-json-schema (extra package) | Redundant since Zod 4: native `z.toJSONSchema()` produces the schema object Ollama's `format` accepts (per current official docs). The 2024-era blog pattern using `zodToJsonSchema()` is outdated. | `z.toJSONSchema()` from the `zod` package itself |
| `qwen2.5:7b` (or smaller) for exam generation | Weaker schema adherence on constrained-generation tasks; the 14b model is already provisioned and default-configured. VRAM pressure is real on a single GPU, but exam generation is a short bursty job, not a sustained load — serialize it behind the pipeline queue instead of shrinking the model. | Keep `qwen2.5:14b` for the exam/Q&A paths; consider 7b only for bulk embedding-adjacent work if benchmarks force it |
| Separate vector DB (Chroma/Qdrant/pgvector) | Corpus scale (a semester of documents) fits the proven SQLite-JSON + brute-force cosine pattern. A new store means a new provisioning step, new failure mode, and migration of the existing lecture vectors — all for unmeasured performance gain. | Reuse `Chunk.embeddingJson` pattern in a `DocumentChunk` table; revisit only with benchmark numbers showing Q&A latency pain |

## Stack Patterns by Variant

**If a PDF has no text layer (scanned image-only):**
- Detect via `extractText` returning empty/whitespace-only pages, mark the document `status: 'UNREADABLE'` with reason `no-text-layer`, and surface it honestly in the UI readiness indicator.
- Because OCR is out of scope — do not silently store empty chunks (they poison retrieval with zero-signal rows).

**If a DOCX uses custom styles instead of Heading 1/2:**
- Pass a `styleMap` to `convertToHtml` mapping the document's style names to `h1`/`h2` (mammoth supports this per-document), falling back to paragraph-chunking with positional section labels (`[Doc, §N]`).
- Because section citations must never be fabricated — cite only headings actually observed in the document.

**If the LLM returns schema-invalid exam JSON twice (initial + 1 retry):**
- Mark the exam job `FAILED` with the Zod error summary attached; never persist partial question sets (partial exams break answer-key integrity).
- Because a half-written exam is worse than an explicit failure — the UI can offer one-click regenerate.

**If Ollama server predates structured-output support:**
- Fall back to `format: 'json'` + Zod `safeParse` + same single-retry policy, and flag `llmStructuredOutputs: false` in `GET /api/status` details.
- Because the milestone must degrade truthfully on older Ollama installs, not claim schema guarantees it cannot enforce.

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| unpdf@^1.8.1 | Node ≥ 22 (repo: 24.19.0 ✓); TypeScript ^5.7.3 ✓ | Bundled serverless PDF.js build includes `Promise.withResolvers` polyfill — no Node-version cliff. If opting into the official build via `definePDFJSModule(() => import('pdfjs-dist'))`, pdfjs-dist 6.x hard-requires Node `>=22.13.0`. ESM import style matches `server/tsconfig.json` (`NodeNext`, ESM). |
| mammoth@^1.13.0 | Node ≥ 12 ✓; works with multer `{ buffer }` or `{ path }` inputs | No native bindings — safe on Windows x64 with no build tools. |
| zod@^4.5.4 | TypeScript ≥ 5.5 (repo: 5.7.3 ✓) | Zero dependencies. Zod 4 is a breaking major over v3 (`z.toJSONSchema` is v4-native); no v3 code exists in the repo, so adopt v4 directly. |
| multer@^2.3.0 | Express 4.21.2 ✓ | 2.x keeps the `diskStorage`/`fileFilter`/`limits` API used in `lectureRoutes.ts`; review the 2.x changelog for default-limit behavior changes before flipping. `@types/multer` stays. |
| Ollama JSON-Schema `format` | Ollama server with structured-output support + `qwen2.5:14b` pulled | Verify with `GET /api/tags` + one schema-constrained probe call in the doctor script; adherence is model-dependent, so the Zod `safeParse` gate stays mandatory regardless. |

## Sources

- npm registry `unpdf` — v1.8.1, updated 2026-08-13, MIT, ~6.1M weekly downloads; per-page `extractText`, `extractTextItems`, untrusted-PDF resource-limit guidance — HIGH confidence
- npm registry `pdfjs-dist` — v6.4.299, updated 2026-10-03, Mozilla, Node `>=22.13.0` engine requirement — HIGH confidence
- npm registry `pdf-parse` — v2 API (`PDFParse` class, `getText`/`getTable`/`getImage`), Node 20/22/23/24 support — MEDIUM-HIGH confidence (v2 rewrite lineage younger than PDF.js family)
- npm registry `mammoth` — v1.13.0, updated 2026-09-26, `extractRawText` + `convertToHtml` + `{path}/{buffer}` inputs — HIGH confidence
- npm registry `zod` — v4.5.4 (stable), zero-dep, `z.toJSONSchema` / `z.compile` / locales; JSR mirror shows 4.6.x line emerging — HIGH confidence on 4.5.4, MEDIUM on whether to chase 4.6 (no need; 4.5.4 covers the milestone)
- npm registry `ollama` (JS client) — v0.6.4, updated 2026-09-29, `format` param on `chat`/`generate` — HIGH confidence
- `docs.ollama.com/capabilities/structured-outputs` — `format` accepts full JSON Schema object; Zod `z.toJSONSchema()` → `format` → `Country.parse(JSON.parse(...))` canonical pattern; temperature-0 guidance — HIGH confidence
- `ollama.com/blog/structured-outputs` (2024-12) — historical corroboration; note its `zodToJsonSchema()` import is superseded by Zod 4 native — MEDIUM-HIGH confidence
- npm registry `multer` — v2.3.0, updated 2026-08-28; `fileFilter` + `limits` contract incl. per-request function limits — HIGH confidence
- Repo grounding: `.planning/PROJECT.md`, `.planning/codebase/{STACK,ARCHITECTURE,INTEGRATIONS,CONCERNS}.md`, `server/package.json`, `server/prisma/schema.prisma`, `shared/src/index.ts` (all read 2026-10-09) — HIGH confidence

---
*Stack research for: Lectern document-ingestion + grounded-exam milestone (PDF/DOCX/TXT extraction, local-LLM exam generation, mixed-source retrieval)*
*Researched: 2026-10-09*
