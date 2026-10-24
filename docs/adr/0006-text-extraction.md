# 0006 Text extraction libraries

**Status:** Proposed, amended by [0010](0010-stack-python-django.md) · **Issue:** #5

## Context

The pipeline diagram names Apache Tika, pypdf and python-docx, which are Java and Python. The rest of the
system is TypeScript on Node (ADR-0001).

## Decision

Extract in-process with TypeScript-compatible libraries. Each was checked on npm on 2026-10-19 (exists, latest
version, license, published within the last month):

| Format | Library                      | Version | License      |
| ------ | ---------------------------- | ------- | ------------ |
| PDF    | `unpdf`                      | 1.9.1   | MIT          |
| DOCX   | `mammoth` (`extractRawText`) | 1.13.0  | BSD-2-Clause |
| PPTX   | `officeparser`               | 8.1.1   | MIT          |

All three sit behind one `extractText(fileKind, bytes)` function, so a library can be replaced without
touching callers. All three read the seed files in `packages/db/seed/files/` (checked 2026-10-19).
`officeparser` 8 returns a document tree (`parseOffice(...).content`), not a string; the wrapper flattens its
`text` nodes.

## Alternatives

- **Tika or a Python sidecar service**: better coverage of odd files, but a second runtime to deploy, monitor
  and explain, for three formats that these libraries handle.
- **`officeparser` for all three formats**: fewer dependencies, but `unpdf` and `mammoth` are the more
  widely used choices for PDF and DOCX.

## Consequences

- Scanned PDFs (images only) extract no text; the material is marked `failed` with a clear message (no OCR in
  this release).
- Extraction runs with a size limit and a timeout so a malformed file cannot stall the server.
