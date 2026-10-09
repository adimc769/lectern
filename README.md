# Lectern — Offline Lecture Assistant

## Why Local AI?

1. **Lectures are Long Audio**: A typical university lecture runs 60 to 120 minutes. Streaming massive audio files to cloud APIs (OpenAI Whisper, Gemini, etc.) is financially unsustainable for students and frequently fails on slow connections.
2. **Students Have Unreliable Internet**: College lecture halls, student dorms, transit commutes, and campus basements often suffer from high packet loss, Wi-Fi throttles, or complete dead zones. Lectern functions entirely with Wi-Fi switched off.
3. **Lecture Recordings are Private**: Classroom audio captures candid questions, peer discussions, and proprietary academic materials that should never be uploaded or stored on third-party cloud servers.
4. **Zero Cloud Latency & Subscriptions**: Modern consumer GPUs (e.g. NVIDIA RTX 5060 Ti) can transcribe and summarize in real time with zero ongoing subscription costs.

---

## Architecture & Pipeline

```text
[Audio Input] (Upload or In-Browser Record)
      │
      ▼
   [FFmpeg] (Converts to 16kHz Mono 16-bit PCM WAV)
      │
      ▼
 [whisper.cpp] (CUDA Acceleration + Flash Attention)
      │         Model: large-v3-turbo (ggml-large-v3-turbo-q5_0.bin)
      ▼
[Timestamped Segments]
      │
      ├─────────────────────────────────────────────┐
      ▼                                             ▼
[Semantic Chunks] (~250 words, overlap, start time) [Ollama LLM] (qwen2.5:14b / 7b)
      │                                             │  - Map-Reduce Section Summaries
      ▼                                             │  - Combined Lecture Summary
[Ollama Embeddings] (nomic-embed-text)              │  - JSON Schema Structured Flashcards
      │                                             │  - JSON Schema Key Terms
      ▼                                             │
 [SQLite DB] (Chunks + 768-dim Embeddings JSON) <───┘
      │
      ▼
[Cross-Lecture Q&A]
 1. Embed user query via nomic-embed-text
 2. Cosine similarity in JS across all SQLite chunks
 3. LLM answers strictly from top-5 chunks
 4. Grounded citations: [Lecture N, mm:ss]
```

---

## Disclosures

In accordance with hackathon rules, here is the complete running list of models, libraries, and tools utilized in Lectern:

### 1. Local AI Models & Runtimes (Strictly Local Inference)
* **Speech-to-Text**: `whisper.cpp` (`v1.9.5` Windows x64 CUDA build with cuBLAS & Flash Attention) running `large-v3-turbo` (`ggml-large-v3-turbo-q5_0.bin`).
* **Text LLM**: Ollama (`v0.40.1`) running `qwen2.5:14b` and `qwen2.5:7b` for map-reduce summarization, flashcards, key terms, and cited Q&A.
* **Text Embeddings**: Ollama running `nomic-embed-text:latest` (768-dimensional local vector embeddings).

### 2. AI Development Assistance
* **Google Antigravity & Gemini**: Primary agentic coding assistant for repo architecture, CUDA environment validation, test scripts, and pipeline orchestration.
* **Claude / Anthropic**: Architecture planning, Everything Claude Code (ECC) guidelines, and code review methodology.

### 3. Core Libraries & Software
* **Audio Engine**: FFmpeg (`v9.0.1` full build, gyan.dev) for 16kHz mono audio normalization.
* **Backend**: Express.js, TypeScript, Multer, Cors.
* **Database & ORM**: SQLite (`dev.db`), Prisma ORM (`v6.3.1`).
* **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Lucide React (self-hosted system fonts, telemetry disabled).
* **Skills Framework**: `ecc-universal` and `ui-ux-pro-max` design intelligence.

---

## Project Structure (Monorepo)

```text
/
├── server/               # Express + TypeScript pipeline orchestrator
│   ├── prisma/           # Prisma SQLite schema & migrations
│   └── src/              # Routes, controllers, and local AI runners
├── web/                  # Next.js 15 frontend (Tailwind, offline UI)
├── shared/               # Shared TypeScript DTOs & interfaces
├── tools/                # Local binaries (whisper.cpp CUDA release)
├── models/               # Local ggml whisper weights
└── README.md             # Project documentation & disclosures
```

---

## Getting Started (Offline)

### Prerequisites
1. **NVIDIA GPU** with CUDA support (e.g. RTX 5060 Ti / RTX 40/30 series).
2. **FFmpeg** installed in system PATH.
3. **Ollama** running locally with models pulled:
   ```bash
   ollama pull nomic-embed-text
   ollama pull qwen2.5:14b
   ```
4. **whisper.cpp** prebuilt CUDA binaries in `tools/whisper/Release` and model weights in `models/`.

### Setup & Run
```bash
# 1. Install dependencies
npm install

# 2. Push SQLite database schema
npm run db:push

# 3. Start development servers
npm run dev:server   # Express API on http://localhost:5000
npm run dev:web      # Next.js App on http://localhost:3000
```
