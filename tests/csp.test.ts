import { describe, expect, it } from "vitest";
import { buildCsp } from "@/lib/csp";

const directives = (policy: string) => Object.fromEntries(policy.split("; ").map((d) => [d.split(" ")[0], d.split(" ").slice(1)]));

describe("Content-Security-Policy", () => {
  const prod = directives(buildCsp());

  it("allows no third-party origin anywhere", () => {
    for (const [name, values] of Object.entries(prod)) {
      expect(values.filter((v) => /^(https?:)?\/\//.test(v) || /\*/.test(v)), name).toEqual([]);
    }
  });

  it("forbids plugins, framing, foreign form targets and a rewritten base URL", () => {
    expect(prod["default-src"]).toEqual(["'self'"]);
    expect(prod["object-src"]).toEqual(["'none'"]);
    expect(prod["frame-ancestors"]).toEqual(["'none'"]);
    expect(prod["form-action"]).toEqual(["'self'"]);
    expect(prod["base-uri"]).toEqual(["'self'"]);
    expect(prod["connect-src"]).toEqual(["'self'"]);
  });

  it("never allows eval in production, only in development", () => {
    expect(prod["script-src"]).not.toContain("'unsafe-eval'");
    expect(directives(buildCsp({ dev: true }))["script-src"]).toContain("'unsafe-eval'");
    expect(directives(buildCsp({ dev: true }))["connect-src"]).toContain("ws:");
  });

  it("only upgrades insecure requests when asked (localhost over HTTP must keep working)", () => {
    expect(buildCsp()).not.toContain("upgrade-insecure-requests");
    expect(buildCsp({ upgradeInsecure: true })).toContain("upgrade-insecure-requests");
  });

  it("can be tightened by dropping inline scripts", () => {
    expect(directives(buildCsp({ inlineScripts: false }))["script-src"]).toEqual(["'self'"]);
  });
});
