# Architecture Research

**Domain:** Local-first offline AI study assistant — document ingestion + mixed-source (audio transcript + document) retrieval and grounded generation
**Researched:** 2026-10-09
**Confidence:** HIGH

## Standard Architecture

### System Overview

Standard document-ingestion + mixed-source study systems separate into two
pipelines that converge on one retrieval index and one grounded-generation
path (nanohype RAG reference architecture; Eagle-RAG dual-pipeline design;
pdf-rag-assistant production backend):

```
┌─────────────────────────────────────────────────────────────────┐
│                      Intake Layer (per source)                   │
├──────────────────────────────┬──────────────────────────────────┤
│  ┌────────────────────────┐  │  ┌────────────────────────────┐  │
│  │ Audio intake (EXISTS)  │  │  │ Document intake (NEW)      │  │
│  │ upload / record modal  │  │  │ upload modal, MIME gate,   │  │
│  │ FFmpeg normalize       │  │  │ size cap, page-count probe │  │
│  └───────────┬────────────┘  │  └──────────────┬─────────────┘  │
├──────────────┴───────────────┴──────────────────┴───────────────┤
│                   Extraction + Normalization Layer               │
├──────────────────────────────┬──────────────────────────────────┤
│  ┌────────────────────────┐  │  ┌────────────────────────────┐  │
│  │ whisper.cpp ASR        │  │  │ Format router:            │  │
│  │ → timestamped segments │  │  │ PDF (pdfjs-legacy) /      │  │
│  │   (EXISTS, keep as-is) │  │  │ DOCX (mammoth) / TXT      │  │
│  └───────────┬────────────┘  │  │ → pages + sections        │  │
│              │               │  └──────────────┬─────────────┘  │
├──────────────┴───────────────┴──────────────────┴───────────────┤
│                 Chunking + Metadata Enrichment Layer             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Recursive / structure-aware chunker (~400–512 tokens,    │  │
│  │ 10–15% overlap) carrying { sourceId, sourceType,         │  │
│  │ pageNumber | startTime, sectionPath, chunkIndex }         │  │
│  └──────────────────────────────┬───────────────────────────┘  │
├─────────────────────────────────┴──────────────────────────────┤
│                   Embedding + Storage Layer                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Shared embedding service (Ollama nomic-embed-text) →     │  │
│  │ SQLite via Prisma (Lecture/Chunk EXISTS + Document/      │  │
│  │ DocumentChunk NEW), embeddingJson per row                 │  │
│  └──────────────────────────────┬───────────────────────────┘  │
├─────────────────────────────────┴──────────────────────────────┤
│               Retrieval + Grounded Generation Layer              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Unified top-K cosine retrieval across both chunk tables  │  │
│  │ → per-type citation shaping → single Ollama chat call   │  │
│  │ → "Not covered in your materials." fallback              │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

Key structural finding: at single-user local scale the correct topology is
**two intake/extraction branches converging into one shared
chunk → embed → store → retrieve → generate spine** — not two parallel RAG
stacks. Multi-index designs (per-source BM25+dense indexes, weighted RRF,
cross-encoder rerank, claim-conflict arbitration) exist for heterogeneous
web-scale corpora and are overkill here; the evidence converges on a
**unified chunk representation with a `sourceType` discriminator and
per-type citation formatting** (same conclusion as the adi2355
multi-source pipeline's unified `ai_content` schema, minus its FTS5/vector
hybrid weighting which Lectern does not need yet).

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Format router + validator | MIME/extension gate (PDF/DOCX/TXT only), size cap, corrupt/encrypted-file rejection with explicit messages | New `documentService.detectAndValidate()`; multer extension allowlist mirrors existing audio allowlist pattern |
| Per-format extractor | PDF → per-page text array; DOCX → paragraph array via mammoth; TXT → normalized text | `pdfjs-dist/legacy/build/pdf.mjs` server-side (Node-safe, no worker config); `mammoth.extractRawText({ buffer })`; `fs.readFile utf-8` + `\r\n` normalize |
| Structure preserver | Keep page numbers and section headings attached to text spans so chunks inherit citable locators | PDF: page-indexed extraction loop; DOCX: `convertToHtml` heading capture OR raw-text + paragraph-index fallback (MVP: page/paragraph index, not full style tree) |
| Document chunker | Recursive split ~250 words / ~512 tokens with ~40-token overlap, page-restricted (never merge across page boundaries for PDFs), section breadcrumb prepend | Extend existing `chunkingService` with `chunkDocumentPages()`; same word-budget constants as audio path for embedding comparability |
| Shared embedding service | Batch embed chunks via Ollama `/api/embed`, persist `embeddingJson` | Reuse `embeddingService.getEmbedding()`; add bounded-concurrency batch wrapper (fixes existing sequential-loop bottleneck) |
| Pipeline orchestrator | Background stage machine with progress events (VALIDATING → EXTRACTING → CHUNKING → EMBEDDING → READY/FAILED) | Extend `pipelineOrchestrator` with `startDocumentPipeline()` reusing `updateProgress`/`progressMap` pattern; fire-and-forget via `queueMicrotask` as audio path does |
| Unified retriever | Embed query once, cosine top-K across both chunk tables in memory, single merged ranking | Extend `embeddingService.findTopK()` to `findTopKAcrossSources()`; one embedding space (nomic-embed-text) — never mix models in one index |
| Citation shaper | Map each hit to `{ sourceType, title, locator }` — `[Title, mm:ss]` vs `[Doc, p. N]` vs `[Doc, section]` | Extend `CitationItem` with `sourceType` + `pageNumber`/`section` fields; format in `qnaRoutes` |
| Grounded generator | Single Ollama chat call with numbered sources, per-type citation rules, grounded-only fallback | Extend existing `qnaRoutes` prompt block; late-fusion prompt orchestration (one LLM call decides source use — no router agent needed at this scale) |
| Health/diagnostics | Per-service readiness (FFmpeg, whisper, Ollama, + new parser readiness) | Extend `statusRoutes` + `SystemStatusDTO`; parser readiness = import probe + supported-format list (no GPU needed) |

## Recommended Project Structure

```
server/src/
├── routes/
│   ├── lectureRoutes.ts      # EXISTS — audio CRUD + progress (untouched)
│   ├── documentRoutes.ts     # NEW — doc upload/list/detail/delete/progress
│   ├── qnaRoutes.ts          # EXTEND — unified retrieval + per-type citations
│   └── statusRoutes.ts       # EXTEND — parser readiness probe
├── services/
│   ├── audioService.ts       # EXISTS (untouched)
│   ├── whisperService.ts     # EXISTS (untouched)
│   ├── chunkingService.ts    # EXTEND — chunkDocumentPages() alongside chunkSegments()
│   ├── embeddingService.ts   # EXTEND — findTopKAcrossSources() + batched embed
│   ├── documentService.ts    # NEW — validate → extract → normalize (format router)
│   └── pipelineOrchestrator.ts # EXTEND — startDocumentPipeline() mirroring startPipeline()
├── config.ts                 # EXTEND — DOCS_UPLOADS_DIR, MAX_DOC_MB, parser knobs
├── db.ts                     # EXISTS — same Prisma singleton
server/prisma/
└── schema.prisma             # EXTEND — Document + DocumentChunk (sibling tables)
shared/src/index.ts            # EXTEND — DocumentDTO, DocumentChunkDTO, sourceType,
                               # extended CitationItem, PipelineStage additions
web/src/
├── lib/api.ts                # EXTEND — document fetch helpers (*WithSource pattern)
├── components/
│   ├── DocumentUploadPanel.tsx # NEW — mirrors AudioUploader structure
│   ├── IntakeModal.tsx         # EXTEND — document tab alongside upload/record
│   ├── LibraryView.tsx         # NEW or EXTEND — mixed-source search list
│   └── QnAChat.tsx             # EXTEND — per-type citation chips + deep links
```

(Brownfield note: `server/src/routes/`, `server/src/services/`,
`shared/src/index.ts`, `web/src/lib/api.ts`, `web/next.config.mjs` rewrite
table, and `PipelineStage` enum locations per `.planning/codebase/`
STRUCTURE + ARCHITECTURE maps dated 2026-10-09.)

### Structure Rationale

- **`documentService.ts` (new, not merged into audio/whisper services):** audio
  and document extraction share nothing except the downstream chunk/embed
  contract; merging them creates a god-service. One class + singleton per
  capability is the established codebase pattern.
- **Sibling `Document`/`DocumentChunk` tables, not a polymorphic `Chunk`:**
  existing `Chunk.lectureId` is a required FK with cascade delete and per-query
  `JSON.parse` scan. Making it nullable/polymorphic forces a data migration
  and risks regressing the working audio Q&A. Sibling tables keep the Lecture
  aggregate untouched; unification happens at retrieval time (in-memory merge),
  which is cheap at this scale.
- **Extend `chunkingService` / `embeddingService` rather than new services:**
  chunking math (word budget, overlap) and embedding math (cosine, Ollama HTTP)
  must stay comparable across sources or cosine ranking becomes meaningless.
  One implementation with two entry functions guarantees that.
- **Extend `qnaRoutes`, don't add `docQnaRoutes`:** mixed-source Q&A is one
  user question over one merged evidence pool. Two endpoints would force the
  frontend to fuse answers and citations itself — the exact complexity
  late-fusion prompt orchestration is meant to avoid.
- **Contract-first (`shared/` before routes/services/UI):** `DocumentDTO`,
  extended `CitationItem`, and new `PipelineStage` values are imported by both
  tiers; adding them first prevents the route/UI drift the codebase map flags
  as a recurring risk.

## Architectural Patterns

### Pattern 1: Convergent dual-intake, shared-spine RAG

**What:** Two source-specific front halves (audio: FFmpeg→whisper→segments;
documents: validate→extract→pages/sections) feeding one shared back half
(chunk→embed→store→retrieve→generate). Downstream code never knows which
source a chunk came from except via its metadata discriminator.
**When to use:** Any study/knowledge assistant with 2–4 static local source
types and one embedding model. This is the standard shape in every surveyed
implementation from single-process backends to Eagle-RAG's router (which still
converges before embed/upsert).
**Trade-offs:** Pro: one retrieval/generation path to test; consistent
citation contract; minimal new infra. Con: per-source extraction quirks leak
through as metadata variance (timestamps vs page numbers) — handled by the
citation shaper, not by forking the pipeline.

**Example:**
```typescript
// server/src/services/documentService.ts — front half is source-specific…
export class DocumentService {
  async extract(buffer: Buffer, mime: string): Promise<ExtractedPage[]> {
    if (mime === 'application/pdf') return this.extractPdf(buffer);   // pdfjs-legacy per-page loop
    if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      return this.extractDocx(buffer);                                // mammoth paragraphs
    return this.extractTxt(buffer);                                   // normalize + split
  }
}
// …back half is shared:
const chunks = chunkingService.chunkDocumentPages(pages);   // same word budget as audio
await embeddingService.generateAndSaveDocEmbeddings(docId, chunks); // same Ollama model
```

### Pattern 2: Metadata-carrying chunks with locator inheritance

**What:** Every chunk stores its full citation locator at write time
(`sourceType`, `sourceId`, `sourceTitle`, `pageNumber`/`startTime`,
`sectionHeading`, `chunkIndex`). Retrieval never re-derives provenance; it
copies fields into the citation DTO.
**When to use:** Always in grounded study systems — citations are a
correctness requirement (Lectern PROJECT.md: "every generated answer carries
verifiable source refs"), not a display nicety.
**Trade-offs:** Pro: citations survive re-ranking/merging; fallback logic can
cite "nearest page" honestly. Con: slightly wider rows; section detection for
DOCX without style parsing is approximate (paragraph-index fallback in MVP).

**Example:**
```typescript
// shared/src/index.ts
export type SourceType = 'lecture' | 'document';
export interface CitationItem {
  sourceType: SourceType;
  sourceId: string; sourceTitle: string;
  startTime?: number; endTime?: number;   // lectures
  pageNumber?: number; section?: string;  // documents
  timestampLabel: string;  // "[Title, 04:12]" | "[Doc, p. 7]" | "[Doc, § Methods]"
  textSnippet: string; similarity: number;
}
```

### Pattern 3: Background pipeline with polled progress (existing-repo pattern, reused)

**What:** Upload returns `201 { id }` immediately; heavy work
(extract→chunk→embed) runs fire-and-forget via `queueMicrotask`, tracked in
the orchestrator's `progressMap`, polled by the client (`GET
/api/documents/:id/progress`), same as the 7-stage audio pipeline.
**When to use:** Any ingestion exceeding ~2 s (all PDF/DOCX extraction +
embedding does). Keeps the single Node event loop responsive — an explicit
constraint in the codebase architecture map.
**Trade-offs:** Pro: zero new infra (no BullMQ/Redis at single-user scale);
consistent progress UX. Con: in-memory progress lost on restart (known issue;
same DB-fallback mitigation as audio path — persist coarse stage on the
`Document` row).

## Data Flow

### Request Flow

```
[Student uploads PDF/DOCX/TXT]
    ↓
[DocumentUploadPanel] → POST multipart → [documentRoutes: multer → validate]
    ↓ 201 { documentId }                          ↓ 400 (type/size/corrupt) with reason
[PipelineProgress polls] ← progressMap ← [orchestrator.startDocumentPipeline()]
    ↓ EXTRACTING → CHUNKING → EMBEDDING → READY
[LibraryView / Q&A input]
    ↓
[qnaRoutes] → embed query → cosine top-K across Chunk + DocumentChunk
    ↓ merge-sort by similarity
[Ollama chat: numbered sources + per-type citation rules]
    ↓
[QnAResponseDTO { answer, citations[], unsupported }] → citation chips
    ↓ click → /lectures/:id?t= (audio) or /documents/:id?p= (page anchor)
```

### State Management

```
[SQLite: Document.status]  ← source of truth (PENDING|PROCESSING|READY|FAILED)
    ↑ write-through
[progressMap: docId → JobProgressDTO]  ← ephemeral stage % (lost on restart)
    ↓ poll
[Frontend per-page useState + useEffect polling]  ← no global store (repo convention)
[localStorage] ← SRS boxes/streaks only (untouched by this milestone)
```

### Key Data Flows

1. **Document ingestion:** `multer buffer → documentService.validate (MIME +
   magic bytes + size cap + page-count probe) → extract per format → normalize
   → chunkDocumentPages (page-restricted, section breadcrumb) → batch embed
   (bounded concurrency, same nomic-embed-text model) → bulk insert
   `DocumentChunk` rows → `Document.status = READY`. Failures mark `FAILED`
   with stage + reason; never throw out of the background task (fail the
   document, never the process — existing error-handling contract).
2. **Mixed-source Q&A:** `question → getEmbedding(question) → load Chunk rows
   (+Lecture.title) AND DocumentChunk rows (+Document.title) → JSON.parse
   vectors → cosine both sets → merge → sort desc → slice topK (default 6–8,
   cap per-source at 4 to prevent one corpus drowning the other) → build
   numbered source block with `[Lecture, mm:ss]` / `[Doc p.N]` / `[Doc §]`
   labels → Ollama chat with grounded-only system rules → shape
   `CitationItem[]` with `sourceType` → return with `unsupported` flag when the
   model emits the not-covered sentinel.
3. **Library search (lightweight, pre-semantic):** `query → title/section
   substring filter over Lecture + Document rows → grouped result list
   (lectures section, documents section)`. Full semantic library search reuses
   flow 2's retriever with `topK` per source; no separate search index in MVP.
4. **Diagnostics:** `GET /api/status → existing probes (nvidia-smi, Ollama
   tags, ffmpeg, whisper files) + parser probe (pdfjs import OK, mammoth
   import OK, supported formats list)`. Always 200 with per-service flags —
   feeds the honest readiness indicators requirement.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current: single student, tens of docs/lectures, <10k chunks | This design as-is: SQLite + in-memory brute-force cosine, no queue, no vector DB. Matches every surveyed "start here" recommendation (<10k chunks: anything works). |
| 10k–100k chunks or 100+ page PDFs | First: bounded-concurrency embed batching + bulk insert (fixes linear per-chunk await); page-windowed PDF extraction (don't hold whole 500-page text in memory); incremental per-document re-embed on edit via content-hash diff. |
| 100k+ chunks / multi-user | Then: SQLite FTS5 keyword side-index + hybrid merge, or migrate vectors to pgvector/Qdrant; durable job queue (BullMQ + Redis persistence) replacing `progressMap`; per-user namespace column on all tables (auth layer first — repo currently has none). |

### Scaling Priorities

1. **First bottleneck: sequential per-chunk embedding loop.** Existing
   `generateAndSaveEmbeddings()` awaits one Ollama call per chunk; document
   ingestion multiplies chunk volume. Fix with bounded-concurrency batches
   (e.g. 8–16 in flight) + bulk `createMany` — same fix the codebase map
   already prescribes for audio.
2. **Second bottleneck: full-table cosine scan per question.** Two tables
   scanned + `JSON.parse` per row per query. Fine now; when felt, add
   per-document pre-filter (only search selected/in-scope materials) before
   reaching for a vector index — scoping is both a perf win and a study-UX
   feature ("ask within these 3 sources").

## Anti-Patterns

### Anti-Pattern 1: Monolithic ingestion script with no stage persistence

**What people do:** One function/file owns parse + chunk + embed + write; a
failure on page 200 of 300 restarts everything; no one can answer "which chunk
size produced this index."
**Why it's wrong:** Wastes GPU minutes, makes retries all-or-nothing, kills
debuggability — the exact failure the Red Hat multi-step pipeline post
dissects (intermediate JSONL + per-component retry as the fix).
**Do this instead:** Stage the orchestrator (`VALIDATING → EXTRACTING →
CHUNKING → EMBEDDING → READY`), persist `Document.status`/stage per step, keep
extracted pages in a staging column or sibling rows so embed can retry without
re-parsing. At Lectern scale: status column + extracted-page cache is enough;
S3/MinIO intermediate stores are not.

### Anti-Pattern 2: Chunking without locator preservation

**What people do:** Concatenate all pages into one string, fixed-split every
500 tokens, embed. Page numbers and headings lost.
**Why it's wrong:** Citations become ungroundable (`[Doc]` with no page);
chunk context degrades (headers separated from their bodies — the DocAI Block-4
finding). Violates Lectern's provenance constraint.
**Do this instead:** Page-restricted chunking (never merge across page
boundaries for PDFs), section breadcrumb prepend (`§ Methods › Sampling`),
locator inheritance into every chunk row.

### Anti-Pattern 3: Separate Q&A stacks per source type

**What people do:** `/api/qna/audio` + `/api/qna/docs` endpoints, frontend
merges two answers.
**Why it's wrong:** Citation conflicts unresolvable client-side; double LLM
latency/cost; prompt rules duplicated and drifting. Surveyed multi-source
systems that tried endpoint-per-source converged on late-fusion single
generation (hybrid RAG orchestration paper: one final LLM node fuses both
contexts with explicit conflict/selection rules).
**Do this instead:** One `/api/qna` over the merged evidence pool with
per-source citation formatting and a conflict rule in the prompt ("if sources
conflict, prefer the more specific; surface the disagreement").

### Anti-Pattern 4: Premature vector-DB / reranker / OCR adoption

**What people do:** Add Qdrant/Milvus + cross-encoder rerank + Tesseract OCR
"while we're here."
**Why it's wrong:** Each adds native deps, GPU contention, and offline failure
modes for zero MVP gain at <10k chunks; OCR is explicitly out of scope
(PROJECT.md) pending native-tool investigation.
**Do this instead:** SQLite brute-force + single-stage cosine; clean-text PDFs
only with an explicit "scanned PDF detected — text layer empty" message
(detect via `text_page_ratio` probe pattern from Eagle-RAG); defer OCR, FTS5,
and vector indexes to measured need.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| pdfjs-dist legacy build | `import('pdfjs-dist/legacy/build/pdf.mjs')`, `getDocument({ data }).promise`, per-page `getTextContent()` join | Node-safe path (NOT the browser worker build); pin version; `useSystemFonts: true` equivalent for standard-font PDFs; wrap per-page in try/catch — one corrupt page must not fail the document |
| mammoth | `mammoth.extractRawText({ buffer })` (MVP) or `convertToMarkdown({ buffer })` (headings preserved) | Pure-JS, no system deps, offline-safe; `extractRawText` drops headings — prefer `convertToMarkdown` if section citations required for DOCX in this milestone, else paragraph-index locators |
| Ollama embed/chat | Existing `fetch` + `AbortSignal.timeout` pattern, same `nomic-embed-text` + `qwen2.5` models | Never introduce a second embedding model — mixed-model vectors are cosine-incomparable (requires full re-index; use versioned collection/table on model change) |
| whisper.cpp / FFmpeg | Untouched | Document pipeline must not contend unnecessarily: serialize heavy jobs or cap concurrency when transcription + doc-embedding overlap on the RTX 5060 Ti target |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| documentRoutes ↔ orchestrator | `startDocumentPipeline(docId, filePath)` + `getProgress(docId)` | Mirror `lectureRoutes.ts:132/141` fire-and-forget + `queueMicrotask`; same `201`-then-poll contract |
| orchestrator ↔ documentService/chunking/embedding | Sequential awaits with `updateProgress` between stages | Keep routes thin (parse + DTO map only); all extraction/AI logic behind service singletons |
| qnaRoutes ↔ both chunk tables | Two Prisma reads, in-memory cosine merge | Cap per-source contributions (e.g. max 4 of top-8) so a long transcript can't starve document evidence |
| shared DTOs ↔ both tiers | `DocumentDTO`, `DocumentChunkDTO`, `SourceType`, extended `CitationItem`/`PipelineStage` | Add to `shared/src/index.ts` first, rebuild `shared/dist/`, then write routes/UI |
| web rewrites ↔ new endpoints | `web/next.config.mjs` rewrites for `/api/documents/*` | Forgetting the rewrite is the #1 "endpoint 404s in dev" cause in this repo |
| status ↔ frontend badges | Extended `SystemStatusDTO` parser flags → readiness pills | Honest-down behavior: parser import failure shows "documents unavailable," never a fake offline-ready claim |

## Suggested Build Order

1. **Contract + persistence** — `shared` DTOs (`SourceType`, `DocumentDTO`,
   extended `CitationItem`/`PipelineStage`) → Prisma `Document` +
   `DocumentChunk` + `db:push`. Unblocks everything; zero runtime risk.
2. **Extraction service** — `documentService` (validate → per-format extract →
   normalize) with unit tests on fixture PDF/DOCX/TXT (no Ollama needed).
3. **Chunking extension** — `chunkDocumentPages()` reusing word-budget
   constants; test page-restriction + locator inheritance.
4. **Pipeline + routes** — orchestrator `startDocumentPipeline()` +
   `documentRoutes` CRUD/progress + `next.config.mjs` rewrites; verify
   upload→READY without embeddings mocked.
5. **Embedding + unified retrieval** — batched embed writer +
   `findTopKAcrossSources()`; benchmark per-doc ingest time (feeds perf-target
   decision).
6. **Grounded generation + citations** — `qnaRoutes` prompt update (per-type
   labels, conflict rule, not-covered fallback) + `QnAChat` chips/deep links
   (`?p=` page anchors mirroring `?t=` time anchors).
7. **Diagnostics + library UI** — status parser probe + readiness pills +
   mixed-source library list; airplane-mode verification last.

## Sources

- nanohype RAG reference architecture — ingestion (`Documents → Load → Parse →
  Clean → Chunk → Embed → Store`) vs query pipeline split; metadata-first
  attribution; <10k-chunk brute-force guidance —
  https://github.com/nanohype/nanohype/blob/main/docs/reference-architectures/rag-pipelines.md (HIGH)
- Red Hat / OpenShift AI production RAG series (2026-09-01) — staged components
  with intermediate persistence + independent retries; structure-aware
  (HybridChunker) chunking; parallel data/model chains —
  https://developers.redhat.com/articles/2026/09/01/orchestrate-production-rag-openshift-ai (HIGH)
- Callsphere production ingestion pipeline (2026-03-17) — format detector →
  per-format extractor (pdfplumber table handling) → recursive chunker with
  overlap → batched embed/store; 512-token/64-overlap starting point; OCR
  fallback flagging —
  https://callsphere.ai/blog/building-document-ingestion-pipeline-rag-pdf-docx-html-csv (MEDIUM, Python-side but stage shape transfers)
- Eagle-RAG ingest pipeline docs — dual-pipeline routing by PDF text-vs-scanned
  probe (`text_page_ratio`), typed chunks with hierarchy (`path`/`level`),
  parse→chunk→classify→embed→upsert hook order —
  https://zhiweio.github.io/EagleRAG/backend/ingest-pipeline/ (MEDIUM)
- Embedding pipeline at scale (ikshitij.com) — 5-stage
  ingest→chunk→dedupe→batch-embed→index; content-hash dedupe; incremental
  re-embed only changed chunks; never mix embedding models in one index —
  https://ikshitij.com/learn/ai-agentic/embedding-pipeline-scale/ (MEDIUM)
- pdf-rag-assistant (Express + BullMQ + Pinecone) — API/worker/pipeline
  separation; deterministic resume-safe chunking; idempotent ingestion via
  content fingerprints; retrieval/LLM layer separation —
  https://github.com/ankit123nag/pdf-rag-assistant (MEDIUM, validates service/orchestrator split)
- Multi-source RAG reference (Pangqiang-Gary) — per-source loaders + weighted
  fusion + authority/conflict handling; adopted as the *counterpoint* (why
  Lectern should NOT build per-source indexes/RRF/rerank at this scale) —
  https://github.laiyagushi.com/Pangqiang-Gary/multi_source_rag (MEDIUM)
- Hybrid multi-source RAG, CEUR DARLIAP — late-fusion prompt orchestration
  (single final LLM node fusing independent contexts with selection/conflict
  rules); modality separation preserved to generation time —
  https://ceur-ws.org/Vol-4192/DARLIAP-paper13.pdf (MEDIUM)
- pdfjs-dist legacy Node extraction + mammoth patterns — server-side
  `pdfjs-dist/legacy/build/pdf.mjs` per-page loop; `mammoth.extractRawText /
  convertToMarkdown` DOCX handling; Node 22.13+ floor —
  https://localmode.dev/docs/pdfjs,
  https://ultimatetools.hashnode.dev/word-to-pdf-in-next-js-mammoth-js-text-extraction-pdfkit-layout-and-streaming-a-binary-response (HIGH for library choice)
- Repo grounding — `.planning/codebase/ARCHITECTURE.md`, `STACK.md`,
  `STRUCTURE.md` (2026-10-09); `server/prisma/schema.prisma`
  (Lecture/Chunk/FK shape); `shared/src/index.ts` (DTO + CitationItem shape);
  `.planning/PROJECT.md` constraints (local-first, stack freeze, provenance,
  OCR deferred) (HIGH)

---
*Architecture research for: Lectern document ingestion + mixed-source study system*
*Researched: 2026-10-09*
