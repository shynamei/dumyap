import { useNotes } from "../useNotes";
import NoteItem from "./NoteItem";

export default function NotesList() {
  const { status, notes, error, reload, remove } = useNotes();

  if (status === "loading") {
    return (
      <p className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-400">
        Loading notes…
      </p>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center">
        <p className="text-sm font-medium text-red-700">
          {error ?? "Could not load notes."}
        </p>
        <button
          type="button"
          onClick={reload}
          className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
        >
          Retry
        </button>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center">
        <span aria-hidden="true" className="text-xl">
          🗒️
        </span>
        <p className="text-sm font-medium text-slate-600">No notes yet</p>
        <p className="text-xs text-slate-400">
          Highlight text on a page and record a thought to save it here.
        </p>
      </div>
    );
  }

  return (
    <>
      {error ? (
        <p className="mb-2 text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="flex max-h-96 flex-col gap-2 overflow-auto">
        {notes.map((note) => (
          <NoteItem key={note.id} note={note} onDelete={remove} />
        ))}
      </ul>
    </>
  );
}
