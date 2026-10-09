import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { prisma } from '../db.js';
import { CONFIG } from '../config.js';
import { pipelineOrchestrator } from '../services/pipelineOrchestrator.js';
import type { LectureDTO } from '@lectern/shared';

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
      audioPath: l.audioPath,
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
      audioPath: lecture.audioPath,
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
