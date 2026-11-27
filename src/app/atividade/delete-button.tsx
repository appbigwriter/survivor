"use client";

import { deleteActivity } from "./actions";

/** "Apagar" com confirmação: um toque sem querer não some com o registro. */
export function DeleteButton({ id, label }: { id: string; label: string }) {
  return (
    <form
      action={deleteActivity}
      onSubmit={(e) => {
        if (!window.confirm(`Apagar ${label}?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="min-h-11 rounded-xl px-3 text-muted underline underline-offset-4" aria-label={`Apagar ${label}`}>
        Apagar
      </button>
    </form>
  );
}
