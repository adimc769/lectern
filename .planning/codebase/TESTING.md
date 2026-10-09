---
last_mapped_commit: 15310b9043b62a1f115f333f51535da622f0d098
last_mapped_at: 2026-10-09
---
# Testing Patterns

**Analysis Date:** 2026-10-09

## Test Framework

**Runner:**
- Vitest everywhere tests exist — no Jest, no Playwright/Cypress, no other runner
- `server/package.json` (`vitest@^5.0.3`, script `"test": "vitest run"`), `packages/core/package.json` (`vitest@^2.1.0`, script `"test": "vitest run"`), `packages/ui/package.json` (`vitest@^5.0.3`, script `"test": "vitest run"`), `packages/server-routes/package.json` (`vitest@^2.1.0`, script `"test": "vitest run"`)
- Config: zero-config Vitest except `packages/ui/vite.config.ts`, which sets the only test block in the repo:

```typescript
test: {
  environment: 'jsdom',
  globals: true,
},
// from packages/ui/vite.config.ts
```

- `web/` (`web/package.json`) and `shared/` (`shared/package.json`) have no test script, no test runner, and no test files — do not expect tests there

**Assertion Library:**
- Vitest built-ins only: `describe`, `it`, `expect`, `vi`, `beforeEach` imported from `'vitest'` at the top of every test file
- Component tests add `@testing-library/react@^16.3.3` + `@testing-library/dom@^10.4.2` with `jsdom@^30.1.2` (devDependencies of `packages/ui/package.json`): `render`, `screen`, `fireEvent`, `waitFor`

**Run Commands:**

```bash
npm --workspace @lectern/server run test        # server: server/src/services/__tests__/services.test.ts
npm --workspace @lectern/core run test          # core: packages/core/test/*.test.ts (9 files)
npm --workspace @lectern/server-routes run test # server-routes: packages/server-routes/test/handlers.test.ts
npm --workspace @lectern/ui run test            # ui: packages/ui/src/__tests__/* + packages/ui/src/study/__tests__/*
npx vitest run --workspace=packages/core        # equivalent direct invocation (vitest zero-config)
```

- No watch/coverage CI commands exist: there is no `test:watch`, `test:coverage`, or root `test` script in `package.json`. Use `npx vitest` (watch) and `npx vitest run --coverage` ad-hoc; do not assume coverage gates.

## Test File Organization

**Location:**
- Two accepted layouts — match the surrounding package, do not mix:
  - Colocated `__tests__/` next to sources: `server/src/services/__tests__/services.test.ts`, `packages/ui/src/__tests__/api.test.ts`, `packages/ui/src/__tests__/components.test.tsx`, `packages/ui/src/study/__tests__/srs.test.ts`, `packages/ui/src/study/__tests__/studyStore.test.ts`
  - Sibling `test/` at package root: `packages/core/test/audit.test.ts`, `packages/core/test/chunker.test.ts`, `packages/core/test/fixtures.test.ts`, `packages/core/test/ollama.test.ts`, `packages/core/test/pipeline.test.ts`, `packages/core/test/prompts.test.ts`, `packages/core/test/types.test.ts`, `packages/core/test/vector.test.ts`, `packages/core/test/whisper.test.ts`, `packages/server-routes/test/handlers.test.ts`

**Naming:**
- Use `*.test.ts` for logic/API/handler tests, `*.test.tsx` for component tests. Never use `*.spec.*` (zero `.spec` files exist).

**Structure:**

```
server/src/services/__tests__/services.test.ts   # one file covering all 5 backend services
packages/core/test/<module>.test.ts               # one file per module (chunker, vector, ollama, whisper, pipeline, prompts, types, fixtures, audit)
packages/server-routes/test/handlers.test.ts      # one file covering all route handlers + background job
packages/ui/src/__tests__/api.test.ts             # HTTP client + mock API contract
packages/ui/src/__tests__/components.test.tsx     # rendered component behavior (jsdom)
packages/ui/src/study/__tests__/srs.test.ts       # pure SRS math
packages/ui/src/study/__tests__/studyStore.test.ts # persistence + streak logic
```

## Test Structure

**Suite Organization:**
- Nest `describe` per class, then per method/behavior; keep `it` names behavioral (`'returns ...'`, `'throws ... when ...'`, `'handles ...'`). Follow this exact shape from `packages/core/test/vector.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { cosine, topK } from '../src/vector.js';

describe('vector operations', () => {
  describe('cosine', () => {
    it('returns 1 for identical vectors', () => {
      expect(cosine([1, 2, 3], [1, 2, 3])).toBeCloseTo(1.0, 5);
    });
    it('returns 0 for zero vectors or empty arrays or mismatched lengths', () => {
      expect(cosine([0, 0], [1, 2])).toBe(0);
      expect(cosine([], [1, 2])).toBe(0);
    });
  });
});
```

- Group multi-service files with one top-level `describe` per service, as in `server/src/services/__tests__/services.test.ts`:

```typescript
describe('Backend Pipeline Services', () => {
  describe('AudioService', () => { /* ... */ });
  describe('ChunkingService', () => { /* ... */ });
  describe('EmbeddingService', () => { /* ... */ });
  describe('WhisperService parsing logic', () => { /* ... */ });
  describe('PipelineOrchestrator progress tracking', () => { /* ... */ });
});
```

**Patterns:**
- Build inputs inline at the top of each `it` (segments, chunks, lectures); assert shape and values with `toBe`, `toEqual`, `toContain`, `toBeCloseTo`, `toHaveLength`, `toBeGreaterThan`, `toMatch`, `toThrowError`. Example from `packages/core/test/chunker.test.ts`:

```typescript
const segments: Segment[] = [
  { start: 0.0, end: 5.0, text: 'This is the first segment with several words.' },
  { start: 5.0, end: 10.0, text: 'And this is the second segment with more words.' },
];
const chunks = chunkSegments(segments, { targetWords: 10, overlapWords: 0 });
expect(chunks.length).toBeGreaterThanOrEqual(1);
expect(chunks[0].start).toBe(0.0);
expect(chunks[0].text).toContain('first segment');
```

- Isolate persistence tests with `beforeEach` clearing `window.localStorage`, as in `packages/ui/src/study/__tests__/studyStore.test.ts`:

```typescript
beforeEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    // Storage unavailable: tests below use the in-memory shim.
  }
});
```

- Prefer injected `now: Date` params over `vi.useFakeTimers` for time logic — `getStreak(now)` / `recordStudyDay(now)` take explicit dates in `packages/ui/src/study/studyStore.ts`, and `packages/ui/src/study/__tests__/studyStore.test.ts` passes fixed `new Date(2026, 9, 5, ...)` values with a `// NOTE: month index is 0-based` comment.

## Mocking

**Framework:** `vi.fn()` + constructor-injected fakes (`fetchFn`, `execFn`, `readFileFn`). No `vi.mock()` module registry mocking exists anywhere — always inject, neverHijack imports.

**Patterns:**
- Inject a mock `fetch` through the client options object. Copy this from `packages/core/test/ollama.test.ts`:

```typescript
const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
  capturedUrl = url;
  capturedBody = JSON.parse(init?.body as string) as Record<string, unknown>;
  return { ok: true, status: 200, json: async () => ({ /* ... */ }) } as unknown as Response;
});
const client = new OllamaClient({ baseUrl: 'http://localhost:11434', fetchFn: mockFetch as unknown as typeof fetch });
```

- Override the global only for legacy singleton-style services, then assert URL + method. Copy this from `server/src/services/__tests__/services.test.ts`:

```typescript
const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ embeddings: [[0.1, 0.2, 0.3]] }) });
globalThis.fetch = mockFetch as unknown as typeof fetch;
const vec = await embedService.getEmbedding('Test lecture chunk text');
expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/embed'), expect.objectContaining({ method: 'POST' }));
```

- Fake `execFile`/`readFile` for native side effects via `execFn`/`readFileFn` options (constructor defaults fall back to real `execFileAsync` / `fs.promises.readFile`). Copy from `packages/core/test/whisper.test.ts`:

```typescript
const mockExec = vi.fn().mockImplementation(async (file: string, args: string[]) => {
  executedFile = file; executedArgs = args;
  return { stdout: '', stderr: '' };
});
const client = new WhisperClient({ ffmpegPath: '/usr/bin/ffmpeg', execFn: mockExec });
const out = await client.toWav('lecture.mp4');
expect(executedArgs).toEqual(['-y', '-i', 'lecture.mp4', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', 'lecture.16k.wav']);
```

- Build a full fake context object for handler tests with `vi.fn()` collaborators and `queueMicrotask`-safe defaults. Copy the factory from `packages/server-routes/test/handlers.test.ts`:

```typescript
function createMockContext(repo = new InMemoryLectureRepository()) {
  const mockWhisper = {
    toWav: vi.fn().mockResolvedValue('/tmp/converted.wav'),
    transcribe: vi.fn().mockResolvedValue([
      { start: 0, end: 10, text: 'Hello world, this is a lecture on trees.' },
      { start: 10, end: 20, text: 'A tree has nodes and edges.' },
    ]),
  };
  const mockOllama = {
    embed: vi.fn().mockResolvedValue({ embedding: [0.1, 0.2, 0.3], embeddings: [[0.1, 0.2, 0.3]] }),
    chat: vi.fn().mockImplementation(async (params: { format?: unknown }) => { /* ... */ }),
  };
  const ctx: ServerContext = {
    repository: repo, ollama: mockOllama as unknown as OllamaClient,
    whisper: mockWhisper as unknown as WhisperClient,
    chatModel: 'test-chat', embedModel: 'test-embed',
  };
  return { ctx, mockOllama, mockWhisper };
}
```

- Reach private methods in tests with `// @ts-expect-error accessing private method` + direct call (accepted pattern, do not export privates for tests). Copy from `server/src/services/__tests__/services.test.ts`:

```typescript
// @ts-expect-error accessing private method for unit test
expect(whisper.parseTimestampToSeconds('00:00:10.500')).toBe(10.5);
// @ts-expect-error accessing private method for testing
orchestrator.updateProgress('lec-test-1', 'CONVERTING_AUDIO', 15, 'Converting audio to WAV');
```

- Drive async background jobs deterministically: either `await runLectureProcessingJob(id, path, ctx)` directly (preferred, in `packages/server-routes/test/handlers.test.ts`) or poll with a bounded loop for `autoStart` paths:

```typescript
await runLectureProcessingJob(lectureId, '/mock/path/trees.wav', ctx);
expect(mockWhisper.toWav).toHaveBeenCalledTimes(1);
// ... vs. polling fallback also in packages/server-routes/test/handlers.test.ts:
let attempts = 0;
while (attempts < 20) {
  await new Promise((r) => setTimeout(r, 20));
  const prog = await handleGetLectureProgress({ id: res.id }, ctx);
  if (prog.status === 'done' || prog.status === 'failed') break;
  attempts++;
}
```

- Simulate storage failure with `localStorage` writes and `Object.defineProperty` removal (see `packages/ui/src/study/__tests__/studyStore.test.ts` `describe('corrupt storage')` and `describe('storage-unavailable shim')`).

**What to Mock:**
- Mock `fetch` (Ollama `/api/chat`, `/api/embed`, `/api/tags`, Whisper `/inference`, API routes) — never hit `localhost:11434` / `localhost:8080` in tests
- Mock `execFn` (ffmpeg, whisper-cli) and `readFileFn` (WAV bytes) — never shell out
- Mock `OllamaClient.chat/embed` and `WhisperClient.toWav/transcribe` at handler level via `ServerContext`
- Use `MockLecternApi` (in `packages/ui/src/mockApi.ts`) instead of hand-rolled fakes for component tests — construct with `{ simulatedProgressSpeedMs: 50 }` to keep `waitFor` timeouts short, as in `packages/ui/src/__tests__/components.test.tsx`

**What NOT to Mock:**
- Do not mock pure logic under test (`chunkSegments`, `countWords`, `cosine`, `topK`, `rate`, `sortDueFirst`, `masteryPercent`, prompt builders, schema shapes) — call the real functions with inline data
- Do not mock the repository when testing repository behavior — use the real `InMemoryLectureRepository` or `SqliteLectureRepository(':memory:')` (see `packages/server-routes/test/handlers.test.ts` `it('works with SqliteLectureRepository')`, which closes with `sqliteRepo.close()`)
- Do not mock `localStorage` wholesale — use the real jsdom storage plus corrupt/removed variants to exercise the never-throw shim

## Fixtures and Factories

**Test Data:**
- Load committed JSON fixtures from `packages/core/fixtures/lecture1.json` and `lecture2.json` with `fs.readFileSync` + `path.resolve(__dirname, ...)` and validate shape/loops, as in `packages/core/test/fixtures.test.ts`:

```typescript
const p = path.resolve(__dirname, '../fixtures/lecture1.json');
const segments: Segment[] = JSON.parse(fs.readFileSync(p, 'utf-8')) as Segment[];
expect(segments.length).toBeGreaterThan(15);
for (const seg of segments) {
  expect(typeof seg.start).toBe('number');
  expect(seg.end).toBeGreaterThan(seg.start);
  expect(seg.text.length).toBeGreaterThan(10);
}
```

- Reuse the `MockLecternApi` seed corpus (`INITIAL_LECTURES` + `QUIZZES` in `packages/ui/src/mockApi.ts`: lec-1 Raft, lec-2 Transformers, lec-3 SSA) for API/component answers; assert grounded vs. fallback branches:

```typescript
const mock = new MockLecternApi({ simulatedProgressSpeedMs: 50 });
const raftAnswer = await mock.ask('How does Raft elect leaders?');
expect(raftAnswer.answer).toContain('Raft');
const offTopicAnswer = await mock.ask('How to bake a chocolate cake?');
expect(offTopicAnswer.answer).toBe('Not covered in your lectures.');
// from packages/ui/src/__tests__/api.test.ts
```

- Build inline factories per test (dummy lectures/details/chunks) rather than shared helpers — e.g. `dummyLectures` / `dummyDetail` in `packages/ui/src/__tests__/components.test.tsx`, `createMockContext()` in `packages/server-routes/test/handlers.test.ts`. There is no shared `factories.ts` — keep it that way.
- Create temp files under `os.tmpdir()` with `fs.mkdtempSync` + `fs.rmSync(tmp, { recursive: true, force: true })` for filesystem-touching tests, as in `packages/core/test/audit.test.ts` (which imports the script under test via `import { auditFile } from '../../scripts/audit-offline.ts'`).

**Location:**
- Committed fixtures: `packages/core/fixtures/lecture1.json`, `packages/core/fixtures/lecture2.json`
- Seed corpora: `INITIAL_LECTURES` + `QUIZZES` in `packages/ui/src/mockApi.ts`; `FALLBACK_LECTURES` in `web/src/lib/api.ts` (untested — frontend has no runner)
- Ephemeral: `os.tmpdir()`-scoped dirs in `packages/core/test/audit.test.ts`; `:memory:` SQLite in `packages/server-routes/test/handlers.test.ts`

## Coverage

**Requirements:** None enforced — no `coverage` script, no `coverageThresholds`, no `c8`/`v8` provider config in any `package.json` or `vite.config.ts`.

**View Coverage:**

```bash
npx vitest run --coverage --workspace=packages/core   # ad-hoc only; @vitest/coverage-* is not installed
```

- Install a coverage provider before relying on this; today coverage is informational only.

## Test Types

**Unit Tests:**
- Scope: pure functions and client edge cases with zero I/O. Files: `packages/core/test/chunker.test.ts` (word counting, empty/overlap chunking), `packages/core/test/vector.test.ts` (`cosine`/`topK` incl. zero/mismatched/skip-missing-embedding), `packages/core/test/prompts.test.ts` (schema shape, `formatTimestamp`, all message builders), `packages/core/test/types.test.ts` (DTO construction), `packages/core/test/ollama.test.ts` (request shape, retry, 404-no-retry, down/timeout errors, top-level helpers), `packages/core/test/whisper.test.ts` (ffmpeg args, FormData shape, unreachable-server error), `packages/ui/src/study/__tests__/srs.test.ts` (box advance/cap/reset/clamp/NaN/Infinity, stable sort, immutability, mastery %), `packages/ui/src/study/__tests__/studyStore.test.ts` (round-trip, clamping, namespacing, copy-semantics, corrupt/SSR fallbacks, streak + session stats)
- Approach: real function + inline data + exact assertions; `toBeCloseTo(..., 5)` for floats, `toEqual([])` / `toBe('')` for empty-input contracts

**Integration Tests:**
- Scope: multi-step flows with fakes at the process boundary (no real Ollama/ffmpeg/SQLite file). Files: `server/src/services/__tests__/services.test.ts` (AudioService rejection, ChunkingService overlap, `cosineSimilarity` + mocked `getEmbedding`, private whisper parsers, orchestrator progress map), `packages/core/test/pipeline.test.ts` (map-reduce fan-out counts, JSON-with-fences parsing, dedup + 12-card cap, cited answer vs. `NOT_COVERED_RESPONSE`), `packages/server-routes/test/handlers.test.ts` (POST→job→GET full lifecycle, failure-path `failed` + readable message, `:memory:` SQLite parity, `autoStart` polling), `packages/ui/src/__tests__/api.test.ts` (`LecternApi` FormData/JSON wire shapes via mock fetch + `MockLecternApi` grounded/fallback answers)
- Example full-lifecycle assertion from `packages/server-routes/test/handlers.test.ts`:

```typescript
await runLectureProcessingJob(lectureId, '/mock/path/trees.wav', ctx);
expect(mockWhisper.toWav).toHaveBeenCalledTimes(1);
expect(mockOllama.embed).toHaveBeenCalled();
const progress = await handleGetLectureProgress({ id: lectureId }, ctx);
expect(progress.status).toBe('done');
expect(progress.percent).toBe(100);
```

**E2E Tests:** Not used — no Playwright/Cypress/WebDriver config, scripts, or specs exist. Component tests in `packages/ui/src/__tests__/components.test.tsx` are the closest proxy (jsdom render + `fireEvent` + `waitFor`):

```typescript
render(<AskPanel api={mock} lectures={[...]} onNavigateToCitation={onNavigate} />);
fireEvent.change(screen.getByRole('textbox', { name: /question prompt/i }), { target: { value: 'What is Raft consensus?' } });
fireEvent.click(screen.getByRole('button', { name: /send query/i }));
await waitFor(() => { expect(screen.getByText(/Sources & Audio Citations:/i)).toBeDefined(); }, { timeout: 3000 });
```

## Common Patterns

**Async Testing:**
- `await expect(promise).rejects.toThrow(...)` for failures; `rejects.toThrowError(SpecificError)` when the class matters. Use these verbatim:

```typescript
await expect(audioService.convertToWav('non_existent_file.mp3')).rejects.toThrow('Audio file does not exist');
// from server/src/services/__tests__/services.test.ts
```

```typescript
await expect(client.chat({ model: 'unknown:latest', messages: [{ role: 'user', content: 'test' }] })).rejects.toThrowError(OllamaModelNotFoundError);
expect(mockFetch).toHaveBeenCalledTimes(1); // 404 should not retry
// from packages/core/test/ollama.test.ts
```

```typescript
await expect(handleGetLectureById({ id: 'nonexistent' }, ctx)).rejects.toThrowError(RouteError);
// from packages/server-routes/test/handlers.test.ts
```

**Error Testing:**
- Assert the retry/no-retry contract explicitly: 500 retries then succeeds (`callCount === 3` in `packages/core/test/ollama.test.ts`), 404 never retries (`toHaveBeenCalledTimes(1)`), connection-refused maps to `OllamaDownError` after `maxRetries + 1` calls, abort maps to `OllamaTimeoutError` via `signal.addEventListener('abort', ...)` fake
- Assert failure surfaces carry readable messages: `progress.error` contains `'Whisper server out of memory'` and `progress.status === 'failed'` in `packages/server-routes/test/handlers.test.ts`; corrupt-storage reads return defaults and writes self-heal without throwing in `packages/ui/src/study/__tests__/studyStore.test.ts`:

```typescript
window.localStorage.setItem(STORAGE_KEY, '{{not-valid-json!!!');
expect(() => getBox('lec-1', 'card-a')).not.toThrow();
expect(getBox('lec-1', 'card-a')).toBe(1);
expect(() => recordStudyDay()).not.toThrow();
```

- Assert defensive copies so callers cannot corrupt state (both in `packages/ui/src/study/__tests__/studyStore.test.ts` and `packages/ui/src/study/__tests__/srs.test.ts`):

```typescript
const boxes = getAllBoxes('lec-1');
boxes['card-a'] = 5;
expect(getBox('lec-1', 'card-a')).toBe(2);
```

```typescript
const sorted = sortDueFirst(cards);
expect(sorted).not.toBe(cards);
expect(cards).toEqual(snapshot);
```

---

*Testing analysis: 2026-10-09*
