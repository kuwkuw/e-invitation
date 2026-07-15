import { InvitationPreview } from "inv-app-web";

// Real copy shapes: title/greeting/body/details_line/rsvp_prompt/closing —
// mirrors what the generation pipeline produces (uk or en, per EventBrief.language).

export const ClassicWarm = () => (
  <InvitationPreview
    copy={{
      title: "Запрошення на день народження",
      greeting: "Дорогі друзі!",
      body: "Запрошуємо вас відсвяткувати цей особливий день разом із нами.",
      details_line: "12 серпня, 18:00 — Кафе «Затишок», Львів",
      rsvp_prompt: "Будь ласка, підтвердіть свою присутність.",
      closing: "З любов'ю, Олена",
    }}
    design={{ palette: "warm", typography: "serif", layout: "classic", ornament: "floral" }}
  />
);

export const BannerElegant = () => (
  <InvitationPreview
    copy={{
      title: "Ювілей — 50 років",
      greeting: "Шановні гості!",
      body: "Маємо честь запросити вас на святкування ювілею.",
      details_line: "20 вересня, 17:00 — Ресторан «Панорама», Київ",
      rsvp_prompt: "Просимо повідомити про участь до 10 вересня.",
      closing: "З повагою, родина Коваленків",
    }}
    design={{ palette: "elegant", typography: "serif", layout: "banner", ornament: "geometric" }}
  />
);

export const SplitMinimal = () => (
  <InvitationPreview
    copy={{
      title: "Housewarming Party",
      greeting: "Hi friends,",
      body: "We finally moved in — come celebrate our new place with us.",
      details_line: "Saturday, Oct 4 · 7 PM\n12 Maple Lane, Apt 3",
      rsvp_prompt: "Let us know if you can make it.",
      closing: "— Dan & Ira",
    }}
    design={{ palette: "minimal", typography: "sans", layout: "split", ornament: "none" }}
  />
);

export const FestiveDark = () => (
  <InvitationPreview
    copy={{
      title: "Новорічна вечірка",
      greeting: "Друзі!",
      body: "Проводжаємо рік разом — музика, ігри та святковий стіл.",
      details_line: "31 грудня, 21:00 — у нас вдома",
      rsvp_prompt: "Дайте знати, чи будете.",
      closing: "Чекаємо на вас!",
    }}
    design={{ palette: "festive", typography: "serif", layout: "classic", ornament: "sparkle" }}
  />
);

export const ScriptRomantic = () => (
  <InvitationPreview
    copy={{
      title: "Ми одружуємось!",
      greeting: "Любі рідні та друзі,",
      body: "Запрошуємо вас розділити з нами найщасливіший день нашого життя.",
      details_line: "6 червня, 15:00 — Сад «Оранжерея», Одеса",
      rsvp_prompt: "Підтвердіть присутність до 20 травня.",
      closing: "Марія та Андрій",
    }}
    design={{ palette: "romantic", typography: "script", layout: "classic", ornament: "floral" }}
  />
);

export const PlayfulKids = () => (
  <InvitationPreview
    copy={{
      title: "Sofia is turning 6!",
      greeting: "Hey there!",
      body: "Join us for cake, games and a bouncy castle in the backyard.",
      details_line: "Sunday, May 17 · 2 PM\nOur garden, 8 Cherry Street",
      rsvp_prompt: "Tell us you're coming!",
      closing: "The Petrenko family",
    }}
    design={{ palette: "playful", typography: "sans", layout: "banner", ornament: "sparkle" }}
  />
);
