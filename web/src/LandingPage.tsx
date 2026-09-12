import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { googleSignInUrl } from "./api";
import { AccountFooter } from "./components/AccountFooter";
import { DeleteAccountSheet } from "./components/DeleteAccountSheet";
import { InvitationPreview } from "./components/InvitationPreview";
import { LangSwitcher } from "./components/LangSwitcher";
import { SignOutSheet } from "./components/SignOutSheet";
import { YourInvitations } from "./components/YourInvitations";
import { useAuthSession } from "./hooks/useAuthSession";
import { useHostInvitationCounts } from "./hooks/useHostInvitationCounts";
import { useNotificationPref } from "./hooks/useNotificationPref";
import { manageUrl } from "./hooks/usePublishing";
import { loadHostInvitations, mergeHostInvitations } from "./hostInvitations";
import { AUTH, type DemoGuest, LANDING, loadUiLang, type SampleId, saveUiLang } from "./i18n";
import { allHeldManageTokens, readManageToken } from "./manageTokens";
import { langFromSearch, routeMeta, useDocumentMeta } from "./seo";
import type { DesignTokens, Language } from "./types";

// Ported from the "Тепла класика" landing direction designed in Claude Design.
// Chrome copy is bilingual (LANDING strings) — with the wordmark as the one
// exception, because a name is not copy (adr-016 §9). The hero composes the
// real InvitationPreview component with three sample events, and their words
// are bilingual too: the samples are what an English visitor arriving on
// `/?lang=en` is there to judge (see the note over `LANDING`).
//
// Split by kind rather than by sample: the words are in `LANDING.samples`,
// the design tokens are here, and the id is the join. Tokens are presentation
// — the same three directions in both languages — so translating them would
// mean two ways to say "romantic script".

const SAMPLE_DESIGNS: Record<SampleId, DesignTokens> = {
  wedding: { palette: "romantic", typography: "script", layout: "classic", ornament: "floral" },
  kids: { palette: "playful", typography: "sans", layout: "banner", ornament: "sparkle" },
  corporate: { palette: "festive", typography: "serif", layout: "classic", ornament: "sparkle" },
};

/** Fan order, left to right — `lp-fan-{i}` positions each card. */
const SAMPLE_ORDER: SampleId[] = ["wedding", "kids", "corporate"];

const STEP_ICONS = ["❧", "✧", "◆"];

/** The mocked reply rows: who they are and how they answered. The names come
 *  from `LANDING.rsvpNames` under these ids — a status is a colour and a pill
 *  label, and both of those already have translations of their own. */
const responses: { id: DemoGuest; status: "yes" | "no" | "wait" }[] = [
  { id: "friend", status: "yes" },
  { id: "colleague", status: "yes" },
  { id: "couple", status: "no" },
  { id: "family", status: "wait" },
];

export function LandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // `?lang=` wins over the stored preference, because it is the more specific
  // answer: someone following an English link asked for English *now*, and a
  // crawler has no stored preference at all — the parameter is the only way
  // the English home page has an address to be indexed under (adr-016 §5).
  const urlLang = langFromSearch(location.search);
  const [lang, setLang] = useState<Language>(() => urlLang ?? loadUiLang());
  const t = LANDING[lang];
  // Arriving on an English link makes English this browser's preference too,
  // or the first click through to /create would silently switch back.
  useEffect(() => {
    if (urlLang) saveUiLang(urlLang);
  }, [urlLang]);
  // `*` renders this component for every unknown path (AppRoutes), which is a
  // kindness to a person and a duplicate of the home page to a crawler.
  useDocumentMeta(
    routeMeta(location.pathname === "/" ? "landing" : "notFound", lang, location.search),
  );
  const account = useAuthSession();
  // What this browser has published, and then the account's keyring laid over
  // it once that answers. Reading the index once was enough before accounts —
  // it only changed by publishing, which happens on another page — but the
  // keyring arrives after this render, so a read alone left a host who signed
  // in on a new device looking at an empty list until they reloaded.
  const [local] = useState(loadHostInvitations);
  const mine = useMemo(
    () => mergeHostInvitations(local, account.invitations),
    [local, account.invitations],
  );
  // Counts fill in after the list has already rendered, and a failure leaves
  // the rows exactly as they are (adr-012 §6). The hook keys on the joined
  // ids, so the keyring landing refetches exactly once and a re-render does
  // not refetch at all.
  const counts = useHostInvitationCounts(mine.map((m) => m.id));
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const signedIn = account.status === "signed_in" && account.email !== null;
  // **The list is the view of whichever store owns the identity** (DS
  // `LandingListIsAccount`). Publishing already requires an account, so a list
  // rendered to someone without one is a second source of truth about "your
  // events" that contradicts the first. Where accounts cannot exist at all
  // (adr-014 §7) the rule points at the other store rather than making an
  // exception: the identity is the browser, and the list is this browser's.
  //
  // "loading" shows nothing, which costs an unconfigured deployment one fetch
  // before its list appears — the alternative is rendering a list and taking
  // it away, and a flash of the host's own events is worse than a beat of
  // nothing.
  const showList = account.status === "unavailable" || signedIn;
  // What this browser can prove is the host's, for the nav count. Read once,
  // like the list: a signed-out browser gains no tokens while the landing page
  // is open. Signed in it is not rendered, so the keyring seed cannot inflate
  // it.
  const [heldCount] = useState(() => allHeldManageTokens().size);
  // Both the label and the layout concessions key off this, never off the
  // count alone: where sign-in is unavailable the link does not render, and a
  // wordmark that shrank to make room for a count nobody sees would be paying
  // for nothing.
  const showNavCount = account.status === "signed_out" && heldCount > 0;
  // Two conditions, and both render the line **absent** rather than disabled
  // (DS LandingAccountNotify): a deployment that cannot send mail must promise
  // nothing, and before the first invitation a preference about replies is
  // about nothing. It appears with the first published invitation.
  const canNotify = signedIn && account.notifications && mine.length > 0;
  const notify = useNotificationPref(canNotify);
  // What the *account* holds, which is what the deletion sheet is about. The
  // list above can legitimately be wider: an invitation this browser published
  // before it ever signed in is in no keyring, and deleting the account has
  // nothing to do with it. Falls back to the list when the keyring has not
  // answered, which is every signed-out case and therefore never rendered.
  const held = account.invitations ?? mine;
  const replyCount = held.reduce((total, invitation) => {
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
    // Keep the URL the address of what is on screen: the English landing page
    // is `/?lang=en` and the Ukrainian one is `/`, which is what the canonical
    // and hreflang tags on both of them promise. `replace` because a language
    // toggle is not a place the back button should have to walk through, and
    // `navigate` rather than history.replaceState — nothing goes behind the
    // router (adr-011 §4). Only on `/`: an unknown path has no language pair.
    if (location.pathname === "/") navigate(next === "en" ? "/?lang=en" : "/", { replace: true });
  }

  return (
    <div className="landing">
      {/* `lp-nav-counted` is what lets the narrow rules find the count without
          a `:has()`: with the number present the bar needs the wordmark's
          space, and below 370 the wordmark gives up its letters entirely. */}
      <header className={`lp-nav${showNavCount ? " lp-nav-counted" : ""}`}>
        <span className="lp-brand">
          <span className="lp-brand-full">{t.brand}</span>
          {/* Derived, never its own string: the monogram is the brand's first
              letter. It used to be what kept a *translated* wordmark's initial
              honest; the name is one word in both languages now (adr-016 §9),
              and deriving it still beats a second place to edit the name. */}
          <span className="lp-brand-mono">{[...t.brand][0]}</span>
        </span>
        {/* The way into the gallery (adr-017 §8), and the crawl edge a
            `<button>` could not be. Deliberately in the nav and not the hero:
            the hero already carries the primary action, and a second one
            beside it takes weight from the one that matters. A `<Link>` here
            rather than an `<a>` — the prerendered block has the real href a
            crawler follows, and by the time React is mounted a transition is
            the better experience. */}
        <Link className="lp-nav-gallery" to="/gallery">
          {t.galleryLink}
        </Link>
        <div className="lp-nav-right">
          {/* The only sign-in outside the publish gate. Before it, a returning
              host on a new phone could reach their events only by generating an
              invitation they did not want and pressing Publish — the gate is at
              publish (adr-014 §2), but a door on the landing page is not a gate.
              Rendered only when signed out and configured: "loading" would flash
              a link that then vanishes, and a deployment with no OAuth client
              shows no account affordance at all (§7). It stays out of the
              invitations card on purpose — an offer there would be an
              advertisement where a host simply wants their list. */}
          {account.status === "signed_out" && (
            <a className="lp-nav-signin" href={googleSignInUrl("/")}>
              {/* The count is the page's one acknowledgement that a signed-out
                  host's events exist, now that the card does not render for
                  them. It is a fact, not an offer: it states what is already
                  in this browser and disappears on sign-in because the list
                  replaces it. A first-time visitor never sees it — zero
                  tokens, so the branch does not render — which is what keeps
                  the link costing them nothing. */}
              {showNavCount
                ? AUTH[lang].navMyInvitationsCount.replace("{n}", String(heldCount))
                : AUTH[lang].signInLink}
            </a>
          )}
          <LangSwitcher value={lang} onChange={handleLang} />
          <button type="button" className="lp-cta lp-cta-sm" onClick={startEditing}>
            {t.cta}
          </button>
        </div>
      </header>

      {/* Reading order per the DS Returning template: header → your events →
          pitch. Whoever the list is not for — a first-time visitor, and now a
          signed-out host on a deployment that has accounts — sees the page
          begin at the pitch. */}
      {showList && (
        <YourInvitations
          invitations={mine}
          counts={counts}
          signedIn={signedIn}
          // Rendered inside the card, because the account exists for this list.
          footer={
            signedIn && account.email ? (
              <AccountFooter
                email={account.email}
                // Sign-out now takes the list off the page while leaving every
                // token in place, so it asks first (DS `LandingListIsAccount`).
                onSignOut={() => setConfirmingSignOut(true)}
                notify={canNotify ? { enabled: notify.enabled, onToggle: notify.toggle } : null}
                t={AUTH[lang]}
              />
            ) : null
          }
          onDeleteAccount={signedIn ? () => setConfirmingDelete(true) : undefined}
          t={t}
          auth={AUTH[lang]}
        />
      )}

      {confirmingSignOut && (
        <SignOutSheet
          invitationCount={held.length}
          onCopyAllLinks={copyAllManageLinks}
          onConfirm={() => {
            void account.signOut();
            setConfirmingSignOut(false);
          }}
          onCancel={() => setConfirmingSignOut(false)}
          t={AUTH[lang]}
        />
      )}

      {confirmingDelete && (
        <DeleteAccountSheet
          invitationCount={held.length}
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
          {SAMPLE_ORDER.map((id, i) => (
            <div key={id} className={`lp-fan-card lp-fan-${i}`}>
              <InvitationPreview copy={t.samples[id]} design={SAMPLE_DESIGNS[id]} />
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
              <div key={r.id} className="lp-rsvp-row">
                <span>{t.rsvpNames[r.id]}</span>
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
