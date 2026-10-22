export const Events = {
  extractionFailed: "extraction.failed",
  injectionSuspected: "security.injection_suspected",
} as const;
ctx.log.warn({ event: Events.injectionSuspected, docId, detector: "regex-v1" }, "suspected prompt injection");
