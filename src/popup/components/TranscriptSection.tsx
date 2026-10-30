import { useState } from "react";
import type { VoiceNote } from "../../shared/note";
import { transcribeAudio, TranscribeError } from "../../shared/transcribe";

type Phase =
  | { status: "idle" } // no transcript yet, not transcribing
  | { status: "confirm" } // showing the pre-send notice
  | { status: "transcribing" }
  | { status: "error"; message: string };

export default function TranscriptSection({
  note,
  onSaveTranscript,
}: {
  note: VoiceNote;
  /** Persists the transcript text to IndexedDB; resolves on success. */
  onSaveTranscript: (id: string, transcript: string) => Promise<void>;
}) {
  const hasTranscript = typeof note.transcript === "string";
  const [phase, setPhase] = useState<Phase>({ status: "idle" });

  // Edit state for an existing transcript.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.transcript ?? "");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const runTranscription = async () => {
    if (phase.status === "transcribing") return; // prevent duplicate requests
    setPhase({ status: "transcribing" });
    try {
      const text = await transcribeAudio(note.audio, note.mimeType);
      await onSaveTranscript(note.id, text);
      setDraft(text);
      setPhase({ status: "idle" });
    } catch (err) {
      const message =
        err instanceof TranscribeError
          ? err.message
          : "Transcription failed. Please try again.";
      setPhase({ status: "error", message });
    }
  };

  const saveEdit = async () => {
    if (savingEdit) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      await onSaveTranscript(note.id, draft);
      setEditing(false);
    } catch {
      setEditError("Could not save the transcript. Please try again.");
    } finally {
      setSavingEdit(false);
    }
  };

  // --- Existing transcript: show it, allow edit/save/retranscribe. ---
  if (hasTranscript && !editing && phase.status !== "transcribing") {
    return (
      <div className="flex flex-col gap-1.5 rounded-md bg-slate-50 p-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Transcript
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(note.transcript ?? "");
                setEditing(true);
              }}
              className="text-[11px] font-medium text-indigo-600 hover:underline"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setPhase({ status: "confirm" })}
              className="text-[11px] font-medium text-slate-400 hover:text-indigo-600"
              title="Send the audio to OpenAI again"
            >
              Re-transcribe
            </button>
          </div>
        </div>
        {note.transcript ? (
          <p className="whitespace-pre-wrap text-xs text-slate-700">
            {note.transcript}
          </p>
        ) : (
          <p className="text-xs italic text-slate-400">(empty transcript)</p>
        )}
        {phase.status === "confirm" ? (
          <ConfirmNotice
            onConfirm={runTranscription}
            onCancel={() => setPhase({ status: "idle" })}
          />
        ) : null}
      </div>
    );
  }

  // --- Editing an existing transcript. ---
  if (editing) {
    return (
      <div className="flex flex-col gap-1.5 rounded-md bg-slate-50 p-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Edit transcript
        </span>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          className="w-full resize-y rounded border border-slate-300 p-2 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none"
        />
        {editError ? (
          <p className="text-[11px] text-red-600" role="alert">
            {editError}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setEditError(null);
            }}
            className="rounded-md border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={saveEdit}
            disabled={savingEdit}
            className="rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {savingEdit ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    );
  }

  // --- No transcript yet. ---
  return (
    <div className="flex flex-col gap-1.5">
      {phase.status === "transcribing" ? (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
          Transcribing… sending audio to OpenAI.
        </p>
      ) : phase.status === "confirm" ? (
        <ConfirmNotice
          onConfirm={runTranscription}
          onCancel={() => setPhase({ status: "idle" })}
        />
      ) : (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setPhase({ status: "confirm" })}
            className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
          >
            Transcribe
          </button>
          {phase.status === "error" ? (
            <span className="flex-1 text-right text-[11px] text-red-600" role="alert">
              {phase.message}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** Explicit pre-send notice shown before any audio leaves the device. */
function ConfirmNotice({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50 p-2">
      <p className="text-[11px] text-amber-800">
        This sends the recording's audio to OpenAI for transcription via your
        local dumyap server. Continue?
      </p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-700"
        >
          Send to OpenAI
        </button>
      </div>
    </div>
  );
}
