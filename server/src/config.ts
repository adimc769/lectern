import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const ROOT_DIR = path.resolve(__dirname, '../../');

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  OLLAMA_LLM_MODEL: process.env.OLLAMA_LLM_MODEL || 'qwen2.5:14b',
  OLLAMA_EMBED_MODEL: process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text',
  WHISPER_CLI_PATH: process.env.WHISPER_CLI_PATH || path.join(ROOT_DIR, 'tools/whisper/Release/whisper-cli.exe'),
  WHISPER_MODEL_PATH: process.env.WHISPER_MODEL_PATH || path.join(ROOT_DIR, 'models/ggml-large-v3-turbo.bin'),
  UPLOADS_DIR: path.join(ROOT_DIR, 'uploads'),
  FFMPEG_CMD: process.env.FFMPEG_CMD || 'ffmpeg',
};
