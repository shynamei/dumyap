// Crops a viewport region out of a full visible-tab screenshot, in the content
// script. Returns a PNG data URL (the context is passed to the recorder via
// session storage, which holds JSON-serialisable values, so a data URL — not a
// Blob — is the right carrier).
//
// DPR / scaling: chrome.tabs.captureVisibleTab records the viewport at device
// resolution, so the captured image's width equals the CSS viewport width times
// the effective scale (devicePixelRatio, including browser/page zoom). We derive
// that scale from image.naturalWidth / window.innerWidth rather than trusting a
// single devicePixelRatio value, so the crop stays aligned under zoom too.

import type { ViewportRect } from "./selectionOverlay";

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("Could not load the captured screenshot."));
    img.src = dataUrl;
  });
}

export async function cropViewportRegion(
  screenshotDataUrl: string,
  rect: ViewportRect,
): Promise<string> {
  const img = await loadImage(screenshotDataUrl);

  const scaleX = img.naturalWidth / window.innerWidth;
  const scaleY = img.naturalHeight / window.innerHeight;

  let sx = Math.round(rect.left * scaleX);
  let sy = Math.round(rect.top * scaleY);
  let sw = Math.round(rect.width * scaleX);
  let sh = Math.round(rect.height * scaleY);

  sx = Math.max(0, Math.min(sx, img.naturalWidth));
  sy = Math.max(0, Math.min(sy, img.naturalHeight));
  sw = Math.max(1, Math.min(sw, img.naturalWidth - sx));
  sh = Math.max(1, Math.min(sh, img.naturalHeight - sy));

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas is not available for cropping.");
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  return canvas.toDataURL("image/png");
}
