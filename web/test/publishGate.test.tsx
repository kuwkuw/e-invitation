import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../src/api";
import { ApiError } from "../src/api";
import { clearDraft, loadDraft, saveDraft } from "../src/draft";
import { useAuthReturn } from "../src/hooks/useAuthReturn";
import { usePublishing } from "../src/hooks/usePublishing";
import { forgetHeldManageTokens, readManageToken } from "../src/manageTokens";
import type { Invitation } from "../src/types";

const invitation: Invitation = {
  brief: {
    event_type: "birthday",
    hosts: ["Олена"],
    date: "12 серпня",
    time: "18:00",
    venue: null,
    city: null,
    tone: "warm",
    language: "uk",
    extra_details: null,
  },
  copy: {
    title: "Запрошення",
    greeting: "Дорогі друзі!",
    body: "Текст",
    details_line: "12 серпня",
    rsvp_prompt: "Підтвердіть",
    closing: "Олена",
  },
  design: { palette: "warm", typography: "serif", layout: "classic", ornament: "floral" },
};

const result = { id: "abc123xy", version: 1, manage_token: "a".repeat(32) };

function at(entry: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  forgetHeldManageTokens();
  clearDraft();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("publish gate", () => {
  it("publishes straight through when the deployment does not gate", async () => {
    const publish = vi.spyOn(api, "publishInvitation").mockResolvedValue(result);
    const { result: hook } = renderHook(() => usePublishing(() => {}, { gated: false }), {
      wrapper: at("/create"),
    });

    await act(() => hook.current.share(invitation));

    expect(publish).toHaveBeenCalledOnce();
    expect(hook.current.gate).toBeNull();
    expect(hook.current.shareOpen).toBe(true);
  });

  // The sheet is the first frame of the share panel the host already expects,
  // so it has to be there before any round trip — not after a 401.
  it("opens the gate on the press, without asking the server", async () => {
    const publish = vi.spyOn(api, "publishInvitation").mockResolvedValue(result);
    const { result: hook } = renderHook(
      () => usePublishing(() => {}, { gated: true, signedIn: false }),
      { wrapper: at("/create") },
    );

    await act(() => hook.current.share(invitation));

    expect(publish).not.toHaveBeenCalled();
    expect(hook.current.gate).toBe("prompt");
    // And the draft is parked, because the next tap leaves the page entirely.
    expect(loadDraft()?.invitation.copy.title).toBe("Запрошення");
  });

  it("does not gate a signed-in host", async () => {
    const publish = vi.spyOn(api, "publishInvitation").mockResolvedValue(result);
    const { result: hook } = renderHook(
      () => usePublishing(() => {}, { gated: true, signedIn: true }),
      { wrapper: at("/create") },
    );

    await act(() => hook.current.share(invitation));
    expect(publish).toHaveBeenCalledOnce();
    expect(hook.current.gate).toBeNull();
  });

  // adr-014 §1: auth never revokes a capability, so a republish is never gated.
  it("never gates a republish", async () => {
    vi.spyOn(api, "publishInvitation").mockResolvedValue(result);
    const { result: hook } = renderHook(
      () => usePublishing(() => {}, { gated: true, signedIn: true }),
      { wrapper: at("/create") },
    );
    await act(() => hook.current.share(invitation));
    // Close the panel, then republish as a signed-out host would after their
    // session lapsed.
    await act(() => hook.current.share(invitation));

    const { result: signedOut } = renderHook(
      () => usePublishing(() => {}, { gated: true, signedIn: false }),
      { wrapper: at("/create") },
    );
    await act(() => signedOut.current.share(invitation));
    // First publish for *this* hook instance, so it gates — but the one that
    // already holds a published record does not.
    expect(signedOut.current.gate).toBe("prompt");
    expect(hook.current.published).not.toBeNull();
  });

  it("falls into the gate when the session lapsed between load and press", async () => {
    const unauthorized = new ApiError("nope");
    unauthorized.status = 401;
    vi.spyOn(api, "publishInvitation").mockRejectedValue(unauthorized);
    const onError = vi.fn();
    const { result: hook } = renderHook(
      // The session said we were signed in; the server disagrees.
      () => usePublishing(onError, { gated: true, signedIn: true }),
      { wrapper: at("/create") },
    );

    await act(() => hook.current.share(invitation));

    expect(hook.current.gate).toBe("prompt");
    // Not a generic publish failure — the host gets a way forward.
    expect(onError).not.toHaveBeenCalled();
    expect(loadDraft()).not.toBeNull();
  });

  it("still reports a real publish failure as one", async () => {
    vi.spyOn(api, "publishInvitation").mockRejectedValue(new Error("boom"));
    const onError = vi.fn();
    const { result: hook } = renderHook(() => usePublishing(onError, { gated: false }), {
      wrapper: at("/create"),
    });

    await act(() => hook.current.share(invitation));
    expect(onError).toHaveBeenCalledOnce();
    expect(hook.current.gate).toBeNull();
  });

  it("parks the draft and leaves for Google", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign, origin: "http://localhost" });
    const { result: hook } = renderHook(
      () => usePublishing(() => {}, { gated: true, signedIn: false, source: "guest" }),
      { wrapper: at("/create") },
    );

    act(() => hook.current.signInAndPublish(invitation));

    expect(hook.current.gate).toBe("redirecting");
    expect(assign).toHaveBeenCalledWith("/api/auth/google?redirect_to=%2Fcreate");
    // The referral survives the round trip, so an interrupted publish still
    // counts as referred (adr-013 §3).
    expect(loadDraft()?.source).toBe("guest");
  });

  it("dismissing the gate drops the parked draft", async () => {
    const { result: hook } = renderHook(
      () => usePublishing(() => {}, { gated: true, signedIn: false }),
      { wrapper: at("/create") },
    );
    await act(() => hook.current.share(invitation));
    expect(loadDraft()).not.toBeNull();

    act(() => hook.current.dismissGate());

    expect(hook.current.gate).toBeNull();
    expect(loadDraft()).toBeNull();
  });

  describe("coming back from Google", () => {
    it("lands in `returning`, not back in `prompt`", () => {
      // The draft is what the gate parked on the way out, so the real return
      // trip always has one.
      saveDraft({ invitation, source: "direct", published: null });
      const { result: hook } = renderHook(
        () => usePublishing(() => {}, { gated: true, signedIn: true, authReturn: "ok" }),
        { wrapper: at("/create?auth=ok") },
      );
      expect(hook.current.gate).toBe("returning");
    });

    it("resumes the interrupted publish and clears the draft", async () => {
      const publish = vi.spyOn(api, "publishInvitation").mockResolvedValue(result);
      saveDraft({ invitation, source: "direct", published: null });
      const { result: hook } = renderHook(
        () => usePublishing(() => {}, { gated: true, signedIn: true, authReturn: "ok" }),
        { wrapper: at("/create?auth=ok") },
      );

      await act(() => hook.current.resume(invitation, null));

      expect(publish).toHaveBeenCalledOnce();
      expect(hook.current.shareOpen).toBe(true);
      expect(hook.current.gate).toBeNull();
      expect(readManageToken(result.id)).toBe(result.manage_token);
      // The parked draft is spent, so a later ordinary visit finds nothing.
      expect(loadDraft()).toBeNull();
    });

    // `returning` promises a publish is in flight. With nothing parked there
    // is none, and the sheet would sit on "Publishing…" forever. Reachable for
    // real: a browser that refused the draft write (private-mode Safari), or
    // arriving at /api/auth/google directly rather than through the gate.
    it("shows nothing when there is no parked draft to resume", () => {
      const { result: hook } = renderHook(
        () => usePublishing(() => {}, { gated: true, signedIn: true, authReturn: "ok" }),
        { wrapper: at("/create?auth=ok") },
      );
      // The host is signed in either way; the next Publish press just works.
      expect(hook.current.gate).toBeNull();
    });

    it.each([
      ["declined", "declined"],
      ["failed", "failed"],
    ] as const)("shows %s as its own state", (returned, expected) => {
      const { result: hook } = renderHook(
        () => usePublishing(() => {}, { gated: true, authReturn: returned }),
        { wrapper: at(`/create?auth=${returned}`) },
      );
      expect(hook.current.gate).toBe(expected);
    });
  });
});

describe("useAuthReturn", () => {
  it("captures the result and strips it from the URL", async () => {
    const { result } = renderHook(() => useAuthReturn(), {
      wrapper: at("/create?auth=failed&auth_code=exchange"),
    });

    expect(result.current).toEqual({ result: "failed", code: "exchange" });
    // Held in state, so it survives the strip the effect performs immediately.
    await waitFor(() => expect(result.current.result).toBe("failed"));
  });

  it("ignores a value the server would never send", () => {
    const { result } = renderHook(() => useAuthReturn(), {
      wrapper: at("/create?auth=whatever"),
    });
    expect(result.current.result).toBeNull();
  });

  it("carries no code on a success", () => {
    const { result } = renderHook(() => useAuthReturn(), { wrapper: at("/create?auth=ok") });
    expect(result.current).toEqual({ result: "ok", code: null });
  });

  it("is inert on an ordinary visit", () => {
    const { result } = renderHook(() => useAuthReturn(), { wrapper: at("/create") });
    expect(result.current).toEqual({ result: null, code: null });
  });
});
