import { describe, expect, it } from "vitest";
import { buildRsvpCsv, type RsvpCsvStrings } from "../src/csv";

const uk: RsvpCsvStrings = {
  headers: ["Ім'я", "Відповідь", "Гості", "Побажання", "Час відповіді", "Статус"],
  yes: "Так",
  no: "Ні",
  superseded: "замінена",
};

describe("buildRsvpCsv", () => {
  it("emits a BOM, localized headers and answers, CRLF rows", () => {
    const csv = buildRsvpCsv(
      [
        {
          name: "Ірина",
          attending: true,
          guests_count: 2,
          note: null,
          created_at: "2026-08-01T18:04:00.000Z",
          superseded: false,
        },
        {
          name: "Марко",
          attending: false,
          guests_count: 1,
          note: null,
          created_at: "2026-08-02T09:30:00.000Z",
          superseded: false,
        },
      ],
      uk,
    );
    expect(csv.startsWith("\uFEFF")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("Ім'я,Відповідь,Гості,Побажання,Час відповіді,Статус");
    // Trailing empty field is the status column: blank means this answer counts.
    expect(lines[1]).toBe("Ірина,Так,2,,2026-08-01 18:04,");
    // Declines carry no meaningful guest count — blank, not the stored 1.
    expect(lines[2]).toBe("Марко,Ні,,,2026-08-02 09:30,");
    expect(lines[3]).toBe("");
  });

  it("exports superseded answers too, marked rather than dropped", () => {
    // The file is the host's full record (adr-010 §5) — a guest who changed
    // their mind leaves both rows, with only the old one flagged.
    const csv = buildRsvpCsv(
      [
        {
          name: "Тарас",
          attending: false,
          guests_count: 1,
          note: null,
          created_at: "2026-08-01T10:00:00.000Z",
          superseded: true,
        },
        {
          name: "Тарас",
          attending: true,
          guests_count: 2,
          note: null,
          created_at: "2026-08-04T10:00:00.000Z",
          superseded: false,
        },
      ],
      uk,
    );
    const lines = csv.slice(1).split("\r\n");
    expect(lines[1]).toBe("Тарас,Ні,,,2026-08-01 10:00,замінена");
    expect(lines[2]).toBe("Тарас,Так,2,,2026-08-04 10:00,");
  });

  it("quotes fields containing commas, quotes, or newlines", () => {
    const csv = buildRsvpCsv(
      [
        {
          name: 'Олена "Оля", молодша',
          attending: true,
          guests_count: 1,
          note: "Буду пізніше,\nдесь о 19:00",
          created_at: "2026-08-01T10:00:00.000Z",
          superseded: false,
        },
      ],
      uk,
    );
    const row = csv.slice(1).split("\r\n")[1];
    expect(row).toBe(
      '"Олена ""Оля"", молодша",Так,1,"Буду пізніше,\nдесь о 19:00",2026-08-01 10:00,',
    );
  });
});
