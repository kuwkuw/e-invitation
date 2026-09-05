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

/** The same invitation with a date the calendar parser can't turn into a day. */
function dated(date: string | null, time: string | null = null): Invitation {
  return { ...invitation, brief: { ...invitation.brief, date, time } };
}

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

  // adr-013 §4: the referral is captured at mount and stripped from the URL
  // immediately, so the value has to survive to a generation several chat
  // turns later — which is where it is actually spent.
  it("carries the referral source into every generation, turns later", async () => {
    const generate = vi.spyOn(api, "generateInvitation").mockResolvedValue(invitation);
    const { result } = renderHook(() => useInvitationEditor(chat, "guest"));

    await act(async () => {
      await result.current.send("a birthday party");
    });
    await act(async () => {
      await result.current.send("outdoors");
    });
    await act(async () => {
      await result.current.send("bring a dish");
    });

    expect(generate).toHaveBeenCalledTimes(3);
    for (const call of generate.mock.calls) {
      expect(call[1]).toBe("guest");
    }
  });

  it("labels a cold visit direct", async () => {
    const generate = vi.spyOn(api, "generateInvitation").mockResolvedValue(invitation);
    const { result } = renderHook(() => useInvitationEditor(chat));

    await act(async () => {
      await result.current.send("a birthday party");
    });

    expect(generate).toHaveBeenCalledWith("a birthday party", "direct");
  });

  it("generates from the first message and lands in the active phase", async () => {
    const generate = vi.spyOn(api, "generateInvitation").mockResolvedValue(invitation);
    const { result } = renderHook(() => useInvitationEditor(chat));

    await act(async () => {
      await result.current.send("Olena's birthday dinner");
    });

    expect(generate).toHaveBeenCalledWith("Olena's birthday dinner", "direct");
    expect(result.current.phase).toBe("active");
    expect(result.current.invitation).toEqual(invitation);
    expect(result.current.messages).toEqual([
      { role: "user", text: "Olena's birthday dinner" },
      { role: "assistant", text: chat.doneMsg },
    ]);
  });

  it("asks for the date when the brief has none", async () => {
    vi.spyOn(api, "generateInvitation").mockResolvedValue(dated(null));
    const { result } = renderHook(() => useInvitationEditor(chat));

    await act(async () => {
      await result.current.send("Olena's birthday dinner");
    });

    // After the usual done message, not instead of it — the host still needs
    // the "tap to tweak" hint.
    expect(result.current.messages.slice(-2)).toEqual([
      { role: "assistant", text: chat.doneMsg },
      { role: "assistant", text: chat.dateNudge },
    ]);
  });

  it("asks when the date is too vague to reach a calendar", async () => {
    // "у вересні" survives extraction as written (brief.ts copies it verbatim)
    // but yields no day, so the guest page would hide add-to-calendar.
    vi.spyOn(api, "generateInvitation").mockResolvedValue(dated("у вересні"));
    const { result } = renderHook(() => useInvitationEditor(chat));

    await act(async () => {
      await result.current.send("Весілля у вересні на 80 гостей");
    });

    expect(result.current.messages.at(-1)).toEqual({ role: "assistant", text: chat.dateNudge });
  });

  it("asks only once, even if the date is still missing after a refinement", async () => {
    vi.spyOn(api, "generateInvitation").mockResolvedValue(dated(null));
    const { result } = renderHook(() => useInvitationEditor(chat));

    await act(async () => {
      await result.current.send("Olena's birthday dinner");
    });
    await act(async () => {
      await result.current.send("make it formal");
    });

    const nudges = result.current.messages.filter((m) => m.text === chat.dateNudge);
    expect(nudges).toHaveLength(1);
  });

  it("blocks publishing when the date reads cleanly but has already gone by", async () => {
    // An explicit stale year is the one way past today's date gets this far:
    // brief.ts copies the year the host wrote, and a year-less date is rolled
    // forward by the parser. The card renders it looking perfectly finished.
    vi.spyOn(api, "generateInvitation").mockResolvedValue(dated("August 12, 2020"));
    const { result } = renderHook(() => useInvitationEditor(chat));

    await act(async () => {
      await result.current.send("Olena's birthday dinner on August 12, 2020");
    });

    expect(result.current.messages.slice(-2)).toEqual([
      { role: "assistant", text: chat.doneMsg },
      { role: "assistant", text: chat.pastDateBlock },
    ]);
    // Blocked from publishing, not from editing: the invitation is still there
    // and every other action still works (FR-1.8).
    expect(result.current.dateBlocked).toBe(true);
    expect(result.current.phase).toBe("active");
    expect(result.current.invitation).not.toBeNull();
  });

  it("says nothing, and blocks nothing, about a date still ahead", async () => {
    vi.spyOn(api, "generateInvitation").mockResolvedValue(invitation);
    const { result } = renderHook(() => useInvitationEditor(chat));

    await act(async () => {
      await result.current.send("Olena's birthday dinner");
    });

    expect(result.current.messages.at(-1)).toEqual({ role: "assistant", text: chat.doneMsg });
    expect(result.current.dateBlocked).toBe(false);
  });

  it("leaves a save-the-date publishable", async () => {
    // FR-1.7's case: no day at all is a legitimate invitation, and the nudge
    // that asks for one must not take the Publish button with it.
    vi.spyOn(api, "generateInvitation").mockResolvedValue(dated("у вересні"));
    const { result } = renderHook(() => useInvitationEditor(chat));

    await act(async () => {
      await result.current.send("Весілля у вересні");
    });

    expect(result.current.messages.at(-1)).toEqual({ role: "assistant", text: chat.dateNudge });
    expect(result.current.dateBlocked).toBe(false);
  });

  it("repeats the refusal on every turn the date is still stale", async () => {
    vi.spyOn(api, "generateInvitation").mockResolvedValue(dated("12.08.2020"));
    const { result } = renderHook(() => useInvitationEditor(chat));

    await act(async () => {
      await result.current.send("Olena's birthday dinner");
    });
    await act(async () => {
      await result.current.send("make it formal");
    });

    // Unlike the missing-date nudge, this one is not said once: it explains a
    // disabled button, and two turns later the reason would have scrolled off
    // the top of the log.
    expect(result.current.messages.filter((m) => m.text === chat.pastDateBlock)).toHaveLength(2);
    expect(result.current.dateBlocked).toBe(true);
  });

  it("stops refusing once the host moves the date forward", async () => {
    vi.spyOn(api, "generateInvitation")
      .mockResolvedValueOnce(dated("12.08.2020"))
      .mockResolvedValueOnce(dated("12.08.2099"));
    const { result } = renderHook(() => useInvitationEditor(chat));

    await act(async () => {
      await result.current.send("Olena's birthday dinner on 12.08.2020");
    });
    expect(result.current.dateBlocked).toBe(true);

    await act(async () => {
      await result.current.send("sorry, 12.08.2099");
    });

    expect(result.current.dateBlocked).toBe(false);
    expect(result.current.messages.at(-1)).toEqual({ role: "assistant", text: chat.doneMsg });
  });

  it("blocks a stale year the host answered the date prompt with", async () => {
    vi.spyOn(api, "generateInvitation")
      .mockResolvedValueOnce(dated(null))
      .mockResolvedValueOnce(dated("12.08.2020"));
    const { result } = renderHook(() => useInvitationEditor(chat));

    await act(async () => {
      await result.current.send("Olena's birthday dinner");
    });
    await act(async () => {
      await result.current.send("on 12.08.2020");
    });

    // The nudge asked for a date; the answer was one that cannot be published.
    expect(
      result.current.messages.filter((m) => m.role === "assistant").map((m) => m.text),
    ).toEqual([chat.doneMsg, chat.dateNudge, chat.doneMsg, chat.pastDateBlock]);
  });

  it("blocks an invitation restored from the sign-in draft, which no turn ran for", async () => {
    // adr-014 §2 hands the invitation straight back into state — nothing
    // generates, so a flag set during a generate would leave the gate open.
    const { result } = renderHook(() => useInvitationEditor(chat, "direct", dated("12.08.2020")));

    expect(result.current.dateBlocked).toBe(true);
    expect(result.current.phase).toBe("active");
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
    expect(generate).toHaveBeenLastCalledWith("Olena's birthday dinner. make it formal", "direct");
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
