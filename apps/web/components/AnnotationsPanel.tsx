"use client";

// Phase 4: shared, class-visible notes on a material. Students can anchor a
// note to a highlighted snippet of the material text (select text on the
// page, then "Quote selection") or leave a general note. Everyone enrolled
// sees every note; you can delete your own.
import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/trpc";

type Annotation = Awaited<ReturnType<typeof api.annotation.listByMaterial.query>>[number];

const MAX_QUOTE = 1000;

export function AnnotationsPanel({ materialId }: { materialId: string }) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [body, setBody] = useState("");
  const [quote, setQuote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setAnnotations(await api.annotation.listByMaterial.query({ materialId }));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoaded(true);
    }
  }, [materialId]);

  useEffect(() => {
    void load();
  }, [load]);

  function captureSelection() {
    const text = window.getSelection()?.toString().replace(/\s+/g, " ").trim() ?? "";
    if (text) setQuote(text.slice(0, MAX_QUOTE));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.annotation.create.mutate({ materialId, body: trimmed, quote });
      setBody("");
      setQuote("");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(annotationId: string) {
    try {
      await api.annotation.delete.mutate({ annotationId });
      setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section className="mt-8">
      <h2 className="mb-1 font-display text-lg font-semibold text-ink">
        Class notes
        {loaded && annotations.length > 0 && (
          <span className="ml-2 text-sm font-medium text-slate-400">{annotations.length}</span>
        )}
      </h2>
      <p className="mb-4 text-sm font-medium text-slate-500">
        Highlight any text above and click <span className="font-semibold">Quote selection</span> to
        anchor a note - everyone in the course sees these.
      </p>

      <form onSubmit={submit} className="card mb-6">
        {quote && (
          <div className="mb-3 flex items-start justify-between gap-3 rounded-lg border-l-4 border-brand-300 bg-brand-50/60 px-3 py-2">
            <p className="text-sm italic text-slate-600">&ldquo;{quote}&rdquo;</p>
            <button
              type="button"
              onClick={() => setQuote("")}
              className="shrink-0 text-xs font-semibold text-slate-400 hover:text-rose-500"
              title="Remove the quoted snippet"
            >
              clear
            </button>
          </div>
        )}
        <textarea
          className="input min-h-[3rem] resize-y"
          rows={2}
          placeholder="Add a note for your classmates - a clarification, a question, an exam tip..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            // preventDefault on mousedown keeps the page text selection from
            // collapsing when the button takes focus, so we can read it.
            onMouseDown={(e) => e.preventDefault()}
            onClick={captureSelection}
            className="btn-secondary"
          >
            Quote selection
          </button>
          <button type="submit" disabled={busy || !body.trim()} className="btn-primary">
            {busy ? "Posting..." : "Post note"}
          </button>
        </div>
      </form>

      {error && <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}

      {!loaded ? (
        <p className="py-6 text-center text-sm font-medium text-slate-400">Loading notes...</p>
      ) : annotations.length === 0 ? (
        <p className="surface-panel px-5 py-8 text-center text-sm font-medium text-slate-400">
          No notes yet - be the first to annotate this material for the class.
        </p>
      ) : (
        <div className="space-y-3">
          {annotations.map((a) => (
            <div key={a.id} className="surface-panel p-4">
              {a.quote && (
                <p className="mb-2 border-l-4 border-slate-200 pl-3 text-sm italic text-slate-500">
                  &ldquo;{a.quote}&rdquo;
                </p>
              )}
              <p className="whitespace-pre-wrap text-[15px] text-ink">{a.body}</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-slate-400">
                  {a.authorName}
                  {a.mine && <span className="ml-1.5 font-semibold text-brand-600">you</span>} -{" "}
                  {new Date(a.createdAt).toLocaleString()}
                </p>
                {a.mine && (
                  <button
                    onClick={() => remove(a.id)}
                    className="text-xs font-semibold text-slate-400 transition hover:text-rose-500"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
