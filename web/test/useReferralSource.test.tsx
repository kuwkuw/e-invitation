import { cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { sourceFromSearch, useReferralSource } from "../src/hooks/useReferralSource";

// vite.config.ts sets globals: false, so RTL never auto-cleans.
afterEach(cleanup);

function wrapper(initial: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>
  );
}

describe("sourceFromSearch", () => {
  it("recognizes only the value the CTA writes", () => {
    expect(sourceFromSearch("?ref=guest")).toBe("guest");
    expect(sourceFromSearch("?a=1&ref=guest&b=2")).toBe("guest");
    expect(sourceFromSearch("")).toBe("direct");
    expect(sourceFromSearch("?ref=")).toBe("direct");
    // A hint, not a credential — anything unexpected is simply not a referral.
    expect(sourceFromSearch("?ref=twitter")).toBe("direct");
    expect(sourceFromSearch("?ref=GUEST")).toBe("direct");
  });
});

describe("useReferralSource", () => {
  it("reads the referral and takes it out of the address bar", () => {
    const { result } = renderHook(
      () => ({ source: useReferralSource(), location: useLocation() }),
      { wrapper: wrapper("/create?ref=guest") },
    );

    expect(result.current.source).toBe("guest");
    expect(result.current.location.search).toBe("");
    expect(result.current.location.pathname).toBe("/create");
  });

  it("keeps the source after the parameter is gone", () => {
    const { result, rerender } = renderHook(
      () => ({ source: useReferralSource(), location: useLocation() }),
      { wrapper: wrapper("/create?ref=guest") },
    );

    // The generate call this labels can be several chat turns later, long
    // after the strip — the value has to survive re-renders, not be re-read.
    rerender();
    rerender();
    expect(result.current.location.search).toBe("");
    expect(result.current.source).toBe("guest");
  });

  it("leaves a direct visit alone", () => {
    const { result } = renderHook(
      () => ({ source: useReferralSource(), location: useLocation() }),
      { wrapper: wrapper("/create") },
    );

    expect(result.current.source).toBe("direct");
    expect(result.current.location.search).toBe("");
  });

  it("strips only ref, leaving any other query parameters", () => {
    const { result } = renderHook(
      () => ({ source: useReferralSource(), location: useLocation() }),
      { wrapper: wrapper("/create?keep=1&ref=guest&also=2") },
    );

    expect(result.current.source).toBe("guest");
    expect(result.current.location.search).toBe("?keep=1&also=2");
  });
});
