import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../src/api";
import { ENVELOPE_MS, useEnvelope } from "../src/hooks/useEnvelope";
import type { LoadStatus } from "../src/hooks/usePublishedInvitation";
import { useViewBeacon } from "../src/hooks/useViewBeacon";

// vite.config.ts sets globals: false, so RTL never auto-cleans.
afterEach(cleanup);
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query }));
});

describe("useEnvelope (adr-019 §5.1)", () => {
  it("shows on a first open once the invitation is ready", () => {
    const { result, rerender } = renderHook(({ status }) => useEnvelope("abc123", status), {
      initialProps: { status: "loading" as LoadStatus },
    });
    expect(result.current.phase).toBe("none");

    rerender({ status: "ready" });
    expect(result.current.phase).toBe("closed");
  });

  it("stays shut for a returning guest", () => {
    localStorage.setItem("inv-viewed:abc123", new Date().toISOString());
    const { result } = renderHook(() => useEnvelope("abc123", "ready"));
    expect(result.current.phase).toBe("none");
  });

  // The beacon writes the flag on ready. Re-reading it would close the
  // envelope during the very open it exists for.
  it("keeps the first-open decision when the beacon writes the flag", () => {
    vi.spyOn(api, "recordInvitationView").mockImplementation(() => {});
    const { result, rerender } = renderHook(
      ({ status }) => {
        useViewBeacon("abc123", status);
        return useEnvelope("abc123", status);
      },
      { initialProps: { status: "loading" as LoadStatus } },
    );

    rerender({ status: "ready" });
    expect(localStorage.getItem("inv-viewed:abc123")).not.toBeNull();
    rerender({ status: "ready" });
    expect(result.current.phase).toBe("closed");
  });

  it("never shows under reduced motion", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce"),
      media: query,
    }));
    const { result } = renderHook(() => useEnvelope("abc123", "ready"));
    expect(result.current.phase).toBe("none");
  });

  it("opens, then is gone within the 1.2 s budget", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useEnvelope("abc123", "ready"));

    act(() => result.current.open());
    expect(result.current.phase).toBe("opening");

    act(() => vi.advanceTimersByTime(ENVELOPE_MS));
    expect(result.current.phase).toBe("none");
    expect(ENVELOPE_MS).toBeLessThanOrEqual(1200);
  });

  it("ignores a second tap while it is already opening", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useEnvelope("abc123", "ready"));

    act(() => result.current.open());
    act(() => vi.advanceTimersByTime(ENVELOPE_MS - 100));
    act(() => result.current.open());
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.phase).toBe("none");
  });

  it("shows every time when storage is blocked, which is skippable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(() => useEnvelope("abc123", "ready"));
    expect(result.current.phase).toBe("closed");
  });

  it("behaves as no preference where matchMedia is missing", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => useEnvelope("abc123", "ready"));
    expect(result.current.phase).toBe("closed");
  });
});
