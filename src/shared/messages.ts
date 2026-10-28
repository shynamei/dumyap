// Shared message + data types used across the popup, content script, service
// worker, and recorder page.
//
// The "capture context" is the small, bounded slice of page data we keep when
// the user initiates a note: the selected text (for text notes), the page URL
// and title, a timestamp, and — for visual notes — the cropped screenshot as a
// data URL. We never collect the full page contents.

export interface CaptureContext {
  /** The text the user had selected (empty for visual-only notes). */
  selectedText: string;
  /** Source page URL. */
  url: string;
  /** Source page title. */
  title: string;
  /** Capture start time, epoch milliseconds. */
  timestamp: number;
  /**
   * Cropped screenshot as a PNG data URL (visual notes only). Absent for
   * text notes. Passed via session storage and converted to a Blob by the
   * recorder before saving.
   */
  screenshotDataUrl?: string;
}

/** Popup -> active tab content script: begin in-page region selection. */
export interface StartCaptureMessage {
  type: "dumyap:start-capture";
}

/** Content script -> service worker: capture the visible tab, return a PNG. */
export interface CaptureVisibleTabMessage {
  type: "dumyap:capture-visible-tab";
}

export interface CaptureVisibleTabResponse {
  ok: boolean;
  dataUrl?: string;
  error?: string;
}

/** Content script -> service worker: open the recorder with this context. */
export interface OpenRecorderMessage {
  type: "dumyap:open-recorder";
  context: CaptureContext;
}

export type RuntimeMessage =
  | StartCaptureMessage
  | CaptureVisibleTabMessage
  | OpenRecorderMessage;

/** Session-storage key for a pending capture context, by one-time id. */
export function contextStorageKey(id: string): string {
  return `dumyap:context:${id}`;
}
