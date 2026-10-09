// Concept visualizer (Phase 4, final feature). Turns "explain X" into a
// CONCEPT MAP: a small graph of the ideas around a concept - prerequisites,
// related ideas, worked-example territory, and common pitfalls - grounded
// in the course's shared materials when the AI is configured.
//
// Like the study planner, the feature stays honest without an API key:
// buildFallbackConceptMap produces a deterministic "study map" that points
// the student at the class materials and a practice loop instead of
// pretending to know the concept's internals.
import { z } from "zod";

// Node kinds drive the color legend in the UI and tell the model what
// belongs on the map.
export const CONCEPT_NODE_KINDS = ["core", "concept", "example", "pitfall", "practice"] as const;
export type ConceptNodeKind = (typeof CONCEPT_NODE_KINDS)[number];

export const CONCEPT_NODE_KIND_LABELS: Record<ConceptNodeKind, string> = {
  core: "The concept",
  concept: "Related idea",
  example: "Example / application",
  pitfall: "Common pitfall",
  practice: "How to practice",
};

export const ConceptMapNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(80),
  summary: z.string().max(400).default(""),
  kind: z.enum(CONCEPT_NODE_KINDS).default("concept"),
});
export type ConceptMapNode = z.infer<typeof ConceptMapNodeSchema>;

export const ConceptMapEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().max(40).default(""),
});
export type ConceptMapEdge = z.infer<typeof ConceptMapEdgeSchema>;

export const ConceptMapSchema = z.object({
  summary: z.string().max(1000).default(""),
  nodes: z.array(ConceptMapNodeSchema).min(1).max(16),
  edges: z.array(ConceptMapEdgeSchema).max(40),
});
export type ConceptMap = z.infer<typeof ConceptMapSchema>;

/** Drop duplicate node ids and edges that point at nodes that don't exist -
 *  LLM output is validated but graphs can still be internally inconsistent. */
export function normalizeConceptMap(map: ConceptMap): ConceptMap {
  const seen = new Set<string>();
  const nodes = map.nodes.filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });
  const ids = new Set(nodes.map((n) => n.id));
  const edges = map.edges.filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to);
  return { summary: map.summary, nodes, edges };
}

const FALLBACK_MATERIAL_LIMIT = 5;

/** Keyless fallback: a deterministic STUDY map - where the concept lives in
 *  the class materials plus a practice loop. Never invents facts about the
 *  concept itself. */
export function buildFallbackConceptMap(opts: {
  concept: string;
  materialTitles: string[];
}): ConceptMap {
  const concept = opts.concept.trim();
  const nodes: ConceptMapNode[] = [
    { id: "core", label: concept, summary: "", kind: "core" },
  ];
  const edges: ConceptMapEdge[] = [];

  opts.materialTitles.slice(0, FALLBACK_MATERIAL_LIMIT).forEach((title, i) => {
    const id = `mat${i + 1}`;
    nodes.push({
      id,
      label: title.length > 60 ? `${title.slice(0, 57)}...` : title,
      summary: `Shared class material - skim it for "${concept}".`,
      kind: "concept",
    });
    edges.push({ from: "core", to: id, label: "look in" });
  });

  const loop: Array<[string, string, string]> = [
    ["p1", "Define it in your own words", "Write one plain-English sentence without peeking at the notes."],
    ["p2", "Work one example", "Pick a practice problem that uses it and solve it end to end."],
    ["p3", "Explain it to a classmate", "Post it in the group chat - teaching it is the fastest test of understanding."],
  ];
  for (const [id, label, summary] of loop) {
    nodes.push({ id, label, summary, kind: "practice" });
  }
  edges.push({ from: "core", to: "p1", label: "start" });
  edges.push({ from: "p1", to: "p2", label: "then" });
  edges.push({ from: "p2", to: "p3", label: "then" });

  return {
    summary: `An offline study map for "${concept}". Connect the AI (add an Anthropic API key) to get a real concept breakdown - prerequisites, examples, and pitfalls grounded in your class materials.`,
    nodes,
    edges,
  };
}
