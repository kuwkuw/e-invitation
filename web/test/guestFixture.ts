import type { PublishedInvitation } from "../src/types";

/** One published invitation for the tests that render the guest page. Two
 *  hosts, so the seal's monogram is «О&А»; a date and time that parse; a venue
 *  and a city, so «Маршрут» has somewhere to go. */
export function guestFixture(
  brief: Partial<PublishedInvitation["invitation"]["brief"]> = {},
  copy: Partial<PublishedInvitation["invitation"]["copy"]> = {},
): PublishedInvitation {
  return {
    id: "abc123",
    version: 1,
    invitation: {
      brief: {
        event_type: "birthday",
        hosts: ["Олена", "Андрій"],
        date: "12 серпня",
        time: "18:00",
        venue: "Кафе «Затишок»",
        city: "Львів",
        tone: "warm",
        language: "uk",
        extra_details: null,
        ...brief,
      },
      copy: {
        title: "Запрошення",
        greeting: "Дорогі друзі!",
        body: "Запрошуємо вас.",
        details_line: "12 серпня, 18:00\nКафе «Затишок», Львів",
        rsvp_prompt: "Підтвердіть присутність.",
        closing: "Олена",
        ...copy,
      },
      design: { palette: "warm", typography: "serif", layout: "classic", ornament: "floral" },
      background: null,
    },
  } as unknown as PublishedInvitation;
}

/** A guest who has opened this link before: no envelope. */
export function asReturningGuest(id = "abc123"): void {
  localStorage.setItem(`inv-viewed:${id}`, new Date().toISOString());
}
