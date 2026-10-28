// Popup-side capture trigger.
//
// On the user's explicit "Capture area" click, we ask the active tab's content
// script to begin an in-page region selection, then close the popup so the
// webpage (and the overlay) are fully visible. The screenshot itself is taken
// later by the service worker, after the content script hides its overlay.

import type { StartCaptureMessage } from "../shared/messages";

export class CaptureError extends Error {}

/** Pages where content scripts can't run / tabs can't be captured. */
function isUnsupportedUrl(url: string | undefined): boolean {
  if (!url) return true;
  return (
    url.startsWith("chrome://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("https://chrome.google.com/webstore") ||
    url.startsWith("https://chromewebstore.google.com")
  );
}

/**
 * Tells the active tab to start in-page region selection. Throws CaptureError
 * with a user-facing message when the tab can't host the overlay.
 */
export async function startAreaCapture(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || tab.id === undefined) {
    throw new CaptureError("No active tab to capture.");
  }
  if (isUnsupportedUrl(tab.url)) {
    throw new CaptureError(
      "This page can't be captured. Open a normal website and try again.",
    );
  }

  const message: StartCaptureMessage = { type: "dumyap:start-capture" };
  try {
    await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    // The content script isn't present (e.g. the page loaded before the
    // extension, or an unsupported frame). Ask the user to reload.
    throw new CaptureError(
      "Couldn't start capture on this page. Reload the page and try again.",
    );
  }
}
