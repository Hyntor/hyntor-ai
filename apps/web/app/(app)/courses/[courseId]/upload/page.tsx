"use client";

// Material upload: file extraction or pasted text into the shared library.
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/trpc";
import { PageHeader } from "@/components/ui";

export default function UploadPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const router = useRouter();
  const [tab, setTab] = useState<"file" | "text">("file");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [type, setType] = useState("NOTES");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function handleFileUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("courseId", courseId);
      form.append("title", title);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      if (data.warning) {
        setWarning(data.warning);
        setBusy(false);
      } else {
        router.push(`/courses/${courseId}`);
        router.refresh();
      }
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  async function handleTextUpload(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (type === "SYLLABUS") {
        await api.study.importSyllabus.mutate({
          courseId,
          title,
          text,
        });
        router.push(`/courses/${courseId}/study`);
      } else {
        await api.material.createFromText.mutate({
          courseId,
          title,
          text,
          type: type as "NOTES" | "TEXT",
        });
        router.push(`/courses/${courseId}`);
      }
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (warning) {
    return (
      <div>
        <PageHeader title="Uploaded with a catch" />
        <div className="card max-w-2xl">
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            {warning}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="btn-primary" onClick={() => router.push(`/courses/${courseId}`)}>
              Back to course
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setWarning(null);
                setTab("text");
              }}
            >
              Paste the text instead
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Upload course material"
        subtitle="PDF, PPTX, DOCX, TXT, or MD. Extracted text is shared with the course library so the tutor can ground answers in it."
      />
      <div className="grid gap-6 lg:grid-cols-[0.95fr_0.55fr]">
        <div className="card">
          <div className="mb-6 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              className={tab === "file" ? "btn-primary" : "btn-secondary"}
              onClick={() => setTab("file")}
            >
              Upload file
            </button>
            <button
              type="button"
              className={tab === "text" ? "btn-primary" : "btn-secondary"}
              onClick={() => setTab("text")}
            >
              Paste text
            </button>
          </div>

          {tab === "file" ? (
            <form onSubmit={handleFileUpload} className="space-y-4">
              <div>
                <label className="label">Title (optional)</label>
                <input
                  className="input"
                  placeholder="Lecture 12 - Graph Traversal"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="label">File (max 25 MB)</label>
                <input
                  type="file"
                  required
                  accept=".pdf,.docx,.pptx,.txt,.md"
                  className="input"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
              <button type="submit" disabled={busy || !file} className="btn-primary">
                {busy ? "Uploading and extracting..." : "Upload to shared library"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleTextUpload} className="space-y-4">
              <div>
                <label className="label">Title</label>
                <input
                  className="input"
                  required
                  placeholder="My week 5 notes"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Type</label>
                <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="NOTES">Notes</option>
                  <option value="SYLLABUS">Syllabus</option>
                  <option value="TEXT">Other text</option>
                </select>
              </div>
              <div>
                <label className="label">Content</label>
                <textarea
                  className="input font-mono text-xs"
                  rows={12}
                  required
                  placeholder="Paste your notes, syllabus, or any study text here..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </div>
              {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
              <button type="submit" disabled={busy} className="btn-primary">
                {busy ? "Saving..." : type === "SYLLABUS" ? "Add syllabus and build plan" : "Add to shared library"}
              </button>
            </form>
          )}
        </div>

        <aside className="surface-panel h-fit p-6">
          <p className="eyebrow">Shared library</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-ink">Every useful upload improves the tutor.</h2>
          <p className="mt-4 text-sm font-medium leading-relaxed text-slate-500">
            Slides, notes, syllabi, homework descriptions, and practice tests give the AI better context for everyone in the course.
          </p>
        </aside>
      </div>
    </div>
  );
}
