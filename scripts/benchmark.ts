import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// ANSI colors for clean terminal output
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const MAGENTA = '\x1b[35m';
const RESET = '\x1b[0m';

const ROOT_DIR = path.resolve(__dirname, '..');
const WHISPER_CLI = path.join(ROOT_DIR, 'tools/whisper/Release/whisper-cli.exe');
const WHISPER_MODEL = path.join(ROOT_DIR, 'models/ggml-large-v3-turbo.bin');
const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

// Sample lecture transcript text for LLM benchmarking
const SAMPLE_TRANSCRIPT = `
Today we're exploring the foundations of Thermodynamics, specifically the Second Law.
As we discussed in the previous lecture, the First Law tells us that energy cannot be created or destroyed,
only transformed. However, the First Law doesn't specify the direction of spontaneous processes.
Why does heat flow spontaneously from a hot reservoir to a cold reservoir, but never the reverse?
This asymmetry is governed by entropy, denoted as S. Rudolf Clausius formulated that the entropy of an
isolated system never decreases over time. In mathematical terms, delta S of the universe is greater than or
equal to zero. In statistical mechanics, Ludwig Boltzmann related entropy directly to microscopic states
with his famous formula: S equals k times the natural logarithm of W, where k is the Boltzmann constant and
W is the multiplicity or number of accessible microstates. This means systems naturally evolve toward
states with the highest statistical probability.
`;

function getAudioDuration(filePath: string): number {
  try {
    const output = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { encoding: 'utf-8' }
    );
    const duration = parseFloat(output.trim());
    if (!isNaN(duration)) return duration;
  } catch {
    // Fallback: estimate from wav header if ffprobe is absent
  }

  // Fallback via ffmpeg
  try {
    const output = spawnSync('ffmpeg', ['-i', filePath], { encoding: 'utf-8' });
    const match = (output.stderr || '').match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
    if (match) {
      const hours = parseFloat(match[1]);
      const minutes = parseFloat(match[2]);
      const seconds = parseFloat(match[3]);
      return hours * 3600 + minutes * 60 + seconds;
    }
  } catch {
    // Ignore
  }
  return 10.0; // fallback default
}

function ensureSampleAudio(targetPath: string, durationSec: number = 10): void {
  if (fs.existsSync(targetPath)) return;
  console.log(`${YELLOW}No audio file provided. Generating a ${durationSec}s test audio using FFmpeg...${RESET}`);
  execSync(
    `ffmpeg -y -f lavfi -i "sine=frequency=440:duration=${durationSec}" -ar 16000 -ac 1 -c:a pcm_s16le "${targetPath}"`,
    { stdio: 'ignore' }
  );
}

async function benchmarkWhisper(inputAudioPath: string) {
  console.log(`\n${BOLD}${CYAN}====================================================${RESET}`);
  console.log(`${BOLD}${CYAN}   PART 1: SPEECH-TO-TEXT BENCHMARK (whisper.cpp)  ${RESET}`);
  console.log(`${BOLD}${CYAN}====================================================${RESET}`);

  if (!fs.existsSync(WHISPER_CLI)) {
    throw new Error(`Whisper executable not found at: ${WHISPER_CLI}`);
  }
  if (!fs.existsSync(WHISPER_MODEL)) {
    throw new Error(`Whisper model not found at: ${WHISPER_MODEL}`);
  }

  const modelName = path.basename(WHISPER_MODEL);
  console.log(`${BOLD}Model Used:${RESET}        ${GREEN}${modelName}${RESET}`);
  console.log(`${BOLD}Inference Engine:${RESET}  whisper.cpp (CUDA + Flash Attention)`);
  console.log(`${BOLD}Input File:${RESET}        ${inputAudioPath}`);

  // Step 1: Preprocess with ffmpeg to 16kHz mono WAV
  const tempWav = path.join(ROOT_DIR, 'temp_benchmark_16k.wav');
  const t0_ffmpeg = performance.now();
  execSync(`ffmpeg -y -i "${inputAudioPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${tempWav}"`, {
    stdio: 'ignore',
  });
  const ffmpegTimeSec = (performance.now() - t0_ffmpeg) / 1000;
  const audioDurationSec = getAudioDuration(tempWav);

  console.log(`${BOLD}Audio Duration:${RESET}    ${audioDurationSec.toFixed(2)} seconds`);
  console.log(`${BOLD}FFmpeg Prep Time:${RESET}  ${ffmpegTimeSec.toFixed(3)}s`);

  // Step 2: Run whisper.cpp inference
  console.log(`\nRunning Whisper GPU inference...`);
  const t0_whisper = performance.now();
  const whisperProcess = spawnSync(
    WHISPER_CLI,
    ['-m', WHISPER_MODEL, '-f', tempWav, '-dev', '0', '-fa', '-nt'],
    { encoding: 'utf-8' }
  );

  const whisperTimeSec = (performance.now() - t0_whisper) / 1000;
  const totalProcessTimeSec = ffmpegTimeSec + whisperTimeSec;

  // Real-Time Factor (RTF = processing_time / audio_duration)
  // RTF < 1.0 means faster than real-time.
  const rtf = totalProcessTimeSec / audioDurationSec;
  const speedupFactor = audioDurationSec / totalProcessTimeSec;

  if (whisperProcess.status !== 0) {
    console.error(`Whisper error:`, whisperProcess.stderr);
  }

  console.log(`\n${BOLD}--- Whisper Benchmark Results ---${RESET}`);
  console.log(`Processing Time:     ${GREEN}${whisperTimeSec.toFixed(2)}s${RESET} (whisper) + ${ffmpegTimeSec.toFixed(2)}s (ffmpeg) = ${GREEN}${totalProcessTimeSec.toFixed(2)}s total${RESET}`);
  console.log(`Audio Length:        ${CYAN}${audioDurationSec.toFixed(2)}s${RESET}`);
  console.log(`Real-Time Factor:    ${YELLOW}${rtf.toFixed(3)}${RESET} (${rtf < 1 ? 'Faster than real-time' : 'Slower than real-time'})`);
  console.log(`Speedup Multiplier:  ${BOLD}${GREEN}${speedupFactor.toFixed(1)}x real-time speed${RESET}`);

  // Clean up temp file
  if (fs.existsSync(tempWav)) fs.unlinkSync(tempWav);

  return { audioDurationSec, whisperTimeSec, totalProcessTimeSec, rtf, speedupFactor };
}

async function benchmarkOllamaModel(modelName: string) {
  console.log(`\nTesting Ollama Model: ${BOLD}${GREEN}${modelName}${RESET}...`);

  const prompt = `Summarize the following lecture transcript into key takeaways and core concepts:\n\n${SAMPLE_TRANSCRIPT}`;

  const t0 = performance.now();
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelName,
      prompt,
      stream: false,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Ollama failed (${res.status}): ${errText}`);
  }

  const elapsedSec = (performance.now() - t0) / 1000;
  const data = (await res.json()) as {
    response: string;
    total_duration?: number;
    eval_count?: number;
    eval_duration?: number;
    prompt_eval_count?: number;
    prompt_eval_duration?: number;
  };

  const evalCount = data.eval_count || 0;
  // eval_duration is in nanoseconds in Ollama API
  const evalDurationSec = data.eval_duration ? data.eval_duration / 1e9 : elapsedSec;
  const tokensPerSec = evalDurationSec > 0 ? evalCount / evalDurationSec : 0;

  console.log(`  Summary Generation Time: ${CYAN}${elapsedSec.toFixed(2)}s${RESET}`);
  console.log(`  Tokens Generated:        ${evalCount} tokens`);
  console.log(`  Inference Speed:         ${BOLD}${GREEN}${tokensPerSec.toFixed(1)} tokens/sec${RESET}`);

  return {
    model: modelName,
    elapsedSec,
    evalCount,
    tokensPerSec,
    sampleOutput: data.response.trim().slice(0, 160) + '...',
  };
}

async function benchmarkOllama() {
  console.log(`\n${BOLD}${MAGENTA}====================================================${RESET}`);
  console.log(`${BOLD}${MAGENTA}       PART 2: LLM BENCHMARK (Local Ollama)        ${RESET}`);
  console.log(`${BOLD}${MAGENTA}====================================================${RESET}`);

  // Check Ollama connection
  try {
    const tagsRes = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!tagsRes.ok) throw new Error('Ollama service unreachable');
    const tagsData = (await tagsRes.json()) as { models: Array<{ name: string }> };
    const available = tagsData.models.map((m) => m.name);
    console.log(`Available Local Models: ${available.join(', ')}`);

    const candidates = ['qwen2.5:14b', 'qwen2.5:7b'].filter((cand) =>
      available.some((a) => a.startsWith(cand.split(':')[0]))
    );

    if (candidates.length === 0) {
      console.log(`${YELLOW}Candidate models not found. Testing with first available: ${available[0]}${RESET}`);
      candidates.push(available[0]);
    }

    const results = [];
    for (const cand of candidates) {
      try {
        const result = await benchmarkOllamaModel(cand);
        results.push(result);
      } catch (err) {
        console.error(`  ${YELLOW}Skipping ${cand}:${RESET}`, (err as Error).message);
      }
    }

    if (results.length > 0) {
      console.log(`\n${BOLD}--- LLM Benchmark Comparison ---${RESET}`);
      console.table(
        results.map((r) => ({
          Model: r.model,
          'Speed (tokens/sec)': `${r.tokensPerSec.toFixed(1)} t/s`,
          'Latency (s)': `${r.elapsedSec.toFixed(2)}s`,
          'Output Tokens': r.evalCount,
        }))
      );
    }
  } catch (err) {
    console.error(`Failed to benchmark Ollama:`, (err as Error).message);
  }
}

async function main() {
  console.log(`${BOLD}====================================================${RESET}`);
  console.log(`${BOLD}    LECTERN HARDWARE BENCHMARK (RTX 5060 Ti)       ${RESET}`);
  console.log(`${BOLD}====================================================${RESET}`);

  let inputAudio = process.argv[2];
  if (!inputAudio) {
    inputAudio = path.join(ROOT_DIR, 'sample_lecture_test.wav');
    ensureSampleAudio(inputAudio, 10);
  }

  try {
    await benchmarkWhisper(inputAudio);
  } catch (err) {
    console.error(`${YELLOW}Whisper benchmark error:${RESET}`, err);
  }

  try {
    await benchmarkOllama();
  } catch (err) {
    console.error(`${YELLOW}Ollama benchmark error:${RESET}`, err);
  }

  console.log(`\n${BOLD}${GREEN}====================================================${RESET}`);
  console.log(`${BOLD}${GREEN}            BENCHMARK RUN COMPLETED                 ${RESET}`);
  console.log(`${BOLD}${GREEN}====================================================${RESET}\n`);
}

main().catch((err) => {
  console.error('Benchmark fatal error:', err);
  process.exit(1);
});
