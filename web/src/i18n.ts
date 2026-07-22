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
  quotaMsg: string;
  keyMsg: string;
  limitMsg: string;
}

export interface ByokStrings {
  button: string;
  title: string;
  intro: string;
  provider: string;
  keyLabel: string;
  keyPlaceholder: string;
  save: string;
  clear: string;
  active: string;
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
  byok: ByokStrings;
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
      quotaMsg: "The AI's free daily limit is used up. Try again tomorrow — or add your own key via the AI key button above.",
      keyMsg: "The AI key didn't work — check it in the AI key panel above.",
      limitMsg: "Today's free generations are used up. Come back tomorrow — or add your own key via the AI key button above.",
    },
    byok: {
      button: "AI key",
      title: "Your AI key",
      intro:
        "Generation can run on your own AI key. It stays in this browser only and is sent just with your requests — the server never stores it. Tip: use a separate free-tier key, not one linked to billing.",
      provider: "Provider",
      keyLabel: "API key",
      keyPlaceholder: "Paste your key…",
      save: "Save key",
      clear: "Remove",
      active: "Using your key",
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
      quotaMsg: "Безкоштовний денний ліміт AI вичерпано. Спробуйте завтра — або додайте власний ключ через кнопку «Ключ AI» вгорі.",
      keyMsg: "Ключ AI не спрацював — перевірте його в панелі «Ключ AI» вгорі.",
      limitMsg: "Безкоштовні генерації на сьогодні вичерпано. Поверніться завтра — або додайте власний ключ через кнопку «Ключ AI» вгорі.",
    },
    byok: {
      button: "Ключ AI",
      title: "Ваш ключ AI",
      intro:
        "Генерація може працювати на вашому власному ключі AI. Він зберігається лише в цьому браузері й надсилається тільки з вашими запитами — сервер його не зберігає. Порада: використовуйте окремий безкоштовний ключ, не прив'язаний до платіжних даних.",
      provider: "Провайдер",
      keyLabel: "API-ключ",
      keyPlaceholder: "Вставте ваш ключ…",
      save: "Зберегти ключ",
      clear: "Видалити",
      active: "Використовується ваш ключ",
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

// Host UI language is shared between the landing page and the editor.
const UI_LANG_KEY = "inv-ui-lang";

export function loadUiLang(): Language {
  const stored = localStorage.getItem(UI_LANG_KEY);
  return stored === "en" || stored === "uk" ? stored : "uk";
}

export function saveUiLang(lang: Language): void {
  localStorage.setItem(UI_LANG_KEY, lang);
}

// Landing-page marketing copy. The sample invitations in the hero stay
// Ukrainian on purpose — they're showcased content, not chrome.
export interface LandingStrings {
  brand: string;
  cta: string;
  heroTitle: string;
  heroText: string;
  howTitle: string;
  steps: { title: string; text: string }[];
  chips: string[];
  rsvpTitle: string;
  rsvpText: string;
  rsvpSummary: string;
  responseLabels: { yes: string; no: string; wait: string };
  finalTitle: string;
  footer: string;
}

export const LANDING: Record<Language, LandingStrings> = {
  en: {
    brand: "Zaproshennya",
    cta: "Create an invitation",
    heroTitle: "An invitation from one sentence",
    heroText: "Describe your event in words — get a beautiful invitation in a minute.",
    howTitle: "How it works",
    steps: [
      { title: "Describe the event", text: "In your own words — what, when and where." },
      { title: "Get a design", text: "We pick the style, colors and layout." },
      { title: "Share the link", text: "Send it to guests — and collect replies." },
    ],
    chips: ["wedding", "birthday", "kids party", "team event", "christening"],
    rsvpTitle: "Know who's coming",
    rsvpText:
      "Guests confirm by the link — you see the replies right away, no calls or reminders.",
    rsvpSummary: "18 coming · 3 can't make it · 5 haven't replied",
    responseLabels: { yes: "Yes", no: "No", wait: "Waiting" },
    finalTitle: "Ready to send your first invitation?",
    footer: "Zaproshennya — simple, and Ukrainian at heart.",
  },
  uk: {
    brand: "Запрошення",
    cta: "Створити запрошення",
    heroTitle: "Запрошення за одне речення",
    heroText: "Опишіть подію словами — отримайте гарне запрошення за хвилину.",
    howTitle: "Як це працює",
    steps: [
      { title: "Опишіть подію", text: "Своїми словами — що святкуєте, коли і де." },
      { title: "Отримайте дизайн", text: "Ми підберемо стиль, кольори та оформлення." },
      { title: "Поділіться посиланням", text: "Надішліть гостям — і збирайте відповіді." },
    ],
    chips: ["весілля", "день народження", "дитяче свято", "корпоратив", "хрестини"],
    rsvpTitle: "Знайте, хто прийде",
    rsvpText:
      "Гості підтверджують участь за посиланням — ви бачите відповіді одразу, без дзвінків і нагадувань.",
    rsvpSummary: "18 прийдуть · 3 не прийдуть · 5 ще не відповіли",
    responseLabels: { yes: "Так", no: "Ні", wait: "Очікує" },
    finalTitle: "Готові надіслати перше запрошення?",
    footer: "Запрошення — просто і по-українськи.",
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
