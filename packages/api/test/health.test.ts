import { describe, expect, it } from "vitest";

import { createCaller, createContext } from "../src";

describe("health.check", () => {
  it("reports ok with the server time", async () => {
    const caller = createCaller(createContext({ headers: new Headers() }));

    const result = await caller.health.check();

    expect(result.status).toBe("ok");
    expect(result.serverTime).toBeInstanceOf(Date);
  });
});
