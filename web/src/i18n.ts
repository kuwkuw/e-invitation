import type { RsvpCsvStrings } from "./csv";
import type { RelativeTimeStrings } from "./relativeTime";
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
  background: string;
  bgAdd: string;
  bgRegenerate: string;
  bgRemove: string;
  bgGenerating: string;
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
  /** Asked once when the generated brief carries no date a calendar can read
   *  — the one missing fact the host gets no other signal about. */
  dateNudge: string;
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
  busyMsg: string;
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

export interface UiStrings {
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
  publishedTitle: string;
  publishedVersion: string;
  publishedSubtitle: string;
  guestLinkLabel: string;
  guestLinkBadge: string;
  shareHint: string;
  copyLink: string;
  copied: string;
  manageLinkLabel: string;
  manageLinkWarning: string;
  manageLinkMasked: string;
  revealManageLink: string;
  copyManageLink: string;
  manageLinkCopied: string;
  viewResponses: string;
  // Host accounts (adr-014). Copy is verbatim from the DS `AuthGateSpec`,
  // `ShareSignedIn` and `LandingSignedInStates` boards. The forbidden words
  // recorded there — sign up / register / create an account / required, and
  // their Ukrainian equivalents — must not reappear here: the gate says what
  // the host gets, never what we demand.
  auth: AuthStrings;
}

export interface AuthStrings {
  gateTitle: string;
  gateWhy: string;
  continueWithGoogle: string;
  dataNote: string;
  backToEditing: string;
  redirecting: string;
  redirectingNote: string;
  returningTitle: string;
  returningNote: string;
  declinedTitle: string;
  declinedBody: string;
  tryAgain: string;
  failedTitle: string;
  failedBody: string;
  draftSaved: string;
  errorCode: string;
  savedToAccount: string;
  showManage: string;
  hideManage: string;
  /** adr-015 §7: the disclosure is made where it is caused — at publish, with
   *  the off switch beside it — rather than discovered from the first email.
   *  `{email}` is the signed-in address the replies will go to. */
  notifyOn: string;
  /** The same fact on the landing footer, where the address is already on the
   *  line above — repeating it would say one thing twice in one block. */
  notifyOnAccount: string;
  notifyOff: string;
  notifyTurnOff: string;
  notifyTurnOn: string;
  signOut: string;
  crossDevice: string;
  emptySignedIn: string;
  invitationCount: string;
  onThisDevice: string;
  deleteTitle: string;
  deleteHeadline: string;
  deleteKeepGuests: string;
  deleteKeepReplies: string;
  deleteKeepManage: string;
  deleteWhatGoes: string;
  saveKeysTitle: string;
  saveKeysBody: string;
  copyAllLinks: string;
  copyAllLinksDone: string;
  cancel: string;
  deleteAccount: string;
}

// Host accounts (adr-014). Its own table because the editor and the landing
// page read from different string sets and both need these.
export const AUTH: Record<Language, AuthStrings> = {
  en: {
    gateTitle: "Publishing your invitation",
    gateWhy: "So your guests' replies are still here when you come back.",
    continueWithGoogle: "Continue with Google",
    dataNote: "We keep only your email address. Nothing else.",
    backToEditing: "Back to editing",
    redirecting: "Opening Google…",
    redirectingNote: "Your invitation is saved — you'll come back to exactly this.",
    returningTitle: "Publishing…",
    returningNote: "One second — your link is on its way.",
    declinedTitle: "All right, not now",
    declinedBody:
      "Your invitation is right where you left it. Keep editing, or publish when you're ready.",
    tryAgain: "Try again",
    failedTitle: "Couldn't finish",
    failedBody: "Something broke on the way back from Google. Not your fault — try again.",
    draftSaved: "Draft saved in this browser",
    errorCode: "code: auth_{code}_failed",
    savedToAccount: "Saved to your account — it'll be there on any device you sign in on.",
    showManage: "Show",
    hideManage: "Hide",
    notifyOn: "We'll email {email} when replies come in.",
    notifyOnAccount: "We'll email you when replies come in.",
    notifyOff: "We won't email you about replies to any of your invitations.",
    notifyTurnOff: "Turn off all emails",
    notifyTurnOn: "Turn emails back on",
    signOut: "Sign out",
    crossDevice: "This list opens on any device you sign in on.",
    emptySignedIn: "Your invitations will appear here — and stay, wherever you sign in.",
    invitationCount: "{n} invitations",
    onThisDevice: "on this device",
    deleteTitle: "Delete your account?",
    deleteHeadline: "Your {n} invitations stay exactly where they are.",
    deleteKeepGuests: "Guests can still open their links and reply",
    deleteKeepReplies: "All {n} replies you've collected are kept",
    deleteKeepManage: "Your manage links keep working as before",
    deleteWhatGoes:
      "Only this list goes away. We'll forget your email address and stop remembering your invitations on other devices.",
    saveKeysTitle: "Save your keys first",
    saveKeysBody:
      "Without the account, a manage link is the only way in. Copy them somewhere safe — notes, or an email to yourself.",
    copyAllLinks: "Copy all {n} links",
    copyAllLinksDone: "Copied — keep them private",
    cancel: "Cancel",
    deleteAccount: "Delete account",
  },
  uk: {
    gateTitle: "Публікуємо запрошення",
    gateWhy: "Щоб відповіді гостей були тут, коли ви повернетесь.",
    continueWithGoogle: "Продовжити з Google",
    dataNote: "Зберігаємо лише вашу пошту. Нічого більше.",
    backToEditing: "Повернутись до редагування",
    redirecting: "Відкриваємо Google…",
    redirectingNote: "Ваше запрошення збережено — ви повернетесь точно сюди.",
    returningTitle: "Публікуємо…",
    returningNote: "Ще секунда — і посилання буде тут.",
    declinedTitle: "Гаразд, не зараз",
    declinedBody:
      "Запрошення на місці — нічого не втрачено. Можете й далі редагувати або опублікувати, коли будете готові.",
    tryAgain: "Спробувати ще раз",
    failedTitle: "Не вдалося завершити",
    failedBody: "Щось не спрацювало на шляху від Google. Це не через вас — спробуйте ще раз.",
    draftSaved: "Чернетка збережена в цьому браузері",
    errorCode: "код: auth_{code}_failed",
    savedToAccount:
      "Збережено у вашому акаунті — відкриється на будь-якому пристрої, де ви увійдете.",
    showManage: "Показати",
    hideManage: "Сховати",
    notifyOn: "Ми напишемо на {email}, коли надійдуть відповіді.",
    notifyOnAccount: "Ми напишемо вам, коли надійдуть відповіді.",
    notifyOff: "Ми не надсилатимемо листів про відповіді на жодне ваше запрошення.",
    notifyTurnOff: "Вимкнути всі листи",
    notifyTurnOn: "Увімкнути листи",
    signOut: "Вийти",
    crossDevice: "Цей список відкриється на будь-якому пристрої, де ви увійдете.",
    emptySignedIn: "Тут з'являться ваші запрошення — і залишаться, куди б ви не увійшли.",
    invitationCount: "{n} запрошень",
    onThisDevice: "на цьому пристрої",
    deleteTitle: "Видалити акаунт?",
    deleteHeadline: "Ваші {n} запрошення нікуди не дінуться.",
    deleteKeepGuests: "Гості й далі відкриють свої посилання й дадуть відповідь",
    deleteKeepReplies: "Усі {n} відповіді, що вже зібрані, залишаються",
    deleteKeepManage: "Ваші посилання для керування працюють, як і раніше",
    deleteWhatGoes:
      "Зникає лише цей список. Ми забудемо вашу пошту й перестанемо пам'ятати ваші запрошення на інших пристроях.",
    saveKeysTitle: "Спершу збережіть свої ключі",
    saveKeysBody:
      "Без акаунта запрошення відкриває лише посилання для керування. Скопіюйте їх собі — у нотатки чи в листа.",
    copyAllLinks: "Скопіювати всі {n} посилання",
    copyAllLinksDone: "Скопійовано — тримайте при собі",
    cancel: "Скасувати",
    deleteAccount: "Видалити акаунт",
  },
};

export const UI: Record<Language, UiStrings> = {
  en: {
    appTitle: "Invitation Studio",
    tagline: "Describe your event in one sentence — get an invitation you can edit and share.",
    placeholder:
      "e.g. Olena invites friends to her birthday dinner on August 12 at 6pm, Zatyshok cafe, Lviv",
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
      background: "Background",
      bgAdd: "✦ Add AI background",
      bgRegenerate: "Try another",
      bgRemove: "Remove",
      bgGenerating: "Painting the background…",
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
      dateNudge:
        "When exactly is it? Add the date and I'll put it on the card — then guests can save the event to their calendar.",
      failMsg: "Something went wrong. Please try again.",
      editingLabel: "Editing",
      actionRegenerate: "Regenerate",
      actionManual: "Edit manually",
      actionVariants: "Variants",
      variantsTitle: "Variants",
      save: "Save",
      send: "Send",
      quotaMsg:
        "The AI's free daily limit is used up. Try again tomorrow — or add your own key via the AI key button above.",
      keyMsg: "The AI key didn't work — check it in the AI key panel above.",
      limitMsg:
        "Today's free generations are used up. Come back tomorrow — or add your own key via the AI key button above.",
      busyMsg: "The AI is busy right now. Please try again in a moment.",
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
    publishedTitle: "Published!",
    publishedVersion: "Version {n}",
    publishedSubtitle: "Send the link to your guests — then wait for replies.",
    guestLinkLabel: "Link for guests",
    guestLinkBadge: "public",
    shareHint: "Paste it into Viber, Telegram or WhatsApp",
    copyLink: "Copy the link",
    copied: "Copied!",
    manageLinkLabel: "Manage link",
    manageLinkWarning:
      "For you only — don't send it to a chat. Anyone who opens it sees every response.",
    manageLinkMasked: "••••••••",
    revealManageLink: "Show the full link",
    copyManageLink: "Copy",
    manageLinkCopied: "Copied — keep it private",
    auth: AUTH.en,
    viewResponses: "View responses →",
  },
  uk: {
    appTitle: "Студія запрошень",
    tagline:
      "Опишіть подію одним реченням — отримайте запрошення, яке можна редагувати та надсилати.",
    placeholder:
      "напр. Олена запрошує друзів на день народження 12 серпня о 18:00, кафе «Затишок», Львів",
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
      background: "Фон",
      bgAdd: "✦ Додати AI-фон",
      bgRegenerate: "Спробувати інший",
      bgRemove: "Прибрати",
      bgGenerating: "Малюю фон…",
    },
    chat: {
      newInvitation: "Нове запрошення",
      back: "Назад",
      share: "Поділитися",
      startTitle: "З чого почнемо?",
      startHint:
        "Опишіть вашу подію одним реченням — я підберу стиль, кольори й оформлення запрошення.",
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
      dateNudge:
        "А коли саме це буде? Додайте дату — я впишу її в запрошення, і гості зможуть зберегти подію в календар.",
      failMsg: "Щось пішло не так. Спробуйте ще раз.",
      editingLabel: "Редагування",
      actionRegenerate: "Перегенерувати",
      actionManual: "Редагувати вручну",
      actionVariants: "Варіанти",
      variantsTitle: "Варіанти",
      save: "Зберегти",
      send: "Надіслати",
      quotaMsg:
        "Безкоштовний денний ліміт AI вичерпано. Спробуйте завтра — або додайте власний ключ через кнопку «Ключ AI» вгорі.",
      keyMsg: "Ключ AI не спрацював — перевірте його в панелі «Ключ AI» вгорі.",
      limitMsg:
        "Безкоштовні генерації на сьогодні вичерпано. Поверніться завтра — або додайте власний ключ через кнопку «Ключ AI» вгорі.",
      busyMsg: "AI зараз перевантажений. Спробуйте ще раз за мить.",
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
    publishedTitle: "Опубліковано!",
    publishedVersion: "Версія {n}",
    publishedSubtitle: "Надішліть посилання гостям — і чекайте відповіді.",
    guestLinkLabel: "Посилання для гостей",
    guestLinkBadge: "публічне",
    shareHint: "Вставте у Viber, Telegram або WhatsApp",
    copyLink: "Скопіювати посилання",
    copied: "Скопійовано!",
    manageLinkLabel: "Посилання для керування",
    manageLinkWarning:
      "Лише для вас — не надсилайте його в чат. Хто відкриє, побачить усі відповіді.",
    manageLinkMasked: "••••••••",
    revealManageLink: "Показати повне посилання",
    copyManageLink: "Копіювати",
    manageLinkCopied: "Скопійовано — тримайте при собі",
    auth: AUTH.uk,
    viewResponses: "Переглянути відповіді →",
  },
};

// Host UI language is shared between the landing page and the editor.
const UI_LANG_KEY = "inv-ui-lang";

export function loadUiLang(): Language {
  try {
    const stored = localStorage.getItem(UI_LANG_KEY);
    return stored === "en" || stored === "uk" ? stored : "uk";
  } catch {
    // Private-mode Safari and blocked-storage settings throw on access, and
    // this runs as a `useState` initializer on three of the four routes — an
    // unguarded throw here is a blank page, not a forgotten preference. Fall
    // back to the default language, as `loadGuestLang` does on the guest side.
    return "uk";
  }
}

export function saveUiLang(lang: Language): void {
  try {
    localStorage.setItem(UI_LANG_KEY, lang);
  } catch {
    // Non-fatal: the switch still applies for this page view.
  }
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
  // Returning-host block (adr-010 §4). Ukrainian needs a singular heading, so
  // the one-invitation case has its own string rather than a naive plural.
  yoursTitle: string;
  yoursTitleOne: string;
  yoursOnThisDevice: string;
  yoursCountOnThisDevice: string;
  yoursPublished: string;
  yoursShowAll: string;
  // Per-row response counts (adr-012, FR-5.7). `yoursReplyForms` is the Slavic
  // one/few/many for "reply"; `yoursNoReplies` is the muted 0-state so the slot
  // is never a bare "0". The "new" badge shows a number, with the full phrase
  // read out through `yoursNewAria`.
  yoursReplies: string;
  yoursReplyForms: [one: string, few: string, many: string];
  yoursNoReplies: string;
  yoursNewAria: string;
  time: RelativeTimeStrings;
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
    rsvpText: "Guests confirm by the link — you see the replies right away, no calls or reminders.",
    rsvpSummary: "18 coming · 3 can't make it · 5 haven't replied",
    responseLabels: { yes: "Yes", no: "No", wait: "Waiting" },
    finalTitle: "Ready to send your first invitation?",
    footer: "Zaproshennya — simple, and Ukrainian at heart.",
    yoursTitle: "Your invitations",
    yoursTitleOne: "Your invitation",
    yoursOnThisDevice: "saved on this device",
    yoursCountOnThisDevice: "{n} on this device",
    yoursPublished: "Published {when}",
    yoursShowAll: "Show all {n}",
    yoursReplies: "{n} {form}",
    yoursReplyForms: ["reply", "replies", "replies"],
    yoursNoReplies: "no replies",
    yoursNewAria: "{n} new since your last visit",
    time: {
      justNow: "just now",
      minutesAgo: "{n} min ago",
      hoursAgo: "{n} h ago",
      yesterday: "yesterday",
      daysAgo: "{n} {form} ago",
      dayForms: ["day", "days", "days"],
    },
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
    yoursTitle: "Ваші запрошення",
    yoursTitleOne: "Ваше запрошення",
    yoursOnThisDevice: "збережено на цьому пристрої",
    yoursCountOnThisDevice: "{n} на цьому пристрої",
    yoursPublished: "Опубліковано {when}",
    yoursShowAll: "Показати всі {n}",
    yoursReplies: "{n} {form}",
    yoursReplyForms: ["відповідь", "відповіді", "відповідей"],
    yoursNoReplies: "без відповідей",
    yoursNewAria: "{n} нових з вашого останнього візиту",
    time: {
      justNow: "щойно",
      minutesAgo: "{n} хв тому",
      hoursAgo: "{n} год тому",
      yesterday: "вчора",
      daysAgo: "{n} {form} тому",
      dayForms: ["день", "дні", "днів"],
    },
  },
};

// Guest-facing strings follow the invitation's language (brief.language),
// independent of the host's UI toggle.
export interface GuestStrings {
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
  addToCalendar: string;
  directions: string;
  share: string;
  shareHint: string;
  linkCopied: string;
  /** The guest page's only link back to the product (adr-013 §7). Chrome, so
   *  the language switcher moves it (FR-6.3) — never host content. */
  ctaLine: string;
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
    addToCalendar: "Add to calendar",
    directions: "How to get there",
    share: "Share the invitation",
    shareHint: "Viber · Telegram · link",
    linkCopied: "Link copied!",
    ctaLine: "Create your own invitation",
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
    addToCalendar: "Додати в календар",
    directions: "Як дістатися",
    share: "Поділитися запрошенням",
    shareHint: "Viber · Telegram · посилання",
    linkCopied: "Посилання скопійовано!",
    ctaLine: "Створіть власне запрошення",
  },
};

// Host response dashboard at /manage/:id. Copy follows the "host-manage"
// template in the E-invitation DS project: every access state stays calm —
// none of them is the host's fault, and all of them have the same one-step
// recovery (paste your manage link).
export interface ManageStrings {
  kicker: string;
  loading: string;
  updatedJustNow: string;
  guestsComing: string;
  comingBreakdown: string;
  tileYes: string;
  tileNo: string;
  tileReplied: string;
  newSinceVisit: string;
  responsesTitle: string;
  previousAnswer: string;
  emptyTitle: string;
  emptyBody: string;
  emptyReassure: string;
  shareAgain: string;
  copyLink: string;
  copied: string;
  exportCsv: string;
  yes: string;
  no: string;
  time: RelativeTimeStrings;
  csv: RsvpCsvStrings;
  noTokenTitle: string;
  noTokenBody: string;
  noTokenHint: string;
  invalidTitle: string;
  invalidBody: string;
  invalidReassure: string;
  notFoundTitle: string;
  notFoundBody: string;
  errorTitle: string;
  errorBody: string;
  pastePlaceholder: string;
  pasteInvalid: string;
  openDashboard: string;
  refresh: string;
  retry: string;
}

export const MANAGE: Record<Language, ManageStrings> = {
  en: {
    kicker: "Host dashboard",
    loading: "Loading responses…",
    updatedJustNow: "updated just now",
    guestsComing: "guests coming",
    comingBreakdown: "{yes} said yes · +{extra} with companions",
    tileYes: "Yes",
    tileNo: "No",
    tileReplied: "Replied",
    newSinceVisit: "{n} new since your last visit",
    responsesTitle: "Responses · {n}",
    previousAnswer: "previous answer",
    emptyTitle: "No one has replied yet",
    emptyBody:
      "The invitation is published and ready. As soon as someone answers, it shows up here.",
    emptyReassure: "That's normal — guests usually reply over a few days.",
    shareAgain: "Share the link again",
    copyLink: "Copy",
    copied: "Copied!",
    exportCsv: "Export CSV",
    yes: "Yes",
    no: "No",
    time: {
      justNow: "just now",
      minutesAgo: "{n} min ago",
      hoursAgo: "{n} h ago",
      yesterday: "yesterday",
      daysAgo: "{n} {form} ago",
      dayForms: ["day", "days", "days"],
    },
    csv: {
      headers: ["Name", "Answer", "Guests", "Note", "Replied at", "Status"],
      yes: "Yes",
      no: "No",
      superseded: "superseded",
    },
    noTokenTitle: "Your link is needed",
    noTokenBody:
      "This dashboard opens only with the personal link you got when you created the invitation. Paste it below.",
    noTokenHint: "The link is saved in the messenger you shared the invitation from.",
    invalidTitle: "This link no longer works",
    invalidBody: "It may have changed or expired. Paste your current manage link to continue.",
    invalidReassure:
      "Your responses haven't gone anywhere — as soon as the link is right, you'll see them again.",
    notFoundTitle: "Invitation not found",
    notFoundBody: "The link may be outdated, or this invitation was never published.",
    errorTitle: "Couldn't load the responses",
    errorBody: "Something went wrong on the way. Try again in a moment.",
    pastePlaceholder: "Paste your manage link…",
    pasteInvalid: "That doesn't look like a manage link.",
    openDashboard: "Open dashboard",
    refresh: "Refresh",
    retry: "Try again",
  },
  uk: {
    kicker: "Панель господаря",
    loading: "Завантаження відповідей…",
    updatedJustNow: "оновлено щойно",
    guestsComing: "гостей прийдуть",
    comingBreakdown: "{yes} відповіли «так» · +{extra} із супутниками",
    tileYes: "Так",
    tileNo: "Ні",
    tileReplied: "Відповіли",
    newSinceVisit: "{n} нових від вашого останнього візиту",
    responsesTitle: "Відповіді · {n}",
    previousAnswer: "попередня відповідь",
    emptyTitle: "Ще ніхто не відповів",
    emptyBody: "Запрошення опубліковане й готове. Щойно хтось відповість — усе з'явиться тут.",
    emptyReassure: "Це нормально — зазвичай гості відповідають протягом кількох днів.",
    shareAgain: "Поділіться посиланням ще раз",
    copyLink: "Копіювати",
    copied: "Скопійовано!",
    exportCsv: "Експорт CSV",
    yes: "Так",
    no: "Ні",
    time: {
      justNow: "щойно",
      minutesAgo: "{n} хв тому",
      hoursAgo: "{n} год тому",
      yesterday: "вчора",
      daysAgo: "{n} {form} тому",
      dayForms: ["день", "дні", "днів"],
    },
    csv: {
      headers: ["Ім'я", "Відповідь", "Гості", "Побажання", "Час відповіді", "Статус"],
      yes: "Так",
      no: "Ні",
      superseded: "замінена",
    },
    noTokenTitle: "Потрібне ваше посилання",
    noTokenBody:
      "Ця панель відкривається лише за особистим посиланням, яке ви отримали при створенні запрошення. Вставте його нижче.",
    noTokenHint: "Посилання зберігається у месенджері, звідки ви ділились запрошенням.",
    invalidTitle: "Посилання вже не дійсне",
    invalidBody:
      "Можливо, воно змінилось або застаріло. Вставте актуальне посилання для керування, щоб продовжити.",
    invalidReassure:
      "Ваші відповіді нікуди не зникли — щойно посилання буде правильним, ви побачите їх знову.",
    notFoundTitle: "Запрошення не знайдено",
    notFoundBody: "Можливо, посилання застаріле або це запрошення не публікували.",
    errorTitle: "Не вдалося завантажити відповіді",
    errorBody: "Щось пішло не так дорогою. Спробуйте ще раз за мить.",
    pastePlaceholder: "Вставте посилання для керування…",
    pasteInvalid: "Це не схоже на посилання для керування.",
    openDashboard: "Відкрити панель",
    refresh: "Оновити",
    retry: "Спробувати ще раз",
  },
};

// Last-resort copy behind the route error boundary — the only screen that has
// to read as calmly as the others while knowing nothing about what broke.
// Two audiences, because the recovery differs: a host can reload and go on
// working, while a guest can only reload and, failing that, ask for a fresh
// link — the same one-step way out as GUEST.notFoundHint.
export type CrashAudience = "host" | "guest";

export interface CrashStrings {
  title: string;
  body: string;
  hint: string;
  reload: string;
}

export const CRASH: Record<Language, Record<CrashAudience, CrashStrings>> = {
  en: {
    host: {
      title: "Something went wrong",
      body: "This page hit an unexpected error and couldn't finish loading. Reloading usually clears it.",
      hint: "Published invitations and their responses are safe on the server — nothing you've shared is affected.",
      reload: "Reload the page",
    },
    guest: {
      title: "The invitation didn't open",
      body: "Something went wrong while showing this invitation. Reloading the page usually helps.",
      hint: "If it happens again, ask the host to send you a fresh link.",
      reload: "Reload the page",
    },
  },
  uk: {
    host: {
      title: "Щось пішло не так",
      body: "Сторінка натрапила на неочікувану помилку й не завантажилась до кінця. Зазвичай допомагає перезавантаження.",
      hint: "Опубліковані запрошення та відповіді на них у безпеці на сервері — з ними нічого не сталося.",
      reload: "Перезавантажити сторінку",
    },
    guest: {
      title: "Запрошення не відкрилося",
      body: "Щось пішло не так під час показу запрошення. Зазвичай допомагає перезавантаження сторінки.",
      hint: "Якщо це повториться, попросіть господаря надіслати нове посилання.",
      reload: "Перезавантажити сторінку",
    },
  },
};
