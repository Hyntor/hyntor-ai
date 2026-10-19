# 0004 Retrieval: keyword matching over chunks

**Status:** Proposed · **Issue:** #5

## Context

The tutor grounds answers in a course's materials and cites the chunks it used. Retrieval has to run on both
SQLite and PostgreSQL (ADR-0002) and be explainable in the oral defense.

## Decision

- Materials are split into ordered `MaterialChunk` rows at extraction time.
- Retrieval scores chunks by keyword overlap with the question (normalized, lowercased terms from
  `packages/core`) and returns the top N chunks of the course's indexed, non-removed materials.
- **No embeddings and no pgvector in this release.**

## Alternatives

- **Vector search (pgvector, a hosted vector DB)**: better recall on paraphrased questions, but it needs
  PostgreSQL in dev, an embedding call per chunk (quota, and CI would need a fake), and one more store to keep
  consistent with removals.
- **PostgreSQL full-text search**: good ranking, but it does not exist on SQLite.

## Consequences

- Paraphrased questions with no shared terms retrieve poorly; the tutor then marks its answer as beyond the
  materials.
- The scoring function is pure code in `packages/core` and is unit-tested without a database.
