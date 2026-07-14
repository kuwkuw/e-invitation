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
  publish: string;
  publishing: string;
  republish: string;
  publishedVersion: string;
  shareHint: string;
  copyLink: string;
  copied: string;
  responsesTitle: string;
  refreshResponses: string;
  responsesEmpty: string;
  countYes: string;
  countNo: string;
  countGuests: string;
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
    publish: "Publish & get link",
    publishing: "Publishing…",
    republish: "Publish changes",
    publishedVersion: "Published (version {n})",
    shareHint: "Send this link in Viber, Telegram or WhatsApp:",
    copyLink: "Copy link",
    copied: "Copied!",
    responsesTitle: "Responses",
    refreshResponses: "Refresh",
    responsesEmpty: "No responses yet.",
    countYes: "coming",
    countNo: "can't come",
    countGuests: "guests total",
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
    publish: "Опублікувати й отримати лінк",
    publishing: "Публікуємо…",
    republish: "Опублікувати зміни",
    publishedVersion: "Опубліковано (версія {n})",
    shareHint: "Надішліть це посилання у Viber, Telegram або WhatsApp:",
    copyLink: "Скопіювати лінк",
    copied: "Скопійовано!",
    responsesTitle: "Відповіді",
    refreshResponses: "Оновити",
    responsesEmpty: "Поки що немає відповідей.",
    countYes: "прийдуть",
    countNo: "не зможуть",
    countGuests: "гостей разом",
  },
};

// Guest-facing strings follow the invitation's language (brief.language),
// independent of the host's UI toggle.
interface GuestStrings {
  loading: string;
  notFound: string;
  error: string;
  formTitle: string;
  yourName: string;
  attendingQuestion: string;
  yes: string;
  no: string;
  guestsCount: string;
  noteLabel: string;
  send: string;
  sending: string;
  thanks: string;
}

export const GUEST: Record<Language, GuestStrings> = {
  en: {
    loading: "Loading…",
    notFound: "This invitation does not exist or was removed.",
    error: "Something went wrong. Please try again.",
    formTitle: "Will you join us?",
    yourName: "Your name",
    attendingQuestion: "Will you come?",
    yes: "I'll be there",
    no: "Can't make it",
    guestsCount: "How many of you?",
    noteLabel: "Message for the hosts (optional)",
    send: "Send reply",
    sending: "Sending…",
    thanks: "Thank you! Your reply has been sent.",
  },
  uk: {
    loading: "Завантаження…",
    notFound: "Такого запрошення не існує або його видалили.",
    error: "Щось пішло не так. Спробуйте ще раз.",
    formTitle: "Приєднаєтесь до нас?",
    yourName: "Ваше ім'я",
    attendingQuestion: "Чи прийдете?",
    yes: "Я буду",
    no: "Не зможу",
    guestsCount: "Скільки вас буде?",
    noteLabel: "Повідомлення для господарів (необов'язково)",
    send: "Надіслати відповідь",
    sending: "Надсилаємо…",
    thanks: "Дякуємо! Вашу відповідь надіслано.",
  },
};
