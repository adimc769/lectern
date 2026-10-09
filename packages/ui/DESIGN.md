# Lectern Study — Playful Study-First Design (packages/ui)

> Replaces the earlier calm/restrained direction for the **study experience only**.
> Upload/library chrome stays as-is; everything under `study/` follows this doc.
> Skill basis: `ui-ux-pro-max` (general guidance — Python CLI unavailable in this
> environment, so no verified `--design-system` match; principles below are
> labeled general guidance) + `frontend-patterns` (composition, keyboard,
> focus management). No existing app copied: original name, mascot, palette.

## 1. Identity (original, no copies)

- **Study mode name:** `Study Circuit` — one lecture = one circuit; cards and
  quizzes are "laps". Distinct from any existing product language.
- **Motif/mascot:** `Loopbug` — an original abstract SVG: a rounded-square card
  with a single orbit ring and two dot eyes. Drawn inline in
  `StudyMascot.tsx`, no external images, no animal mascot, no copied logo.
- **Voice:** friendly coach, never childish. Examples: "Nice — 8 in a row!",
  "Two tricky ones left. You've got this.", "Circuit complete. Sharp work."
  Avoid: baby talk, all-caps hype, streak-shaming.

## 2. Palette (bright, not garish) — general guidance

One strong primary + two supportive accents. All text pairs target ≥ 4.5:1.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--study-primary` | `#5B3DF5` (vivid iris) | `#9D86FF` | primary buttons, progress fill, focus rings |
| `--study-primary-ink` | `#FFFFFF` on primary | `#1A1230` on primary-light | button text |
| `--study-sun` | `#FFB020` (sunbeam) | `#FFC53D` | streaks, celebration confetti, quiz correct pop |
| `--study-mint` | `#0CA678` (mint) | `#3DDC97` | "Got it" / correct states |
| `--study-rose` | `#E64980` | `#F783AC` | "Still learning" / incorrect (never color-only — always with icon + label) |
| `--study-bg` | `#FFF9F0` warm paper | `#161226` deep plum-ink | screen bg |
| `--study-card` | `#FFFFFF` | `#221C3A` | cards, radius 20px, soft shadow |
| `--study-ink` | `#221C3A` | `#F5F1FF` | headings/body |
| `--study-muted` | `#6B6390` | `#B9B0D9` | secondary text (≥4.5:1 on card) |

Radius 16–24px (cards 20px), chunky buttons (min-height 48px, radius 16px),
card text ≥ 24px for question/answer, soft shadows
(`0 8px 24px rgba(34,28,58,.10)` light / `0 8px 24px rgba(0,0,0,.45)` dark).

## 3. Typography (local only)

System stack only — no CDN fonts, no external images:
`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
Scale: card question 26–30px bold; answer 20–22px; UI labels 13–15px semibold.
Never below 12px for readable text.

## 4. Experience rules (study-first)

1. After processing completes, the primary CTA is **"Start studying"**
   (LectureWorkspace header + Study home). Reading tabs are secondary.
2. **One thing per screen**: deck = one card; quiz = one question.
   Top progress bar on every study screen (`7 / 12`, quiz `Q4/10`).
3. Motion with purpose only: 3D card flip (≤300ms), slide-in next card,
   short completion celebration (CSS confetti burst ≤1.2s).
   `prefers-reduced-motion: reduce` disables flip/slide/confetti (instant swap).
4. Every card AND quiz question shows a source chip:
   `From the lecture · 14:32` → opens transcript at `sourceStart`.
5. Offline badge stays visible on all study screens; demo mode ships two
   preloaded lectures with flashcards AND quizzes in fixtures.

## 5. Components (in `src/study/`)

- `StudyMascot.tsx` — inline SVG Loopbug + encouraging line. `aria-hidden` art,
  real text for message.
- `SourceChip.tsx` — button chip (icon + `mm:ss`), `aria-label`
  "Open transcript at 14:32". Never color-only.
- `DeckPlayer.tsx` — full-screen card, flip on click/Space, Got it (→) /
  Still learning (←), touch swipe (pointer events, ≥48px targets), progress
  `n / total`, remaining "still learning" loop until cleared.
- `QuizPlayer.tsx` — one question/screen, 4 choices as big buttons, immediate
  feedback (correct answer + one-line explanation), results screen with score
  + "Review missed ones".
- `StudyHome.tsx` — per-lecture card (mastery %, Continue, Study all),
  streak counter, total mastered. Reads `studyStore`.
- `CompletionScreen.tsx` — score, time studied, streak update,
  "Study again" / "Ask about this lecture".
- `srs.ts` — pure Leitner boxes 1–5 (`rate(card, known)`), due-first sort.
  Unit-tested, no DOM/storage imports.
- `studyStore.ts` — localStorage wrapper (all JSON parse/stringify in
  try/catch, namespaced `lectern.study.v1`), streak + per-card box persistence.

## 6. Accessibility (must-haves)

- Full keyboard: Space flip, ←/→ answer, 1–4 quiz choices, Esc closes.
- Visible focus rings (`outline: 3px solid var(--study-primary)`, offset 2px).
- `role=region` + `aria-label` on players, `aria-live=polite` for progress
  and feedback, real `<button>`s ≥ 44×44px (study uses 48px).
- Touch swipe is enhancement only — buttons always present (no swipe-only).
- Contrast checked both themes; icons + text, never color-alone.

## 7. What we deliberately DON'T do

- No copied mascot/illustrations, no CDN assets, no leaderboard/shaming,
  no autoplay audio, no infinite deck without completion state.
