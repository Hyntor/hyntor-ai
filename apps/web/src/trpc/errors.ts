const CODE: Record<DomainErrorKind, TRPC_ERROR_CODE_KEY> = {
  unauthenticated: "UNAUTHORIZED", forbidden: "FORBIDDEN", not_found: "NOT_FOUND",
  conflict: "CONFLICT", invalid: "BAD_REQUEST", rate_limited: "TOO_MANY_REQUESTS",
};

export function mapError(e: TRPCError): TRPCError {
  const cause = e.cause;
  if (cause instanceof DomainError)
    return new TRPCError({ code: CODE[cause.kind], message: cause.publicMessage, cause });
  if (e.code !== "INTERNAL_SERVER_ERROR") return e; // which is already a deliberate tRPC error
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Internal server error", cause });
}
