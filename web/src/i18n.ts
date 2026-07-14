import type { CopyField, Language } from "./types";

interface UiStrings {
  appTitle: string;
  tagline: string;
  placeholder: string;
  generate: string;
  generating: string;
  regenerate: string;
  editorTitle: string;
  previewTitle: string;
  error: string;
  fields: Record<CopyField, string>;
}

export const UI: Record<Language, UiStrings> = {
  en: {
    appTitle: "Invitation Studio",
    tagline: "Describe your event in one sentence — get an invitation you can edit and share.",
    placeholder: "e.g. Olena invites friends to her birthday dinner on August 12 at 6pm, Zatyshok cafe, Lviv",
    generate: "Create invitation",
    generating: "Creating…",
    regenerate: "Regenerate",
    editorTitle: "Edit",
    previewTitle: "Preview",
    error: "Something went wrong. Please try again.",
    fields: {
      title: "Title",
      greeting: "Greeting",
      body: "Message",
      details_line: "Details",
      rsvp_prompt: "RSVP",
      closing: "Sign-off",
    },
  },
  uk: {
    appTitle: "Студія запрошень",
    tagline: "Опишіть подію одним реченням — отримайте запрошення, яке можна редагувати та надсилати.",
    placeholder: "напр. Олена запрошує друзів на день народження 12 серпня о 18:00, кафе «Затишок», Львів",
    generate: "Створити запрошення",
    generating: "Створюємо…",
    regenerate: "Оновити",
    editorTitle: "Редагування",
    previewTitle: "Перегляд",
    error: "Щось пішло не так. Спробуйте ще раз.",
    fields: {
      title: "Заголовок",
      greeting: "Привітання",
      body: "Текст",
      details_line: "Деталі",
      rsvp_prompt: "RSVP",
      closing: "Підпис",
    },
  },
};
