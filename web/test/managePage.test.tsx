import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { daysUntil, type EventStart, parseEventStart } from "../src/calendar";
import { MANAGE } from "../src/i18n";
import { ManagePage } from "../src/ManagePage";
import { forgetHeldManageTokens, manageTokenKey } from "../src/manageTokens";
import { pluralForm } from "../src/plural";
import type { RsvpCounts, RsvpEntry } from "../src/types";

/**
 * The host dashboard on paper (adr-019 §8): what a host reads at
 * `/manage/:id` once the token is accepted. Access states, the response list,
 * CSV and reply email have their own files; this one holds the layout's
 * claims. The host is signed out, so no account calls are made.
 */

afterEach(cleanup);

const ID = "abc123xy";
const TOKEN = "a".repeat(32);
const TITLE = "Весілля Марії та Андрія";

function yesReply(name: string, guests: number, at = "2026-10-20T10:00:00Z"): RsvpEntry {
  return {
    name,
    answer: "yes",
    attending: true,
    guests_count: guests,
    note: null,
    created_at: at,
    superseded: false,
  };
}

function noReply(name: string, at = "2026-10-20T10:00:00Z"): RsvpEntry {
  return {
    name,
    answer: "no",
    attending: false,
    guests_count: 1,
    note: null,
    created_at: at,
    superseded: false,
  };
}

function withNote(rsvp: RsvpEntry, note: string): RsvpEntry {
  return { ...rsvp, note };
}

/** What the server sends for an answer the same guest later replaced. */
function superseded(rsvp: RsvpEntry): RsvpEntry {
  return { ...rsvp, superseded: true };
}

function stubApi({
  rsvps,
  counts = { yes: 0, no: 0, maybe: 0, guests: 0 },
  date = "20 грудня 2030",
}: {
  rsvps: RsvpEntry[];
  counts?: RsvpCounts;
  date?: string | null;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const json = (body: unknown) =>
        ({ ok: true, status: 200, json: async () => body }) as Response;
      if (url.includes("/api/auth/session")) {
        return json({
          configured: true,
          signed_in: false,
          email: null,
          publish_gate: true,
          notifications: true,
        });
      }
      if (url.includes("/rsvps")) return json({ rsvps, counts });
      if (url.includes(`/api/invitations/${ID}`)) {
        return json({
          id: ID,
          version: 1,
          invitation: {
            brief: {
              event_type: "wedding",
              hosts: ["Марія", "Андрій"],
              date,
              time: "16:00",
              venue: "Садиба «Липи»",
              city: "Київ",
              tone: "warm",
              language: "uk",
              extra_details: null,
            },
            copy: {
              title: TITLE,
              greeting: "",
              body: "",
              details_line: `${date ?? ""}, 16:00 · Садиба «Липи», Київ`,
              rsvp_prompt: "",
              closing: "",
            },
            design: { palette: "warm", typography: "serif", layout: "classic", ornament: "none" },
            background: null,
          },
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    }),
  );
}

function renderManage() {
  return render(
    <MemoryRouter initialEntries={[`/manage/${ID}`]}>
      <ManagePage id={ID} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  forgetHeldManageTokens();
  localStorage.setItem(manageTokenKey(ID), TOKEN);
  localStorage.setItem("inv-ui-lang", "uk");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the dashboard's header (adr-019 §8.1)", () => {
  it("seals the page with the hosts' monogram beside the title", async () => {
    stubApi({ rsvps: [] });
    const { container } = renderManage();
    await screen.findByRole("heading", { level: 1, name: TITLE });
    expect(container.querySelector(".hm-header .seal")?.textContent).toBe("М&А");
  });

  it("counts down to the day, in the host's language", async () => {
    stubApi({ rsvps: [] });
    renderManage();
    const days = daysUntil(parseEventStart("20 грудня 2030", null) as EventStart) as number;
    const text = MANAGE.uk.countdown
      .replace("{n}", String(days))
      .replace("{form}", pluralForm(days, MANAGE.uk.time.dayForms));
    expect(await screen.findByText(text)).toBeTruthy();
  });

  it("shows no countdown when the date doesn't parse", async () => {
    stubApi({ rsvps: [], date: "колись навесні" });
    const { container } = renderManage();
    await screen.findByRole("heading", { level: 1, name: TITLE });
    expect(container.querySelector(".hm-countdown")).toBeNull();
  });
});

describe("the summary (adr-019 §8.2)", () => {
  const replies = [yesReply("Оксана", 3), yesReply("Ігор", 1), noReply("Влад")];

  it("leads with the headcount, then a bar sized by the answers, then the counts", async () => {
    stubApi({ rsvps: replies, counts: { yes: 2, no: 1, maybe: 0, guests: 4 } });
    const { container } = renderManage();
    await screen.findByText("4");
    const bar = container.querySelector(".hm-bar") as HTMLElement;
    expect(bar.getAttribute("aria-hidden")).toBe("true");
    const grow = (cls: string) => (bar.querySelector(cls) as HTMLElement | null)?.style.flexGrow;
    expect(grow(".hm-bar-yes")).toBe("2");
    expect(grow(".hm-bar-no")).toBe("1");
    const counts = [...container.querySelectorAll(".hm-count")].map((c) => c.textContent);
    expect(counts).toEqual([`2${MANAGE.uk.tileYes}`, `1${MANAGE.uk.tileNo}`]);
  });

  it("draws no segment for an answer nobody gave", async () => {
    stubApi({ rsvps: [yesReply("Оксана", 1)], counts: { yes: 1, no: 0, maybe: 0, guests: 1 } });
    const { container } = renderManage();
    await screen.findByText(MANAGE.uk.guestsComing);
    expect(container.querySelector(".hm-bar-no")).toBeNull();
    expect(container.querySelector(".hm-bar-yes")).not.toBeNull();
  });

  it("has retired the replied tile", async () => {
    stubApi({ rsvps: replies, counts: { yes: 2, no: 1, maybe: 0, guests: 4 } });
    const { container } = renderManage();
    await screen.findByText(MANAGE.uk.guestsComing);
    expect(container.querySelector(".hm-tile")).toBeNull();
  });
});

describe("remind guests (adr-019 §8.3)", () => {
  it("copies the public link once someone has replied", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    stubApi({ rsvps: [yesReply("Оксана", 1)], counts: { yes: 1, no: 0, maybe: 0, guests: 1 } });
    renderManage();
    fireEvent.click(await screen.findByRole("button", { name: MANAGE.uk.remindGuests }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/i/${ID}`);
    expect(await screen.findByText(MANAGE.uk.remindCopied)).toBeTruthy();
  });

  // With no replies the empty state's own share row already is this action,
  // so the two never show together.
  it("leaves an empty dashboard to its own share row", async () => {
    stubApi({ rsvps: [] });
    renderManage();
    await screen.findByText(MANAGE.uk.emptyTitle);
    expect(screen.queryByRole("button", { name: MANAGE.uk.remindGuests })).toBeNull();
  });

  it("copies from the empty state's share row through the same hook", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    stubApi({ rsvps: [] });
    renderManage();
    fireEvent.click(await screen.findByRole("button", { name: MANAGE.uk.copyLink }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/i/${ID}`);
    expect(await screen.findByText(MANAGE.uk.copied)).toBeTruthy();
  });
});

describe("wishes from guests (adr-019 §8.4)", () => {
  const quoteIn = (container: HTMLElement) => ({
    text: container.querySelector(".hm-wishes .hm-wish-quote")?.textContent,
    who: container.querySelector(".hm-wishes .hm-wish-who")?.textContent,
  });

  it("quotes the newest live note, with its guest's name", async () => {
    stubApi({
      rsvps: [
        withNote(yesReply("Оксана", 1, "2026-10-20T10:00:00Z"), "Будемо!"),
        withNote(yesReply("Ігор", 1, "2026-10-21T10:00:00Z"), "Вітаємо від усієї родини"),
      ],
      counts: { yes: 2, no: 0, maybe: 0, guests: 2 },
    });
    const { container } = renderManage();
    await screen.findByRole("heading", { level: 2, name: MANAGE.uk.wishesTitle });
    expect(quoteIn(container)).toEqual({ text: "«Вітаємо від усієї родини»", who: "Ігор" });
    const all = container.querySelector(".hm-wishes a") as HTMLAnchorElement;
    expect(all.getAttribute("href")).toBe("#hm-responses");
    expect(all.textContent).toBe(MANAGE.uk.wishesAll.replace("{n}", "2"));
    // Where it leads: the list, where every note sits under its guest's name.
    expect(container.querySelector("#hm-responses")?.classList.contains("hm-responses")).toBe(true);
  });

  // A replaced answer is history (FR-5.5), so its note isn't quoted either.
  it("never quotes an answer the guest has since replaced", async () => {
    stubApi({
      rsvps: [
        superseded(withNote(yesReply("Оксана", 1, "2026-10-20T10:00:00Z"), "Старе")),
        noReply("Оксана", "2026-10-22T10:00:00Z"),
      ],
      counts: { yes: 0, no: 1, maybe: 0, guests: 0 },
    });
    const { container } = renderManage();
    await screen.findByText(MANAGE.uk.guestsComing);
    expect(container.querySelector(".hm-wishes")).toBeNull();
  });

  it("quotes a live note even when a newer reply carries none", async () => {
    stubApi({
      rsvps: [
        withNote(yesReply("Оксана", 1, "2026-10-20T10:00:00Z"), "Будемо!"),
        noReply("Влад", "2026-10-22T10:00:00Z"),
      ],
      counts: { yes: 1, no: 1, maybe: 0, guests: 1 },
    });
    const { container } = renderManage();
    await screen.findByRole("heading", { level: 2, name: MANAGE.uk.wishesTitle });
    expect(quoteIn(container)).toEqual({ text: "«Будемо!»", who: "Оксана" });
  });

  it("offers no link to all of them when there is one", async () => {
    stubApi({
      rsvps: [withNote(yesReply("Оксана", 1), "Будемо!")],
      counts: { yes: 1, no: 0, maybe: 0, guests: 1 },
    });
    const { container } = renderManage();
    await screen.findByRole("heading", { level: 2, name: MANAGE.uk.wishesTitle });
    expect(container.querySelector(".hm-wishes a")).toBeNull();
  });

  it("treats a note of only spaces as no note", async () => {
    stubApi({
      rsvps: [withNote(yesReply("Оксана", 1), "   ")],
      counts: { yes: 1, no: 0, maybe: 0, guests: 1 },
    });
    const { container } = renderManage();
    await screen.findByText(MANAGE.uk.guestsComing);
    expect(container.querySelector(".hm-wishes")).toBeNull();
  });
});
