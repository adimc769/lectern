# Roadmap: Lectern

## Overview

Lectern already turns lecture audio into cited study material; this milestone adds the document half of the core value — a student imports real lecture materials (audio they have, documents they will) and studies from them with grounded, cited AI help, fully offline. Four MVP vertical slices deliver end-to-end user capabilities in dependency order: import documents as retrieval-ready sources, generate and take grounded practice exams, ask cited questions across all materials while reinforcing with guides and mistake review, then land the credibility gate — one unified library that never lies about readiness, proven by an airplane-mode run.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Document Intake** - Upload PDF/DOCX/TXT and get retrieval-ready study sources
- [ ] **Phase 2: Grounded Exams** - Generate and take cited practice exams from documents
- [ ] **Phase 3: Cited Q&A and Reinforcement** - Ask across all materials, study guides, mistake review
- [ ] **Phase 4: Honest Library** - One unified library with truthful readiness plus offline proof

## Phase Details

### Phase 1: Document Intake
**Goal**: Students can import PDF, DOCX, and TXT materials as retrieval-ready study sources
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: DOC-01, DOC-02, DOC-03, DOC-04
**Success Criteria** (what must be TRUE):
  1. Student uploads a PDF and Lectern extracts readable text preserving page numbers
  2. Student uploads a DOCX and Lectern extracts text preserving headings/sections
  3. Student imports TXT notes or pasted plain text as a study source
  4. Student sees an uploaded document reach READY (or FAILED with an honest reason, e.g. scanned PDF) with page/section-anchored chunks available for retrieval
**Plans**: TBD
**UI hint**: yes

### Phase 2: Grounded Exams
**Goal**: Students can generate and take grounded practice exams from their documents
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: EXAM-01, EXAM-02, EXAM-03, EXAM-04, PLAY-01
**Success Criteria** (what must be TRUE):
  1. Student generates multiple-choice questions (4 options, key included) grounded in document content, each stored with its explanation and source ref
  2. Student generates true/false questions with answer key grounded in document content
  3. Student generates identification questions with acceptable answers and self-marks against the shown key
  4. Student takes a quiz covering all three question types with scoring and a review pass showing explanations and source refs
**Plans**: TBD
**UI hint**: yes

### Phase 3: Cited Q&A and Reinforcement
**Goal**: Students can ask cited questions across all materials and reinforce with guides and mistake review
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: QA-01, QA-02, QA-03, LIB-03, PLAY-02, PLAY-03
**Success Criteria** (what must be TRUE):
  1. Student asks a question about one document and gets an answer with `[Doc, p. N]` / `[Doc, section]` citations
  2. Student asks or searches across lectures and documents and gets results with per-type citations (`[Title, mm:ss]` vs `[Doc, p. N]`) in one place
  3. Student asks something unsupported and gets "Not covered in your materials." with empty citations — never fabricated
  4. Student generates a structured study guide (headings, bullets, key terms, section refs) from a document
  5. Student retries missed questions via a mistake queue wired into the existing SRS boxes
**Plans**: TBD
**UI hint**: yes

### Phase 4: Honest Library
**Goal**: Students navigate all materials in one library that never lies about offline readiness
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: LIB-01, LIB-02
**Success Criteria** (what must be TRUE):
  1. Student views lectures and documents in one unified library list with per-item status
  2. Student sees honest per-service readiness, and generation is gated with a stated reason when a service is down
  3. Student completes the core workflow (import → exam → Q&A) in airplane mode with the run recorded
  4. Repo contains no weights, uploads, or database files in git

Note: criteria 3–4 are milestone acceptance gates from PROJECT.md Active scope (offline verification run + repo hygiene), not derived from a single v1 requirement — they verify Phases 1–3 end to end.
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Document Intake | TBD | Not started | - |
| 2. Grounded Exams | TBD | Not started | - |
| 3. Cited Q&A and Reinforcement | TBD | Not started | - |
| 4. Honest Library | TBD | Not started | - |
