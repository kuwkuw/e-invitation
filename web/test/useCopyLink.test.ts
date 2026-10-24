import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { COPIED_MS, useCopyLink } from "../src/hooks/useCopyLink";

// vite.config.ts sets globals: false, so RTL never auto-cleans.
afterEach(cleanup);
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function stubClipboard(writeText: (text: string) => Promise<void>) {
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
}

/** The copy behind the dashboard's empty state and «Нагадати гостям»
 *  (adr-019 §8.3). */
describe("useCopyLink", () => {
  it("says copied after a write, and stops saying it two seconds later", async () => {
    vi.useFakeTimers();
    stubClipboard(async () => {});
    const { result } = renderHook(() => useCopyLink("https://invinto.app/i/abc123xy"));
    expect(result.current.copied).toBe(false);

    await act(() => result.current.copy());
    expect(result.current.copied).toBe(true);

    act(() => vi.advanceTimersByTime(COPIED_MS));
    expect(result.current.copied).toBe(false);
  });

  // A webview that blocks the clipboard rejects the write. That must not
  // surface as an unhandled rejection, nor claim a copy that didn't happen.
  it("stays quiet, and claims nothing, when the clipboard refuses", async () => {
    stubClipboard(async () => {
      throw new DOMException("denied", "NotAllowedError");
    });
    const { result } = renderHook(() => useCopyLink("https://invinto.app/i/abc123xy"));

    await act(() => result.current.copy());
    expect(result.current.copied).toBe(false);
  });

  it("writes exactly the link it was given", async () => {
    const writeText = vi.fn(async () => {});
    stubClipboard(writeText);
    const { result } = renderHook(() => useCopyLink("https://invinto.app/i/abc123xy"));

    await act(() => result.current.copy());
    expect(writeText).toHaveBeenCalledWith("https://invinto.app/i/abc123xy");
  });
});
