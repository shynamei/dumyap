// Placeholder for the saved-notes list. Persistence and real note data are
// intentionally out of scope for the foundation build.
export default function NotesPlaceholder() {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center">
      <span aria-hidden="true" className="text-xl">
        🗒️
      </span>
      <p className="text-sm font-medium text-slate-600">No notes yet</p>
      <p className="text-xs text-slate-400">
        Your saved thoughts will show up here.
      </p>
    </div>
  );
}
