// Shared recording + save panel, reused by both the voice recorder window and
// the screenshot capture window.
//
// It owns the full record -> stop -> preview -> save lifecycle and persists a
// VoiceNote (optionally carrying a screenshot). The host page supplies the
// note's context fields and an optional screenshot, plus auto-start behavior.

import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceNote } from "../shared/note";
import { addNote, NoteStorageError } from "../shared/db";
import { formatDuration } from "../shared/format";
import { useAudioRecorder, type Recording } from "./useAudioRecorder";

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved" }
  | { status: "error"; message: string };

export interface NoteContext {
  selectedText: string;
  url: string;
  title: string;
  timestamp: number;
}

export interface RecorderPanelProps {
  /** Context fields saved with the note. */
  context: NoteContext;
  /** Optional screenshot to attach (visual notes). */
  screenshot?: { blob: Blob; mimeType: string } | null;
  /** Begin recording automatically on mount (default true). */
  autoStart?: boolean;
  /** Called when the user finishes (closes) after save or cancel. */
  onClose: () => void;
}

export default function RecorderPanel({
  context,
  screenshot = null,
  autoStart = true,
  onClose,
}: RecorderPanelProps) {
  const { phase, elapsedMs, audioUrl, recording, error, start, stop, cancel } =
    useAudioRecorder();
  const autoStarted = useRef(false);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });

  useEffect(() => {
    if (autoStart && !autoStarted.current && phase === "idle") {
      autoStarted.current = true;
      void start();
    }
  }, [autoStart, phase, start]);

  const handleCancel = () => {
    cancel();
    onClose();
  };

  // Save only on explicit click; the guard + disabled button prevent dupes.
  const handleSave = useCallback(
    async (rec: Recording) => {
      if (saveState.status === "saving" || saveState.status === "saved") return;
      setSaveState({ status: "saving" });

      const note: VoiceNote = {
        id: crypto.randomUUID(),
        audio: rec.blob,
        selectedText: context.selectedText,
        url: context.url,
        title: context.title,
        createdAt: context.timestamp,
        durationMs: rec.durationMs,
        mimeType: rec.mimeType,
        ...(screenshot
          ? { screenshot: screenshot.blob, screenshotMimeType: screenshot.mimeType }
          : {}),
      };

      try {
        await addNote(note);
        setSaveState({ status: "saved" });
      } catch (err) {
        const message =
          err instanceof NoteStorageError
            ? err.message
            : "Could not save the note.";
        setSaveState({ status: "error", message });
      }
    },
    [context, screenshot, saveState.status],
  );

  return (
    <>
      <StatusArea
        phase={phase}
        elapsedMs={elapsedMs}
        error={error?.message ?? null}
      />
      <Controls
        phase={phase}
        audioUrl={audioUrl}
        recording={recording}
        saveState={saveState}
        onStop={() => void stop()}
        onCancel={handleCancel}
        onRetry={() => void start()}
        onClose={onClose}
        onSave={handleSave}
      />
    </>
  );
}

function StatusArea({
  phase,
  elapsedMs,
  error,
}: {
  phase: string;
  elapsedMs: number;
  error: string | null;
}) {
  return (
    <section
      className="flex flex-col items-center gap-2 rounded-lg bg-white px-4 py-5 text-center"
      aria-live="polite"
    >
      {phase === "requesting" && (
        <p className="text-sm text-slate-500">Requesting microphone access…</p>
      )}

      {phase === "recording" && (
        <>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            <span className="text-sm font-medium text-red-600">Recording</span>
          </div>
          <span className="font-mono text-2xl tabular-nums text-slate-800">
            {formatDuration(elapsedMs)}
          </span>
        </>
      )}

      {phase === "stopping" && (
        <p className="text-sm text-slate-500">Finishing up…</p>
      )}

      {phase === "recorded" && (
        <>
          <span className="text-sm font-medium text-emerald-600">
            Recording ready
          </span>
          <span className="font-mono text-xl tabular-nums text-slate-700">
            {formatDuration(elapsedMs)}
          </span>
        </>
      )}

      {phase === "error" && (
        <p className="text-sm font-medium text-red-600">
          {error ?? "Something went wrong."}
        </p>
      )}

      {phase === "idle" && <p className="text-sm text-slate-500">Preparing…</p>}
    </section>
  );
}

function Controls({
  phase,
  audioUrl,
  recording,
  saveState,
  onStop,
  onCancel,
  onRetry,
  onClose,
  onSave,
}: {
  phase: string;
  audioUrl: string | null;
  recording: Recording | null;
  saveState: SaveState;
  onStop: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onClose: () => void;
  onSave: (rec: Recording) => void;
}) {
  if (phase === "recording") {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onStop}
          className="flex-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Stop
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (phase === "recorded" && audioUrl && recording) {
    const saved = saveState.status === "saved";
    const saving = saveState.status === "saving";
    return (
      <div className="flex flex-col gap-2">
        {/* Native controls give play/pause/scrub for review. */}
        <audio src={audioUrl} controls className="w-full" />

        {saved ? (
          <p
            className="rounded-md bg-emerald-50 px-3 py-2 text-center text-sm font-medium text-emerald-700"
            role="status"
          >
            ✓ Note saved. Find it in the dumyap popup.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => onSave(recording)}
            disabled={saving}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save note"}
          </button>
        )}

        {saveState.status === "error" && (
          <p
            className="text-center text-xs font-medium text-red-600"
            role="alert"
          >
            {saveState.message}
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          {saved ? "Done" : "Discard & close"}
        </button>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="flex-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Close
        </button>
      </div>
    );
  }

  // requesting / stopping / idle: no actionable controls.
  return null;
}
