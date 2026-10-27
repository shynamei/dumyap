// dumyap background service worker.
//
// Bridges the content script and the recorder page:
//   1. Content script sends "dumyap:open-recorder" with the capture context.
//   2. We stash the context in chrome.storage.session under a one-time id and
//      open the recorder as a small extension popup window (an extension-owned,
//      user-initiated context where getUserMedia can prompt and run — unlike a
//      content script). The id travels in the URL query string.
//   3. The recorder page reads its id and pulls the context from session
//      storage, then deletes it.
//
// Session storage is in-memory, not synced, and cleared when the browser
// closes. The context is a bounded slice of page data; nothing is persisted to
// disk or sent anywhere external.

import {
  contextStorageKey,
  type CaptureContext,
  type RuntimeMessage,
} from "../shared/messages";

const RECORDER_PATH = "src/recorder/index.html";
const RECORDER_WIDTH = 360;
const RECORDER_HEIGHT = 460;

async function openRecorderWindow(context: CaptureContext): Promise<void> {
  const id = crypto.randomUUID();
  await chrome.storage.session.set({ [contextStorageKey(id)]: context });

  const url = chrome.runtime.getURL(`${RECORDER_PATH}?id=${id}`);
  await chrome.windows.create({
    url,
    type: "popup",
    width: RECORDER_WIDTH,
    height: RECORDER_HEIGHT,
    focused: true,
  });
}

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, _sender, sendResponse) => {
    if (message.type === "dumyap:open-recorder") {
      openRecorderWindow(message.context)
        .then(() => sendResponse({ ok: true }))
        .catch((err: unknown) => {
          console.error("[dumyap] failed to open recorder window:", err);
          sendResponse({ ok: false });
        });
      return true; // keep the message channel open for the async response
    }
    return false;
  },
);
