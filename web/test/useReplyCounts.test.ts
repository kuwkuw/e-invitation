import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../src/api";
import { useReplyCounts } from "../src/hooks/useReplyCounts";
import type { RsvpCounts } from "../src/types";

// vite.config.ts sets globals: false, so RTL never auto-cleans.
afterEach(cleanup);
beforeEach(() => {
  vi.restoreAllMocks();
});

const TOKEN = "f".repeat(32);
const PUBLISHED = { id: "abc123xy", version: 1, manage_token: TOKEN };
const COUNTS: RsvpCounts = { yes: 7, no: 3, maybe: 2, guests: 16 };

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

/** The editor header's replies so far (adr-019 §7.2). */
describe("useReplyCounts", () => {
  it("asks for nothing before the first publish", () => {
    const fetchCounts = vi.spyOn(api, "fetchCounts").mockResolvedValue([]);
    const { result } = renderHook(() => useReplyCounts(null));
    expect(fetchCounts).not.toHaveBeenCalled();
    expect(result.current).toBeNull();
  });

  // adr-012's endpoint answers with counts only, never the RSVP list, so no
  // guest's name or note reaches the editor. No seen marker: the header is
  // not a visit to the dashboard.
  it("asks the counts endpoint for this invitation, with its token and no seen marker", async () => {
    const fetchCounts = vi
      .spyOn(api, "fetchCounts")
      .mockResolvedValue([{ id: PUBLISHED.id, status: "ok", counts: COUNTS, new_since: 0 }]);
    const fetchRsvps = vi.spyOn(api, "fetchRsvps");
    const { result } = renderHook(() => useReplyCounts(PUBLISHED));
    await waitFor(() => expect(result.current).toEqual(COUNTS));
    expect(fetchCounts).toHaveBeenCalledWith([{ id: PUBLISHED.id, token: TOKEN }]);
    expect(fetchRsvps).not.toHaveBeenCalled();
  });

  // adr-010 §6's rule: no timer. A republish, and coming back to the tab after
  // sharing the link in a messenger, are when the numbers can have moved.
  it("asks again after a republish, and when the tab comes back", async () => {
    const fetchCounts = vi
      .spyOn(api, "fetchCounts")
      .mockResolvedValue([{ id: PUBLISHED.id, status: "ok", counts: COUNTS, new_since: 0 }]);
    const { result, rerender } = renderHook(({ published }) => useReplyCounts(published), {
      initialProps: { published: PUBLISHED },
    });
    await waitFor(() => expect(result.current).toEqual(COUNTS));
    expect(fetchCounts).toHaveBeenCalledTimes(1);

    rerender({ published: { ...PUBLISHED, version: 2 } });
    await waitFor(() => expect(fetchCounts).toHaveBeenCalledTimes(2));

    act(() => setVisibility("hidden"));
    expect(fetchCounts).toHaveBeenCalledTimes(2);
    act(() => setVisibility("visible"));
    await waitFor(() => expect(fetchCounts).toHaveBeenCalledTimes(3));
  });

  // adr-012 §6: a decorative fetch fails silent.
  it("keeps quiet when the request fails", async () => {
    const fetchCounts = vi.spyOn(api, "fetchCounts").mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useReplyCounts(PUBLISHED));
    await waitFor(() => expect(fetchCounts).toHaveBeenCalled());
    await act(async () => {});
    expect(result.current).toBeNull();
  });

  it("shows nothing for a token the server refuses", async () => {
    vi.spyOn(api, "fetchCounts").mockResolvedValue([{ id: PUBLISHED.id, status: "forbidden" }]);
    const { result } = renderHook(() => useReplyCounts(PUBLISHED));
    await act(async () => {});
    expect(result.current).toBeNull();
  });
});
