// The persisted voice-note record shape, shared between the recorder (which
// creates notes) and the popup (which lists and deletes them).

export interface VoiceNote {
  /** Unique id (UUID). */
  id: string;
  /** The recorded audio. Stored directly as a Blob in IndexedDB. */
  audio: Blob;
  /** Text the user had selected when they started recording. */
  selectedText: string;
  /** Source page URL. */
  url: string;
  /** Source page title. */
  title: string;
  /** Creation time, epoch milliseconds. */
  createdAt: number;
  /** Recording duration in milliseconds. */
  durationMs: number;
  /** Audio MIME type (e.g. "audio/webm;codecs=opus"). */
  mimeType: string;
  /**
   * Optional cropped screenshot (visual notes only). Stored as a Blob.
   * Absent on text-based notes created before this feature — code must treat
   * it as optional for backward compatibility.
   */
  screenshot?: Blob;
  /** MIME type of the screenshot Blob, when present (e.g. "image/png"). */
  screenshotMimeType?: string;
}

/** A note is "visual" when it carries a screenshot. */
export function isVisualNote(note: VoiceNote): boolean {
  return note.screenshot instanceof Blob;
}
