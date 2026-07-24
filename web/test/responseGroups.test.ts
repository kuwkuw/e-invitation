import { describe, expect, it } from "vitest";
import { groupResponses } from "../src/responseGroups";
import type { RsvpEntry } from "../src/types";

function entry(partial: Partial<RsvpEntry> & { name: string; created_at: string }): RsvpEntry {
  return {
    attending: true,
    guests_count: 1,
    note: null,
    superseded: false,
    ...partial,
  };
}

describe("groupResponses", () => {
  it("nests a replaced answer under the guest's live one", () => {
    const groups = groupResponses([
      entry({
        name: "Тарас Поліщук",
        created_at: "2026-08-01T10:00:00Z",
        attending: false,
        superseded: true,
      }),
      entry({ name: "Софія", created_at: "2026-08-02T09:00:00Z" }),
      entry({ name: "тарас  поліщук", created_at: "2026-08-03T08:00:00Z" }),
    ]);

    // Two guests, not three rows.
    expect(groups).toHaveLength(2);
    const taras = groups.find((g) => g.live.name === "тарас  поліщук");
    expect(taras?.previous).toHaveLength(1);
    expect(taras?.previous[0]?.attending).toBe(false);
    // Софія never changed her mind, so she carries no history.
    expect(groups.find((g) => g.live.name === "Софія")?.previous).toEqual([]);
  });

  it("orders guests by their live answer, newest first", () => {
    const groups = groupResponses([
      entry({ name: "Оксана", created_at: "2026-08-01T10:00:00Z" }),
      entry({ name: "Богдан", created_at: "2026-08-05T10:00:00Z" }),
      entry({ name: "Ірина", created_at: "2026-08-03T10:00:00Z" }),
    ]);

    expect(groups.map((g) => g.live.name)).toEqual(["Богдан", "Ірина", "Оксана"]);
  });

  it("keeps two different guests apart even mid-rename", () => {
    const groups = groupResponses([
      entry({ name: "Олена К.", created_at: "2026-08-01T10:00:00Z" }),
      entry({ name: "Олена Г.", created_at: "2026-08-02T10:00:00Z" }),
    ]);

    expect(groups).toHaveLength(2);
  });

  it("survives a group with no live answer rather than dropping the guest", () => {
    // Shouldn't happen — the server marks one live per guest — but losing a
    // row silently would be worse than showing the newest.
    const groups = groupResponses([
      entry({ name: "Ігор", created_at: "2026-08-01T10:00:00Z", superseded: true }),
      entry({ name: "Ігор", created_at: "2026-08-02T10:00:00Z", superseded: true }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.live.created_at).toBe("2026-08-02T10:00:00Z");
    expect(groups[0]?.previous).toHaveLength(1);
  });
});
