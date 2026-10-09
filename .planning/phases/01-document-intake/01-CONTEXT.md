# Phase 1: Document Intake - Context

**Gathered:** 2026-10-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Students upload PDF, DOCX, and TXT materials (plus pasted plain-text notes) and get retrieval-ready study sources: extracted text preserving pages/sections, chunked with page/section refs and embedded for retrieval. A document reaches READY (or honest FAILED) with anchored chunks available — the foundation Phases 2–3 build on.
</domain>

<decisions>
## Implementation Decisions

### Upload surface
- **D-01:** Single file per upload, matching the audio flow (no multi-file queue)
- **D-02:** TXT intake supports both `.txt` file upload and a paste-text box for copied notes
- **D-03:** After upload, the user lands on a source view with live progress (mirrors the audio workspace pattern)

### Failure UX
- **D-04:** Unreadable files (scanned, encrypted, empty) are rejected by upfront validation at select time, not after processing
- **D-05:** Failure messages name the specific cause (scanned / encrypted / empty) plus the next action
- **D-06:** Rejected files leave no trace in the library — nothing stored
- **D-07:** Recovery returns the user to the picker with a formats reminder

### Size & type guardrails
- **D-08:** One single 25 MB size cap for all document types
- **D-09:** Over-limit or wrong-extension files are blocked before upload with the limit and accepted formats stated
- **D-10:** Strict allowlist: PDF / DOCX / TXT only (no Markdown)

### Library visibility
- **D-11:** Document rows show title + type icon + READY/PROCESSING/FAILED badge + page count
- **D-12:** Documents mix into the existing lecture list (one list with type icons), not a separate section
- **D-13:** Extraction progress mirrors lectures: status badge + progress % via the existing polling pattern
- **D-14:** Clicking a document opens an extracted-text reader (headings + pages), not a details-only panel

### the agent's Discretion
- Exact placement of the document upload surface (IntakeModal tab vs unified picker vs separate dropzone)
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope & requirements
- `.planning/PROJECT.md` — Source→feature split, local-first constraints, planning discipline
- `.planning/REQUIREMENTS.md` — DOC-01..DOC-04 acceptance wording
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, build order

### Research (this milestone)
- `.planning/research/STACK.md` — Parser shortlist (`unpdf`, `mammoth`), Zod validation, upload hardening
- `.planning/research/PITFALLS.md` — Yield-gate for silent extraction failures, provenance-at-extraction rule
- `.planning/research/ARCHITECTURE.md` — Dual-intake/shared-spine topology, build order

### Codebase patterns to mirror
- `server/src/routes/lectureRoutes.ts` — multer diskStorage upload pattern to mirror for documents
- `server/src/services/chunkingService.ts` — ~250-word overlapping chunker to reuse for doc text
- `server/src/services/embeddingService.ts` — getEmbedding/findTopK + embeddingJson storage to reuse
- `server/src/services/pipelineOrchestrator.ts` — background-job + progressMap polling pattern to mirror
- `server/prisma/schema.prisma` — where new Document/Chunk models attach (cascade conventions)
- `web/src/components/IntakeModal.tsx` — existing intake tabs the upload surface extends
- `web/src/components/PipelineProgress.tsx` — progress stepper the extraction UI mirrors
- `shared/src/index.ts` — DTO contract all cross-tier shapes go through
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- multer diskStorage + randomized filenames + size cap (`server/src/routes/lectureRoutes.ts`): mirror for document intake with the 25 MB cap
- `chunkSegments` pure chunker + `getEmbedding`/`generateAndSaveEmbeddings` (`server/src/services/chunkingService.ts`, `server/src/services/embeddingService.ts`): reuse for doc text, carrying page/section refs instead of startTime
- Progress polling (`web/src/components/PipelineProgress.tsx` + `fetchProgress`): mirror for extraction progress
- IntakeModal upload tab + FormData POST (`web/src/components/IntakeModal.tsx`): extension point for the docs path

### Established Patterns
- Service singleton per capability (`export class XService` + `export const xService`), CONFIG-central tunables, `AbortSignal.timeout` on Ollama calls, `deleteMany` + `create` rewrites, JSON-shape guards on LLM output
- Frontend `*WithSource()` + `BackendUnreachableError` explicit-fallback pattern for read paths

### Integration Points
- New `POST` intake route beside `/api/lectures` (or type-discriminated extension), new Prisma models beside `Lecture`, new shared DTOs beside `LectureDTO`; Next.js rewrites in `web/next.config.mjs` already proxy `/api/*`
</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Placement of the upload surface explicitly delegated to the agent.
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope
</deferred>

---

*Phase: 01-document-intake*
*Context gathered: 2026-10-09*
