// dumyap local transcription backend.
//
// Exposes a single POST /transcribe endpoint that forwards an uploaded audio
// file to OpenAI's gpt-transcribe model and returns the raw transcript text.
// The OpenAI key is read only from the server environment and never leaves the
// server. Bound to loopback; CORS restricted to configured extension origins.

import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI, { toFile } from "openai";

import {
  ALLOWED_AUDIO_TYPES,
  ALLOWED_ORIGINS,
  HOST,
  MAX_AUDIO_BYTES,
  OPENAI_API_KEY,
  PORT,
  TRANSCRIBE_MODEL,
} from "./config.js";
import { isOriginAllowed } from "./corsPolicy.js";
import { rateLimit } from "./rateLimit.js";

if (!OPENAI_API_KEY) {
  console.error(
    "[dumyap-server] OPENAI_API_KEY is not set. Copy .env.example to .env and add your key.",
  );
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const app = express();
app.disable("x-powered-by");

// DEV-ONLY origin diagnostic. Off unless DEBUG_CORS=1 is set in the environment.
// Logs ONLY the request's Origin header (never the body, never any secret) so a
// developer can confirm the exact value Chromium sends from the extension popup
// during live testing. Must not be left on as noisy permanent logging.
if (process.env.DEBUG_CORS === "1") {
  app.use((req, _res, next) => {
    console.log(
      `[dumyap-server][debug] Origin=${JSON.stringify(req.headers.origin)} ${req.method} ${req.path}`,
    );
    next();
  });
}

// CORS: only the configured extension origin(s). No wildcard, never throws.
// A disallowed origin simply gets no CORS headers (cb(null, false)); the
// pre-route guard below turns that into a clean 403.
app.use(
  cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin, ALLOWED_ORIGINS)) return callback(null, true);
      return callback(null, false);
    },
    methods: ["POST", "GET"],
  }),
);

// Pre-route guard: when an Origin header is present AND not allowed, reject with
// a clean 403 (no stack trace, no secrets). Requests with no Origin header
// (curl, health check) pass straight through, preserving prior behavior.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !isOriginAllowed(origin, ALLOWED_ORIGINS)) {
    return res.status(403).json({ error: "Origin not allowed." });
  }
  next();
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES, files: 1 },
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post(
  "/transcribe",
  rateLimit,
  (req, res, next) => {
    upload.single("audio")(req, res, (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res
            .status(413)
            .json({ error: "Audio file is too large to transcribe." });
        }
        return res.status(400).json({ error: "Invalid upload." });
      }
      next();
    });
  },
  async (req, res) => {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No audio file was provided." });
    }

    const mimeType = (file.mimetype || "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_AUDIO_TYPES.includes(mimeType)) {
      return res
        .status(415)
        .json({ error: `Unsupported audio type: ${mimeType || "unknown"}.` });
    }

    try {
      // Give the buffer a filename + type so the API can identify the format.
      const ext = mimeType === "audio/webm" ? "webm" : mimeType.split("/")[1];
      const audioFile = await toFile(file.buffer, `audio.${ext}`, {
        type: mimeType,
      });

      // No `language` is passed on purpose: auto-detection preserves natural
      // English / Filipino / Taglish code-switching. We only transcribe —
      // never translate, summarize, or reorganize.
      const result = await openai.audio.transcriptions.create({
        model: TRANSCRIBE_MODEL,
        file: audioFile,
      });

      const text = typeof result.text === "string" ? result.text : "";
      return res.json({ text });
    } catch (err) {
      return handleOpenAiError(err, res);
    }
  },
);

function handleOpenAiError(err, res) {
  const status = err?.status ?? err?.statusCode;

  if (status === 401) {
    return res
      .status(401)
      .json({ error: "The server's OpenAI API key is invalid or missing." });
  }
  if (status === 429) {
    // Could be rate limit or insufficient quota/credits.
    const code = err?.code || err?.error?.code;
    if (code === "insufficient_quota") {
      return res.status(402).json({
        error: "The OpenAI account has insufficient credits.",
      });
    }
    return res
      .status(429)
      .json({ error: "OpenAI is rate limiting requests. Try again shortly." });
  }

  // Avoid logging secrets or full payloads — just a short message.
  console.error("[dumyap-server] transcription error:", err?.message || err);
  return res
    .status(502)
    .json({ error: "Transcription failed. Please try again." });
}

app.listen(PORT, HOST, () => {
  console.log(`[dumyap-server] listening on http://${HOST}:${PORT}`);
  if (ALLOWED_ORIGINS.length === 0) {
    console.warn(
      "[dumyap-server] No ALLOWED_ORIGINS set — browser requests from the extension will be blocked by CORS. Set ALLOWED_ORIGINS in .env.",
    );
  }
});
