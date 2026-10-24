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
