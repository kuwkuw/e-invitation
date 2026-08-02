import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AccountFooter } from "./components/AccountFooter";
import { DeleteAccountSheet } from "./components/DeleteAccountSheet";
import { InvitationPreview } from "./components/InvitationPreview";
import { LangSwitcher } from "./components/LangSwitcher";
import { YourInvitations } from "./components/YourInvitations";
import { useAuthSession } from "./hooks/useAuthSession";
import { useHostInvitationCounts } from "./hooks/useHostInvitationCounts";
import { useNotificationPref } from "./hooks/useNotificationPref";
import { manageUrl } from "./hooks/usePublishing";
import { loadHostInvitations } from "./hostInvitations";
import { AUTH, LANDING, loadUiLang, saveUiLang } from "./i18n";
import { readManageToken } from "./manageTokens";
import type { DesignTokens, InvitationCopy, Language } from "./types";

// Ported from the "Тепла класика" landing direction designed in Claude Design.
// Chrome copy is bilingual (LANDING strings); the hero composes the real
// InvitationPreview component with three sample events whose content stays
// Ukrainian on purpose — invitations are showcased content, not chrome.

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

export function LandingPage() {
  const navigate = useNavigate();
  const [lang, setLang] = useState<Language>(loadUiLang);
  const t = LANDING[lang];
  // Read once: the list only changes by publishing, which happens elsewhere.
  const [mine] = useState(loadHostInvitations);
  // Counts fill in after the list has already rendered, and a failure leaves
  // the rows exactly as they are (adr-012 §6). `mine` is stable, so the ids
  // handed to the hook are too.
  const counts = useHostInvitationCounts(mine.map((m) => m.id));
  const account = useAuthSession();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const signedIn = account.status === "signed_in" && account.email !== null;
  // Two conditions, and both render the line **absent** rather than disabled
  // (DS LandingAccountNotify): a deployment that cannot send mail must promise
  // nothing, and before the first invitation a preference about replies is
  // about nothing. It appears with the first published invitation.
  const canNotify = signedIn && account.notifications && mine.length > 0;
  const notify = useNotificationPref(canNotify);
  // The list is seeded from the keyring on sign-in, so by the time it is
  // non-empty for a signed-in host these are their account's invitations.
  const replyCount = mine.reduce((total, invitation) => {
    const result = counts?.get(invitation.id);
    return total + (result?.counts ? result.counts.yes + result.counts.no : 0);
  }, 0);

  /** Every manage link this browser holds, one per line. The only real loss in
   *  deleting an account is convenient access, so it is handed back first. */
  function copyAllManageLinks() {
    const links = mine
      .map((invitation) => {
        const token = readManageToken(invitation.id);
        return token ? `${invitation.title}: ${manageUrl(invitation.id, token)}` : null;
      })
      .filter((line): line is string => line !== null);
    void navigator.clipboard.writeText(links.join("\n"));
  }

  // Every call to action on the page goes to the same place; the editor starts
  // empty either way, so there is nothing to carry across.
  const startEditing = () => navigate("/create");

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
          <button type="button" className="lp-cta lp-cta-sm" onClick={startEditing}>
            {t.cta}
          </button>
        </div>
      </header>

      {/* Reading order per the DS Returning template: header → your events →
          pitch. A first-time visitor has an empty list and sees the page
          exactly as before. */}
      <YourInvitations
        invitations={mine}
        counts={counts}
        signedIn={signedIn}
        // Rendered inside the card, because the account exists for this list.
        footer={
          signedIn && account.email ? (
            <AccountFooter
              email={account.email}
              onSignOut={account.signOut}
              notify={canNotify ? { enabled: notify.enabled, onToggle: notify.toggle } : null}
              t={AUTH[lang]}
            />
          ) : null
        }
        onDeleteAccount={signedIn ? () => setConfirmingDelete(true) : undefined}
        t={t}
        auth={AUTH[lang]}
      />

      {confirmingDelete && (
        <DeleteAccountSheet
          invitationCount={mine.length}
          replyCount={replyCount}
          onCopyAllLinks={copyAllManageLinks}
          onConfirm={() => {
            void account.deleteAccount();
            setConfirmingDelete(false);
          }}
          onCancel={() => setConfirmingDelete(false)}
          t={AUTH[lang]}
        />
      )}

      <section className="lp-hero">
        <div className="lp-hero-copy">
          <h1>{t.heroTitle}</h1>
          <p>{t.heroText}</p>
          <button type="button" className="lp-cta" onClick={startEditing}>
            {t.cta}
          </button>
        </div>
        <div className="lp-fan" aria-hidden="true">
          {samples.map((s, i) => (
            <div key={s.copy.title} className={`lp-fan-card lp-fan-${i}`}>
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
        <button type="button" className="lp-cta" onClick={startEditing}>
          {t.cta}
        </button>
      </section>

      <footer className="lp-footer">{t.footer}</footer>

      <div className="lp-sticky-cta">
        <button type="button" className="lp-cta" onClick={startEditing}>
          {t.cta}
        </button>
      </div>
    </div>
  );
}
