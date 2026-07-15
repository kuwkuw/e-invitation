import { InvitationPreview } from "./components/InvitationPreview";
import type { DesignTokens, InvitationCopy } from "./types";

// Ported from the "Тепла класика" landing direction designed in Claude Design.
// Marketing copy is Ukrainian (product is Ukrainian-first); the hero composes
// the real InvitationPreview component with three sample events.

interface Props {
  onStart: () => void;
}

const samples: { copy: InvitationCopy; design: DesignTokens }[] = [
  {
    copy: {
      title: "Ми одружуємось!",
      greeting: "Любі рідні та друзі,",
      body: "Запрошуємо вас розділити з нами найщасливіший день нашого життя.",
      details_line: "6 червня, 15:00 — Сад «Оранжерея», Одеса",
      rsvp_prompt: "Підтвердіть присутність до 20 травня.",
      closing: "Марія та Андрій",
    },
    design: { palette: "romantic", typography: "script", layout: "classic", ornament: "floral" },
  },
  {
    copy: {
      title: "Софійці — 5 років!",
      greeting: "Привіт, малята й батьки!",
      body: "Чекаємо на казкове свято з єдинорогами, тортом і кульками.",
      details_line: "18 травня, 13:00 — Парк «Казка», Львів",
      rsvp_prompt: "Підтвердіть, чи прийде ваша дитина.",
      closing: "Родина Ковальчук",
    },
    design: { palette: "playful", typography: "sans", layout: "banner", ornament: "sparkle" },
  },
  {
    copy: {
      title: "Новорічний корпоратив",
      greeting: "Шановні колеги!",
      body: "Завершуємо рік разом — вечеря, музика й приємні сюрпризи.",
      details_line: "27 грудня, 19:00 — Готель «Прем'єр», Київ",
      rsvp_prompt: "Підтвердіть участь до 20 грудня.",
      closing: "Команда «ТехноЛайн»",
    },
    design: { palette: "festive", typography: "serif", layout: "classic", ornament: "sparkle" },
  },
];

const steps = [
  { icon: "❧", title: "Опишіть подію", text: "Своїми словами — що святкуєте, коли і де." },
  { icon: "✧", title: "Отримайте дизайн", text: "Ми підберемо стиль, кольори та оформлення." },
  { icon: "◆", title: "Поділіться посиланням", text: "Надішліть гостям — і збирайте відповіді." },
];

const chips = ["весілля", "день народження", "дитяче свято", "корпоратив", "хрестини"];

const responses = [
  { name: "Оксана Мельник", status: "yes", label: "Так" },
  { name: "Ігор Бондар", status: "yes", label: "Так" },
  { name: "Настя і Влад", status: "no", label: "Ні" },
  { name: "Родина Шевченків", status: "wait", label: "Очікує" },
] as const;

export function LandingPage({ onStart }: Props) {
  return (
    <div className="landing">
      <header className="lp-nav">
        <span className="lp-brand">Запрошення</span>
        <button className="lp-cta lp-cta-sm" onClick={onStart}>
          Створити запрошення
        </button>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-copy">
          <h1>Запрошення за одне речення</h1>
          <p>Опишіть подію словами — отримайте гарне запрошення за хвилину.</p>
          <button className="lp-cta" onClick={onStart}>
            Створити запрошення
          </button>
        </div>
        <div className="lp-fan" aria-hidden="true">
          {samples.map((s, i) => (
            <div key={i} className={`lp-fan-card lp-fan-${i}`}>
              <InvitationPreview copy={s.copy} design={s.design} />
            </div>
          ))}
        </div>
      </section>

      <section className="lp-steps">
        <h2>Як це працює</h2>
        <div className="lp-steps-grid">
          {steps.map((s) => (
            <div key={s.title} className="lp-step">
              <div className="lp-step-icon">{s.icon}</div>
              <div className="lp-step-title">{s.title}</div>
              <div className="lp-step-text">{s.text}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-chips">
        {chips.map((c) => (
          <span key={c} className="lp-chip">
            {c}
          </span>
        ))}
      </section>

      <section className="lp-rsvp">
        <div className="lp-rsvp-inner">
          <div className="lp-rsvp-copy">
            <h2>Знайте, хто прийде</h2>
            <p>
              Гості підтверджують участь за посиланням — ви бачите відповіді одразу, без дзвінків і
              нагадувань.
            </p>
          </div>
          <div className="lp-rsvp-card">
            <div className="lp-rsvp-summary">18 прийдуть · 3 не прийдуть · 5 ще не відповіли</div>
            {responses.map((r) => (
              <div key={r.name} className="lp-rsvp-row">
                <span>{r.name}</span>
                <span className={`lp-rsvp-status lp-rsvp-${r.status}`}>{r.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-final">
        <h2>Готові надіслати перше запрошення?</h2>
        <button className="lp-cta" onClick={onStart}>
          Створити запрошення
        </button>
      </section>

      <footer className="lp-footer">Запрошення — просто і по-українськи.</footer>

      <div className="lp-sticky-cta">
        <button className="lp-cta" onClick={onStart}>
          Створити запрошення
        </button>
      </div>
    </div>
  );
}
