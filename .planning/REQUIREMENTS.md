# Lectern Requirements — Document Milestone (v1)

**Gathered:** 2026-10-09
**Sources:** `.planning/PROJECT.md`, `.planning/research/FEATURES.md`, scoping session

## v1 Requirements

### Document Intake
- [ ] **DOC-01**: Student can upload a PDF and Lectern extracts readable text preserving page numbers
- [ ] **DOC-02**: Student can upload a DOCX and Lectern extracts text preserving headings/sections
- [ ] **DOC-03**: Student can import TXT notes or pasted plain text as a study source
- [ ] **DOC-04**: Extracted document text is chunked with page/section refs and embedded for retrieval

### Exam Generation
- [ ] **EXAM-01**: Student can generate multiple-choice questions (4 options, key included) grounded in document content
- [ ] **EXAM-02**: Student can generate true/false questions with answer key grounded in document content
- [ ] **EXAM-03**: Student can generate identification questions with acceptable answers, self-marked with key shown
- [ ] **EXAM-04**: Every generated question stores its explanation and source ref at generation time (no post-hoc drift)

### Exam Player & Guides
- [ ] **PLAY-01**: Student can take a quiz covering all three question types with scoring and a review pass
- [ ] **PLAY-02**: Student can generate a structured study guide (headings, bullets, key terms, section refs)
- [ ] **PLAY-03**: Student can retry missed questions via a mistake queue wired into existing SRS boxes

### Q&A
- [ ] **QA-01**: Student can ask questions about one document with `[Doc, p. N]` / `[Doc, section]` citations (build-order step toward QA-02)
- [ ] **QA-02**: Student can ask questions across lectures and documents with per-type citations in one answer
- [ ] **QA-03**: Unsupported questions receive "Not covered in your materials." with empty citations — never fabricated

### Library & Readiness
- [ ] **LIB-01**: Student can view lectures and documents in one unified library list with status
- [ ] **LIB-02**: Student can see honest per-service readiness (generation gated with reasons when a service is down)
- [ ] **LIB-03**: Student can keyword-search and semantically retrieve across transcripts and document text

### Visual Study Decks
- [ ] **DECK-01**: Student can generate a grounded slide deck (title → objectives → concepts → recap → knowledge check) from a lecture, document, or selected sources
- [ ] **DECK-02**: Student can navigate a deck locally (keyboard, slide progress, per-slide source refs) with loading/empty/error states
- [ ] **DECK-03**: Deck content stays within slide budgets (no overflow/unreadable slides) across text, definitions, processes, and examples
- [ ] **DECK-04**: Student can export or open the deck as Slidev-compatible Markdown for use in real Slidev

### Editorial UI System
- [ ] **UI-01**: All eight screens (Home, Import, Source workspace, Ask, Flashcards, Exams, Decks, Settings) follow one editorial design system (type scale, spacing, components, states) with WCAG AA contrast and reduced-motion support

## v2 Requirements (deferred)
- [ ] Difficulty + topic controls on generation (trigger: "harder questions" requests)
- [ ] Timed exam mode with per-topic breakdown (trigger: untimed player validated)
- [ ] Print-ready exam + key handout (trigger: teacher/tutor ask)
- [ ] Retake-weak-spots analytics beyond SRS queue

## Out of Scope
- OCR for scanned PDFs — heavyweight native dep + compat risk, P2 with investigation
- Advanced PDF layout/table reconstruction — low value per effort
- Formats beyond PDF/DOCX/TXT — deferred until reliable core ships
- Cloud sync / accounts / sharing — violates local-first core value
- LLM-judge auto-grading — small-model grading untrustworthy without eval harness
- SM-2 calendars, mastery dashboards, TTS podcasts, binary exporters — second-product scope
- Spaced-repetition extensions beyond existing Leitner boxes + streaks — frozen per scope refinement
- Full Slidev runtime embed — rejected in favor of deck-contract approach

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DOC-01 | Phase 1 | Pending |
| DOC-02 | Phase 1 | Pending |
| DOC-03 | Phase 1 | Pending |
| DOC-04 | Phase 1 | Pending |
| EXAM-01 | Phase 2 | Pending |
| EXAM-02 | Phase 2 | Pending |
| EXAM-03 | Phase 2 | Pending |
| EXAM-04 | Phase 2 | Pending |
| PLAY-01 | Phase 2 | Pending |
| PLAY-02 | Phase 3 | Pending |
| PLAY-03 | Phase 3 | Pending |
| QA-01 | Phase 3 | Pending |
| QA-02 | Phase 3 | Pending |
| QA-03 | Phase 3 | Pending |
| LIB-01 | Phase 4 | Pending |
| LIB-02 | Phase 4 | Pending |
| LIB-03 | Phase 3 | Pending |
| DECK-01 | Phase 5 | Pending |
| DECK-02 | Phase 5 | Pending |
| DECK-03 | Phase 5 | Pending |
| DECK-04 | Phase 5 | Pending |
| UI-01 | Phase 6 | Pending |

---

*Requirements defined: 2026-10-09*
