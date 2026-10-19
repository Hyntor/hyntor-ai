"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/client";

/** Calls health.check over HTTP, proving the browser -> route handler -> router path works end to end. */
export function HealthStatus() {
  const trpc = useTRPC();
  const health = useQuery(trpc.health.check.queryOptions());

  return (
    <p className="mt-8 text-sm" role="status">
      API: {health.isPending && "checking..."}
      {health.isError && <span className="text-red-700">unreachable</span>}
      {health.data && (
        <span className="text-green-700">
          {health.data.status} at {health.data.serverTime.toLocaleTimeString()}
        </span>
      )}
    </p>
  );
}
