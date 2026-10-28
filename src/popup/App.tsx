import { useState } from "react";
import NotesList from "./components/NotesList";
import { startAreaCapture, CaptureError } from "./capture";

export default function App() {
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const handleCapture = async () => {
    if (capturing) return;
    setCaptureError(null);
    setCapturing(true);
    try {
      await startAreaCapture();
      // Selection mode is now active in the page; close the popup so the
      // webpage and the overlay are fully visible.
      window.close();
    } catch (err) {
      setCaptureError(
        err instanceof CaptureError
          ? err.message
          : "Could not start a capture. Please try again.",
      );
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="flex w-80 flex-col gap-4 bg-slate-50 p-4 text-slate-800">
      <header className="flex items-center gap-2">
        <span aria-hidden="true" className="text-2xl">
          💭
        </span>
        <div>
          <h1 className="text-lg font-semibold leading-tight">dumyap</h1>
          <p className="text-xs text-slate-500">
            Highlight, speak, and organize your thoughts on any page.
          </p>
        </div>
      </header>

      <section>
        <button
          type="button"
          onClick={handleCapture}
          disabled={capturing}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span aria-hidden="true">▣</span>
          {capturing ? "Starting…" : "Capture area"}
        </button>
        {captureError ? (
          <p className="mt-2 text-xs font-medium text-red-600" role="alert">
            {captureError}
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          Saved notes
        </h2>
        <NotesList />
      </section>

      <footer className="border-t border-slate-200 pt-2 text-[10px] text-slate-400">
        v0.1.0 · notes stored locally in your browser
      </footer>
    </div>
  );
}
