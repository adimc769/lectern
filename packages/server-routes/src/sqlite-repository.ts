import type { Chunk, Segment, Flashcard, KeyTerm } from '@lectern/core';
import type { LectureRecord, LectureSummaryItem, LectureStatus } from './types.js';
import type { LectureRepository } from './repository.js';

interface DbStatement {
  run(...params: unknown[]): unknown;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

interface DbInstance {
  exec(sql: string): void;
  prepare(sql: string): DbStatement;
  close(): void;
}

export function createSqliteDb(dbPath = ':memory:'): DbInstance {
  // First attempt loading better-sqlite3
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const BetterSqlite = require('better-sqlite3');
    const db = new BetterSqlite(dbPath);
    return db as DbInstance;
  } catch {
    // Fall back to Node.js built-in node:sqlite DatabaseSync (Node 22+)
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(dbPath);
      return db as DbInstance;
    } catch (innerErr) {
      throw new Error(
        `Failed to initialize SQLite database: neither better-sqlite3 nor node:sqlite is available. Detail: ${innerErr instanceof Error ? innerErr.message : String(innerErr)}`,
      );
    }
  }
}

interface LectureRow {
  id: string;
  title: string;
  status: string;
  progress_percent: number;
  duration_sec: number;
  created_at: string;
  transcript_json: string;
  summary: string;
  key_terms_json: string;
  flashcards_json: string;
  error_message: string | null;
  audio_file_path: string | null;
}

interface ChunkRow {
  id: string;
  lecture_id: string;
  start: number;
  end: number;
  text: string;
  embedding_json: string | null;
}

export class SqliteLectureRepository implements LectureRepository {
  private readonly db: DbInstance;

  constructor(dbOrPath: DbInstance | string = ':memory:') {
    if (typeof dbOrPath === 'string') {
      this.db = createSqliteDb(dbOrPath);
    } else {
      this.db = dbOrPath;
    }

    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS lectures (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        progress_percent INTEGER NOT NULL DEFAULT 0,
        duration_sec REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        transcript_json TEXT NOT NULL DEFAULT '[]',
        summary TEXT NOT NULL DEFAULT '',
        key_terms_json TEXT NOT NULL DEFAULT '[]',
        flashcards_json TEXT NOT NULL DEFAULT '[]',
        error_message TEXT,
        audio_file_path TEXT
      );

      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        lecture_id TEXT NOT NULL,
        start REAL NOT NULL,
        end REAL NOT NULL,
        text TEXT NOT NULL,
        embedding_json TEXT
      );
    `);
  }

  createLecture(lecture: LectureRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO lectures (
        id, title, status, progress_percent, duration_sec, created_at,
        transcript_json, summary, key_terms_json, flashcards_json,
        error_message, audio_file_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      lecture.id,
      lecture.title,
      lecture.status,
      lecture.progressPercent,
      lecture.durationSec,
      lecture.createdAt,
      JSON.stringify(lecture.transcript ?? []),
      lecture.summary ?? '',
      JSON.stringify(lecture.keyTerms ?? []),
      JSON.stringify(lecture.flashcards ?? []),
      lecture.errorMessage ?? null,
      lecture.audioFilePath ?? null,
    );
  }

  getLecture(id: string): LectureRecord | null {
    const stmt = this.db.prepare('SELECT * FROM lectures WHERE id = ?');
    const row = stmt.get(id) as LectureRow | undefined;
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      title: row.title,
      status: row.status as LectureStatus,
      progressPercent: row.progress_percent,
      durationSec: row.duration_sec,
      createdAt: row.created_at,
      transcript: JSON.parse(row.transcript_json || '[]') as Segment[],
      summary: row.summary,
      keyTerms: JSON.parse(row.key_terms_json || '[]') as KeyTerm[],
      flashcards: JSON.parse(row.flashcards_json || '[]') as Flashcard[],
      errorMessage: row.error_message ?? undefined,
      audioFilePath: row.audio_file_path ?? undefined,
    };
  }

  listLectures(): LectureSummaryItem[] {
    const stmt = this.db.prepare(
      'SELECT id, title, status, duration_sec, created_at FROM lectures ORDER BY created_at DESC',
    );
    const rows = stmt.all() as Array<{
      id: string;
      title: string;
      status: string;
      duration_sec: number;
      created_at: string;
    }>;

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status as LectureStatus,
      durationSec: r.duration_sec,
      createdAt: r.created_at,
    }));
  }

  updateProgress(
    id: string,
    status: LectureStatus,
    percent: number,
    errorMessage?: string,
  ): void {
    if (errorMessage !== undefined) {
      const stmt = this.db.prepare(
        'UPDATE lectures SET status = ?, progress_percent = ?, error_message = ? WHERE id = ?',
      );
      stmt.run(status, percent, errorMessage, id);
    } else {
      const stmt = this.db.prepare(
        'UPDATE lectures SET status = ?, progress_percent = ? WHERE id = ?',
      );
      stmt.run(status, percent, id);
    }
  }

  updateLecture(id: string, updates: Partial<LectureRecord>): void {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      values.push(updates.title);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.progressPercent !== undefined) {
      fields.push('progress_percent = ?');
      values.push(updates.progressPercent);
    }
    if (updates.durationSec !== undefined) {
      fields.push('duration_sec = ?');
      values.push(updates.durationSec);
    }
    if (updates.transcript !== undefined) {
      fields.push('transcript_json = ?');
      values.push(JSON.stringify(updates.transcript));
    }
    if (updates.summary !== undefined) {
      fields.push('summary = ?');
      values.push(updates.summary);
    }
    if (updates.keyTerms !== undefined) {
      fields.push('key_terms_json = ?');
      values.push(JSON.stringify(updates.keyTerms));
    }
    if (updates.flashcards !== undefined) {
      fields.push('flashcards_json = ?');
      values.push(JSON.stringify(updates.flashcards));
    }
    if (updates.errorMessage !== undefined) {
      fields.push('error_message = ?');
      values.push(updates.errorMessage);
    }
    if (updates.audioFilePath !== undefined) {
      fields.push('audio_file_path = ?');
      values.push(updates.audioFilePath);
    }

    if (fields.length === 0) return;

    values.push(id);
    const sql = `UPDATE lectures SET ${fields.join(', ')} WHERE id = ?`;
    this.db.prepare(sql).run(...values);
  }

  saveChunks(chunks: Chunk[]): void {
    if (chunks.length === 0) return;

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO chunks (id, lecture_id, start, end, text, embedding_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const chunk of chunks) {
      stmt.run(
        chunk.id,
        chunk.lectureId,
        chunk.start,
        chunk.end,
        chunk.text,
        chunk.embedding ? JSON.stringify(chunk.embedding) : null,
      );
    }
  }

  getAllChunks(): Chunk[] {
    const stmt = this.db.prepare('SELECT * FROM chunks');
    const rows = stmt.all() as ChunkRow[];

    return rows.map((r) => ({
      id: r.id,
      lectureId: r.lecture_id,
      start: r.start,
      end: r.end,
      text: r.text,
      embedding: r.embedding_json ? (JSON.parse(r.embedding_json) as number[]) : undefined,
    }));
  }

  getChunksForLecture(lectureId: string): Chunk[] {
    const stmt = this.db.prepare('SELECT * FROM chunks WHERE lecture_id = ?');
    const rows = stmt.all(lectureId) as ChunkRow[];

    return rows.map((r) => ({
      id: r.id,
      lectureId: r.lecture_id,
      start: r.start,
      end: r.end,
      text: r.text,
      embedding: r.embedding_json ? (JSON.parse(r.embedding_json) as number[]) : undefined,
    }));
  }

  close(): void {
    this.db.close();
  }
}

export class InMemoryLectureRepository implements LectureRepository {
  private lectures = new Map<string, LectureRecord>();
  private chunks = new Map<string, Chunk>();

  createLecture(lecture: LectureRecord): void {
    this.lectures.set(lecture.id, { ...lecture });
  }

  getLecture(id: string): LectureRecord | null {
    const l = this.lectures.get(id);
    return l ? { ...l } : null;
  }

  listLectures(): LectureSummaryItem[] {
    return Array.from(this.lectures.values())
      .map((l) => ({
        id: l.id,
        title: l.title,
        status: l.status,
        durationSec: l.durationSec,
        createdAt: l.createdAt,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  updateProgress(id: string, status: LectureStatus, percent: number, errorMessage?: string): void {
    const l = this.lectures.get(id);
    if (l) {
      l.status = status;
      l.progressPercent = percent;
      if (errorMessage !== undefined) {
        l.errorMessage = errorMessage;
      }
    }
  }

  updateLecture(id: string, updates: Partial<LectureRecord>): void {
    const l = this.lectures.get(id);
    if (l) {
      Object.assign(l, updates);
    }
  }

  saveChunks(chunks: Chunk[]): void {
    for (const c of chunks) {
      this.chunks.set(c.id, { ...c });
    }
  }

  getAllChunks(): Chunk[] {
    return Array.from(this.chunks.values()).map((c) => ({ ...c }));
  }

  getChunksForLecture(lectureId: string): Chunk[] {
    return Array.from(this.chunks.values())
      .filter((c) => c.lectureId === lectureId)
      .map((c) => ({ ...c }));
  }
}
