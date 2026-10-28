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
import { SelectionOverlay, type ViewportRect } from "./selectionOverlay";
import { cropViewportRegion } from "./captureCrop";
import type {
  CaptureVisibleTabResponse,
  OpenRecorderMessage,
  RuntimeMessage,
} from "../shared/messages";

/** True once the extension context has been invalidated (e.g. reloaded). */
function isContextInvalidated(): boolean {
  try {
    // Accessing runtime.id throws when the context is gone.
    return !chrome.runtime?.id;
  } catch {
    return true;
  }
}

// Only one selection session at a time.
let captureActive = false;

function startAreaCapture(): void {
  if (captureActive) return;
  captureActive = true;

  const overlay = new SelectionOverlay({
    onCancel: () => {
      overlay.destroy();
      captureActive = false;
    },
    onSelect: (rect) => {
      void completeCapture(overlay, rect);
    },
  });
  overlay.mount();
}

async function completeCapture(
  overlay: SelectionOverlay,
  rect: ViewportRect,
): Promise<void> {
  // Hide our own UI so it isn't included in the captured pixels, then wait two
  // animation frames for the browser to actually repaint before capturing.
  overlay.hideVisual();
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

  try {
    if (isContextInvalidated()) {
      throw new Error("The dumyap extension was reloaded. Please try again.");
    }

    const response = (await chrome.runtime.sendMessage({
      type: "dumyap:capture-visible-tab",
    } satisfies RuntimeMessage)) as CaptureVisibleTabResponse | undefined;

    if (!response?.ok || !response.dataUrl) {
      throw new Error(response?.error ?? "Screenshot capture failed.");
    }

    const screenshotDataUrl = await cropViewportRegion(response.dataUrl, rect);

    const openMessage: OpenRecorderMessage = {
      type: "dumyap:open-recorder",
      context: {
        selectedText: "",
        url: location.href,
        title: document.title,
        timestamp: Date.now(),
        screenshotDataUrl,
      },
    };
    await chrome.runtime.sendMessage(openMessage);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not capture the region.";
    console.warn("[dumyap] area capture failed:", message);
    // Surface a lightweight, non-blocking notice to the user.
    showTransientNotice(message);
  } finally {
    overlay.destroy();
    captureActive = false;
  }
}

/** Shows a brief, self-dismissing toast via an isolated Shadow DOM host. */
function showTransientNotice(text: string): void {
  const host = document.createElement("div");
  Object.assign(host.style, {
    position: "fixed",
    top: "16px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: "2147483647",
  } satisfies Partial<CSSStyleDeclaration>);
  const shadow = host.attachShadow({ mode: "open" });
  const note = document.createElement("div");
  note.textContent = `dumyap: ${text}`;
  Object.assign(note.style, {
    background: "rgba(127, 29, 29, 0.95)",
    color: "#fff",
    font: "13px system-ui, sans-serif",
    padding: "8px 14px",
    borderRadius: "8px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
  } satisfies Partial<CSSStyleDeclaration>);
  shadow.appendChild(note);
  (document.body ?? document.documentElement).appendChild(host);
  setTimeout(() => host.remove(), 4000);
}

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

  // Popup -> content script: begin in-page region selection.
  chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
    if (message.type === "dumyap:start-capture") {
      startAreaCapture();
    }
    // No async response needed.
    return false;
  });
}

if (document.body) {
  init();
} else {
  document.addEventListener("DOMContentLoaded", init, { once: true });
}

export {};
