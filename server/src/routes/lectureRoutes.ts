import { Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { prisma } from '../db.js';
import { CONFIG } from '../config.js';
import { pipelineOrchestrator } from '../services/pipelineOrchestrator.js';
import { audioService } from '../services/audioService.js';
import type { LectureDTO } from '@lectern/shared';

function toPublicAudioPath(audioPath: string): string {
  if (!audioPath) return '';
  if (audioPath.startsWith('/uploads/')) return audioPath;
  return `/uploads/${path.basename(audioPath)}`;
}

const DEMO_TITLE = 'DEMO: Raft in 60s';

const DEMO_SUMMARY =
  'This 60-second demo explains the Raft consensus algorithm: leader election ' +
  'with randomized timeouts, majority-based log replication with commit on quorum, ' +
  'and the safety guarantee of at most one leader per term, so every server applies ' +
  'the same commands in the same order.';

const DEMO_SEGMENTS = [
  {
    startTime: 0,
    endTime: 17.03,
    text: 'Raft is a consensus algorithm for managing a replicated log across a cluster of servers. In sixty seconds: the cluster elects a leader, the leader accepts client commands, and every server applies the same commands in the same order.',
  },
  {
    startTime: 17.03,
    endTime: 36.38,
    text: 'Leader election uses randomized timeouts. When followers stop hearing heartbeats, they become candidates, vote for themselves, and request votes. The candidate with a majority becomes leader for the new term, which keeps split votes from stalling the cluster.',
  },
  {
    startTime: 36.38,
    endTime: 51.96,
    text: 'The leader replicates log entries with remote procedure calls and commits an entry once a majority stores it. If a leader fails, a new election starts, and the election safety guarantee ensures at most one leader per term.',
  },
];

const DEMO_FLASHCARDS = [
  {
    front: 'What triggers a Raft leader election?',
    back: "A follower times out waiting for the leader's heartbeat, becomes a candidate, and requests votes.",
  },
  {
    front: 'When does a Raft leader commit a log entry?',
    back: 'Once a majority of servers have stored the entry, it is committed and applied in order.',
  },
  {
    front: 'What is the quorum requirement for a 5-node cluster?',
    back: 'At least 3 nodes (majority) must agree to guarantee split-brain safety.',
  },
  {
    front: 'Why are Raft election timeouts randomized?',
    back: 'To prevent split-vote ties by ensuring one candidate times out and requests votes first.',
  },
];

const DEMO_KEY_TERMS = [
  {
    term: 'Leader election',
    definition:
      'Process where a candidate wins a majority of votes to lead the cluster for a monotonically increasing term.',
  },
  {
    term: 'Quorum commit',
    definition:
      'A log entry is committed when stored on a majority of servers, keeping the replicated log consistent.',
  },
];

function copySeedAudio(src: string): string {
  const dest = path.join(CONFIG.UPLOADS_DIR, `${Date.now()}_demo-seed_${path.basename(src)}`);
  try {
    if (path.resolve(src) === path.resolve(dest)) return src;
    fs.copyFileSync(src, dest);
    return dest;
  } catch {
    return src;
  }
}

function pickSeedAudioPath(): string {
  try {
    if (!fs.existsSync(CONFIG.UPLOADS_DIR)) {
      fs.mkdirSync(CONFIG.UPLOADS_DIR, { recursive: true });
    }
    const demo60 = path.join(CONFIG.UPLOADS_DIR, 'demo-60s.wav');
    if (fs.existsSync(demo60)) {
      return copySeedAudio(demo60);
    }
    const smallest = fs
      .readdirSync(CONFIG.UPLOADS_DIR)
      .filter((f) => f.toLowerCase().endsWith('.wav'))
      .map((f) => {
        const p = path.join(CONFIG.UPLOADS_DIR, f);
        return { p, size: fs.statSync(p).size };
      })
      .sort((a, b) => a.size - b.size)[0];
    if (smallest) return copySeedAudio(smallest.p);
  } catch {
    // Fall through to empty audio path.
  }
  return '';
}

export const lectureRouter = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, CONFIG.UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

// POST new lecture audio (multipart upload)
lectureRouter.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No audio file provided in multipart upload' });
      return;
    }

    const title =
      (req.body.title as string | undefined)?.trim() ||
      path.parse(req.file.originalname).name ||
      'Untitled Lecture';

    const lecture = await prisma.lecture.create({
      data: {
        title,
        audioPath: req.file.path,
        status: 'PROCESSING',
      },
    });

    // Start background processing pipeline
    pipelineOrchestrator.startPipeline(lecture.id, req.file.path);

    res.status(201).json({ id: lecture.id, success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create lecture upload', details: String(error) });
  }
});

// POST idempotent demo lecture for the 60s Judge-Mode flow
lectureRouter.post('/seed-demo', async (_req, res) => {
  try {
    const existing = await prisma.lecture.findFirst({
      where: { title: DEMO_TITLE },
      include: { flashcards: true },
    });
    if (existing) {
      if (existing.flashcards.length < DEMO_FLASHCARDS.length) {
        await prisma.flashcard.deleteMany({ where: { lectureId: existing.id } });
        await prisma.flashcard.createMany({
          data: DEMO_FLASHCARDS.map((f) => ({ ...f, lectureId: existing.id })),
        });
      }
      res.status(200).json({ id: existing.id, status: existing.status });
      return;
    }

    const audioPath = pickSeedAudioPath();
    const probedDur = audioPath ? await audioService.getAudioDuration(audioPath) : 0;
    const duration = probedDur > 0 ? probedDur : 60;
    const scaledSegments = DEMO_SEGMENTS.map((s) => {
      if (duration === 60) return { ...s };
      const ratio = duration / 60;
      return {
        text: s.text,
        startTime: Math.round(s.startTime * ratio * 100) / 100,
        endTime: Math.round(s.endTime * ratio * 100) / 100,
      };
    });

    const lecture = await prisma.lecture.create({
      data: {
        title: DEMO_TITLE,
        audioPath,
        duration,
        status: 'COMPLETED',
        summary: DEMO_SUMMARY,
        segments: { create: scaledSegments },
        flashcards: { create: DEMO_FLASHCARDS.map((f) => ({ ...f })) },
        keyTerms: { create: DEMO_KEY_TERMS.map((k) => ({ ...k })) },
      },
    });

    res.status(201).json({ id: lecture.id, status: lecture.status });
  } catch (error) {
    res.status(500).json({ error: 'Failed to seed demo lecture', details: String(error) });
  }
});

// GET lecture processing progress
lectureRouter.get('/:id/progress', async (req, res) => {
  try {
    const progress = await pipelineOrchestrator.getProgress(req.params.id);
    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve progress', details: String(error) });
  }
});


// GET all lectures
lectureRouter.get('/', async (_req, res) => {
  try {
    const lectures = await prisma.lecture.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            segments: true,
            flashcards: true,
            keyTerms: true,
            chunks: true,
          },
        },
      },
    });


    const mapped: LectureDTO[] = lectures.map((l) => ({
      id: l.id,
      title: l.title,
      audioPath: toPublicAudioPath(l.audioPath),
      duration: l.duration,
      status: l.status as LectureDTO['status'],
      summary: l.summary,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    }));

    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve lectures', details: String(error) });
  }
});

// GET single lecture with details
lectureRouter.get('/:id', async (req, res) => {
  try {
    const lecture = await prisma.lecture.findUnique({
      where: { id: req.params.id },
      include: {
        segments: { orderBy: { startTime: 'asc' } },
        flashcards: true,
        keyTerms: true,
      },
    });

    if (!lecture) {
      res.status(404).json({ error: 'Lecture not found' });
      return;
    }

    const mapped: LectureDTO = {
      id: lecture.id,
      title: lecture.title,
      audioPath: toPublicAudioPath(lecture.audioPath),
      duration: lecture.duration,
      status: lecture.status as LectureDTO['status'],
      summary: lecture.summary,
      createdAt: lecture.createdAt.toISOString(),
      updatedAt: lecture.updatedAt.toISOString(),
      segments: lecture.segments.map((s) => ({
        id: s.id,
        lectureId: s.lectureId,
        startTime: s.startTime,
        endTime: s.endTime,
        text: s.text,
      })),
      flashcards: lecture.flashcards.map((f) => ({
        id: f.id,
        lectureId: f.lectureId,
        front: f.front,
        back: f.back,
      })),
      keyTerms: lecture.keyTerms.map((k) => ({
        id: k.id,
        lectureId: k.lectureId,
        term: k.term,
        definition: k.definition,
      })),
    };

    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve lecture details', details: String(error) });
  }
});

// GET lecture quiz derived from flashcards (QuizQuestion projection)
lectureRouter.get('/:id/quiz', async (req, res) => {
  try {
    const lecture = await prisma.lecture.findUnique({
      where: { id: req.params.id },
      include: {
        flashcards: true,
      },
    });

    if (!lecture) {
      res.status(404).json({ error: 'Lecture not found' });
      return;
    }

    const cards = lecture.flashcards ?? [];
    if (cards.length < 4) {
      res.json([]);
      return;
    }

    const questions: Array<{
      id: string;
      question: string;
      choices: [string, string, string, string];
      answerIndex: number;
      explanation: string;
      sourceStart: number;
    }> = [];

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const distractors = cards
        .filter((_, j) => j !== i)
        .map((c) => c.back)
        .filter((back) => back !== card.back);
      const uniqueDistractors = [...new Set(distractors)].slice(0, 3);
      if (uniqueDistractors.length < 3) continue;

      // Deterministic distribution of correct choice
      const rawChoices = [card.back, ...uniqueDistractors];
      const targetSlot = i % 4;
      const choices: [string, string, string, string] = [
        rawChoices[1],
        rawChoices[2],
        rawChoices[3],
        rawChoices[1],
      ];
      // Place target at targetSlot and other 3 in remaining slots
      const others = [rawChoices[1], rawChoices[2], rawChoices[3]];
      let otherIdx = 0;
      for (let s = 0; s < 4; s++) {
        if (s === targetSlot) {
          choices[s] = card.back;
        } else {
          choices[s] = others[otherIdx++] ?? rawChoices[1];
        }
      }

      questions.push({
        id: `quiz-${lecture.id}-${card.id}`,
        question: card.front,
        choices,
        answerIndex: targetSlot,
        explanation: `Concept from this lecture: ${card.back}`,
        sourceStart: 0,
      });
    }

    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve lecture quiz', details: String(error) });
  }
});

// DELETE lecture (cascade deletes segments, chunks, cards; cleans up audio)
lectureRouter.delete('/:id', async (req, res) => {
  try {
    const lecture = await prisma.lecture.findUnique({
      where: { id: req.params.id },
    });

    if (!lecture) {
      res.status(404).json({ error: 'Lecture not found' });
      return;
    }

    await prisma.lecture.delete({
      where: { id: req.params.id },
    });

    if (lecture.audioPath && fs.existsSync(lecture.audioPath)) {
      try {
        fs.unlinkSync(lecture.audioPath);
      } catch {
        // ignore cleanup error
      }
    }

    res.json({ success: true, message: 'Lecture deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete lecture', details: String(error) });
  }
});
