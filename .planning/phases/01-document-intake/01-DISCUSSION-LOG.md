# Phase 1: Document Intake - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-09
**Phase:** 1-document-intake
**Areas discussed:** Upload surface, Failure UX, Size & type guardrails, Library visibility

---

## Upload surface

| Option | Description | Selected |
|--------|-------------|----------|
| Third IntakeModal tab | Documents tab beside Upload/Record — reuses FormData POST + progress polling | |
| Unified picker | One tab accepts audio + docs, routes by detected type | |
| You decide | Pick whichever fits the codebase best | ✓ |

**User's choice:** You decide (agent discretion on placement)
**Notes:** Placement delegated; remaining upload questions answered directly.

| Option | Description | Selected |
|--------|-------------|----------|
| Both | Upload .txt plus a paste box for copied notes | ✓ |
| File only | Strictly .txt upload, no paste path | |
| You decide | Your call | |

**User's choice:** Both (upload .txt plus paste box)
**Notes:** Covers slides/handouts pasted from elsewhere.

| Option | Description | Selected |
|--------|-------------|----------|
| One at a time | Single upload with clear progress | ✓ |
| Multi-file queue | Drop several docs, they process in sequence | |
| You decide | Your call | |

**User's choice:** One at a time
**Notes:** Matches audio flow, simpler.

| Option | Description | Selected |
|--------|-------------|----------|
| Source view + progress | Open the document view with live progress stepper | ✓ |
| Stay + inline progress | Remain on current page, progress shown inline/toast | |
| You decide | Your call | |

**User's choice:** Source view + progress
**Notes:** Mirrors audio workspace pattern.

---

## Failure UX

| Option | Description | Selected |
|--------|-------------|----------|
| Upfront validation | Checked at select time, instant message before upload | ✓ |
| Processing FAILED status | Upload first, pipeline marks FAILED with stated reason | |
| You decide | Your call | |

**User's choice:** Upfront validation
**Notes:** No wasted processing on unreadable files.

| Option | Description | Selected |
|--------|-------------|----------|
| Specific cause + action | Names the cause and what to do next | ✓ |
| Generic error | One plain unsupported-file message for all cases | |
| You decide | Your call | |

**User's choice:** Specific cause + action
**Notes:** Scanned/encrypted/empty each explained.

| Option | Description | Selected |
|--------|-------------|----------|
| No trace | Rejected outright, nothing stored | ✓ |
| FAILED entry | Visible entry with reason, retry/delete actions | |
| You decide | Your call | |

**User's choice:** No trace
**Notes:** Library stays clean.

| Option | Description | Selected |
|--------|-------------|----------|
| Pick another file | Return to picker with formats reminder | ✓ |
| Retry same file | One-click retry in case of transient failure | |
| You decide | Your call | |

**User's choice:** Pick another file
**Notes:** Fastest recovery path.

---

## Size & type guardrails

| Option | Description | Selected |
|--------|-------------|----------|
| Single cap | One limit for PDF/DOCX/TXT — simpler to explain | ✓ |
| Per-type caps | Tuned limits per format | |
| You decide | Your call | |

**User's choice:** Single cap

| Option | Description | Selected |
|--------|-------------|----------|
| 25 MB | Room for big slide decks and long PDFs | ✓ |
| 10 MB | Tighter, keeps embedding costs and wait times low | |
| You decide | Your call | |

**User's choice:** 25 MB

| Option | Description | Selected |
|--------|-------------|----------|
| Block with reason | Refuse before upload, state the limit and accepted formats | ✓ |
| Allow with warning | Let it through but warn it may be slow or partial | |
| You decide | Your call | |

**User's choice:** Block with reason

| Option | Description | Selected |
|--------|-------------|----------|
| PDF/DOCX/TXT only | Strict allowlist, Markdown stays out | ✓ |
| Include Markdown | Accept .md too, treated like TXT with headings | |
| You decide | Your call | |

**User's choice:** PDF/DOCX/TXT only
**Notes:** Smallest reliable core per scope.

---

## Library visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Title + type + status + pages | Icon per type, READY/PROCESSING/FAILED badge, page count | ✓ |
| Title + status only | Minimal row, details on open | |
| You decide | Your call | |

**User's choice:** Title + type + status + pages

| Option | Description | Selected |
|--------|-------------|----------|
| Mixed into one list | Lectures + docs together with type icons | ✓ |
| Separate section | Documents grouped apart until Phase 4 unifies | |
| You decide | Your call | |

**User's choice:** Mixed into one list
**Notes:** Unified feel early; Phase 4 formalizes the library.

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror lectures | Status badge + progress % polling, same as audio pipeline | ✓ |
| Minimal spinner | Just a spinner until READY | |
| You decide | Your call | |

**User's choice:** Mirror lectures

| Option | Description | Selected |
|--------|-------------|----------|
| Extracted text reader | Headings + pages, readable review of what was extracted | ✓ |
| Details panel only | Title, page count, status — no reading view yet | |
| You decide | Your call | |

**User's choice:** Extracted text reader
**Notes:** Lets students verify extraction quality directly.

---

## the agent's Discretion

- Document upload surface placement (IntakeModal tab vs unified picker vs separate dropzone)

## Deferred Ideas

None — discussion stayed within phase scope.
