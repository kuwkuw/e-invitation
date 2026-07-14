import { describe, expect, it, vi } from "vitest";
import type { Task } from "../src/llm/routing.js";
import type { EventBrief } from "../src/schemas.js";

const brief: EventBrief = {
  event_type: "birthday",
  hosts: ["Олена"],
  date: "12 серпня",
  time: "18:00",
  venue: "Кафе «Затишок»",
  city: "Львів",
  tone: "warm and familial",
  language: "uk",
  extra_details: null,
};

const canned: Record<Task, unknown> = {
  brief_extraction: brief,
  copy_generation: {
    title: "Запрошення на день народження",
    greeting: "Дорогі друзі!",
    body: "Запрошуємо вас відсвяткувати разом із нами.",
    details_line: "12 серпня, 18:00 — Кафе «Затишок», Львів",
    rsvp_prompt: "Будь ласка, підтвердіть свою присутність.",
    closing: "З любов'ю, Олена",
  },
  design_resolution: {
    palette: "warm",
    typography: "serif",
    layout: "classic",
    ornament: "floral",
  },
  field_regeneration: { value: "Любі гості!" },
};

const completeJson = vi.fn(async (task: Task) => canned[task]);

vi.mock("../src/llm/gateway.js", () => ({
  completeJson: (task: Task, spec: unknown) => completeJson(task, spec),
}));

describe("generateInvitation", () => {
  it("runs brief -> parallel copy+design and composes an Invitation", async () => {
    const { generateInvitation } = await import("../src/pipeline/generate.js");
    const invitation = await generateInvitation("Олена запрошує на день народження у Львові");

    expect(invitation.brief).toEqual(brief);
    expect(invitation.copy.title).toContain("день народження");
    expect(invitation.design.palette).toBe("warm");

    const calledTasks = completeJson.mock.calls.map(([task]) => task);
    expect(calledTasks).toEqual(["brief_extraction", "copy_generation", "design_resolution"]);
  });

  it("regenerateField returns the rewritten value for one field", async () => {
    const { regenerateField } = await import("../src/pipeline/copy.js");
    const value = await regenerateField(brief, "greeting", "Дорогі друзі!");
    expect(value).toBe("Любі гості!");
  });
});
