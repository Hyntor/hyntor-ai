export type DomainErrorKind =
  | "unauthenticated" | "forbidden" | "not_found"
  | "conflict" | "invalid" | "rate_limited";

export class DomainError extends Error {
  constructor(
    public readonly kind: DomainErrorKind,
    public readonly publicMessage: string, // this is the only text the user sees.
    options?: { cause?: unknown },
  ) {
    super(publicMessage, options);
  }
}
export const notFound = (what = "Resource") => new DomainError("not_found", `${what} not found`);
export const forbidden = (msg = "Not allowed") => new DomainError("forbidden", msg);

