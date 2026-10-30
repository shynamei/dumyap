// IndexedDB data layer for voice notes.
//
// A tiny, dependency-free wrapper exposing promise-based CRUD. Audio Blobs are
// stored directly (IndexedDB supports Blobs natively). Everything is local to
// the browser profile — no network, no external services.

import type { VoiceNote } from "./note";

const DB_NAME = "dumyap";
const DB_VERSION = 1;
const STORE = "notes";
const CREATED_AT_INDEX = "createdAt";

export type NoteStorageErrorKind = "open" | "quota" | "read" | "write";

export class NoteStorageError extends Error {
  constructor(
    public kind: NoteStorageErrorKind,
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "NoteStorageError";
  }
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(
        new NoteStorageError("open", "IndexedDB is not available in this browser."),
      );
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex(CREATED_AT_INDEX, "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      // If another tab triggers a version change, close so it isn't blocked.
      db.onversionchange = () => db.close();
      resolve(db);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(
        new NoteStorageError(
          "open",
          "Could not open the notes database.",
          request.error,
        ),
      );
    };

    request.onblocked = () => {
      reject(
        new NoteStorageError(
          "open",
          "The notes database is blocked by another tab. Close other dumyap windows and retry.",
        ),
      );
    };
  });

  return dbPromise;
}

/** Saves a new note. Rejects with a NoteStorageError on quota/write failure. */
export async function addNote(note: VoiceNote): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE, "readwrite");
    } catch (err) {
      reject(new NoteStorageError("write", "Could not start a write.", err));
      return;
    }

    tx.objectStore(STORE).add(note);

    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => {
      const err = tx.error;
      const isQuota = err?.name === "QuotaExceededError";
      reject(
        new NoteStorageError(
          isQuota ? "quota" : "write",
          isQuota
            ? "Not enough local storage space to save this recording."
            : "Could not save the note.",
          err,
        ),
      );
    };
  });
}

/**
 * Updates an existing note (by id). Used to attach/edit a transcript without
 * touching the original audio or screenshot. Uses `put`, which inserts or
 * replaces the record keyed by `id`.
 */
export async function updateNote(note: VoiceNote): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE, "readwrite");
    } catch (err) {
      reject(new NoteStorageError("write", "Could not start an update.", err));
      return;
    }

    tx.objectStore(STORE).put(note);

    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => {
      const err = tx.error;
      const isQuota = err?.name === "QuotaExceededError";
      reject(
        new NoteStorageError(
          isQuota ? "quota" : "write",
          isQuota
            ? "Not enough local storage space to save the change."
            : "Could not save the change.",
          err,
        ),
      );
    };
  });
}

/** Returns all notes, newest first. */
export async function getAllNotes(): Promise<VoiceNote[]> {
  const db = await openDb();
  return new Promise<VoiceNote[]>((resolve, reject) => {
    const notes: VoiceNote[] = [];
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE, "readonly");
    } catch (err) {
      reject(new NoteStorageError("read", "Could not start a read.", err));
      return;
    }

    const index = tx.objectStore(STORE).index(CREATED_AT_INDEX);
    // Walk the createdAt index in descending order => newest first.
    const cursorReq = index.openCursor(null, "prev");

    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        notes.push(cursor.value as VoiceNote);
        cursor.continue();
      } else {
        resolve(notes);
      }
    };

    cursorReq.onerror = () => {
      reject(
        new NoteStorageError("read", "Could not read notes.", cursorReq.error),
      );
    };
  });
}

/** Deletes a note by id. */
export async function deleteNote(id: string): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE, "readwrite");
    } catch (err) {
      reject(new NoteStorageError("write", "Could not start a delete.", err));
      return;
    }

    tx.objectStore(STORE).delete(id);

    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => {
      reject(
        new NoteStorageError("write", "Could not delete the note.", tx.error),
      );
    };
  });
}
