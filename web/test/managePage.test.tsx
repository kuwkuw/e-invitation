import { cleanup, render, screen } from "@testing-library/react";
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
    attending: true,
    guests_count: guests,
    note: null,
    created_at: at,
    superseded: false,
  };
}

function noReply(name: string, at = "2026-10-20T10:00:00Z"): RsvpEntry {
  return { name, attending: false, guests_count: 1, note: null, created_at: at, superseded: false };
}

function stubApi({
  rsvps,
  counts = { yes: 0, no: 0, guests: 0 },
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
    stubApi({ rsvps: replies, counts: { yes: 2, no: 1, guests: 4 } });
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
    stubApi({ rsvps: [yesReply("Оксана", 1)], counts: { yes: 1, no: 0, guests: 1 } });
    const { container } = renderManage();
    await screen.findByText(MANAGE.uk.guestsComing);
    expect(container.querySelector(".hm-bar-no")).toBeNull();
    expect(container.querySelector(".hm-bar-yes")).not.toBeNull();
  });

  it("has retired the replied tile", async () => {
    stubApi({ rsvps: replies, counts: { yes: 2, no: 1, guests: 4 } });
    const { container } = renderManage();
    await screen.findByText(MANAGE.uk.guestsComing);
    expect(container.querySelector(".hm-tile")).toBeNull();
  });
});
