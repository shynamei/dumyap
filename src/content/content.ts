// dumyap content script.
//
// Detects non-empty text selections on a page and shows a floating microphone
// button near the selection. Clearing the selection or clicking elsewhere
// dismisses the button.
//
// Scope note: this build only surfaces the button. It does not record audio,
// transcribe, call any service, or read/store the selected text or page
// content. The click handler is a placeholder.

import { FloatingMicButton } from "./floatingMicButton";
import { getSelectionAnchor, isSelectionInEditable } from "./selection";

function init(): void {
  console.debug("[dumyap] content script loaded.");

  const micButton = new FloatingMicButton({
    onClick: () => {
      // Placeholder: recording/transcription will hook in here later.
      console.debug("[dumyap] mic button clicked (no-op for now).");
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
