import type { CopyField, DesignTokens, Language } from "./types";

type DesignValue =
  | DesignTokens["palette"]
  | DesignTokens["typography"]
  | DesignTokens["layout"]
  | DesignTokens["ornament"];

export interface DesignStrings {
  title: string;
  palette: string;
  typography: string;
  layout: string;
  ornament: string;
  values: Record<DesignValue, string>;
}

export interface ChatStrings {
  newInvitation: string;
  back: string;
  share: string;
  startTitle: string;
  startHint: string;
  tryExamples: string;
  examples: string[];
  previewPlaceholder: string;
  placeholderEmpty: string;
  placeholderRefine: string;
  creating: string;
  doneMsg: string;
  failMsg: string;
  editingLabel: string;
  actionRegenerate: string;
  actionManual: string;
  actionVariants: string;
  variantsTitle: string;
  save: string;
  send: string;
}

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
  design: DesignStrings;
  chat: ChatStrings;
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
    design: {
      title: "Design",
      palette: "Palette",
      typography: "Font",
      layout: "Layout",
      ornament: "Ornament",
      values: {
        warm: "Warm",
        elegant: "Elegant",
        playful: "Playful",
        minimal: "Minimal",
        festive: "Festive",
        romantic: "Romantic",
        serif: "Serif",
        sans: "Sans",
        script: "Script",
        classic: "Classic",
        banner: "Banner",
        split: "Split",
        none: "None",
        floral: "Floral",
        geometric: "Geometric",
        sparkle: "Sparkle",
      },
    },
    chat: {
      newInvitation: "New invitation",
      back: "Back",
      share: "Share",
      startTitle: "Where shall we start?",
      startHint: "Describe your event in one sentence — I'll pick the style, colors and wording.",
      tryExamples: "Try, for example",
      examples: [
        "Wedding in September for 80 guests…",
        "My daughter turns 5, party in the park…",
        "Team party for 40 people…",
        "Christening on Sunday…",
      ],
      previewPlaceholder: "Your invitation will appear here",
      placeholderEmpty: "Describe your event in one sentence…",
      placeholderRefine: "Add a detail…",
      creating: "Creating your invitation",
      doneMsg: "Done — tap any part of the invitation to tweak it.",
      failMsg: "Something went wrong. Please try again.",
      editingLabel: "Editing",
      actionRegenerate: "Regenerate",
      actionManual: "Edit manually",
      actionVariants: "Variants",
      variantsTitle: "Variants",
      save: "Save",
      send: "Send",
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
    design: {
      title: "Дизайн",
      palette: "Палітра",
      typography: "Шрифт",
      layout: "Композиція",
      ornament: "Орнамент",
      values: {
        warm: "Тепла",
        elegant: "Елегантна",
        playful: "Грайлива",
        minimal: "Мінімальна",
        festive: "Святкова",
        romantic: "Романтична",
        serif: "Серифний",
        sans: "Гротеск",
        script: "Рукописний",
        classic: "Класична",
        banner: "Банер",
        split: "Асиметрична",
        none: "Без",
        floral: "Квітковий",
        geometric: "Геометричний",
        sparkle: "Іскристий",
      },
    },
    chat: {
      newInvitation: "Нове запрошення",
      back: "Назад",
      share: "Поділитися",
      startTitle: "З чого почнемо?",
      startHint: "Опишіть вашу подію одним реченням — я підберу стиль, кольори й оформлення запрошення.",
      tryExamples: "Спробуйте, наприклад",
      examples: [
        "Весілля у вересні на 80 гостей…",
        "Донечці 5 років, свято в парку…",
        "Корпоратив на 40 людей…",
        "Хрестини у неділю…",
      ],
      previewPlaceholder: "Тут з'явиться ваше запрошення",
      placeholderEmpty: "Опишіть вашу подію одним реченням…",
      placeholderRefine: "Додайте деталь…",
      creating: "Створюю запрошення",
      doneMsg: "Готово — торкніться будь-якої частини запрошення, щоб змінити її.",
      failMsg: "Щось пішло не так. Спробуйте ще раз.",
      editingLabel: "Редагування",
      actionRegenerate: "Перегенерувати",
      actionManual: "Редагувати вручну",
      actionVariants: "Варіанти",
      variantsTitle: "Варіанти",
      save: "Зберегти",
      send: "Надіслати",
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
