import { describe, expect, it } from "vitest";
import { rootTokens } from "./cssTokens";

describe("rootTokens", () => {
  it("reads top-level :root and skips nested ones in @media", () => {
    const css = `
      :root { --a: 1; }
      @media (x) { :root { --a: 2; } }
    `;
    const tokens = rootTokens(css);
    expect(tokens.get("--a")).toBe("1");
  });

  it("reads top-level :root even when it appears after a closed @media block", () => {
    const css = `
      @media (x) { :root { --a: 1; } }
      :root { --b: 2; }
    `;
    const tokens = rootTokens(css);
    expect(tokens.get("--a")).toBeUndefined();
    expect(tokens.get("--b")).toBe("2");
  });
});
