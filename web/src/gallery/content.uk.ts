import type { EventBrief } from "../types";
import type { OccasionId } from "./occasions";
import type { GalleryExample } from "./types";

/** A brief with nothing but words: the gallery's examples state no date, time,
 *  venue or city (adr-017 §3), so this is the whole of the shared shape.
 *
 *  Not cosmetic. A hardcoded date eventually becomes a past date, and FR-1.8
 *  refuses to publish one — the template would silently stop being publishable
 *  on a calendar boundary. Empty instead trips FR-1.7's nudge, and "when is
 *  it?" is exactly the right question for someone who just took a template. */
function brief(event_type: string, hosts: string[], tone: string): EventBrief {
  return {
    event_type,
    hosts,
    date: null,
    time: null,
    venue: null,
    city: null,
    tone,
    language: "uk",
    extra_details: null,
  };
}

export const GALLERY_UK: Partial<Record<OccasionId, GalleryExample[]>> = {
  wedding: [
    {
      id: "wedding-romantic",
      style: "Романтичний",
      styleNote: "Рукописний шрифт, тепла пастель",
      sentence: "Ми з Андрієм одружуємось і запрошуємо рідних та друзів",
      brief: brief("весілля", ["Олена", "Андрій"], "романтичний"),
      copy: {
        title: "Ми одружуємось!",
        greeting: "Любі рідні та друзі,",
        body: "З радістю запрошуємо вас розділити з нами день, коли ми скажемо одне одному «так».",
        details_line: "Дату та місце повідомимо особисто",
        rsvp_prompt: "Дайте знати, чи зможете бути поруч.",
        closing: "Олена та Андрій",
      },
    },
    {
      id: "wedding-formal",
      style: "Стриманий",
      styleNote: "Заголовок-банер, офіційний тон",
      sentence: "Весілля Олени та Андрія, офіційне запрошення для гостей",
      brief: brief("весілля", ["Олена", "Андрій"], "офіційний"),
      copy: {
        title: "Олена та Андрій запрошують",
        greeting: "Шановні гості,",
        body: "Ми будемо щиро раді бачити вас серед найближчих людей у день нашого весілля.",
        details_line: "Деталі урочистості надішлемо згодом",
        rsvp_prompt: "Просимо підтвердити свою присутність.",
        closing: "Родини Коваль і Мельник",
      },
    },
    {
      id: "wedding-festive",
      style: "Урочистий",
      styleNote: "Текст ліворуч, насичений акцент",
      sentence: "Велике весілля з музикою і танцями, запрошуємо всіх друзів",
      brief: brief("весілля", ["Олена", "Андрій"], "святковий"),
      copy: {
        title: "Весілля Олени та Андрія",
        greeting: "Дорогі друзі!",
        body: "Збираємо всіх, кого любимо, на свято, якого ми довго чекали. Буде музика, танці та дуже багато радості.",
        details_line: "Дата й місце — зовсім скоро",
        rsvp_prompt: "Напишіть, чи святкуєте разом із нами.",
        closing: "До зустрічі!",
      },
    },
    {
      id: "wedding-minimal",
      style: "Мінімалістичний",
      styleNote: "Без прикрас, коротко й сучасно",
      sentence: "Коротке сучасне запрошення на весілля без зайвих слів",
      brief: brief("весілля", ["Олена", "Андрій"], "сучасний"),
      copy: {
        title: "Незабаром — наше весілля",
        greeting: "Привіт!",
        body: "Ми одружуємось і дуже хочемо, щоб ви були поруч. Деталі — трохи згодом.",
        details_line: "Дату оголосимо найближчим часом",
        rsvp_prompt: "Відповідайте, щойно будете готові.",
        closing: "Олена + Андрій",
      },
    },
  ],
};
