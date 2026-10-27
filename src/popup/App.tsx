import NotesPlaceholder from "./components/NotesPlaceholder";

export default function App() {
  return (
    <div className="flex w-80 flex-col gap-4 bg-slate-50 p-4 text-slate-800">
      <header className="flex items-center gap-2">
        <span aria-hidden="true" className="text-2xl">
          💭
        </span>
        <div>
          <h1 className="text-lg font-semibold leading-tight">Thought Bestie</h1>
          <p className="text-xs text-slate-500">
            Highlight, speak, and organize your thoughts on any page.
          </p>
        </div>
      </header>

      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          Saved notes
        </h2>
        <NotesPlaceholder />
      </section>

      <footer className="border-t border-slate-200 pt-2 text-[10px] text-slate-400">
        v0.1.0 · foundation build
      </footer>
    </div>
  );
}
