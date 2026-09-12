import { cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { useGallerySample } from "../src/hooks/useGallerySample";

// vite.config.ts sets globals: false, so RTL never auto-cleans.
afterEach(cleanup);

function wrapper(initial: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>
  );
}

describe("useGallerySample", () => {
  it("resolves a known sample and takes it out of the address bar", () => {
    const { result } = renderHook(
      () => ({ sample: useGallerySample("uk"), location: useLocation() }),
      { wrapper: wrapper("/create?sample=wedding-romantic") },
    );

    expect(result.current.sample?.example.id).toBe("wedding-romantic");
    expect(result.current.sample?.occasion).toBe("wedding");
    // The rule the whole of adr-017 §3 rests on.
    expect(result.current.sample?.example.brief.date).toBeNull();
    expect(result.current.location.search).toBe("");
    expect(result.current.location.pathname).toBe("/create");
  });

  it("keeps the sample after the parameter is gone", () => {
    const { result, rerender } = renderHook(
      () => ({ sample: useGallerySample("uk"), location: useLocation() }),
      { wrapper: wrapper("/create?sample=wedding-formal") },
    );

    rerender();
    rerender();
    expect(result.current.location.search).toBe("");
    expect(result.current.sample?.example.id).toBe("wedding-formal");
  });

  it("resolves the sample in the language asked for", () => {
    const { result } = renderHook(() => useGallerySample("en"), {
      wrapper: wrapper("/create?sample=wedding-romantic"),
    });
    expect(result.current?.example.copy.title).toBe("We're getting married!");
  });

  it("is null with no parameter", () => {
    const { result } = renderHook(() => useGallerySample("uk"), {
      wrapper: wrapper("/create"),
    });
    expect(result.current).toBeNull();
  });

  // A hint from a link, not a credential: an unrecognised value simply means
  // the editor opens empty.
  it("is null for an unknown sample rather than throwing", () => {
    const { result } = renderHook(() => useGallerySample("uk"), {
      wrapper: wrapper("/create?sample=nope"),
    });
    expect(result.current).toBeNull();
  });

  it("strips only sample, leaving any other query parameters", () => {
    const { result } = renderHook(
      () => ({ sample: useGallerySample("uk"), location: useLocation() }),
      { wrapper: wrapper("/create?ref=guest&sample=wedding-formal&keep=1") },
    );

    expect(result.current.sample?.example.id).toBe("wedding-formal");
    expect(result.current.location.search).toBe("?ref=guest&keep=1");
  });
});
