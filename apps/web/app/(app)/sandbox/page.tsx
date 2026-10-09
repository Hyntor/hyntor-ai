"use client";

// Phase 4: a safe in-browser JavaScript scratchpad. Code runs in a Web
// Worker (no DOM, no network to the app) created from a Blob URL; console
// output is captured and streamed back, and a watchdog terminates the
// worker if it runs too long - so an infinite loop can't freeze the page.
// Zero server/AI dependency: it works the same with or without an API key.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui";

const STORAGE_KEY = "hyntor.sandbox.code";
const RUN_TIMEOUT_MS = 2000;

const STARTER = `// Try things out. Use console.log to print, or end with an expression.
function fib(n) {
  let [a, b] = [0, 1];
  for (let i = 0; i < n; i++) [a, b] = [b, a + b];
  return a;
}

console.log("fib(10) =", fib(10));
[1, 2, 3, 4].map((x) => x * x);
`;

// The worker source. It overrides console.*, runs the user's code, reports
// the value of the final expression, and signals completion.
const WORKER_SRC = `
self.onmessage = (e) => {
  const fmt = (args) => args.map((a) => {
    if (typeof a === "string") return a;
    try { return JSON.stringify(a, (k, v) => (typeof v === "function" ? String(v) : v), 2); }
    catch { return String(a); }
  }).join(" ");
  ["log", "info", "warn", "error", "debug"].forEach((level) => {
    console[level] = (...args) => self.postMessage({ type: "log", level, text: fmt(args) });
  });
  try {
    const result = (0, eval)(e.data);
    if (typeof result !== "undefined") self.postMessage({ type: "log", level: "result", text: fmt([result]) });
    self.postMessage({ type: "done" });
  } catch (err) {
    self.postMessage({ type: "log", level: "error", text: String(err && err.message ? err.message : err) });
    self.postMessage({ type: "done" });
  }
};
`;

type Line = { level: string; text: string };

const LEVEL_STYLE: Record<string, string> = {
  error: "text-coral-500",
  warn: "text-amber-600",
  result: "text-brand-700",
  log: "text-slate-700",
  info: "text-slate-700",
  debug: "text-slate-400",
};

export default function SandboxPage() {
  const [code, setCode] = useState(STARTER);
  const [lines, setLines] = useState<Line[]>([]);
  const [running, setRunning] = useState(false);
  const [ran, setRan] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore the last code on mount; persist as the student types.
  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (saved !== null) setCode(saved);
  }, []);
  useEffect(() => {
    const id = setTimeout(() => window.localStorage.setItem(STORAGE_KEY, code), 300);
    return () => clearTimeout(id);
  }, [code]);

  // Tidy up any live worker/timer on unmount.
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function cleanup() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    workerRef.current?.terminate();
    workerRef.current = null;
    setRunning(false);
  }

  function run() {
    if (running) return;
    setLines([]);
    setRan(true);
    setRunning(true);

    const blob = new Blob([WORKER_SRC], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<{ type: string; level?: string; text?: string }>) => {
      const msg = e.data;
      if (msg.type === "log") {
        setLines((prev) => [...prev, { level: msg.level ?? "log", text: msg.text ?? "" }]);
      } else if (msg.type === "done") {
        cleanup();
        URL.revokeObjectURL(url);
      }
    };
    worker.onerror = (e) => {
      setLines((prev) => [...prev, { level: "error", text: e.message || "Unknown error" }]);
      cleanup();
      URL.revokeObjectURL(url);
    };

    // Watchdog: kill runaway code (e.g. while (true) {}) so the tab stays alive.
    timerRef.current = setTimeout(() => {
      setLines((prev) => [
        ...prev,
        { level: "error", text: `Stopped after ${RUN_TIMEOUT_MS / 1000}s - is there an infinite loop?` },
      ]);
      cleanup();
      URL.revokeObjectURL(url);
    }, RUN_TIMEOUT_MS);

    worker.postMessage(code);
  }

  function stop() {
    setLines((prev) => [...prev, { level: "warn", text: "Stopped." }]);
    cleanup();
  }

  return (
    <div>
      <PageHeader
        title="Code sandbox"
        subtitle="A safe JavaScript scratchpad - run snippets right here, then take what you learn to the tutor. Nothing leaves your browser."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <label className="label mb-0">JavaScript</label>
            <button
              type="button"
              onClick={() => setCode(STARTER)}
              className="text-xs font-semibold text-slate-400 transition hover:text-brand-600"
            >
              Reset example
            </button>
          </div>
          <textarea
            className="input min-h-[24rem] flex-1 resize-y font-mono text-xs leading-relaxed"
            spellCheck={false}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              // Ctrl/Cmd+Enter to run, like most editors.
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                run();
              }
            }}
          />
          <div className="mt-3 flex items-center gap-3">
            {running ? (
              <button onClick={stop} className="btn-secondary">
                Stop
              </button>
            ) : (
              <button onClick={run} className="btn-primary">
                Run
              </button>
            )}
            <span className="text-xs font-medium text-slate-400">Ctrl/Cmd + Enter</span>
          </div>
        </div>

        <div className="card flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <label className="label mb-0">Output</label>
            {lines.length > 0 && (
              <button
                type="button"
                onClick={() => setLines([])}
                className="text-xs font-semibold text-slate-400 transition hover:text-brand-600"
              >
                Clear
              </button>
            )}
          </div>
          <div className="min-h-[24rem] flex-1 overflow-auto rounded-lg bg-ink p-4 font-mono text-xs leading-relaxed">
            {!ran ? (
              <p className="text-slate-500">Press Run to execute your code.</p>
            ) : lines.length === 0 ? (
              <p className="text-slate-500">{running ? "Running..." : "No output."}</p>
            ) : (
              lines.map((line, i) => (
                <pre key={i} className={`whitespace-pre-wrap ${LEVEL_STYLE[line.level] ?? "text-slate-100"}`}>
                  {line.level === "error" ? "! " : line.level === "result" ? "= " : ""}
                  {line.text}
                </pre>
              ))
            )}
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs font-medium text-slate-400">
        Runs in a sandboxed Web Worker - no page or network access, and runaway loops are stopped
        automatically. JavaScript only for now. Stuck on the logic?{" "}
        <Link href="/code-review" className="font-semibold text-brand-600 hover:text-brand-700">
          Bring it to code review
        </Link>
        .
      </p>
    </div>
  );
}
