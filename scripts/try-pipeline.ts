import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  OllamaClient,
  chunkSegments,
  summarizeLecture,
  makeFlashcards,
  extractKeyTerms,
  answerQuestion,
  type Segment,
  type Chunk,
} from '../packages/core/src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('=== Lectern Full Pipeline Demo ===\n');

  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const chatModel = process.env.CHAT_MODEL || 'qwen2.5:7b';
  const embedModel = process.env.EMBED_MODEL || 'nomic-embed-text:latest';

  console.log(`Connecting to Ollama at: ${ollamaUrl}`);
  console.log(`Using Chat Model: ${chatModel}`);
  console.log(`Using Embed Model: ${embedModel}\n`);

  const ollama = new OllamaClient({ baseUrl: ollamaUrl, timeoutMs: 120000 });

  // 1. Load fixtures
  const fixture1Path = path.resolve(__dirname, '../packages/core/fixtures/lecture1.json');
  const fixture2Path = path.resolve(__dirname, '../packages/core/fixtures/lecture2.json');

  const lecture1Segments: Segment[] = JSON.parse(fs.readFileSync(fixture1Path, 'utf-8'));
  const lecture2Segments: Segment[] = JSON.parse(fs.readFileSync(fixture2Path, 'utf-8'));

  console.log(`Loaded Lecture 1: ${lecture1Segments.length} segments`);
  console.log(`Loaded Lecture 2: ${lecture2Segments.length} segments\n`);

  // 2. Chunking
  const chunks1 = chunkSegments(lecture1Segments, {
    targetWords: 250,
    overlapWords: 40,
    lectureId: 'lecture-1',
  });
  const chunks2 = chunkSegments(lecture2Segments, {
    targetWords: 250,
    overlapWords: 40,
    lectureId: 'lecture-2',
  });

  console.log(`Created ${chunks1.length} chunks for Lecture 1`);
  console.log(`Created ${chunks2.length} chunks for Lecture 2`);

  const allChunks: Chunk[] = [...chunks1, ...chunks2];

  // 3. Embedding all chunks
  console.log(`\nComputing embeddings for all ${allChunks.length} chunks...`);
  for (let i = 0; i < allChunks.length; i++) {
    const chunk = allChunks[i];
    const embedRes = await ollama.embed({
      model: embedModel,
      input: chunk.text,
    });
    chunk.embedding = embedRes.embedding;
  }
  console.log('✓ All chunks embedded successfully.\n');

  // 4. Summarization on Lecture 1
  console.log('--- Summarizing Lecture 1 (Intro to Data Structures) ---');
  const summary = await summarizeLecture(chunks1, {
    ollama,
    chatModel,
    maxSectionWords: 800,
  });
  console.log(summary);
  console.log('\n----------------------------------------------------\n');

  // 5. Flashcards on Lecture 1
  console.log('--- Generating Flashcards for Lecture 1 ---');
  const flashcards = await makeFlashcards(chunks1, {
    ollama,
    chatModel,
  });
  console.log(`Generated ${flashcards.length} flashcards:`);
  for (const [idx, card] of flashcards.entries()) {
    console.log(`[Card ${idx + 1}] Q: ${card.question}`);
    console.log(`          A: ${card.answer}`);
  }
  console.log('\n----------------------------------------------------\n');

  // 6. Key Terms on Lecture 1
  console.log('--- Extracting Key Terms for Lecture 1 ---');
  const terms = await extractKeyTerms(chunks1, {
    ollama,
    chatModel,
  });
  console.log(`Extracted ${terms.length} key terms:`);
  for (const t of terms.slice(0, 8)) {
    console.log(`* ${t.term}: ${t.definition}`);
  }
  console.log('\n----------------------------------------------------\n');

  // 7. Testing 3 Q&A questions
  const testQuestions = [
    {
      q: 'What is the difference between an array and a linked list in terms of memory layout and access time?',
      expected: 'Answered from Lecture 1 with citations',
    },
    {
      q: 'What are the four necessary conditions for a deadlock to occur in an operating system?',
      expected: 'Answered from Lecture 2 with citations',
    },
    {
      q: 'What are the primary differences between photosynthesis in C3 and C4 plants?',
      expected: 'Must return "Not covered in your lectures."',
    },
  ];

  console.log('--- Testing Cited Q&A (3 Questions) ---\n');
  for (const [idx, item] of testQuestions.entries()) {
    console.log(`Question ${idx + 1}: "${item.q}"`);
    console.log(`Expected behavior: ${item.expected}`);

    const result = await answerQuestion(item.q, allChunks, {
      ollama,
      chatModel,
      embedModel,
      topK: 6,
    });

    console.log(`Answer:\n${result.answer}`);
    console.log(`Citations (${result.citations.length}):`);
    for (const c of result.citations) {
      console.log(`  - [${c.lectureId}] chunk: ${c.chunkId}, start: ${c.start}s`);
    }
    console.log('\n----------------------------------------------------\n');
  }

  console.log('=== Pipeline Demo Complete ===');
}

main().catch((err) => {
  console.error('Pipeline demo failed:', err);
  process.exit(1);
});
