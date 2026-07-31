import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../src/api";
import { useHostInvitationCounts } from "../src/hooks/useHostInvitationCounts";
import { forgetHeldManageTokens, manageSeenKey, manageTokenKey } from "../src/manageTokens";
import type { CountsResult } from "../src/types";

const ok = (id: string, yes: number, newSince = 0): CountsResult => ({
  id,
  status: "ok",
  counts: { yes, no: 0, guests: yes },
  new_since: newSince,
});

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  forgetHeldManageTokens();
});

describe("useHostInvitationCounts", () => {
  it("asks only about rows that have a token, and keys results by id", async () => {
    localStorage.setItem(manageTokenKey("aaa111"), "t1");
    localStorage.setItem(manageSeenKey("aaa111"), "2026-07-01T00:00:00.000Z");
    localStorage.setItem(manageTokenKey("bbb222"), "t2");
    // "ccc333" has no token — it must not be in the request.

    const fetchCounts = vi
      .spyOn(api, "fetchCounts")
      .mockResolvedValue([ok("aaa111", 3, 2), ok("bbb222", 0)]);

    const { result } = renderHook(() => useHostInvitationCounts(["aaa111", "bbb222", "ccc333"]));

    await waitFor(() => expect(result.current.size).toBe(2));

    expect(fetchCounts).toHaveBeenCalledWith([
      { id: "aaa111", token: "t1", seen_at: "2026-07-01T00:00:00.000Z" },
      { id: "bbb222", token: "t2" },
    ]);
    expect(result.current.get("aaa111")).toEqual(ok("aaa111", 3, 2));
    expect(result.current.get("bbb222")).toEqual(ok("bbb222", 0));
    expect(result.current.has("ccc333")).toBe(false);
  });

  it("never fires a request when no row has a token", async () => {
    const fetchCounts = vi.spyOn(api, "fetchCounts").mockResolvedValue([]);
    const { result } = renderHook(() => useHostInvitationCounts(["aaa111", "bbb222"]));
    expect(fetchCounts).not.toHaveBeenCalled();
    expect(result.current.size).toBe(0);
  });

  it("never advances the seen marker — reading the list is not a visit", async () => {
    const seen = "2026-07-01T00:00:00.000Z";
    localStorage.setItem(manageTokenKey("aaa111"), "t1");
    localStorage.setItem(manageSeenKey("aaa111"), seen);
    vi.spyOn(api, "fetchCounts").mockResolvedValue([ok("aaa111", 1, 0)]);

    const { result } = renderHook(() => useHostInvitationCounts(["aaa111"]));
    await waitFor(() => expect(result.current.size).toBe(1));

    // Unlike the dashboard, the marker the request carried is left untouched.
    expect(localStorage.getItem(manageSeenKey("aaa111"))).toBe(seen);
  });

  it("fails silently — an empty map, never a thrown error", async () => {
    localStorage.setItem(manageTokenKey("aaa111"), "t1");
    vi.spyOn(api, "fetchCounts").mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useHostInvitationCounts(["aaa111"]));
    // Give the rejected promise a tick to settle; the map stays empty.
    await Promise.resolve();
    expect(result.current.size).toBe(0);
  });

  it("does not refetch when the parent re-passes an equal id list", async () => {
    localStorage.setItem(manageTokenKey("aaa111"), "t1");
    const fetchCounts = vi.spyOn(api, "fetchCounts").mockResolvedValue([ok("aaa111", 1)]);

    const { rerender } = renderHook(({ ids }) => useHostInvitationCounts(ids), {
      initialProps: { ids: ["aaa111"] },
    });
    // A fresh array with the same contents, as a re-rendering parent would pass.
    rerender({ ids: ["aaa111"] });

    await waitFor(() => expect(fetchCounts).toHaveBeenCalledTimes(1));
  });
});
