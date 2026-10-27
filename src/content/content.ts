// dumyap content script.
//
// Detects non-empty text selections on a page and shows a floating microphone
// button near the selection. Clearing the selection or clicking elsewhere
// dismisses the button.
//
// Scope note: on mic click, the content script captures only a bounded slice
// of context (the selected text, page URL, title, timestamp) and hands it to
// the service worker, which opens the extension-owned recorder page. Recording
// itself happens there, not in this content script. No full-page content is
// collected and nothing is sent to any external service.

import { FloatingMicButton } from "./floatingMicButton";
import {
  getSelectedText,
  getSelectionAnchor,
  isSelectionInEditable,
} from "./selection";
import type { OpenRecorderMessage } from "../shared/messages";

function init(): void {
  console.debug("[dumyap] content script loaded.");

  const micButton = new FloatingMicButton({
    onClick: () => {
      const selectedText = getSelectedText();
      if (!selectedText) {
        // Selection was lost before the click resolved; nothing to capture.
        micButton.hide();
        return;
      }

      const message: OpenRecorderMessage = {
        type: "dumyap:open-recorder",
        context: {
          selectedText,
          url: location.href,
          title: document.title,
          timestamp: Date.now(),
        },
      };

      chrome.runtime.sendMessage(message, () => {
        // Access lastError to avoid an unchecked-error console warning if the
        // service worker is momentarily unavailable.
        if (chrome.runtime.lastError) {
          console.warn(
            "[dumyap] could not open recorder:",
            chrome.runtime.lastError.message,
          );
        }
      });

      // Dismiss the button once capture has been handed off.
      micButton.hide();
    },
  });
  micButton.mount();

  // Re-evaluate the selection on the next frame so the DOM selection state is
  // settled (e.g. after a mouseup completes a drag-select).
  let rafId = 0;
  const scheduleUpdate = (): void => {
    if (rafId) return;
    rafId = window.requestAnimationFrame(() => {
      rafId = 0;
      updateButton();
    });
  };

  const updateButton = (): void => {
    if (isSelectionInEditable()) {
      micButton.hide();
      return;
    }

    const anchor = getSelectionAnchor();
    if (anchor) {
      micButton.showAt(anchor.x, anchor.y);
    } else {
      micButton.hide();
    }
  };

  // A completed selection gesture (mouse or keyboard) updates the button.
  document.addEventListener("mouseup", scheduleUpdate, true);
  document.addEventListener("keyup", scheduleUpdate, true);

  // selectionchange fires continuously during a drag; defer via rAF. This also
  // catches programmatic clears so the button hides when the selection goes
  // away.
  document.addEventListener("selectionchange", scheduleUpdate);

  // A mousedown outside the button clears any stale button immediately. If the
  // click starts a new selection, the following mouseup re-evaluates.
  document.addEventListener(
    "mousedown",
    (e) => {
      if (!micButton.contains(e.target as Node)) {
        micButton.hide();
      }
    },
    true,
  );

  // Keep the button glued to the selection when the page scrolls or resizes,
  // but only while it is visible.
  const reposition = (): void => {
    if (!micButton.isVisible()) return;
    const anchor = getSelectionAnchor();
    if (anchor) {
      micButton.showAt(anchor.x, anchor.y);
    } else {
      micButton.hide();
    }
  };
  window.addEventListener("scroll", reposition, true);
  window.addEventListener("resize", reposition);
}

if (document.body) {
  init();
} else {
  document.addEventListener("DOMContentLoaded", init, { once: true });
}

export {};
