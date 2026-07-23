import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../src/api";
import { useInvitationEditor } from "../src/hooks/useInvitationEditor";
import { UI } from "../src/i18n";
import type { Invitation } from "../src/types";

const chat = UI.en.chat;

const invitation: Invitation = {
  brief: {
    event_type: "birthday",
    hosts: ["Olena"],
    date: "August 12",
    time: "6pm",
    venue: "Zatyshok",
    city: "Lviv",
    tone: "warm",
    language: "en",
    extra_details: null,
  },
  copy: {
    title: "Olena turns 30",
    greeting: "Dear friends,",
    body: "Join us for dinner.",
    details_line: "August 12, 6pm — Zatyshok, Lviv",
    rsvp_prompt: "Let us know by the 5th.",
    closing: "— Olena",
  },
  design: { palette: "warm", typography: "serif", layout: "classic", ornament: "floral" },
};

function apiError(status: number, causes?: { model: string; class: string }[]) {
  const error = new api.ApiError("failed");
  error.status = status;
  if (causes) error.causes = causes;
  return error;
}

describe("useInvitationEditor", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("generates from the first message and lands in the active phase", async () => {
    const generate = vi.spyOn(api, "generateInvitation").mockResolvedValue(invitation);
    const { result } = renderHook(() => useInvitationEditor(chat));

    await act(async () => {
      await result.current.send("Olena's birthday dinner");
    });

    expect(generate).toHaveBeenCalledWith("Olena's birthday dinner");
    expect(result.current.phase).toBe("active");
    expect(result.current.invitation).toEqual(invitation);
    expect(result.current.messages).toEqual([
      { role: "user", text: "Olena's birthday dinner" },
      { role: "assistant", text: chat.doneMsg },
    ]);
  });

  it("accumulates the description so later turns refine the same event", async () => {
    const generate = vi.spyOn(api, "generateInvitation").mockResolvedValue(invitation);
    const { result } = renderHook(() => useInvitationEditor(chat));

    await act(async () => {
      await result.current.send("Olena's birthday dinner");
    });
    await act(async () => {
      await result.current.send("make it formal");
    });

    // The second call must carry both turns — the pipeline is stateless and
    // regenerates from the whole description each time.
    expect(generate).toHaveBeenLastCalledWith("Olena's birthday dinner. make it formal");
  });

  it("keeps the existing invitation when a refinement fails", async () => {
    vi.spyOn(api, "generateInvitation").mockResolvedValueOnce(invitation);
    const { result } = renderHook(() => useInvitationEditor(chat));
    await act(async () => {
      await result.current.send("Olena's birthday dinner");
    });

    vi.spyOn(api, "generateInvitation").mockRejectedValueOnce(apiError(429));
    await act(async () => {
      await result.current.send("add a dress code");
    });

    // Falls back to active (not empty) because there is still something to
    // show, and the failure is reported in the host's own language.
    expect(result.current.phase).toBe("active");
    expect(result.current.invitation).toEqual(invitation);
    expect(result.current.messages.at(-1)).toEqual({ role: "assistant", text: chat.limitMsg });
  });

  it("returns to empty when the very first generation fails", async () => {
    vi.spyOn(api, "generateInvitation").mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useInvitationEditor(chat));

    await act(async () => {
      await result.current.send("something");
    });

    expect(result.current.phase).toBe("empty");
    expect(result.current.invitation).toBeNull();
    expect(result.current.messages.at(-1)).toEqual({ role: "assistant", text: chat.failMsg });
  });

  it("ignores a send while a generation is in flight", async () => {
    const generate = vi
      .spyOn(api, "generateInvitation")
      .mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useInvitationEditor(chat));

    act(() => {
      result.current.send("first");
    });
    await waitFor(() => expect(result.current.phase).toBe("generating"));
    await act(async () => {
      await result.current.send("second");
    });

    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("edits one copy field without touching the rest", async () => {
    vi.spyOn(api, "generateInvitation").mockResolvedValue(invitation);
    const { result } = renderHook(() => useInvitationEditor(chat));
    await act(async () => {
      await result.current.send("Olena's birthday dinner");
    });

    act(() => result.current.updateField("title", "Olena is 30!"));

    expect(result.current.invitation?.copy.title).toBe("Olena is 30!");
    expect(result.current.invitation?.copy.body).toBe(invitation.copy.body);
    expect(result.current.invitation?.design).toEqual(invitation.design);
  });

  it("patches design tokens without replacing the whole set", async () => {
    vi.spyOn(api, "generateInvitation").mockResolvedValue(invitation);
    const { result } = renderHook(() => useInvitationEditor(chat));
    await act(async () => {
      await result.current.send("Olena's birthday dinner");
    });

    act(() => result.current.updateDesign({ palette: "festive" }));

    expect(result.current.invitation?.design).toEqual({
      palette: "festive",
      typography: "serif",
      layout: "classic",
      ornament: "floral",
    });
  });

  it("collapses duplicate variants and drops failed ones", async () => {
    vi.spyOn(api, "generateInvitation").mockResolvedValue(invitation);
    const { result } = renderHook(() => useInvitationEditor(chat));
    await act(async () => {
      await result.current.send("Olena's birthday dinner");
    });

    vi.spyOn(api, "regenerateField")
      .mockResolvedValueOnce("Same headline")
      .mockResolvedValueOnce("Same headline")
      .mockRejectedValueOnce(new Error("one model failed"));

    let variants: string[] = [];
    await act(async () => {
      variants = await result.current.fieldVariants("title");
    });

    expect(variants).toEqual(["Same headline"]);
  });

  it("reports a failed field regeneration instead of applying it", async () => {
    vi.spyOn(api, "generateInvitation").mockResolvedValue(invitation);
    const { result } = renderHook(() => useInvitationEditor(chat));
    await act(async () => {
      await result.current.send("Olena's birthday dinner");
    });

    vi.spyOn(api, "regenerateField").mockRejectedValue(new Error("boom"));
    let ok = true;
    await act(async () => {
      ok = await result.current.regenerateOneField("title");
    });

    expect(ok).toBe(false);
    expect(result.current.invitation?.copy.title).toBe(invitation.copy.title);
  });

  it("adds and removes the AI background layer", async () => {
    vi.spyOn(api, "generateInvitation").mockResolvedValue(invitation);
    const { result } = renderHook(() => useInvitationEditor(chat));
    await act(async () => {
      await result.current.send("Olena's birthday dinner");
    });

    vi.spyOn(api, "generateBackground").mockResolvedValue({ id: "bg123456" });
    await act(async () => {
      await result.current.addBackground();
    });
    expect(result.current.invitation?.background).toEqual({ id: "bg123456" });

    act(() => result.current.removeBackground());
    expect(result.current.invitation?.background).toBeNull();
  });

  it("reports a background failure in the chat and clears the busy flag", async () => {
    vi.spyOn(api, "generateInvitation").mockResolvedValue(invitation);
    const { result } = renderHook(() => useInvitationEditor(chat));
    await act(async () => {
      await result.current.send("Olena's birthday dinner");
    });

    vi.spyOn(api, "generateBackground").mockRejectedValue(
      apiError(502, [{ model: "gemini-2.5-flash-image", class: "quota" }]),
    );
    await act(async () => {
      await result.current.addBackground();
    });

    expect(result.current.bgBusy).toBe(false);
    expect(result.current.messages.at(-1)).toEqual({ role: "assistant", text: chat.quotaMsg });
    expect(result.current.invitation?.background).toBeUndefined();
  });
});
