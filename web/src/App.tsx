import { useState } from "react";
import { ByokSettings } from "./components/ByokSettings";
import { ChatPanel } from "./components/editor/ChatPanel";
import { FieldSheet } from "./components/editor/FieldSheet";
import { BackIcon, ShareIcon } from "./components/editor/icons";
import { PreviewPanel } from "./components/editor/PreviewPanel";
import { SharePanel } from "./components/editor/SharePanel";
import { LangSwitcher } from "./components/LangSwitcher";
import { useInvitationEditor } from "./hooks/useInvitationEditor";
import { usePublishing } from "./hooks/usePublishing";
import { loadUiLang, saveUiLang, UI } from "./i18n";
import type { CopyField, Language } from "./types";

/**
 * The editor shell: header, chat column, preview column, field sheet. All
 * state lives in two hooks — useInvitationEditor (what the invitation is) and
 * usePublishing (where it's published) — so this component is composition and
 * the two concerns can be tested apart.
 */
export default function App() {
  const [uiLang, setUiLang] = useState<Language>(loadUiLang);
  const [selectedField, setSelectedField] = useState<CopyField | null>(null);
  const t = UI[uiLang];

  const editor = useInvitationEditor(t.chat);
  const publishing = usePublishing(() => editor.say(t.chat.failMsg));

  const hasInvitation = editor.invitation !== null && editor.phase !== "generating";

  function handleSend(text: string) {
    setSelectedField(null);
    editor.send(text);
  }

  return (
    <div className="cc-shell">
      <header className="cc-header">
        <button
          type="button"
          className="cc-back"
          aria-label={t.chat.back}
          onClick={() => {
            window.location.href = "/";
          }}
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
            className={`cc-share${hasInvitation ? " ready" : ""}`}
            disabled={!hasInvitation || publishing.publishing}
            onClick={() => editor.invitation && publishing.share(editor.invitation)}
          >
            <ShareIcon />
            {publishing.publishing ? "…" : t.chat.share}
          </button>
        </div>
      </header>

      {publishing.shareOpen && publishing.published && (
        <SharePanel
          published={publishing.published}
          rsvps={publishing.rsvps}
          rsvpsLoading={publishing.rsvpsLoading}
          onCopyLink={publishing.copyLink}
          copied={publishing.copied}
          onRefreshRsvps={publishing.refreshRsvps}
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
