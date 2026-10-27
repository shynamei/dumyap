// Loads the capture context the service worker stashed in session storage.
//
// The one-time id arrives in the page URL (?id=...). We read the context once
// and immediately delete it so it does not linger in memory.

import { contextStorageKey, type CaptureContext } from "../shared/messages";

export async function loadCaptureContext(): Promise<CaptureContext | null> {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) return null;

  const key = contextStorageKey(id);
  const stored = await chrome.storage.session.get(key);
  const context = stored[key] as CaptureContext | undefined;

  // One-shot: remove it so a refresh can't replay stale context.
  await chrome.storage.session.remove(key);

  return context ?? null;
}
