// Server configuration, read exclusively from environment variables.
// The OpenAI key lives only here (server-side); it is never sent to the client.

import "dotenv/config";

export const PORT = Number(process.env.PORT) || 8787;

// Bind to loopback only — the dev backend must not be reachable off the host.
export const HOST = "127.0.0.1";

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

// Transcription model. gpt-transcribe is OpenAI's current file-transcription
// model (replaces Whisper) and auto-detects language, which preserves
// English / Filipino / Taglish code-switching without forcing a language.
export const TRANSCRIBE_MODEL = "gpt-transcribe";

// Max accepted audio upload (bytes). Keeps requests small and bounded.
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB

// Allowed audio MIME types (what the extension records + common fallbacks).
export const ALLOWED_AUDIO_TYPES = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
];

// CORS allow-list of extension origins. Never defaults to "*".
// Normalize each entry at load time (trim whitespace, strip trailing slash[es])
// so the origin decision is a robust exact match against a canonical form.
// Client-supplied headers are NOT used for auth, so no extension-id constant
// is introduced here — only the browser-sent Origin is ever trusted, and only
// when it matches this strict chrome-extension://<id> allow-list.
export const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter(Boolean);

// Rate limit: requests per window per client IP.
export const RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const RATE_LIMIT_MAX = 10;
