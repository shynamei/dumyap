import { useEffect, useMemo, useState } from "react";
import type { CaptureContext } from "../shared/messages";
import { loadCaptureContext } from "./context";
import RecorderPanel from "./RecorderPanel";

/** Converts a data URL to a Blob (synchronous, for small cropped PNGs). */
function dataUrlToBlob(dataUrl: string): { blob: Blob; mimeType: string } {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = /data:([^;]+)/.exec(header);
  const mimeType = mimeMatch?.[1] ?? "image/png";
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return { blob: new Blob([arr], { type: mimeType }), mimeType };
}

export default function App() {
  const [context, setContext] = useState<CaptureContext | null>(null);
  const [contextLoaded, setContextLoaded] = useState(false);

  // Pull the preserved context once on mount.
  useEffect(() => {
    let active = true;
    loadCaptureContext()
      .then((ctx) => {
        if (active) {
          setContext(ctx);
          setContextLoaded(true);
        }
      })
      .catch(() => {
        if (active) setContextLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Decode the cropped screenshot (if any) into a Blob for saving + preview.
  const screenshot = useMemo(
    () =>
      context?.screenshotDataUrl
        ? dataUrlToBlob(context.screenshotDataUrl)
        : null,
    [context?.screenshotDataUrl],
  );

  // Object URL for the thumbnail; revoked when it changes/unmounts.
  const screenshotUrl = useMemo(
    () => (screenshot ? URL.createObjectURL(screenshot.blob) : null),
    [screenshot],
  );
  useEffect(() => {
    if (!screenshotUrl) return;
    return () => URL.revokeObjectURL(screenshotUrl);
  }, [screenshotUrl]);

  const closeWindow = () => window.close();

  return (
    <div className="flex min-h-screen w-full flex-col gap-3 bg-slate-50 p-4 text-slate-800">
      <header className="flex items-center gap-2">
        <span aria-hidden="true" className="text-xl">
          💭
        </span>
        <h1 className="text-base font-semibold">dumyap · record</h1>
      </header>

      {screenshotUrl ? (
        <img
          src={screenshotUrl}
          alt="Captured region"
          className="mx-auto max-h-48 w-auto max-w-full rounded-md border border-slate-300"
        />
      ) : null}

      {context?.selectedText ? (
        <blockquote className="max-h-20 overflow-auto rounded-md border-l-2 border-indigo-400 bg-white px-3 py-2 text-xs text-slate-600">
          “{context.selectedText}”
        </blockquote>
      ) : contextLoaded && !context ? (
        <p className="text-xs text-amber-600">
          No selection context was found. You can still record a thought.
        </p>
      ) : null}

      {/* Wait for context before mounting the panel so auto-start uses the
          loaded context; render a brief preparing state meanwhile. */}
      {contextLoaded ? (
        <RecorderPanel
          context={{
            selectedText: context?.selectedText ?? "",
            url: context?.url ?? "",
            title: context?.title ?? "",
            timestamp: context?.timestamp ?? Date.now(),
          }}
          screenshot={screenshot}
          onClose={closeWindow}
        />
      ) : (
        <section className="rounded-lg bg-white px-4 py-5 text-center text-sm text-slate-500">
          Preparing…
        </section>
      )}

      {context ? (
        <footer className="mt-auto border-t border-slate-200 pt-2 text-[10px] text-slate-400">
          <div className="truncate" title={context.title}>
            {context.title || "Untitled page"}
          </div>
          <div className="truncate" title={context.url}>
            {context.url}
          </div>
        </footer>
      ) : null}
    </div>
  );
}
