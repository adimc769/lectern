import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OfflineBadge } from '../components/OfflineBadge';
import { LectureList } from '../components/LectureList';
import { LecturePage } from '../components/LecturePage';
import { AskPanel } from '../components/AskPanel';
import { MockLecternApi } from '../mockApi';
import type { LectureDetail, LectureListItem } from '../types';

describe('OfflineBadge', () => {
  it('renders neutral offline guarantee note when online', () => {
    render(<OfflineBadge forceOffline={false} />);
    expect(
      screen.getByText('Works either way. Nothing leaves your device.')
    ).toBeDefined();
    expect(screen.getByText('Local AI')).toBeDefined();
  });

  it('renders green air-gapped status when offline', () => {
    render(<OfflineBadge forceOffline={true} />);
    expect(
      screen.getByText('Offline mode: all AI runs on this device')
    ).toBeDefined();
    expect(screen.getByText('Air-gapped')).toBeDefined();
  });

  it('toggles privacy details modal on button click', () => {
    render(<OfflineBadge forceOffline={true} />);
    const badgeBtn = screen.getByRole('button');
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(badgeBtn);
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('100% On-Device Privacy')).toBeDefined();
  });
});

describe('LectureList & LecturePage', () => {
  const dummyLectures: LectureListItem[] = [
    {
      id: 'lec-1',
      title: 'Distributed Systems 101',
      status: 'done',
      durationSec: 300,
      createdAt: '2026-10-09T00:00:00.000Z',
    },
  ];

  const dummyDetail: LectureDetail = {
    id: 'lec-1',
    title: 'Distributed Systems 101',
    status: 'done',
    durationSec: 300,
    createdAt: '2026-10-09T00:00:00.000Z',
    summary: 'Executive summary content here.',
    keyTerms: [{ term: 'Quorum', definition: 'Majority agreement.' }],
    flashcards: [{ question: 'What is quorum?', answer: 'floor(N/2) + 1 nodes' }],
    transcript: [{ start: 0, end: 15, text: 'Hello class.' }],
  };

  it('renders lecture list and triggers selection', () => {
    const onSelect = vi.fn();
    render(
      <LectureList
        lectures={dummyLectures}
        selectedLectureId="lec-1"
        onSelectLecture={onSelect}
      />
    );

    expect(screen.getByText('Distributed Systems 101')).toBeDefined();
    fireEvent.click(screen.getByText('Distributed Systems 101'));
    expect(onSelect).toHaveBeenCalledWith('lec-1');
  });

  it('switches tabs in LecturePage using WAI-ARIA tab controls', () => {
    render(<LecturePage lecture={dummyDetail} />);

    // Initially on summary tab
    expect(screen.getByText('Executive summary content here.')).toBeDefined();

    // Click Key Terms tab
    const keyTermsTab = screen.getByRole('tab', { name: /key terms/i });
    fireEvent.click(keyTermsTab);
    expect(screen.getByText('Quorum')).toBeDefined();
    expect(screen.getByText('Majority agreement.')).toBeDefined();

    // Click Flashcards tab
    const flashcardsTab = screen.getByRole('tab', { name: /flashcards/i });
    fireEvent.click(flashcardsTab);
    expect(screen.getByText('What is quorum?')).toBeDefined();

    // Flip flashcard
    const flipButton = screen.getByRole('button', { name: /flip card/i });
    fireEvent.click(flipButton);
    expect(screen.getByText('floor(N/2) + 1 nodes')).toBeDefined();
  });
});

describe('AskPanel', () => {
  it('renders chat interface and queries mock API', async () => {
    const mock = new MockLecternApi({ simulatedProgressSpeedMs: 50 });
    const onNavigate = vi.fn();

    render(
      <AskPanel
        api={mock}
        lectures={[{ id: 'lec-1', title: 'Distributed Systems', status: 'done', durationSec: 100, createdAt: '' }]}
        onNavigateToCitation={onNavigate}
      />
    );

    const input = screen.getByRole('textbox', { name: /question prompt/i });
    fireEvent.change(input, { target: { value: 'What is Raft consensus?' } });

    const submitBtn = screen.getByRole('button', { name: /send query/i });
    fireEvent.click(submitBtn);

    // Wait for response bubble
    await waitFor(
      () => {
        expect(screen.getByText(/Sources & Audio Citations:/i)).toBeDefined();
      },
      { timeout: 3000 }
    );
  });
});
