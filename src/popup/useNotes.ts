// Popup hook: loads saved notes and supports deletion, with loading/error
// state. Reads straight from the shared IndexedDB data layer.

import { useCallback, useEffect, useState } from "react";
import {
  deleteNote,
  getAllNotes,
  NoteStorageError,
  updateNote,
} from "../shared/db";
import type { VoiceNote } from "../shared/note";

export type NotesStatus = "loading" | "ready" | "error";

export interface UseNotes {
  status: NotesStatus;
  notes: VoiceNote[];
  error: string | null;
  reload: () => void;
  remove: (id: string) => Promise<void>;
  /** Persist a transcript onto a note; updates in-memory state on success. */
  saveTranscript: (id: string, transcript: string) => Promise<void>;
}

export function useNotes(): UseNotes {
  const [status, setStatus] = useState<NotesStatus>("loading");
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const all = await getAllNotes();
      setNotes(all);
      setStatus("ready");
    } catch (err) {
      setError(
        err instanceof NoteStorageError
          ? err.message
          : "Could not load saved notes.",
      );
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = useCallback(async (id: string) => {
    // Optimistic removal; restore on failure.
    let previous: VoiceNote[] = [];
    setNotes((current) => {
      previous = current;
      return current.filter((n) => n.id !== id);
    });
    try {
      await deleteNote(id);
    } catch {
      setNotes(previous);
      setError("Could not delete the note. Please try again.");
    }
  }, []);

  const saveTranscript = useCallback(
    async (id: string, transcript: string) => {
      const target = notes.find((n) => n.id === id);
      if (!target) return;
      const updated: VoiceNote = {
        ...target,
        transcript,
        transcribedAt: target.transcribedAt ?? Date.now(),
      };
      // Persist first; only reflect in state if the write succeeds, so the UI
      // never shows a transcript that didn't save.
      await updateNote(updated);
      setNotes((current) =>
        current.map((n) => (n.id === id ? updated : n)),
      );
    },
    [notes],
  );

  return {
    status,
    notes,
    error,
    reload: () => void load(),
    remove,
    saveTranscript,
  };
}
