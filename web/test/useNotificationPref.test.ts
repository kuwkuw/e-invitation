import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useNotificationPref } from "../src/hooks/useNotificationPref";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(handlers: { get?: () => Promise<Response>; put?: () => Promise<Response> }) {
  const spy = vi.fn(async (_url: string, init?: RequestInit) => {
    const handler = init?.method === "PUT" ? handlers.put : handlers.get;
    if (!handler) throw new Error("unexpected request");
    return handler();
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

const ok = (enabled: boolean) => async () =>
  new Response(JSON.stringify({ enabled }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("useNotificationPref", () => {
  it("defaults to on before the read resolves, matching the absent-row default", () => {
    stubFetch({ get: ok(true) });
    const { result } = renderHook(() => useNotificationPref("abc123", true));
    expect(result.current.enabled).toBe(true);
  });

  it("adopts the stored preference", async () => {
    stubFetch({ get: ok(false) });
    const { result } = renderHook(() => useNotificationPref("abc123", true));
    await waitFor(() => expect(result.current.enabled).toBe(false));
  });

  it("asks for nothing when there is no invitation yet", () => {
    const spy = stubFetch({ get: ok(true) });
    renderHook(() => useNotificationPref(null, true));
    expect(spy).not.toHaveBeenCalled();
  });

  // §8: an unconfigured deployment or a signed-out host never asks.
  it("asks for nothing when inactive", () => {
    const spy = stubFetch({ get: ok(true) });
    renderHook(() => useNotificationPref("abc123", false));
    expect(spy).not.toHaveBeenCalled();
  });

  it("writes the new value and keeps what the server confirms", async () => {
    const spy = stubFetch({ get: ok(true), put: ok(false) });
    const { result } = renderHook(() => useNotificationPref("abc123", true));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.toggle();
    });

    expect(result.current.enabled).toBe(false);
    const [url, init] = spy.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("/api/account/notifications/abc123");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ enabled: false });
  });

  // The one direction that has to be true: a host who believes they turned
  // notifications off must not keep getting mail. A failed write reverts, so
  // the control never shows "off" while the server still says "on".
  it("reverts when the write fails", async () => {
    const spy = stubFetch({
      get: ok(true),
      put: async () => new Response("nope", { status: 500 }),
    });
    const { result } = renderHook(() => useNotificationPref("abc123", true));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.toggle();
    });

    expect(result.current.enabled).toBe(true);
  });

  it("leaves the default in place when the read fails", async () => {
    stubFetch({ get: async () => new Response("nope", { status: 500 }) });
    const { result } = renderHook(() => useNotificationPref("abc123", true));
    await waitFor(() => expect(result.current.enabled).toBe(true));
  });
});
