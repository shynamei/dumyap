import { useEffect, useMemo, useState } from "react";
import type { VoiceNote } from "../../shared/note";
import { isVisualNote } from "../../shared/note";
import { formatDate, formatDuration } from "../../shared/format";
import TranscriptSection from "./TranscriptSection";

export default function NoteItem({
  note,
  onDelete,
  onSaveTranscript,
}: {
  note: VoiceNote;
  onDelete: (id: string) => void;
  onSaveTranscript: (id: string, transcript: string) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);

  // Create an object URL for playback and revoke it when this item unmounts or
  // the underlying blob changes.
  const audioUrl = useMemo(
    () => URL.createObjectURL(note.audio),
    [note.audio],
  );
  useEffect(() => {
    return () => URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  // Screenshot object URL for visual notes (undefined for text notes).
  const screenshotUrl = useMemo(
    () => (note.screenshot ? URL.createObjectURL(note.screenshot) : null),
    [note.screenshot],
  );
  useEffect(() => {
    if (!screenshotUrl) return;
    return () => URL.revokeObjectURL(screenshotUrl);
  }, [screenshotUrl]);

  const visual = isVisualNote(note);
  const preview = note.selectedText.trim();

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className="truncate text-sm font-medium text-slate-700"
            title={note.title}
          >
            {note.title || "Untitled page"}
          </p>
          <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span
              className={`rounded px-1 py-px text-[9px] font-semibold uppercase ${
                visual
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {visual ? "Visual" : "Text"}
            </span>
            {formatDate(note.createdAt)} · {formatDuration(note.durationMs)}
          </p>
        </div>
        {note.url ? (
          <a
            href={note.url}
            target="_blank"
            rel="noreferrer noopener"
            className="shrink-0 text-xs font-medium text-indigo-600 hover:underline"
            title={note.url}
          >
            Open ↗
          </a>
        ) : null}
      </div>

      {screenshotUrl ? (
        <a
          href={screenshotUrl}
          target="_blank"
          rel="noreferrer noopener"
          title="Open full screenshot"
          className="block overflow-hidden rounded-md border border-slate-200"
        >
          <img
            src={screenshotUrl}
            alt="Captured region"
            className="max-h-28 w-full object-contain"
          />
        </a>
      ) : null}

      {preview ? (
        <blockquote className="line-clamp-2 border-l-2 border-slate-200 pl-2 text-xs text-slate-500">
          “{preview}”
        </blockquote>
      ) : null}

      <audio src={audioUrl} controls className="h-8 w-full" />

      <TranscriptSection note={note} onSaveTranscript={onSaveTranscript} />

      {confirming ? (
        <div className="flex items-center gap-2">
          <span className="flex-1 text-xs text-slate-500">Delete this note?</span>
          <button
            type="button"
            onClick={() => onDelete(note.id)}
            className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            Keep
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="self-end text-xs font-medium text-slate-400 hover:text-red-600"
          aria-label={`Delete note from ${note.title || "untitled page"}`}
        >
          Delete
        </button>
      )}
    </li>
  );
}
