"use client";

// Phase 4 (final feature): the concept visualizer. The student names a
// concept; the AI maps the ideas around it (prerequisites, examples,
// pitfalls, practice) grounded in the course's shared materials, and we
// render the graph as an SVG concept map. Without an API key the server
// returns the deterministic offline study map instead - the page renders
// both the same way.
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, errorMessage } from "@/lib/trpc";
import { PageHeader } from "@/components/ui";
import {
  CONCEPT_NODE_KIND_LABELS,
  type ConceptMap,
  type ConceptMapNode,
  type ConceptNodeKind,
} from "@coursemind/core";

type Course = Awaited<ReturnType<typeof api.course.listMine.query>>[number];
type Result = Awaited<ReturnType<typeof api.visualizer.generate.mutate>>;

// Colors per node kind (Tailwind palette hexes - SVG needs literal values).
const KIND_STYLE: Record<ConceptNodeKind, { fill: string; stroke: string; text: string }> = {
  core: { fill: "#2563eb", stroke: "#1d4ed8", text: "#ffffff" },
  concept: { fill: "#eff6ff", stroke: "#bfdbfe", text: "#1e3a5f" },
  example: { fill: "#ecfdf5", stroke: "#a7f3d0", text: "#065f46" },
  pitfall: { fill: "#fff1f2", stroke: "#fecdd3", text: "#9f1239" },
  practice: { fill: "#fffbeb", stroke: "#fde68a", text: "#92400e" },
};

const VIEW_W = 900;
const VIEW_H = 560;
const NODE_W = 168;
const NODE_H = 48;

/** Break a label into at most two centered lines that fit the node box. */
function wrapLabel(label: string): string[] {
  const MAX = 21;
  if (label.length <= MAX) return [label];
  const words = label.split(" ");
  let first = "";
  let i = 0;
  while (i < words.length && (first + " " + words[i]).trim().length <= MAX) {
    first = (first + " " + words[i]).trim();
    i++;
  }
  if (!first) {
    // One giant word - hard split.
    return [label.slice(0, MAX), label.slice(MAX, MAX * 2 - 3) + (label.length > MAX * 2 - 3 ? "..." : "")];
  }
  let second = words.slice(i).join(" ");
  if (second.length > MAX) second = second.slice(0, MAX - 3) + "...";
  return second ? [first, second] : [first];
}

/** Radial layout: core in the middle, everything else on an ellipse. */
function layoutNodes(nodes: ConceptMapNode[]): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>();
  const cx = VIEW_W / 2;
  const cy = VIEW_H / 2;
  const core = nodes.find((n) => n.kind === "core") ?? nodes[0];
  const rest = nodes.filter((n) => n !== core);
  pos.set(core.id, { x: cx, y: cy });
  const rx = VIEW_W / 2 - NODE_W / 2 - 16;
  const ry = VIEW_H / 2 - NODE_H / 2 - 24;
  rest.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / rest.length - Math.PI / 2;
    pos.set(n.id, { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
  });
  return pos;
}

function ConceptMapSvg({ map, onSelect, selectedId }: {
  map: ConceptMap;
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  const pos = layoutNodes(map.nodes);
  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="h-auto w-full"
      role="img"
      aria-label="Concept map"
    >
      {/* Edges first so nodes draw on top. */}
      {map.edges.map((e, i) => {
        const a = pos.get(e.from);
        const b = pos.get(e.to);
        if (!a || !b) return null;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        return (
          <g key={`e${i}`}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#cbd5e1" strokeWidth={1.5} />
            {e.label && (
              <text
                x={mx}
                y={my - 4}
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                fill="#64748b"
                stroke="#f8fafc"
                strokeWidth={4}
                paintOrder="stroke"
              >
                {e.label}
              </text>
            )}
          </g>
        );
      })}
      {map.nodes.map((n) => {
        const p = pos.get(n.id);
        if (!p) return null;
        const style = KIND_STYLE[n.kind];
        const lines = wrapLabel(n.label);
        const selected = n.id === selectedId;
        return (
          <g
            key={n.id}
            onClick={() => onSelect(n.id)}
            className="cursor-pointer"
            role="button"
            aria-label={n.label}
          >
            <rect
              x={p.x - NODE_W / 2}
              y={p.y - NODE_H / 2}
              width={NODE_W}
              height={NODE_H}
              rx={12}
              fill={style.fill}
              stroke={selected ? "#1d1d1f" : style.stroke}
              strokeWidth={selected ? 2.5 : 1.5}
            />
            {lines.map((line, li) => (
              <text
                key={li}
                x={p.x}
                y={p.y + (lines.length === 1 ? 4 : li === 0 ? -3 : 12)}
                textAnchor="middle"
                fontSize={12.5}
                fontWeight={650}
                fill={style.text}
              >
                {line}
              </text>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function VisualizerInner() {
  const searchParams = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState<string>(searchParams.get("courseId") ?? "");
  const [concept, setConcept] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const mine = await api.course.listMine.query();
        setCourses(mine);
        setCourseId((current) => current || (mine[0]?.id ?? ""));
      } catch (err) {
        setError(errorMessage(err));
      }
    })();
  }, []);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = concept.trim();
    if (!trimmed || !courseId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.visualizer.generate.mutate({ courseId, concept: trimmed });
      setResult(res);
      setSelectedId(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const selected = result?.map.nodes.find((n) => n.id === selectedId) ?? null;

  return (
    <div>
      <PageHeader
        title="Concept visualizer"
        subtitle="Name a concept - get a map of the ideas around it, grounded in your class materials."
        action={
          <Link href="/courses" className="btn-secondary">
            Browse courses
          </Link>
        }
      />

      <form onSubmit={generate} className="card grid gap-4 lg:grid-cols-[1fr_1.2fr_auto] lg:items-end">
        <div>
          <label className="label">Course</label>
          <select className="input" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            {courses.length === 0 && <option value="">Join a course first</option>}
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} - {c.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Concept</label>
          <input
            className="input"
            placeholder="Example: hash table collisions, Bayes' theorem, TCP handshake..."
            maxLength={120}
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary" disabled={busy || !concept.trim() || !courseId}>
          {busy ? "Mapping..." : "Map it"}
        </button>
      </form>

      {error && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}

      {busy && !result && (
        <p className="mt-8 py-8 text-center text-sm font-medium text-slate-400">
          Reading your class materials and laying out the map...
        </p>
      )}

      {result && (
        <div className="mt-8 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            {result.aiGenerated ? (
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">
                AI map - grounded in your class materials
              </span>
            ) : (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">
                Offline study map (AI not configured)
              </span>
            )}
            {(Object.keys(KIND_STYLE) as ConceptNodeKind[]).map((kind) => (
              <span key={kind} className="inline-flex items-center gap-1.5 rounded-full bg-white/75 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: kind === "core" ? KIND_STYLE.core.fill : KIND_STYLE[kind].stroke }}
                />
                {CONCEPT_NODE_KIND_LABELS[kind]}
              </span>
            ))}
          </div>

          {result.notice && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800">
              {result.notice}
            </p>
          )}

          {result.map.summary && (
            <p className="surface-panel px-5 py-4 text-sm font-medium leading-relaxed text-slate-600">
              {result.map.summary}
            </p>
          )}

          <div className="surface-panel overflow-hidden p-3 sm:p-5">
            <ConceptMapSvg
              map={result.map}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId((cur) => (cur === id ? null : id))}
            />
          </div>

          {selected ? (
            <div className="card">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">
                {CONCEPT_NODE_KIND_LABELS[selected.kind]}
              </p>
              <p className="mt-1 font-display text-lg font-semibold text-ink">{selected.label}</p>
              {selected.summary && (
                <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">{selected.summary}</p>
              )}
            </div>
          ) : (
            <p className="text-center text-xs font-medium text-slate-400">
              Click any node to read its one-line explanation.
            </p>
          )}

          <div className="surface-panel divide-y divide-slate-100/80 overflow-hidden">
            {result.map.nodes.map((n) => (
              <button
                key={n.id}
                onClick={() => setSelectedId((cur) => (cur === n.id ? null : n.id))}
                className={`flex w-full items-start gap-3 px-5 py-3 text-left transition hover:bg-white/70 ${
                  n.id === selectedId ? "bg-white/80" : ""
                }`}
              >
                <span
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: n.kind === "core" ? KIND_STYLE.core.fill : KIND_STYLE[n.kind].stroke }}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{n.label}</span>
                  {n.summary && <span className="block text-xs font-medium leading-relaxed text-slate-500">{n.summary}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!result && !busy && (
        <div className="card mt-8 text-sm font-medium leading-relaxed text-slate-500">
          <p className="font-semibold text-ink">How it works</p>
          <p className="mt-2">
            Pick a course, type any concept from it, and the visualizer draws a map: the concept in the middle,
            connected to the prerequisites it builds on, concrete examples, the classic mistakes, and one way to
            practice it. Everything is grounded in the materials your class has shared - so the map speaks your
            professor&apos;s language.
          </p>
        </div>
      )}
    </div>
  );
}

export default function VisualizerPage() {
  return (
    <Suspense>
      <VisualizerInner />
    </Suspense>
  );
}
