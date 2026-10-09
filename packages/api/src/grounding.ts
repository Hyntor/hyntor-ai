// Shared grounding gatherer: a course's extracted materials, best
// (most-upvoted) first, sliced to fit the context budget. Used by the
// private tutor chat AND the discussion-board tutor.
import {
  MAX_GROUNDING_CHARS,
  MAX_CHARS_PER_MATERIAL,
  type GroundingMaterial,
} from "@coursemind/core";
import type { PrismaClient } from "@coursemind/db";

export async function gatherGrounding(
  prisma: PrismaClient,
  courseId: string
): Promise<GroundingMaterial[]> {
  const materials = await prisma.material.findMany({
    where: { courseId, NOT: { extractedText: "" } },
    orderBy: [{ upvoteCount: "desc" }, { createdAt: "desc" }],
    select: { title: true, extractedText: true },
  });
  const grounding: GroundingMaterial[] = [];
  let budget = MAX_GROUNDING_CHARS;
  for (const m of materials) {
    if (budget <= 0) break;
    const text = m.extractedText.slice(0, Math.min(MAX_CHARS_PER_MATERIAL, budget));
    grounding.push({ title: m.title, text });
    budget -= text.length;
  }
  return grounding;
}
