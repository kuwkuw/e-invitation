import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FeedbackSheet } from "../src/components/FeedbackSheet";
import { FEEDBACK } from "../src/i18n";
import { LandingPage } from "../src/LandingPage";

/**
 * Host feedback (adr-016), client side.
 *
 * Three properties carry the weight, and none of them is "the POST fires":
 *
 *  - **A failed send never loses what somebody wrote.** This is the one
 *    unrecoverable outcome a feedback form has, and the daily allowance (§5)
 *    makes it a case that will actually occur rather than a theoretical one.
 *  - **Whether we can write back is stated before sending**, in both
 *    directions, so no host discovers afterwards that their message was
 *    anonymous.
 *  - **The request says nothing about which event.** `page` is a closed enum
 *    and there is no invitation id to leak (§3) — held here as well as on the
 *    server, because the client is where a URL would be easiest to add.
 */

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const t = FEEDBACK.en;

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

/** Captures the feedback POST and answers it however the case needs. */
function stubFeedbackApi(status = 200) {
  const calls: { url: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/feedback")) {
        calls.push({ url, body: JSON.parse(String(init?.body)) });
        return jsonResponse(status === 200 ? { ok: true } : { error: "no" }, status);
      }
      if (url.includes("/api/auth/session")) {
        return jsonResponse({
          configured: true,
          signed_in: false,
          email: null,
          publish_gate: true,
          notifications: false,
        });
      }
      if (url.includes("/api/account/keyring")) return jsonResponse({ invitations: [] });
      if (url.includes("/api/invitations/counts")) return jsonResponse({ results: [] });
      throw new Error(`unexpected fetch: ${url}`);
    }),
  );
  return calls;
}

function renderSheet(email: string | null = null) {
  return render(<FeedbackSheet page="landing" lang="en" email={email} onClose={() => {}} t={t} />);
}

describe("FeedbackSheet", () => {
  it("cannot send an empty or whitespace-only message", () => {
    renderSheet();
    const send = screen.getByRole("button", { name: t.send }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
    expect(send.disabled).toBe(true);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "a real sentence" } });
    expect(send.disabled).toBe(false);
  });

  it("sends the message with its surface and language, and nothing else", async () => {
    const calls = stubFeedbackApi();
    renderSheet();

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "  the date field lost my Saturday  " },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t.send }));
    });

    expect(calls).toHaveLength(1);
    // Trimmed client-side too: it is what decides whether the button is live,
    // so the two must agree.
    expect(calls[0].body).toEqual({
      message: "the date field lost my Saturday",
      page: "landing",
      lang: "en",
    });
    // The §3 guarantee, held where a URL would be easiest to add.
    expect(Object.keys(calls[0].body as object).sort()).toEqual(["lang", "message", "page"]);
  });

  it("confirms in place rather than closing itself", async () => {
    stubFeedbackApi();
    renderSheet();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "nice app" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: t.send }));
    });

    // There is no dashboard row and no email receipt for a feedback message,
    // so this sheet is the only confirmation there is: it has to stay.
    expect(screen.getByText(t.thanksTitle)).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  describe("whether we can write back, said before sending (§2)", () => {
    it("names the address when signed in", () => {
      renderSheet("host@example.com");
      expect(screen.getByText(t.signedInAs.replace("{email}", "host@example.com"))).toBeTruthy();
    });

    it("says plainly that a signed-out message is anonymous", () => {
      renderSheet();
      expect(screen.getByText(t.anonymous)).toBeTruthy();
    });

    // This sheet is often open *because* something about accounts went wrong.
    // Answering that with another sign-in button is the product arguing with
    // the person trying to tell it something.
    it("offers no sign-in when anonymous", () => {
      const { container } = renderSheet();
      expect(container.querySelector("a[href*='/api/auth/google']")).toBeNull();
    });
  });

  describe("a failed send", () => {
    it("keeps the text and lets the host try again", async () => {
      stubFeedbackApi(500);
      renderSheet();

      fireEvent.change(screen.getByRole("textbox"), { target: { value: "worth keeping" } });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: t.send }));
      });

      expect(screen.getByText(t.errorGeneric)).toBeTruthy();
      expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("worth keeping");
      expect((screen.getByRole("button", { name: t.send }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });

    // "Try again in a moment" is false advice for the daily allowance — the
    // honest answer is tomorrow, so the 429 gets its own wording rather than
    // the server's English-only prose.
    it("says tomorrow when the daily allowance is spent", async () => {
      stubFeedbackApi(429);
      renderSheet();

      fireEvent.change(screen.getByRole("textbox"), { target: { value: "one more thing" } });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: t.send }));
      });

      expect(screen.getByText(t.errorLimited)).toBeTruthy();
      expect(screen.queryByText(t.errorGeneric)).toBeNull();
    });
  });
});

describe("the landing footer trigger (§4)", () => {
  // The page's own default language, as the other landing tests do: the
  // trigger follows the UI toggle like every other piece of chrome, and
  // asserting against `FEEDBACK.en` here would only prove the test set a
  // language.
  const uk = FEEDBACK.uk;

  it("opens the sheet, and nothing about it renders before it is asked for", async () => {
    stubFeedbackApi();
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    // It must never interrupt: no sheet until the host presses the link.
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: uk.link }));

    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    expect(screen.getByText(uk.title)).toBeTruthy();
  });
});
