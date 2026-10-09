import { Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { prisma } from '../db.js';
import { CONFIG } from '../config.js';
import { pipelineOrchestrator } from '../services/pipelineOrchestrator.js';
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
    endTime: 20,
    text: 'Raft is a consensus algorithm for managing a replicated log across a cluster of servers. In sixty seconds: the cluster elects a leader, the leader accepts client commands, and every server applies the same commands in the same order.',
  },
  {
    startTime: 20,
    endTime: 40,
    text: 'Leader election uses randomized timeouts. When followers stop hearing heartbeats, they become candidates, vote for themselves, and request votes. The candidate with a majority becomes leader for the new term, which keeps split votes from stalling the cluster.',
  },
  {
    startTime: 40,
    endTime: 60,
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
    });
    if (existing) {
      res.status(200).json({ id: existing.id, status: existing.status });
      return;
    }

    const audioPath = pickSeedAudioPath();

    const lecture = await prisma.lecture.create({
      data: {
        title: DEMO_TITLE,
        audioPath,
        duration: 60,
        status: 'COMPLETED',
        summary: DEMO_SUMMARY,
        segments: { create: DEMO_SEGMENTS.map((s) => ({ ...s })) },
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

// DELETE lecture
lectureRouter.delete('/:id', async (req, res) => {
  try {
    await prisma.lecture.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true, message: 'Lecture deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete lecture', details: String(error) });
  }
});
