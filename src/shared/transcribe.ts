// Client-side transcription: sends a note's audio to the LOCAL dumyap backend,
// which holds the OpenAI key and performs the actual API call. No key or secret
// ever lives in the extension.
//
// The backend must be running locally (see server/). The extension only talks
// to localhost; audio is sent only when the user explicitly requests it.

const BACKEND_URL = "http://127.0.0.1:8787/transcribe";

export type TranscribeErrorKind =
  | "backend-unavailable"
  | "invalid-key"
  | "insufficient-credits"
  | "rate-limited"
  | "unsupported-audio"
  | "too-large"
  | "network"
  | "unknown";

export class TranscribeError extends Error {
  constructor(
    public kind: TranscribeErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "TranscribeError";
  }
}

/** Sends audio to the local backend and returns the transcript text. */
export async function transcribeAudio(
  audio: Blob,
  mimeType: string,
): Promise<string> {
  const form = new FormData();
  // Name the part "audio" (matches multer.single("audio")) with a filename
  // whose extension reflects the type so the backend/API can identify it.
  const ext = mimeType.includes("webm")
    ? "webm"
    : (mimeType.split("/")[1] || "webm").split(";")[0];
  form.append("audio", audio, `audio.${ext}`);

  let res: Response;
  try {
    res = await fetch(BACKEND_URL, { method: "POST", body: form });
  } catch {
    // fetch throws on connection refused / DNS / CORS network failures.
    throw new TranscribeError(
      "backend-unavailable",
      "Can't reach the dumyap transcription server. Start it locally (see server/README) and try again.",
    );
  }

  if (res.ok) {
    const data = (await res.json().catch(() => null)) as {
      text?: string;
    } | null;
    if (!data || typeof data.text !== "string") {
      throw new TranscribeError(
        "unknown",
        "The server returned an unexpected response.",
      );
    }
    return data.text;
  }

  // Map error statuses to typed, user-facing errors.
  const body = (await res.json().catch(() => null)) as {
    error?: string;
  } | null;
  const message = body?.error ?? "Transcription failed.";

  switch (res.status) {
    case 401:
      throw new TranscribeError("invalid-key", message);
    case 402:
      throw new TranscribeError("insufficient-credits", message);
    case 413:
      throw new TranscribeError("too-large", message);
    case 415:
      throw new TranscribeError("unsupported-audio", message);
    case 429:
      throw new TranscribeError("rate-limited", message);
    default:
      throw new TranscribeError("unknown", message);
  }
}
