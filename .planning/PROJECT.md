# Lectern

## What This Is

Lectern is a local-first, offline-capable AI study assistant for students. Students import audio lectures (uploaded or browser-recorded) and documents (PDF, DOCX, TXT, notes) and turn them into summaries, key terms, flashcards, practice exams, study guides, presentation-style Visual Study Decks, and cited Q&A — with 100% of AI inference running on-device and zero cloud dependencies.

## Core Value

A student can import real lecture materials and study from them with grounded, cited AI help — without the internet and without their data leaving the machine.

## Requirements

### Validated

- ✓ Audio upload + browser recording with FFmpeg/whisper.cpp timestamped transcription — existing
- ✓ Chunking, Ollama embeddings (nomic-embed-text), SQLite storage, cross-lecture cited Q&A — existing
- ✓ Summaries, key terms, flashcards (JSON-schema), MCQ quiz player, Study Circuit UI, SRS boxes, streaks — existing
- ✓ Offline/health indicators, local-first storage, Disclosures section in README — existing

### Active

- [ ] Document upload + local text extraction (PDF, DOCX, TXT) preserving pages/sections
- [ ] Quiz + practice-exam generation (MCQ, true/false, identification) grounded in document content
- [ ] Mixed-source library: search + Q&A across transcripts and document text with per-type citations (`[Title, mm:ss]`, `[Doc, p. N]`, `[Doc, section]`)
- [ ] "Not covered in your materials." fallback for unsupported questions (never fabricated citations)
- [ ] Honest per-service readiness indicators (no offline claims when a service is down)
- [ ] Offline verification run (airplane-mode core workflow) + repo hygiene (no weights/uploads/DB in git)
- [ ] Visual Study Decks: grounded slide decks (title → objectives → concepts → recap → knowledge check) with per-slide source refs, rendered and navigated locally
- [ ] Editorial UI system applied product-wide (Home, Import, Source workspace, Ask, Flashcards, Exams, Decks, Settings) — no screen left on the old look
- [ ] Unified import flow across audio/record/PDF/DOCX/TXT with honest format support claims
- [ ] Settings distinguishes internet-disconnected vs local-services-ready vs offline-workflow-verified

### Out of Scope

- Cloud inference of any kind (OpenAI, Anthropic, Gemini) — violates the core value
- OCR for scanned PDFs — deferred to P2, needs native-tool investigation
- Advanced PDF layout/table reconstruction — deferred, low value per effort
- Formats beyond PDF/DOCX/TXT — deferred until the reliable core ships
- Export, analytics, elaborate library filters — P2, cut for MVP focus
- Full Slidev runtime embed (Vue+Vite inside Next.js) — rejected: second framework runtime for marginal gain; deck-contract approach instead
- Spaced-repetition extensions — existing Leitner boxes + streaks grandfathered and frozen, no new SRS features

## Context

- Brownfield monorepo: `server/` (Express + Prisma + SQLite pipeline), `web/` (Next.js 15 study UI), `shared/` (DTOs), `packages/ui` (Study Circuit component library with mock fixtures). See `.planning/codebase/` map (STACK, ARCHITECTURE, STRUCTURE, CONVENTIONS, TESTING, INTEGRATIONS, CONCERNS — 2026-10-09).
- Source→feature split (user-locked): audio keeps transcript + summaries/terms/cards/Q&A; documents are the quiz/exam source plus Q&A.
- Local stack: whisper.cpp CUDA (large-v3-turbo), Ollama (qwen2.5, nomic-embed-text), FFmpeg. Target: NVIDIA RTX 5060 Ti, 32 GB RAM.
- Built during a hackathon under time pressure; demo must use real imports, never mocks.
- Open feasibility items: document parser library choice, Ollama model selection after benchmarks, CUDA compat for new native deps, T/F + identification exam schema design, performance targets TBD after measurement.

## Constraints

- **Local-first**: no cloud AI APIs, no runtime CDN/fonts/network calls — why: privacy + offline core value
- **Stack**: keep Next.js + Express + Prisma + SQLite + whisper.cpp + Ollama unless a concrete compat problem forces change — why: working pipeline, hackathon time budget
- **Offline truthfulness**: never claim offline-ready when a local service is down — why: demo credibility
- **Provenance**: every generated answer carries verifiable source refs; failures explain themselves — why: trust + acceptance criteria
- **Planning discipline**: plan before implementing, one phase at a time, stop per phase for approval — why: user-locked workflow for this scope

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Audio keeps full study features; documents are the quiz/exam source | Audio pipeline already generates summaries/cards; quizzes ground best in structured doc text | — Pending |
| Document MVP = PDF/DOCX/TXT via local parsers, structure preserved | Reliable lightweight core first; OCR and exotic formats deferred | — Pending |
| Exam generation JSON-schema validated, grounded-only, deduplicated | Unreliable free-text parsing + hallucinations kill trust | — Pending |
| Perf targets set only after benchmarks | No real-time promises for 30–90 min lectures without measuring | — Pending |
| GSD onboarding (PROJECT → config → requirements → roadmap) | User-approved planning discipline before implementation | — Pending |
| Visual Study Decks via deck-contract (Slidev-compatible Markdown, native Next.js renderer) | Full Slidev embed = second framework runtime; contract keeps one stack, offline, overflow-safe | — Pending |
| Editorial "Reading Room" UI system product-wide; Study Circuit restyled into it | One coherent language beats two competing aesthetics; playful mode not kept as separate theme | — Pending |
| Existing SRS boxes + streaks grandfathered, extensions cut (P2) | Already shipped and sufficient; per-question SM-2/calendars are a second product | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-09 after scope refinement (Visual Study Decks + editorial redesign)*
