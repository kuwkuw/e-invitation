import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../src/api";
import { usePublishedInvitation } from "../src/hooks/usePublishedInvitation";
import type { PublishedInvitation } from "../src/types";

const published = { id: "abc123", version: 1 } as PublishedInvitation;

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("usePublishedInvitation", () => {
  it("loads the snapshot for a well-formed id", async () => {
    const fetchInvitation = vi.spyOn(api, "fetchInvitation").mockResolvedValue(published);

    const { result } = renderHook(() => usePublishedInvitation("abc123"));

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.published).toEqual(published);
    expect(fetchInvitation).toHaveBeenCalledWith("abc123");
  });

  it("treats a malformed id as a dead link without asking the server", async () => {
    const fetchInvitation = vi.spyOn(api, "fetchInvitation");

    for (const id of ["", "abc", "a".repeat(33), "../../etc/passwd", "abc 123"]) {
      const { result } = renderHook(() => usePublishedInvitation(id));
      // Never "loading": there is no request to wait for, so a spinner would
      // be a lie (adr-011 §3).
      expect(result.current.status).toBe("not_found");
    }
    expect(fetchInvitation).not.toHaveBeenCalled();
  });
});
