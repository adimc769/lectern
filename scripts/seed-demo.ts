/**
 * Seeds the idempotent "DEMO: Raft in 60s" lecture directly via Prisma.
 *
 * Mirrors POST /api/lectures/seed-demo in server/src/routes/lectureRoutes.ts.
 *
 * Run via: npm --workspace=server run seed:demo
 * (executes `tsx ../scripts/seed-demo.ts` with the server workspace on PATH)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const UPLOADS_DIR = path.join(REPO_ROOT, 'uploads');

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
    text: "Leader election uses randomized timeouts. When followers stop hearing heartbeats, they become candidates, vote for themselves, and request votes. The candidate with a majority becomes leader for the new term, which keeps split votes from stalling the cluster.",
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
  const dest = path.join(UPLOADS_DIR, `${Date.now()}_demo-seed_${path.basename(src)}`);
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
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    const demo60 = path.join(UPLOADS_DIR, 'demo-60s.wav');
    if (fs.existsSync(demo60)) {
      return copySeedAudio(demo60);
    }
    const smallest = fs
      .readdirSync(UPLOADS_DIR)
      .filter((f) => f.toLowerCase().endsWith('.wav'))
      .map((f) => {
        const p = path.join(UPLOADS_DIR, f);
        return { p, size: fs.statSync(p).size };
      })
      .sort((a, b) => a.size - b.size)[0];
    if (smallest) return copySeedAudio(smallest.p);
  } catch {
    // Fall through to empty audio path.
  }
  return '';
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const existing = await prisma.lecture.findFirst({ where: { title: DEMO_TITLE } });
    if (existing) {
      console.log(`[seed-demo] Demo lecture already exists: ${existing.id} (${existing.status})`);
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
    console.log(`[seed-demo] Seeded demo lecture: ${lecture.id} (COMPLETED)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[seed-demo] Failed:', err);
  process.exit(1);
});
