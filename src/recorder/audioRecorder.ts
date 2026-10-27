// Audio recording logic, decoupled from any UI framework.
//
// Wraps getUserMedia + MediaRecorder with explicit start/stop/cancel and
// deterministic cleanup. All microphone tracks are stopped on stop, cancel, or
// error so the OS "recording" indicator clears promptly.
//
// Recordings stay entirely in memory as a Blob. Nothing is uploaded.

export type RecorderErrorKind =
  | "permission-denied"
  | "no-device"
  | "unsupported"
  | "unknown";

export interface RecordingResult {
  blob: Blob;
  mimeType: string;
}

export class RecorderError extends Error {
  constructor(
    public kind: RecorderErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "RecorderError";
  }
}

/** Maps a getUserMedia DOMException to a typed, user-facing error kind. */
function classifyGetUserMediaError(err: unknown): RecorderError {
  if (err instanceof DOMException) {
    switch (err.name) {
      case "NotAllowedError":
      case "SecurityError":
        return new RecorderError(
          "permission-denied",
          "Microphone access was blocked. Allow microphone access and try again.",
        );
      case "NotFoundError":
      case "OverconstrainedError":
        return new RecorderError(
          "no-device",
          "No microphone was found. Connect a microphone and try again.",
        );
      case "NotReadableError":
        return new RecorderError(
          "no-device",
          "The microphone is in use by another application.",
        );
      default:
        return new RecorderError("unknown", err.message || "Recording failed.");
    }
  }
  return new RecorderError("unknown", "An unexpected recording error occurred.");
}

/** Picks a supported audio MIME type, preferring webm/opus. */
function pickMimeType(): string | undefined {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ];
  for (const type of candidates) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(type)
    ) {
      return type;
    }
  }
  return undefined;
}

export class AudioRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private mimeType: string | undefined;

  /**
   * Requests mic access and begins recording. Throws a RecorderError on
   * permission denial, missing device, or unsupported environment.
   */
  async start(): Promise<void> {
    if (this.recorder) {
      throw new RecorderError("unknown", "Recording is already in progress.");
    }
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      throw new RecorderError(
        "unsupported",
        "Audio recording is not supported in this browser.",
      );
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      this.cleanupStream();
      throw classifyGetUserMediaError(err);
    }

    this.mimeType = pickMimeType();
    this.chunks = [];

    try {
      this.recorder = new MediaRecorder(
        this.stream,
        this.mimeType ? { mimeType: this.mimeType } : undefined,
      );
    } catch (err) {
      this.cleanupStream();
      throw new RecorderError(
        "unsupported",
        err instanceof Error ? err.message : "Could not start the recorder.",
      );
    }

    this.recorder.addEventListener("dataavailable", (e: BlobEvent) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    });

    this.recorder.start();
  }

  /**
   * Stops recording and resolves with the recorded audio plus its MIME type.
   * Microphone tracks are released. Resolves with null if nothing was captured.
   */
  stop(): Promise<RecordingResult | null> {
    return new Promise((resolve, reject) => {
      const recorder = this.recorder;
      if (!recorder) {
        reject(new RecorderError("unknown", "No active recording to stop."));
        return;
      }

      recorder.addEventListener(
        "stop",
        () => {
          const type = this.mimeType ?? "audio/webm";
          const result =
            this.chunks.length > 0
              ? { blob: new Blob(this.chunks, { type }), mimeType: type }
              : null;
          this.cleanupStream();
          this.recorder = null;
          resolve(result);
        },
        { once: true },
      );

      recorder.addEventListener(
        "error",
        () => {
          this.cleanupStream();
          this.recorder = null;
          reject(new RecorderError("unknown", "Recording failed while active."));
        },
        { once: true },
      );

      if (recorder.state !== "inactive") {
        recorder.stop();
      }
    });
  }

  /** Aborts recording and discards all captured audio. */
  cancel(): void {
    if (this.recorder && this.recorder.state !== "inactive") {
      try {
        this.recorder.stop();
      } catch {
        // ignore — we're discarding anyway
      }
    }
    this.chunks = [];
    this.cleanupStream();
    this.recorder = null;
  }

  private cleanupStream(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
  }
}
