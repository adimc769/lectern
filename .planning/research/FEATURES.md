# Feature Research

**Domain:** Local-first offline AI study assistant (document-based learning + practice exams)
**Researched:** 2026-10-09
**Confidence:** HIGH (table stakes — 5+ competitor products converge); MEDIUM (differentiators — inferred from competitor gaps + Lectern local-first constraint)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Document upload (PDF, DOCX, TXT) with size guard | Every study product (NotebookLM, Quizlet, Knowt, StudyFetch, Dende, October AI, Quizly) starts from "drop in your file"; students will not retype notes | MEDIUM | Lectern already has `multer` audio pattern in `server/src/routes/lectureRoutes.ts` — mirror it for docs. Need per-type parser, page/section preservation, 20–50 MB guard. Competitors accept up to 50 MB (October AI) or 200 MB (NotebookLM); local-first MVP can cap lower (10–25 MB) for embedding cost. |
| Local text extraction preserving pages/sections | Without page/section anchors there is nothing to cite; extraction is step 1 of every competitor pipeline ("reads your material → finds key ideas → generates") | MEDIUM | PDF text layer via `pdfjs-dist`/`pdf-parse`-class lib; DOCX via `mammoth`-class lib (paragraphs + headings); TXT passthrough with synthetic section splits. Preserve `{ pageNo \| headingPath, charOffset }` per chunk. Scanned-image PDFs explicitly out (no text layer → extraction returns empty; surface honest error, not garbage). |
| Chunk + embed document text for retrieval | All grounded Q&A and grounded quiz generation depend on retrievable chunks; Lectern already does this for transcripts (`chunkingService.ts`, `embeddingService.ts`) | LOW | Reuse `chunkSegments`-style ~250-word overlapping chunks + Ollama `nomic-embed-text` + SQLite `embeddingJson`. Only delta: document chunks carry `pageNo/section` instead of `startTime`. Brute-force cosine in-process is fine at single-user scale. |
| Grounded document Q&A with page citations | NotebookLM ("every answer includes citation links"), October AI ("every answer cites the exact source"), PDF AI ("answers with page citations") — citations are the trust mechanism | MEDIUM | Mirror existing `qnaRoutes.ts` grounded prompt ("Answer ONLY from sources" + fallback sentence) but format citations as `[Doc, p. N]` / `[Doc, section]`. Every atomic claim needs ≥1 span; never emit a citation not present in retrieved chunks (RAG citation-failure literature: quotes prove presence, not meaning — keep claims-per-citation low). |
| MCQ generation from uploaded material (answer key included) | The single most universal practice feature: Quizlet AI Test Generator, Knowt Learn Mode, Dende (MCQ/T/F/fill-blank), StudyFetch QuizFetch, October AI (MCQ/T-F/short/mixed). Users equate "study app" with "quiz me on my file" | MEDIUM | Lectern already has MCQ JSON-schema extraction + `QuizPlayer` in `packages/ui`. Extend schema to `{ stem, options[4], answerIndex, explanation, sourceRef }`. Generate via Ollama chat with `format: json`, validate + dedupe, cap count (e.g. 10–20/exam) to bound local inference time. |
| True/False generation with answer key + explanation | Dende, October AI, Knowt, Quizly all ship T/F alongside MCQ; trivial marginal cost once MCQ pipeline exists, and lecturers use T/F heavily | LOW | Same JSON-schema path as MCQ with `{ statement, isTrue, explanation, sourceRef }`. Guard against trivially-negated statements ("... is NOT ...") in prompt; require explanation to quote or paraphrase the supporting passage. |
| Identification / short-answer generation with answer key + explanation | PH-curriculum staple ("identification" = name-the-term/concept); cloud tools call it "short answer / fill-in-the-blank / free response" (Dende, StudyFetch, October AI). Expected in any exam-prep tool | MEDIUM | Schema `{ prompt, acceptableAnswers[], explanation, sourceRef }`. Grading is the hard part: exact-match first, then small-model-tolerant normalized match; LLM-judge grading deferred to P2 (local 14B judge is slow + lenient). MVP: show answer key + explanation after attempt, self-marked. |
| Per-question explanations (why correct / why wrong) | StudyFetch ("instant feedback and explanations on every answer"), Dende ("feedback to stimulate critical thinking"), Knowt ("explain why you got a practice question wrong"), NotebookLM Quiz "Explain button" — explanations are what convert quizzing into learning | MEDIUM | Require `explanation` field at generation time (grounded in same chunk as question), not post-hoc. Post-hoc explanation generation doubles inference calls and risks contradicting the key. Review-wrong-answers screen reuses stored explanation + source ref. |
| Quiz/exam player with scoring + review pass | Quizlet Practice Tests ("submit test to see score and review"), Knowt unlimited practice tests, October AI ("review mistakes, retake weak spots") — generation without a player is a dead end | LOW | Lectern already has MCQ `QuizPlayer` + SRS `DeckPlayer`. Extend player to render T/F + identification, score immediately (MCQ/T-F auto; identification self-mark or normalized match), then review screen with per-question key + explanation + source link. |
| Study guide generation (structured outline from sources) | Quizlet AI Study Guide, Knowt study-guide creator, NotebookLM Reports/Study Guides, Quizly revision sheets — the "compress 50 pages into one" feature every competitor lists second after quizzes | MEDIUM | Map-reduce pattern already exists (`summarizeLectureWithOllama`): section-wise outlines → merged guide with headings, bullets, key terms. Keep guide grounded (each section carries source refs); support 1–2 length presets only (short/detailed) for MVP. |
| Honest "Not covered in your materials" fallback (never fabricated citations) | Every credible grounded product states it ("says so instead of guessing"; NotebookLM source-grounding; GRACE abstention research 2026). For a hackathon demo judged on trust, a fabricated `[p. 99]` is a fail worse than no answer | LOW | Prompt-level rule + server-side guard: if top-K similarity below threshold OR model emits fallback prefix, return fallback sentence with empty citations. Never synthesize page numbers. Log abstention rate for eval. |
| Library listing of documents + lectures (unified intake) | NotebookLM notebooks (50 sources/notebook), PDF AI workspaces, Quizly workspace — users expect to see what they uploaded and pick sources | LOW | Lectern has `/lectures` archive + `Lecture` model. Add `Document` model (or unified `Source` abstraction) with title, type, page count, status; list alongside lectures; delete cascades chunks/cards/exams. Elaborate filters/search rank deferred to P2. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Mixed-source Q&A with per-type citations (`[Title, mm:ss]` vs `[Doc, p. N]` vs `[Doc, section]`) | No cloud competitor distinguishes audio-timestamp and page citations in one answer; Lectern's source→feature split (audio keeps transcript features, docs feed exams) plus unified retrieval is unique. Directly implements PROJECT.md Active requirement | MEDIUM | Requires unified `Chunk` retrieval across transcript chunks (timestamped) and doc chunks (paged) with a `sourceKind` discriminator, then citation formatter per kind. Retrieval prompt must label each source block with its kind so the model cites correctly. Deep links: audio → `?tab=transcript&t=`, doc → doc viewer anchor. |
| 100% offline, on-device inference with zero cloud dependency | Every competitor analyzed (NotebookLM, Quizlet, Knowt, StudyFetch, Dende, October AI) is cloud-hosted with account + upload-to-server; Lectern's core value ("without the internet, data never leaves the machine") is the sharpest wedge for privacy-sensitive students and no-connectivity exam prep | HIGH (already paid) | Already architected (whisper.cpp + Ollama + SQLite). For this milestone the work is *preserving* it: no new npm dep may phone home, no CDN fonts, document parsers must be pure-local. Verify with `audit-offline.ts` + airplane-mode run. Market as the headline, not a footnote. |
| Exam-mode practice tests (timed, full-length, topic breakdown) | StudyFetch distinguishes quiz (short, confidence-rated) vs practice test (timed, scored at end, topic breakdown); Quizlet Practice Tests add timer + difficulty. Timed simulation is the closest proxy to real exam pressure | MEDIUM | Build on quiz player: add timer, hide explanations until submit, score at end with per-topic breakdown (topics from doc headings). Low extra AI cost (same generation pipeline), mostly UI state. P1.x after untimed player ships. |
| Difficulty + topic controls on generation | October AI ("pick quiz type, difficulty, number of questions"), Quizly (adjustable difficulty + topic focus), NotebookLM flashcards/quiz (difficulty + count), Quizlet (question type + length + timer). Control converts one-shot generation into a study loop | LOW | Prompt parameters `{ count, difficulty: easy\|medium\|hard, topicFilter: heading }` + UI selects. Cheap to add once schema pipeline exists; improves demo ("generate 5 hard questions on Chapter 3"). |
| Retake-weak-spots / mistake review queue | October AI ("retake weak spots"), PrepAI ("mistake review"), Knowt spaced repetition, StudyFetch confidence tracking. Turns a static exam into adaptive practice without full adaptive algorithms | LOW | Persist per-question results on the exam attempt; "retry missed" filters to wrong/self-marked-wrong items. No new AI calls needed. Natural fit with existing SRS boxes/streaks in `packages/ui/src/study/`. |
| Progressive-difficulty generation (recall → understanding → application → synthesis) | NotebookLM power-user pattern (Q1–6 recall → Q18–20 synthesis across sources). Demonstrates pedagogical depth judges and educators notice | LOW | Prompt-level only: instruct generator to label each question with a tier and order output accordingly. Zero schema change (add optional `tier` field). Offer as an "exam hardness" preset. |
| Per-service readiness indicators (honest offline truthfulness) | PROJECT.md Active requirement; no competitor does per-service honesty well (they assume cloud). "Ollama down → quiz generation disabled with clear reason" builds demo credibility | LOW | Extend existing `SystemStatusDTO` / `/api/status` probes with doc-pipeline deps (parser availability is static; Ollama + embed model + disk space are live). Gate generation buttons on status; never claim offline-ready when a service is down. |
| Answer-key + explanation export (print-ready exam handout) | Teachers/tutors want paper handouts; NotebookLM exports reports/PDF, Quizly exports revision-sheet PDF. For PH classroom use, a printable exam + key is high value | LOW | Render exam + key to print CSS (existing `LectureWorkspace` already has Markdown/Anki/print export pattern to copy). Full file export (PDF/DOCX) deferred — browser print is enough for MVP. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| OCR for scanned/image PDFs | "Support any PDF" sounds complete; Dende/Quizly advertise scanned-page support | Native OCR (Tesseract) adds heavyweight binary + CUDA-compat risk + slow per-page inference; PROJECT.md explicitly defers to P2 pending native-tool investigation. Image PDFs with no text layer would silently yield empty exams | Detect no-text-layer PDFs at upload, reject with clear message ("scanned PDF — OCR coming in P2"); focus MVP on digital PDFs/DOCX/TXT that cover most lecture handouts |
| Advanced PDF layout / table / figure reconstruction | Textbook PDFs have complex two-column layouts, tables, figures; faithful reconstruction sounds premium | Low value per effort (PROJECT.md out of scope); reading-order bugs corrupt chunks and poison retrieval + citations. Competitors with best results all caveat "clean source material = best results" | Linear text extraction in reading order + heading detection; skip tables/figures (drop with a logged warning, note in UI "tables/figures not included") |
| Formats beyond PDF/DOCX/TXT (PPTX, ODT, photos, YouTube, audio-as-doc) | Competitors accept slides/photos/YouTube (NotebookLM multi-format, October AI photos of slides) | Each format is a new parser + new citation semantics; hackathon time budget kills reliability. PROJECT.md defers until core ships | Paste-as-TXT escape hatch (user pastes slide text); PPTX only if `mammoth`-class lib handles it for free — otherwise P2 |
| Cloud sync / accounts / sharing / collaboration | NotebookLM sharing, Knowt mobile apps, StudyFetch accounts — "access anywhere" expectation | Directly violates local-first core value; adds auth, backend, and data-leak surface. No auth layer exists (ARCHITECTURE.md: localhost-only) | Single-user localhost library; export via print/Markdown for sharing; revisit only with an explicit hosted milestone |
| AI podcast / audio-overview generation from documents | NotebookLM Audio Overviews are beloved; Quizly/StudyFetch ship podcast features | Requires TTS engine (new native dep + voices + storage) with zero exam-prep payoff; Lectern already has real lecture audio — synthetic podcasts duplicate it poorly | Keep real-audio playback + transcript deep links; defer TTS to v2+ |
| LLM-judge auto-grading of free-response / identification | "Auto-grade my essay" is the obvious ask (StudyFetch Essay Grader) | Small local models (qwen2.5:14b) are lenient, slow, and non-deterministic graders; false "correct" marks destroy trust worse than self-marking. GaRAGe 2025: even large models only reach ~59% attribution F1 | MVP: answer key + explanation shown after attempt with self-mark (correct/close/missed); normalized string match as assist. LLM judge is a P2 research item with eval harness |
| Full adaptive engine (SM-2 per-question scheduling, confidence tracking, study calendar) | Knowt/Quizly SM-2, StudyFetch study plan/calendar, PrepAI mastery tracking — looks like the "real" study app | Lectern already has Leitner boxes + streaks (good enough); per-question SM-2 + calendars + mastery dashboards are a second product. Scope creep that starves exam-generation quality | Reuse existing SRS boxes/streaks + mistake-retry queue; defer calendars/mastery dashboards to P2 analytics milestone (already cut in PROJECT.md out of scope) |
| Elaborate library search / filters / tags /Mind-map navigation | Quizly mindmaps, NotebookLM mind maps — visual navigation feels modern | Retrieval already handles "find it for me" via Q&A; filter/tag/mindmap UI is high-frontend-cost, low-learning-value for a hackathon demo | Flat unified library list + Q&A-driven discovery; full-text search only if free via SQLite `LIKE` on titles |
| Export to Anki-apkg / PDF / DOCX / Sheets pipelines | NotebookLM Sheets export, Quizly PDF export, Knowt mobile sync | Each exporter is a format bug farm; existing Markdown/Anki/print pattern covers demo needs | Browser-print CSS + Markdown copy (already established pattern); binary exporters deferred to P2 |

## Feature Dependencies

```
[Document upload + intake]
    └──requires──> [Local text extraction (pages/sections)]
                       └──requires──> [Chunk + embed doc text]
                                          ├──requires──> [Grounded doc Q&A w/ page citations]
                                          ├──requires──> [MCQ / T-F / Identification generation + keys]
                                          └──requires──> [Study guide generation]
[MCQ / T-F / Identification generation + keys]
    └──requires──> [Quiz/exam player w/ scoring + review]
                       └──requires──> [Per-question explanations display]
                       └──enhances──> [Exam mode (timed) + topic breakdown]
                       └──enhances──> [Retake-weak-spots queue]
[Mixed-source Q&A w/ per-type citations]
    └──requires──> [Chunk + embed doc text] + [existing transcript chunks]
    └──requires──> [Grounded doc Q&A citation format]
    └──requires──> ["Not covered" fallback + abstention guard]
[Study guide generation] ──enhances──> [Difficulty + topic controls]
[Difficulty + topic controls] ──enhances──> [MCQ / T-F / Identification generation]
[Honest readiness indicators] ──guards──> [All generation features]
[Library listing] ──requires──> [Document upload + intake]

[OCR for scanned PDFs] ──conflicts──> [MVP timeline] (deferred P2)
[Cloud sync / accounts] ──conflicts──> [Local-first core value] (never without explicit milestone)
[LLM-judge auto-grading] ──conflicts──> [Trust requirement] (deferred P2 with eval)
```

### Dependency Notes

- **Extraction requires intake, everything requires extraction:** upload (multer + size guard + type allowlist) → parse to `{ text, pageNo/section }` → chunk → embed. No chunking without structure; no citations without chunk offsets. This is Phase 1 and blocks all other phases.
- **Generation requires retrieval-ready chunks + JSON-schema validation:** the generator prompt must receive grounded passages (not "write questions about biology") and the output must parse as schema (`answerIndex`, `isTrue`, `acceptableAnswers`, `explanation`, `sourceRef`). PROJECT.md key decision: "JSON-schema validated, grounded-only, deduplicated" — dedupe against existing exam items by normalized stem.
- **Player requires generation output contract:** do not build the T/F + identification player against free-text; freeze the exam-item DTO in `@lectern/shared` first, then build UI. Extends existing `QuizPlayer`/`DeckPlayer`, not a rewrite.
- **Mixed-source Q&A requires both chunk stores + fallback:** unified `findTopK` across transcript + doc chunks, per-kind citation formatting, and the abstention guard. Ship single-source doc Q&A first, then flip on mixed retrieval — keeps each step demoable.
- **Explanations are generated with the question, displayed by the player:** generating explanations post-hoc doubles Ollama calls and risks key/explanation drift. Store `explanation` at generation time.
- **Readiness indicators guard all generation:** if Ollama/embed model is down, disable generation buttons with the reason. Never let the user generate into a failure and receive fabricated output.
- **Anti-features conflict by design:** OCR, cloud sync, and LLM-judge grading are documented conflicts, not backlog — they either break the timeline (OCR), the core value (cloud), or trust (judge without eval).

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] Document upload + local extraction (PDF/DOCX/TXT, pages/sections preserved, scanned PDFs rejected with clear message) — without this nothing downstream exists
- [ ] MCQ + True/False + Identification generation with answer keys + per-question explanations + source refs (JSON-schema validated, grounded-only, deduplicated) — the exam-prep core
- [ ] Quiz/exam player handling all three types with scoring + review pass (MCQ/T-F auto-scored; identification self-marked with key shown) — generation is worthless without a take-and-review loop
- [ ] Study guide generation (structured outline, 1–2 length presets, section source refs) — the "compress 50 pages" expectation
- [ ] Mixed-source Q&A with per-type citations (`[Title, mm:ss]`, `[Doc, p. N]`, `[Doc, section]`) + "Not covered in your materials." fallback — the trust + unified-library payoff
- [ ] Unified library listing (lectures + documents with status) + honest per-service readiness indicators — demo navigability + offline truthfulness

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] Exam mode (timer, hidden-until-submit explanations, per-topic score breakdown) — trigger: untimed player validated in demo
- [ ] Difficulty + topic controls and progressive-difficulty presets — trigger: users ask for "harder questions" or per-chapter exams
- [ ] Retake-weak-spots queue wired into existing SRS boxes/streaks — trigger: mistake-review requested more than once
- [ ] Print-ready exam + key via print CSS (reuse Markdown/Anki/print pattern) — trigger: teacher/tutor user asks for handouts

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] OCR for scanned PDFs (native-tool investigation) — why defer: heavyweight dep + compat risk, PROJECT.md P2
- [ ] LLM-judge grading for identification/free-response with eval harness — why defer: small-model grading untrustworthy without measured accuracy
- [ ] SM-2 scheduling, confidence tracking, study calendar, mastery dashboards — why defer: second product; Leitner boxes suffice
- [ ] Binary exporters (PDF/DOCX/apkg), mind-map navigation, elaborate library filters — why defer: high cost, low learning value for MVP
- [ ] TTS podcast overviews, cloud sync/accounts, PPTX/photo/YouTube ingest — why defer: new deps or core-value conflicts

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Document upload + local extraction (pages/sections) | HIGH | MEDIUM | P1 |
| MCQ generation + key + explanation + source ref | HIGH | MEDIUM | P1 |
| T/F generation + key + explanation | HIGH | LOW | P1 |
| Identification generation + key + explanation | HIGH | MEDIUM | P1 |
| Quiz/exam player (3 types) + scoring + review | HIGH | LOW | P1 |
| Mixed-source Q&A w/ per-type citations | HIGH | MEDIUM | P1 |
| "Not covered" fallback + no-fabricated-citations guard | HIGH | LOW | P1 |
| Study guide generation | HIGH | MEDIUM | P1 |
| Unified library listing | MEDIUM | LOW | P1 |
| Readiness indicators (honest offline status) | MEDIUM | LOW | P1 |
| Difficulty + topic controls | MEDIUM | LOW | P2 |
| Exam mode (timed + topic breakdown) | MEDIUM | MEDIUM | P2 |
| Retake-weak-spots queue | MEDIUM | LOW | P2 |
| Print-ready exam + key | MEDIUM | LOW | P2 |
| OCR for scanned PDFs | MEDIUM | HIGH | P3 |
| LLM-judge auto-grading | MEDIUM | HIGH | P3 |
| SM-2 / calendars / mastery dashboards | LOW | HIGH | P3 |
| TTS podcasts, cloud sync, extra formats | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | NotebookLM (Google) | Quizlet / Knowt | StudyFetch / Dende / October AI / Quizly | Our Approach (Lectern) |
|---------|---------------------|-----------------|------------------------------------------|------------------------|
| Doc ingest formats | PDF, Docs, Slides, URLs, YouTube, text; 50 sources/notebook, 200 MB/file | DOCX, PDF, PPTX, Drive, paste-text | PDF/DOCX/TXT (+PPT, photos, scans on some); up to 50 MB | PDF/DOCX/TXT only, local parsers, smaller cap; scanned PDFs rejected honestly (P2 OCR) |
| Extraction structure | Auto analysis + instant overview per source | Key-idea extraction for cards/tests | Concept extraction → quiz/flash/summary/podcast/mindmap | Preserve pages/sections explicitly for citations; drop tables/figures with notice |
| Practice questions | Quiz (MCQ/short/essay, cited, difficulty+count, Explain button) | Practice tests (MCQ/written, timer, difficulty), Learn mode (MCQ/T-F/fill-in) | MCQ, T/F, fill-blank, short/free response, mixed; difficulty/type/count; confidence tracking | MCQ + T/F + identification with keys + explanations + source refs; JSON-schema validated; difficulty/topic controls P1.x |
| Answer keys + explanations | Cited answers + Explain button | Feedback on strengths/weaknesses; Knowt explains wrong answers | Instant per-answer feedback + explanations; review mistakes | Explanation stored at generation time (no post-hoc drift); review-wrong-answers screen with source link |
| Study guides | Reports: study guides, FAQs, timelines, briefing docs, custom prompts | AI study guides/outlines + PDF summarizer; Knowt detailed breakdowns | Revision sheets/notes, structured guides, mindmaps | Map-reduce outline reusing lecture summarizer; headings + bullets + key terms + section refs; 2 length presets |
| Flashcards/SRS | Flashcards (count + difficulty, grounded) | Flashcards + Learn + spaced repetition; matching game | Flashcards + SM-2 SRS | Already exists (DeckPlayer + Leitner + streaks); reuse, don't rebuild |
| Q&A + citations | Source-grounded chat, inline citations to exact passage, multi-source synthesis | Ask/homework help (cloud LLM, weak citations) | Sparky tutor, chat w/ materials (citations vary) | Mixed-source RAG with **per-type** citations (audio `mm:ss` vs doc `p. N`); abstention fallback; local Ollama only |
| Honest fallback | Source-grounded ("only your sources") | Weak — cloud LLM answers from general knowledge | Claimed ("built from your material") but unverified server-side | Prompt rule + similarity-threshold guard + empty-citation fallback; "Not covered in your materials." verbatim |
| Offline / privacy | Cloud, Google account, trains on platform terms | Cloud accounts, paywalled AI features | Cloud accounts, uploads to servers | **100% on-device, no account, no upload off-machine** — the wedge; airplane-mode verified |
| Exam simulation | None (quiz only) | Timed practice tests + expert sets (AP/NCLEX/SAT) | Full practice tests: timed, scored-at-end, topic breakdown, exam-specific formats (MCAT/NCLEX/AP) | Timed exam mode + topic breakdown as P1.x on top of validated untimed player |
| Weak-spot loop | Retake quiz; review results | Spaced repetition + practice-test feedback | Retake weak spots; mistake review; confidence ratings; mastery tracking | Persist attempt results; "retry missed" queue into existing SRS; defer full SM-2/calendar analytics |

## Sources

- Competitor products analyzed: Google NotebookLM (notebooklm.xin feature overview; Georgetown CNDLS Studio panel doc — Quiz/Flashcards/Reports/Mind Map/Slide Deck/Infographic with citations + Explain button; Google for Education + Penn State AI pages — source-grounded answers, 50 sources/notebook, study-guide/quiz/flashcard generation); Quizlet AI tools (AI Test Generator, Practice Tests help-center article — upload → generate → customize type/length/timer → review; AI Study Guide, PDF Summarizer, Flashcard Maker); Knowt (free Learn Mode MCQ/T-F/fill-in, spaced repetition, unlimited practice tests, study-guide creator from PDF/DOCX/PPT/video); StudyFetch (QuizFetch multi-type quizzes + confidence tracking + explanations; Practice Tests vs quizzes distinction; Flashcards/Notes/Study Plan/Sparky suite); Dende.ai (MCQ/fill-blank/T-F quiz maker from PDF, per-answer feedback, 104M+ questions); OctoberAI (upload→generate→study in <60s; MCQ/T-F/short/flashcards/mixed credit model; per-answer source passage); Quizly (PDF/DOCX/TXT → MCQ/T-F/matching + SRS SM-2 + revision sheets + podcasts + mindmaps + adaptive study plan); PrepAI/PDF AI/Sikgen (extraction + mistake review + multi-doc workspaces + teacher review gate patterns)
- RAG grounding research: GRACE (Zhao et al., arXiv Jan 2026 — joint grounding + abstention via RL, 10% annotation cost); GaRAGe benchmark (Amazon Science — attribution F1 ≤58.9%, deflection responses for insufficient grounding); "Generate but Verify: Answering with Faithfulness" (Filice et al., IJCNLP-AACL 2025); "When RAG Citations Still Lie" (Rana, Mar 2026 — 11 failure modes: quote cropping, claims-per-citation, wrong-version retrieval; fix: per-claim spans, multi-citation coverage policy)
- Repo grounding: `.planning/PROJECT.md` (Active requirements, out-of-scope list, source→feature split, local stack); `.planning/codebase/ARCHITECTURE.md` (pipeline orchestrator, embeddingService cosine retrieval, qnaRoutes grounded prompt + fallback, shared DTO contract); `.planning/codebase/STACK.md` (Express + Prisma + SQLite, Next.js 15, Ollama, whisper.cpp); `.planning/codebase/STRUCTURE.md` (where new services/routes/components/DTOs go)
- Confidence: HIGH that listed table-stakes appear in ≥3 independent competitor products (cross-verified); MEDIUM on complexity estimates (local-model inference costs unmeasured — PROJECT.md notes perf targets TBD after benchmarks) and on differentiator ranking (inferred from gaps, not user interviews)

---
*Feature research for: local-first offline AI study assistant (Lectern document + practice-exam milestone)*
*Researched: 2026-10-09*
