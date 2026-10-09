# Project Research Summary

**Project:** Lectern — local-first offline AI study assistant (document ingestion + grounded practice-exam milestone)
**Domain:** Document-grounded RAG study tool — PDF/DOCX/TXT ingestion, local-LLM exam generation, mixed-source (audio transcript + document) cited Q&A, 100% on-device
**Researched:** 2026-10-09
**Confidence:** HIGH

## Executive Summary

Lectern is a local-first offline study assistant that turns student materials — lecture audio it already handles plus document uploads it does not yet — into grounded practice exams, study guides, and cited Q&A without any cloud dependency. Every credible competitor (NotebookLM, Quizlet/Knowt, StudyFetch, Dende, October AI, Quizly) converges on the same pipeline shape: upload → extract with structure → chunk + embed → grounded generation with citations. Lectern's wedge is that it does all of this on-device (whisper.cpp + Ollama + SQLite) where every competitor requires accounts and server uploads.

The recommended approach is a convergent dual-intake, shared-spine architecture: keep the working audio pipeline untouched, add a parallel document front half (multer gate → unpdf/mammoth extraction → page-restricted chunking), and converge both sources into the existing embed → store → retrieve → generate spine with a `sourceType` discriminator and per-type citation formatting (`[Lecture, mm:ss]` vs `[Doc, p. N]`). Exam generation must use Ollama JSON-Schema-constrained output (`format: <schema>`, Zod 4 native `z.toJSONSchema()`) plus a deterministic QC gate (dedupe, exactly-one-key, distractor sanity) — never free-text regex parsing. New dependencies are minimal and all pure-JS: `unpdf`, `mammoth`, `zod`, plus a `multer@2.x` security upgrade.

The key risks are trust-destroying, not engineering-hard: silent empty ingestion of scanned PDFs, destroyed page provenance making citations ungroundable, small-model hallucinated citations, and fake-green readiness indicators that claim offline-ready while Ollama is down. Each has a cheap deterministic prevention (yield gate, locator-carrying chunks, citation label verification, per-service live probes) — but provenance loss in Phase 1 is HIGH-cost to recover (full re-ingestion), so the schema must carry `sourceType` + page ranges from day one.

## Key Findings

### Recommended Stack

Pure-JS local pipeline on top of the frozen Express + Prisma + SQLite + Ollama stack — no vector DB, no orchestration framework, no OCR engine, no native bindings. Full rationale in `STACK.md`.

**Core technologies:**
- unpdf `^1.8.1`: PDF text extraction with per-page array output — maps 1:1 onto the `[Doc, p. N]` citation model, pure JS, no worker config
- mammoth `^1.13.0`: DOCX extraction via `extractRawText` + `convertToHtml` style-map so headings survive for `[Doc, section]` citations
- Node native `fs` + `TextDecoder`: TXT ingestion — no dependency justified
- zod `^4.5.4`: single source of truth for exam JSON validation (`safeParse`) AND Ollama schema constraint (`z.toJSONSchema()`); also fixes the unclamped-`topK` and unvalidated-upload bugs
- Ollama `/api/chat` via native `fetch` with `format: <JSON Schema>`, `qwen2.5:14b`, temperature 0: schema-constrained generation, keeping the codebase's established no-SDK pattern
- Prisma + SQLite (existing, `^6.3.1`): sibling `Document`/`DocumentChunk` tables reusing the `embeddingJson` + brute-force cosine pattern — no migration of the working Lecture aggregate
- multer `^2.3.0` (upgrade from `1.4.5-lts.1`): `fileFilter` allowlist + `limits` closes the recorded unrestricted-upload XSS concern

### Expected Features

Competitor analysis (7+ products) plus RAG grounding literature converge on a clear table-stakes set. Details in `FEATURES.md`.

**Must have (table stakes):**
- Document upload (PDF/DOCX/TXT) with size guard + type allowlist — intake everything downstream needs
- Local extraction preserving pages/sections with `{ pageNo | headingPath, charOffset }` per chunk — without anchors there is nothing to cite
- Chunk + embed doc text reusing `chunkSegments`-style windows + `nomic-embed-text` — LOW cost, existing pattern
- Grounded document Q&A with page citations + mixed-source per-type citations (`[Title, mm:ss]` vs `[Doc, p. N]`) — the trust mechanism every credible product ships
- MCQ + True/False + Identification generation with answer keys + per-question explanations stored at generation time — the exam-prep core users equate with "study app"
- Quiz/exam player (extend existing `QuizPlayer`) with scoring + review pass — generation without a take-and-review loop is a dead end
- Study guide generation reusing the lecture map-reduce summarizer — the "compress 50 pages" expectation
- Honest "Not covered in your materials." fallback with empty citations, server-enforced — a fabricated `[p. 99]` fails a trust-judged demo worse than refusal
- Unified library listing (lectures + documents) + per-service readiness indicators — demo navigability + offline truthfulness

**Should have (competitive):**
- Exam-mode practice tests (timed, hidden-until-submit, topic breakdown) — P1.x after untimed player validates
- Difficulty + topic controls and progressive-difficulty presets — prompt-level, cheap, strong demo ("5 hard questions on Chapter 3")
- Retake-weak-spots queue wired into existing SRS boxes/streaks — no new AI calls, turns static exams adaptive
- Print-ready exam + key via print CSS — high PH-classroom value, reuse existing export pattern

**Defer (v2+):**
- OCR for scanned PDFs, LLM-judge auto-grading (small-model grading untrustworthy without eval harness), SM-2/calendars/mastery dashboards, binary exporters (PDF/DOCX/apkg), TTS podcasts, cloud sync/accounts (core-value conflict), PPTX/photo/YouTube ingest — each is timeline-breaking, trust-breaking, or value-conflicting per the anti-features analysis

### Architecture Approach

Two intake/extraction branches converging into one shared chunk → embed → store → retrieve → generate spine — not two parallel RAG stacks. At single-user local scale (<10k chunks), per-source indexes, RRF fusion, and rerankers are overkill; a unified chunk representation with a `sourceType` discriminator and per-type citation shaping is the converged standard shape. Full diagrams and build order in `ARCHITECTURE.md`.

**Major components:**
1. Format router + validator (`documentService.detectAndValidate()`) — MIME/extension gate, size cap, corrupt/encrypted rejection
2. Per-format extractor (`documentService.extract()`) — pdfjs-legacy per-page loop / mammoth / TXT normalize, preserving `pages[] → { pageNum, text, headings? }`
3. Document chunker (`chunkingService.chunkDocumentPages()`) — page-restricted, section-breadcrumb, same word-budget constants as audio for cosine comparability
4. Pipeline orchestrator (`startDocumentPipeline()`) — VALIDATING → EXTRACTING → CHUNKING → EMBEDDING → READY/FAILED, reusing `progressMap` + `queueMicrotask` fire-and-forget
5. Unified retriever (`findTopKAcrossSources()`) — one embedding space, in-memory merge, per-source cap (max 4 of top-8) so long transcripts can't starve doc evidence
6. Citation shaper + grounded generator (extended `qnaRoutes`) — per-type labels, conflict rule, not-covered fallback in a single Ollama call (late-fusion, no router agent)
7. Health/diagnostics (extended `statusRoutes` + `SystemStatusDTO`) — parser import probe + supported-format list feeding honest readiness pills

### Critical Pitfalls

Eight pitfalls researched; top 5 below (all in `PITFALLS.md` with avoidance steps, warning signs, and recovery costs).

1. **Scanned PDFs treated as extractable text** — extraction returns ~0 chars, pipeline proceeds, user gets a "completed" doc with garbage exams. Avoid: per-page character-yield gate → `BLOCKED` state with reason, never `COMPLETED`; surface "scanned PDF — OCR deferred to P2" honestly.
2. **Destroying page/section provenance during extraction** — concatenating pages into one blob makes `[Doc, p. N]` citations impossible or fabricated; recovery is HIGH cost (full re-ingestion). Avoid: chunk *within* pages, schema carries `sourceType` + `pageStart/pageEnd` + `sectionLabel` from day one, strip repeated headers/footers.
3. **Trusting small-model citations without verification** — qwen2.5-class models emit confident citations to nonexistent pages; current code attaches all `topChunks` regardless of model output. Avoid: regex-parse emitted labels, confirm each ∈ retrieved set, server-substitute refusal on failure; replace `startsWith` refusal detection with a JSON envelope or sentinel.
4. **Free-text exam parsing instead of JSON-schema generation** — regex/split parsing breaks on long docs exactly when whole-corpus prompts truncate. Avoid: `format: 'json'` + schema validation + budgeted per-slice input + bounded retry, then mark FAILED (never persist partial questions); cache validated exams per document.
5. **Duplicate/ambiguous/multi-key questions shipped without QC** — ~37% of raw LLM MCQs carry item-writing flaws; students notice instantly. Avoid: deterministic QC gate (stem similarity ≥0.9 reject + resample, exactly-one-key, distractor sanity, T/F falsifiability, identification alias-list grading — never LLM-judge at quiz time).

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Document ingestion pipeline
**Rationale:** Extraction requires intake and everything requires extraction — upload → parse → chunk → embed is the critical path blocking all other work. Schema decisions here are unrecoverable cheaply later (provenance loss = HIGH recovery cost).
**Delivers:** `Document`/`DocumentChunk` tables, `documentService` (validate → extract → normalize), `chunkDocumentPages()`, `startDocumentPipeline()` + `documentRoutes` CRUD/progress, contract-first `shared` DTOs, yield-gate + normalization + boilerplate filtering
**Addresses:** Document upload + local extraction, chunk + embed, unified library listing (doc half), readiness `docParser` probe
**Avoids:** P1 scanned-PDF emptiness, P2 provenance loss, P6 encoding/granularity mismatch (normalize + structure-aware chunking now; prefilter + clamp in Phase 3)

### Phase 2: Grounded exam generation + player
**Rationale:** Generation requires retrieval-ready chunks + JSON-schema validation from Phase 1; the player requires a frozen exam-item DTO before UI work. Explanations must be generated with the question (post-hoc doubles calls + drifts from key).
**Delivers:** JSON-Schema-constrained generation (`format: <schema>` + `safeParse` + bounded retry + QC gate), MCQ/T-F/identification schemas with `sourceRef` + `explanation`, exam persistence + caching, extended `QuizPlayer` with scoring + review pass, difficulty/topic controls if cheap
**Uses:** zod `z.toJSONSchema()`, `qwen2.5:14b` at temperature 0, per-slice budgeted input, normalized-match identification grading
**Implements:** Grounded generator path for exams; exam-item DTO in `@lectern/shared`
**Avoids:** P4 free-text parsing brittleness, P5 duplicate/ambiguous/multi-key exams

### Phase 3: Mixed-source Q&A + hardening + study guides
**Rationale:** Requires both chunk stores (Phase 1) + citation format (Phase 1 schema) + fallback contract; ship single-source doc Q&A first, then flip on mixed retrieval so each step stays demoable. Study guides reuse the existing map-reduce summarizer and ride along cheaply.
**Delivers:** `findTopKAcrossSources()` with per-source caps, per-type citation chips + deep links (`?p=` mirroring `?t=`), citation label verification + server-authoritative refusal, zod input clamps + prompt delimiters + `sourcesText` budget + rate limiting, study guide generation
**Addresses:** Mixed-source Q&A with per-type citations, "Not covered" fallback, study guides
**Avoids:** P3 hallucinated citations, P8 prompt-injection + unbounded input, P6 retrieval half (prefilter + `topK` clamp)

### Phase 4: Readiness honesty + offline verification + library UI polish
**Rationale:** Credibility gate scheduled last so it verifies Phases 1–3 end to end — but the `source: 'live' | 'fallback'` tagging contract must be written in Phase 1 so later phases conform. Airplane-mode run is the milestone's proof artifact.
**Delivers:** Per-service live probes (no synthesized `Ready: true`), kill the three known fabrication paths (fake `COMPLETED`, keyword-matcher fallback, 200-with-fallbacks status), mixed-source library list + readiness pills, upload quota/prune, airplane-mode verification recording, exam-mode (timed) + retake-weak-spots if validated
**Avoids:** P7 offline-readiness lie — the demo-killing failure

### Phase Ordering Rationale

- **Dependencies force the order:** intake → extraction → chunks → (generation ∥ retrieval) → verification. No chunking without structure, no citations without chunk offsets, no player without a frozen DTO, no honest status without all services existing to probe.
- **Architecture grouping keeps the spine shared:** Phases 1–3 each extend one shared service (`chunkingService`, exam generator, `embeddingService`/`qnaRoutes`) rather than forking per-source stacks — one retrieval/generation path to test throughout.
- **Pitfall economics front-load irreversibility:** Phase 1 contains the two NEVER-shortcuts (shared chunker without `sourceType`, page-concatenation) whose recovery costs HIGH; Phase 4 contains the credibility gate that catches everything else.
- **Each phase stays demoable:** upload→READY list (P1) → take-and-review exam (P2) → cited mixed Q&A (P3) → kill-Ollama-mid-demo recovery (P4).

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Ollama structured-output adherence is model-specific (qwen2.5) — needs a benchmark probe (`/gsd-plan-phase --research-phase`) to confirm schema-conformance rate and set retry budgets before locking the QC design.
- **Phase 3:** Citation-verification regex + JSON-envelope contract against small-model output variability — worth targeted research into refusal-envelope reliability on qwen2.5 during planning.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Extraction (unpdf/mammoth), multer gating, Prisma sibling tables, progress-poll pipeline — all well-documented established patterns with version-verified HIGH confidence.
- **Phase 4:** Readiness probes + rate limiting + print CSS — standard middleware and UI patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Extraction + validation libs version-verified via npm registry 2026-09/10; Ollama structured-output docs official. Only MEDIUM on qwen2.5-specific schema adherence — needs benchmarking. |
| Features | HIGH | Table stakes appear in ≥3 independent competitor products (cross-verified); MEDIUM on complexity estimates (local inference costs unmeasured) and differentiator ranking (inferred from gaps, no user interviews). |
| Architecture | HIGH | Convergent dual-intake shape confirmed across reference architectures + production pipelines + repo's own codebase maps; brownfield file locations dated 2026-10-09. |
| Pitfalls | HIGH | Grounded in repo audit + RAG/QA literature (TRUST-SCORE, GaRAGe, L2Q, docimology); MEDIUM on parser-library specifics pending benchmark phase. |

**Overall confidence:** HIGH

### Gaps to Address

- **qwen2.5 schema-adherence rate:** unknown until benchmarked — handle by keeping the Zod `safeParse` gate mandatory regardless of `format` mode, and probe adherence in Phase 2 planning (fallback to `format: 'json'` + retry if the server predates structured outputs).
- **Local inference latency/cost:** unmeasured (perf targets TBD per PROJECT.md) — handle by logging per-doc ingest time in Phase 1 (feeds the batching decision) and capping exam input per-slice in Phase 2.
- **DOCX heading fidelity:** `convertToMarkdown` vs raw-text + paragraph-index tradeoff unresolved — handle by unit-testing both on real fixture DOCX in Phase 1 and choosing per measured citation quality.
- **Ollama `/api/embed` vs `/api/embeddings` path:** status probe path suspected wrong per CONCERNS.md — handle by centralizing endpoint constants in `shared/` and verifying against a live server in Phase 1.

## Sources

### Primary (HIGH confidence)
- npm registry: `unpdf` (v1.8.1 per-page extraction), `mammoth` (v1.13.0 raw-text + style-map), `zod` (v4.5.4 native `toJSONSchema`), `multer` (v2.3.0 filter/limits), `ollama` JS client (v0.6.4 `format` param) — versions + APIs verified
- `docs.ollama.com/capabilities/structured-outputs` — full-JSON-Schema `format` + Zod canonical pattern + temperature-0 guidance
- Repo grounding: `.planning/PROJECT.md`, `.planning/codebase/{STACK,ARCHITECTURE,INTEGRATIONS,CONCERNS,STRUCTURE}.md`, `server/package.json`, `server/prisma/schema.prisma`, `shared/src/index.ts` (all read 2026-10-09)
- RAG trustworthiness: TRUST-SCORE/TRUST-ALIGN (ICLR 2025), GaRAGe attribution benchmark, GRACE abstention (2026), hybrid late-fusion (CEUR DARLIAP)

### Secondary (MEDIUM confidence)
- Competitor products: NotebookLM, Quizlet/Knowt, StudyFetch, Dende, October AI, Quizly, PrepAI/PDF AI (feature convergence across ≥3 sources each)
- Architecture refs: nanohype RAG reference, Red Hat production RAG series, Eagle-RAG ingest pipeline, Callsphere ingestion pipeline, pdf-rag-assistant (stage shapes transfer; Python-side details adapted)
- Exam quality: L2Q self-hosted pipeline (QC pattern), docimological flaw rates (~37%), SAQUET/IWF toolkit

### Tertiary (LOW confidence)
- None outstanding — parser edge cases (CJK/math-symbol PDFs, custom DOCX styles) flagged as fixture-test items in Phase 1 rather than research gaps.

---

*Research completed: 2026-10-09*
*Ready for roadmap: yes*
