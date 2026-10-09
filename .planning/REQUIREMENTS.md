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

## Traceability

(Filled by roadmap: each REQ-ID mapped to exactly one phase.)

---

*Requirements defined: 2026-10-09*
