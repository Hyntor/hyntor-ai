# 0005 File storage: local disk in dev, blob storage in prod

**Status:** Proposed, amended by [0010](0010-stack-python-django.md) · **Issue:** #5

## Context

Uploaded PDF, DOCX and PPTX files have to live somewhere other than the database. Serverless hosting
(ADR-0008) has no persistent disk.

## Decision

- One interface, `FileStore` (`put`, `get`, `delete` by `storageKey`).
- `LocalFileStore` writes under `STORAGE_DIR` (default `.storage/`, git-ignored) in dev and tests.
- `BlobFileStore` uses `@vercel/blob` (Apache-2.0, checked on npm 2026-10-19) in production.
- `storageKey` = `materials/<courseId>/<sha256>.<ext>`: content-addressed, so the same file in the same course
  maps to the same key, matching the `(courseId, sha256)` unique constraint.

## Alternatives

- **Files in the database (bytea / blob)**: no extra service, but the database grows quickly and SQLite and
  PostgreSQL handle large binaries differently.
- **S3**: equivalent, but one more account and IAM setup; Vercel Blob is provisioned with the host.

## Consequences

- Deleting a material's row does not delete its file; removal is a soft delete (`removedAt`), so files stay.
- `npm run db:reset` also clears `STORAGE_DIR`.
