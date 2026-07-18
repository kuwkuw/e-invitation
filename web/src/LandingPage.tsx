import { useState } from "react";
import { InvitationPreview } from "./components/InvitationPreview";
import { LangSwitcher } from "./components/LangSwitcher";
import { LANDING, loadUiLang, saveUiLang } from "./i18n";
import type { DesignTokens, InvitationCopy, Language } from "./types";

// Ported from the "Тепла класика" landing direction designed in Claude Design.
// Chrome copy is bilingual (LANDING strings); the hero composes the real
// InvitationPreview component with three sample events whose content stays
// Ukrainian on purpose — invitations are showcased content, not chrome.

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

const STEP_ICONS = ["❧", "✧", "◆"];

const responses = [
  { name: "Оксана Мельник", status: "yes" },
  { name: "Ігор Бондар", status: "yes" },
  { name: "Настя і Влад", status: "no" },
  { name: "Родина Шевченків", status: "wait" },
] as const;

export function LandingPage({ onStart }: Props) {
  const [lang, setLang] = useState<Language>(loadUiLang);
  const t = LANDING[lang];

  function handleLang(next: Language) {
    setLang(next);
    saveUiLang(next);
  }

  return (
    <div className="landing">
      <header className="lp-nav">
        <span className="lp-brand">{t.brand}</span>
        <div className="lp-nav-right">
          <LangSwitcher value={lang} onChange={handleLang} />
          <button className="lp-cta lp-cta-sm" onClick={onStart}>
            {t.cta}
          </button>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-copy">
          <h1>{t.heroTitle}</h1>
          <p>{t.heroText}</p>
          <button className="lp-cta" onClick={onStart}>
            {t.cta}
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
        <h2>{t.howTitle}</h2>
        <div className="lp-steps-grid">
          {t.steps.map((s, i) => (
            <div key={s.title} className="lp-step">
              <div className="lp-step-icon">{STEP_ICONS[i]}</div>
              <div className="lp-step-title">{s.title}</div>
              <div className="lp-step-text">{s.text}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-chips">
        {t.chips.map((c) => (
          <span key={c} className="lp-chip">
            {c}
          </span>
        ))}
      </section>

      <section className="lp-rsvp">
        <div className="lp-rsvp-inner">
          <div className="lp-rsvp-copy">
            <h2>{t.rsvpTitle}</h2>
            <p>{t.rsvpText}</p>
          </div>
          <div className="lp-rsvp-card">
            <div className="lp-rsvp-summary">{t.rsvpSummary}</div>
            {responses.map((r) => (
              <div key={r.name} className="lp-rsvp-row">
                <span>{r.name}</span>
                <span className={`lp-rsvp-status lp-rsvp-${r.status}`}>
                  {t.responseLabels[r.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-final">
        <h2>{t.finalTitle}</h2>
        <button className="lp-cta" onClick={onStart}>
          {t.cta}
        </button>
      </section>

      <footer className="lp-footer">{t.footer}</footer>

      <div className="lp-sticky-cta">
        <button className="lp-cta" onClick={onStart}>
          {t.cta}
        </button>
      </div>
    </div>
  );
}
