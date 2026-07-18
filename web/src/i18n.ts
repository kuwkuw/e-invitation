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
  notFoundTitle: string;
  notFoundBody: string;
  notFoundHint: string;
  error: string;
  replyKicker: string;
  yourName: string;
  namePlaceholder: string;
  attendingQuestion: string;
  yes: string;
  no: string;
  guestsCount: string;
  noteLabel: string;
  noteOptional: string;
  notePlaceholder: string;
  send: string;
  sending: string;
  thanksTitle: string;
  thanksSent: string;
  thanksGlad: string;
  declinedTitle: string;
  declinedSorry: string;
  attendingPill: string;
  declinedPill: string;
  guestForms: [string, string, string];
  changeAnswer: string;
  directions: string;
  share: string;
  shareHint: string;
  linkCopied: string;
}

export const GUEST: Record<Language, GuestStrings> = {
  en: {
    loading: "Loading…",
    notFoundTitle: "Invitation not found",
    notFoundBody: "The link may be outdated, or the invitation hasn't been published yet.",
    notFoundHint: "Ask the host to send you a fresh link.",
    error: "Something went wrong. Please try again.",
    replyKicker: "Your reply",
    yourName: "Your name",
    namePlaceholder: "Type your name",
    attendingQuestion: "Will you come?",
    yes: "I'll be there",
    no: "Can't make it",
    guestsCount: "How many of you?",
    noteLabel: "A note for the hosts",
    noteOptional: "(optional)",
    notePlaceholder: "A few warm words…",
    send: "Send reply",
    sending: "Sending…",
    thanksTitle: "Thank you!",
    thanksSent: "Your reply has been sent.",
    thanksGlad: "So glad you'll be with us.",
    declinedTitle: "Thanks for letting us know",
    declinedSorry: "Sorry it won't work out this time.",
    attendingPill: "You're coming",
    declinedPill: "You can't make it",
    guestForms: ["guest", "guests", "guests"],
    changeAnswer: "Change your reply",
    directions: "How to get there",
    share: "Share the invitation",
    shareHint: "Viber · Telegram · link",
    linkCopied: "Link copied!",
  },
  uk: {
    loading: "Завантаження…",
    notFoundTitle: "Запрошення не знайдено",
    notFoundBody: "Можливо, посилання застаріло або запрошення ще не опубліковане.",
    notFoundHint: "Попросіть господаря надіслати актуальне посилання.",
    error: "Щось пішло не так. Спробуйте ще раз.",
    replyKicker: "Ваша відповідь",
    yourName: "Ваше ім'я",
    namePlaceholder: "Напишіть ім'я",
    attendingQuestion: "Чи прийдете?",
    yes: "Я буду",
    no: "Не зможу",
    guestsCount: "Скільки вас буде?",
    noteLabel: "Побажання господарям",
    noteOptional: "(необов'язково)",
    notePlaceholder: "Кілька теплих слів…",
    send: "Надіслати відповідь",
    sending: "Надсилаємо…",
    thanksTitle: "Дякуємо!",
    thanksSent: "Вашу відповідь надіслано.",
    thanksGlad: "Раді, що ви будете з нами.",
    declinedTitle: "Дякуємо, що дали знати",
    declinedSorry: "Шкода, що не вийде цього разу.",
    attendingPill: "Ви йдете",
    declinedPill: "Ви не зможете прийти",
    guestForms: ["гість", "гості", "гостей"],
    changeAnswer: "Змінити відповідь",
    directions: "Як дістатися",
    share: "Поділитися запрошенням",
    shareHint: "Viber · Telegram · посилання",
    linkCopied: "Посилання скопійовано!",
  },
};
