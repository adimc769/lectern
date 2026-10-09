import { describe, it, expect, vi } from 'vitest';
import { LecternApi } from '../api';
import { MockLecternApi } from '../mockApi';

describe('LecternApi (HTTP Client)', () => {
  it('calls POST /lectures with FormData', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'lec-123' }),
    });

    const api = new LecternApi({ baseUrl: 'http://localhost:3000', fetchFn: mockFetch as any });
    const dummyBlob = new Blob(['audio-content'], { type: 'audio/webm' });

    const result = await api.uploadLecture(dummyBlob, 'Intro to OS');

    expect(result.id).toBe('lec-123');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/lectures',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('calls GET /lectures and parses list', async () => {
    const mockLectures = [
      { id: '1', title: 'Test 1', status: 'done', durationSec: 100, createdAt: '2026-10-09' },
    ];
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockLectures,
    });

    const api = new LecternApi({ baseUrl: 'http://localhost:3000', fetchFn: mockFetch as any });
    const result = await api.getLectures();

    expect(result).toEqual(mockLectures);
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:3000/lectures', expect.anything());
  });

  it('calls POST /ask with question payload', async () => {
    const mockResponse = { answer: 'Raft consensus...', citations: [] };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const api = new LecternApi({ baseUrl: 'http://localhost:3000', fetchFn: mockFetch as any });
    const result = await api.ask('What is Raft?');

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/ask',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ question: 'What is Raft?' }),
      })
    );
  });
});

describe('MockLecternApi', () => {
  it('initializes with seed lectures and answers grounded queries', async () => {
    const mock = new MockLecternApi({ simulatedProgressSpeedMs: 50 });
    const lectures = await mock.getLectures();

    expect(lectures.length).toBeGreaterThanOrEqual(3);
    expect(lectures[0].status).toBe('done');

    const raftAnswer = await mock.ask('How does Raft elect leaders?');
    expect(raftAnswer.answer).toContain('Raft');
    expect(raftAnswer.citations.length).toBeGreaterThan(0);

    const offTopicAnswer = await mock.ask('How to bake a chocolate cake?');
    expect(offTopicAnswer.answer).toBe('Not covered in your lectures.');
    expect(offTopicAnswer.citations).toEqual([]);
  });
});
