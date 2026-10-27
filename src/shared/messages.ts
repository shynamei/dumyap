// Shared message + data types used across the content script, service worker,
// and recorder page.
//
// The "capture context" is the small, bounded slice of page data we keep when
// the user initiates a recording: the text they selected, the page URL and
// title, and when they started. We never collect the full page contents.

export interface CaptureContext {
  /** The text the user had selected when they clicked the mic. */
  selectedText: string;
  /** Source page URL. */
  url: string;
  /** Source page title. */
  title: string;
  /** Capture start time, epoch milliseconds. */
  timestamp: number;
}

/** Content script -> service worker: user clicked the mic, open the recorder. */
export interface OpenRecorderMessage {
  type: "dumyap:open-recorder";
  context: CaptureContext;
}

export type RuntimeMessage = OpenRecorderMessage;

/** Session-storage key for a pending capture context, by one-time id. */
export function contextStorageKey(id: string): string {
  return `dumyap:context:${id}`;
}
