import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ByokSettings } from "./components/ByokSettings";
import { AuthGate } from "./components/editor/AuthGate";
import { ChatPanel } from "./components/editor/ChatPanel";
import { FieldSheet } from "./components/editor/FieldSheet";
import { BackIcon, ShareIcon } from "./components/editor/icons";
import { PreviewPanel } from "./components/editor/PreviewPanel";
import { SharePanel } from "./components/editor/SharePanel";
import { LangSwitcher } from "./components/LangSwitcher";
import { loadDraft } from "./draft";
import { sampleInvitation } from "./gallery";
import { useAuthReturn } from "./hooks/useAuthReturn";
import { useAuthSession } from "./hooks/useAuthSession";
import { useGallerySample } from "./hooks/useGallerySample";
import { useInvitationEditor } from "./hooks/useInvitationEditor";
import { useNotificationPref } from "./hooks/useNotificationPref";
import { usePublishing } from "./hooks/usePublishing";
import { useReferralSource } from "./hooks/useReferralSource";
import { loadUiLang, saveUiLang, UI } from "./i18n";
import { routeMeta, useDocumentMeta } from "./seo";
import type { CopyField, Language } from "./types";

/**
 * The editor shell: header, chat column, preview column, field sheet. All
 * state lives in two hooks — useInvitationEditor (what the invitation is) and
 * usePublishing (where it's published) — so this component is composition and
 * the two concerns can be tested apart.
 */
export default function App() {
  // Leaving the editor discards its in-memory state on purpose — a fresh App
  // mounts on the way back in, exactly as the old full reload left things.
  const navigate = useNavigate();
  const [uiLang, setUiLang] = useState<Language>(loadUiLang);
  const [selectedField, setSelectedField] = useState<CopyField | null>(null);
  const t = UI[uiLang];
  // The tab has to say where you are after a client-side navigation from the
  // landing page, and the head has to stop claiming `/`'s canonical. The
  // editor itself is `noindex` (adr-016 §3) — it renders nothing until the app
  // boots and has nothing a search result could quote.
  useDocumentMeta(routeMeta("create", uiLang));

  // Where this session came from (adr-013). Read and stripped by the router at
  // mount; held for the whole session so a generation several chat turns later
  // still carries it.
  const source = useReferralSource();

  // The sign-in round trip (adr-014 §2). Read once at mount and stripped by
  // the router; the draft is restored only on a return trip, so an ordinary
  // visit never resurrects one unasked.
  const authReturn = useAuthReturn();
  const [draft] = useState(() => (authReturn.result ? loadDraft() : null));
  const account = useAuthSession();

  // A gallery sample the visitor pressed "use this one" on (adr-017 §4), read
  // and stripped by the router at mount like the referral above.
  const sample = useGallerySample(uiLang);
  // A parked sign-in draft wins over `?sample=`: someone returning from Google
  // is mid-publish, and a sample in the URL is a stale parameter from before
  // the redirect.
  const seeded = draft?.invitation ?? (sample ? sampleInvitation(sample) : null);

  const editor = useInvitationEditor(
    t.chat,
    draft?.source ?? (sample ? "gallery" : source),
    seeded,
    draft ? "" : (sample?.example.sentence ?? ""),
  );
  const publishing = usePublishing(() => editor.say(t.chat.failMsg), {
    // Refused for a date that has gone by (FR-1.8). The button is already
    // disabled from the same rule, so this fires only for a press the gate
    // could not reach first — a resume after sign-in, most of all.
    onDateBlocked: () => editor.say(t.chat.pastDateBlock),
    gated: account.publishGate,
    signedIn: account.status === "signed_in",
    source: draft?.source ?? source,
    authReturn: authReturn.result,
    authCode: authReturn.code,
  });
  // Account-level, so it needs no invitation — only a signed-in host on a
  // deployment that can actually send mail (adr-015 §7, §8).
  const notify = useNotificationPref(account.status === "signed_in" && account.notifications);

  // Finish what the gate interrupted. Guarded by a ref rather than by the
  // gate state, because the publish flips that state itself and StrictMode
  // double-invokes effects — without the guard the invitation publishes twice
  // and the host gets two links for one event.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || authReturn.result !== "ok" || !draft) return;
    resumed.current = true;
    void publishing.resume(draft.invitation, draft.published);
  }, [authReturn.result, draft, publishing.resume]);

  const hasInvitation = editor.invitation !== null && editor.phase !== "generating";
  // An invitation whose day has gone by is not publishable until the host
  // moves it (FR-1.8); the chat says so on the turn that produced it.
  const canPublish = hasInvitation && !editor.dateBlocked;

  function handleSend(text: string) {
    setSelectedField(null);
    editor.send(text);
  }

  return (
    // The ground is tinted by the invitation being edited (adr-018 §1). An
    // attribute rather than the palette-* class: that class would also push
    // the card's --ink and --accent into the chrome, where the product's own
    // accent belongs. Undefined before the first generate, which falls back to
    // the bare :root --ground.
    <div className="cc-shell" data-palette={editor.invitation?.design.palette}>
      <header className="cc-header">
        <button
          type="button"
          className="cc-back"
          aria-label={t.chat.back}
          onClick={() => navigate("/")}
        >
          <BackIcon />
        </button>
        <div className="cc-title">{editor.invitation?.copy.title ?? t.chat.newInvitation}</div>
        <div className="cc-header-right">
          <ByokSettings labels={t.byok} />
          <LangSwitcher
            value={uiLang}
            onChange={(lang) => {
              setUiLang(lang);
              saveUiLang(lang);
            }}
          />
          <button
            type="button"
            className={`cc-share${canPublish ? " ready" : ""}`}
            disabled={!canPublish || publishing.publishing}
            onClick={() => editor.invitation && publishing.share(editor.invitation)}
            // The label is hidden on narrow screens to leave the title room to
            // be readable, so the button carries its name here regardless.
            aria-label={t.chat.share}
            title={editor.dateBlocked ? t.chat.pastDateBlock : undefined}
          >
            <ShareIcon />
            <span className="cc-share-label">{publishing.publishing ? "…" : t.chat.share}</span>
          </button>
        </div>
      </header>

      {publishing.gate && (
        <AuthGate
          state={publishing.gate}
          draftSaved={publishing.draftSaved}
          errorCode={publishing.authCode}
          onSignIn={() => editor.invitation && publishing.signInAndPublish(editor.invitation)}
          onDismiss={publishing.dismissGate}
          t={t.auth}
        />
      )}

      {publishing.shareOpen && publishing.published && (
        <SharePanel
          published={publishing.published}
          onCopyLink={publishing.copyLink}
          copied={publishing.copied}
          canShare={publishing.canShare}
          onShare={publishing.shareLink}
          onCopyManageLink={publishing.copyManageLink}
          manageCopied={publishing.manageCopied}
          signedIn={account.status === "signed_in"}
          manageShown={publishing.manageShown}
          onToggleManage={publishing.toggleManageShown}
          notifyEmail={account.notifications ? account.email : null}
          notifyEnabled={notify.enabled}
          onToggleNotify={notify.toggle}
          t={t}
        />
      )}

      <div className="cc-main">
        <ChatPanel
          messages={editor.messages}
          phase={editor.phase}
          hasInvitation={editor.invitation !== null}
          onSend={handleSend}
          t={t.chat}
        />
        <PreviewPanel
          invitation={editor.invitation}
          generating={editor.phase === "generating"}
          activeField={selectedField}
          onFieldClick={setSelectedField}
          onDesignChange={editor.updateDesign}
          backgroundBusy={editor.bgBusy}
          onBackgroundAdd={editor.addBackground}
          onBackgroundRemove={editor.removeBackground}
          t={t}
        />
      </div>

      {selectedField && editor.invitation && (
        // Keyed by field so switching fields resets the sheet's mode and draft.
        <FieldSheet
          key={selectedField}
          field={selectedField}
          currentValue={editor.invitation.copy[selectedField]}
          onRegenerate={() => editor.regenerateOneField(selectedField)}
          onVariants={() => editor.fieldVariants(selectedField)}
          onApply={(value) => editor.updateField(selectedField, value)}
          onClose={() => setSelectedField(null)}
          t={t}
        />
      )}
    </div>
  );
}
