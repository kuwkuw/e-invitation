import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../src/api";
import { buildRsvpInput, MAX_GUESTS, useRsvpForm } from "../src/hooks/useRsvpForm";

describe("buildRsvpInput", () => {
  it("trims the name and turns a blank note into null", () => {
    expect(
      buildRsvpInput({ name: "  Оксана  ", answer: "yes", guestsCount: 2, note: "   " }),
    ).toEqual({ name: "Оксана", answer: "yes", attending: true, guests_count: 2, note: null });
  });

  it("resets the party size when the answer is no", () => {
    // A decline must never carry a guest count into the host's totals.
    const input = buildRsvpInput({ name: "Ігор", answer: "no", guestsCount: 4, note: "" });
    expect(input).toMatchObject({ answer: "no", attending: false, guests_count: 1 });
  });

  // adr-019 §9.1: a maybe never counts toward the headcount, so it carries no
  // party size whatever the stepper held. `attending` rides beside `answer`
  // for a server that predates the maybe, which must read it as a no.
  it("sends a maybe with no party size, and as a no to an older reader", () => {
    const input = buildRsvpInput({ name: "Тарас", answer: "maybe", guestsCount: 4, note: "" });
    expect(input).toMatchObject({ answer: "maybe", attending: false, guests_count: 1 });
  });
});

describe("useRsvpForm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("blocks submission until there is a name and an answer", () => {
    const { result } = renderHook(() => useRsvpForm("abc123"));
    expect(result.current.canSubmit).toBe(false);

    act(() => result.current.setName("Оксана"));
    expect(result.current.canSubmit).toBe(false); // still no yes/no

    act(() => result.current.setAnswer("maybe"));
    expect(result.current.canSubmit).toBe(true);

    act(() => result.current.setName("   "));
    expect(result.current.canSubmit).toBe(false); // whitespace is not a name
  });

  it("clamps the guest stepper to the server's 1-10 bounds", () => {
    const { result } = renderHook(() => useRsvpForm("abc123"));
    act(() => result.current.decrement());
    expect(result.current.guestsCount).toBe(1);

    for (let i = 0; i < MAX_GUESTS + 5; i++) act(() => result.current.increment());
    expect(result.current.guestsCount).toBe(MAX_GUESTS);
  });

  it("submits the normalized payload and switches to the sent state", async () => {
    const submit = vi.spyOn(api, "submitRsvp").mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useRsvpForm("abc123"));

    act(() => {
      result.current.setName(" Ігор ");
      result.current.setAnswer("yes");
      result.current.setNote(" +1 dessert ");
    });
    await act(async () => {
      await result.current.submit({ preventDefault: () => {} } as React.FormEvent);
    });

    expect(submit).toHaveBeenCalledWith("abc123", {
      name: "Ігор",
      answer: "yes",
      attending: true,
      guests_count: 1,
      note: "+1 dessert",
    });
    expect(result.current.sent).toBe(true);
    expect(result.current.submitError).toBe(false);
  });

  it("surfaces a failure without losing the guest's answers", async () => {
    vi.spyOn(api, "submitRsvp").mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useRsvpForm("abc123"));

    act(() => {
      result.current.setName("Оксана");
      result.current.setAnswer("no");
    });
    await act(async () => {
      await result.current.submit({ preventDefault: () => {} } as React.FormEvent);
    });

    await waitFor(() => expect(result.current.submitError).toBe(true));
    expect(result.current.sent).toBe(false);
    expect(result.current.sending).toBe(false);
    expect(result.current.name).toBe("Оксана");
  });

  it("reopens the form with the previous answers after 'change my answer'", async () => {
    vi.spyOn(api, "submitRsvp").mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useRsvpForm("abc123"));

    act(() => {
      result.current.setName("Ігор");
      result.current.setAnswer("yes");
      result.current.increment();
    });
    await act(async () => {
      await result.current.submit({ preventDefault: () => {} } as React.FormEvent);
    });
    expect(result.current.sent).toBe(true);

    act(() => result.current.reopen());
    expect(result.current.sent).toBe(false);
    expect(result.current.name).toBe("Ігор");
    expect(result.current.guestsCount).toBe(2);
  });
});
