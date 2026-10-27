import { useEffect, useRef, useState } from "react";
import type { CaptureContext } from "../shared/messages";
import { loadCaptureContext } from "./context";
import { useAudioRecorder } from "./useAudioRecorder";

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function App() {
  const [context, setContext] = useState<CaptureContext | null>(null);
  const [contextLoaded, setContextLoaded] = useState(false);
  const { phase, elapsedMs, audioUrl, error, start, stop, cancel } =
    useAudioRecorder();
  const autoStarted = useRef(false);

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

  // Auto-start recording once, after context has loaded. The window was opened
  // by a direct user gesture (the mic click), so this counts as user-initiated.
  useEffect(() => {
    if (contextLoaded && !autoStarted.current && phase === "idle") {
      autoStarted.current = true;
      void start();
    }
  }, [contextLoaded, phase, start]);

  const closeWindow = () => window.close();

  const handleCancel = () => {
    cancel();
    closeWindow();
  };

  return (
    <div className="flex min-h-screen w-full flex-col gap-3 bg-slate-50 p-4 text-slate-800">
      <header className="flex items-center gap-2">
        <span aria-hidden="true" className="text-xl">
          💭
        </span>
        <h1 className="text-base font-semibold">dumyap · record</h1>
      </header>

      {context?.selectedText ? (
        <blockquote className="max-h-20 overflow-auto rounded-md border-l-2 border-indigo-400 bg-white px-3 py-2 text-xs text-slate-600">
          “{context.selectedText}”
        </blockquote>
      ) : contextLoaded && !context ? (
        <p className="text-xs text-amber-600">
          No selection context was found. You can still record a thought.
        </p>
      ) : null}

      <StatusArea
        phase={phase}
        elapsedMs={elapsedMs}
        error={error?.message ?? null}
      />

      <Controls
        phase={phase}
        audioUrl={audioUrl}
        onStop={() => void stop()}
        onCancel={handleCancel}
        onRetry={() => void start()}
        onClose={closeWindow}
      />

      <Footer context={context} />
    </div>
  );
}

function StatusArea({
  phase,
  elapsedMs,
  error,
}: {
  phase: string;
  elapsedMs: number;
  error: string | null;
}) {
  return (
    <section
      className="flex flex-col items-center gap-2 rounded-lg bg-white px-4 py-5 text-center"
      aria-live="polite"
    >
      {phase === "requesting" && (
        <p className="text-sm text-slate-500">Requesting microphone access…</p>
      )}

      {phase === "recording" && (
        <>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            <span className="text-sm font-medium text-red-600">Recording</span>
          </div>
          <span className="font-mono text-2xl tabular-nums text-slate-800">
            {formatElapsed(elapsedMs)}
          </span>
        </>
      )}

      {phase === "stopping" && (
        <p className="text-sm text-slate-500">Finishing up…</p>
      )}

      {phase === "recorded" && (
        <>
          <span className="text-sm font-medium text-emerald-600">
            Recording ready
          </span>
          <span className="font-mono text-xl tabular-nums text-slate-700">
            {formatElapsed(elapsedMs)}
          </span>
        </>
      )}

      {phase === "error" && (
        <p className="text-sm font-medium text-red-600">
          {error ?? "Something went wrong."}
        </p>
      )}

      {phase === "idle" && (
        <p className="text-sm text-slate-500">Preparing…</p>
      )}
    </section>
  );
}

function Controls({
  phase,
  audioUrl,
  onStop,
  onCancel,
  onRetry,
  onClose,
}: {
  phase: string;
  audioUrl: string | null;
  onStop: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  if (phase === "recording") {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onStop}
          className="flex-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Stop
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (phase === "recorded" && audioUrl) {
    return (
      <div className="flex flex-col gap-2">
        {/* Native controls give play/pause/scrub for review. */}
        <audio src={audioUrl} controls className="w-full" />
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Done
        </button>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="flex-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Close
        </button>
      </div>
    );
  }

  // requesting / stopping / idle: no actionable controls.
  return null;
}

function Footer({ context }: { context: CaptureContext | null }) {
  if (!context) return null;
  return (
    <footer className="mt-auto border-t border-slate-200 pt-2 text-[10px] text-slate-400">
      <div className="truncate" title={context.title}>
        {context.title || "Untitled page"}
      </div>
      <div className="truncate" title={context.url}>
        {context.url}
      </div>
    </footer>
  );
}
