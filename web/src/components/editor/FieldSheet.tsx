import { useState } from "react";
import type { UiStrings } from "../../i18n";
import type { CopyField } from "../../types";
import { BusyDots, CloseIcon, PencilIcon, RegenerateIcon, VariantsIcon } from "./icons";

type Mode = "actions" | "manual" | "variants";

interface Props {
  field: CopyField;
  currentValue: string;
  /** Rewrite this field in place; false means the call failed and the sheet
   *  should stay open so the host can retry. */
  onRegenerate: () => Promise<boolean>;
  /** Up to three alternatives; may return fewer, or none. */
  onVariants: () => Promise<string[]>;
  onApply: (value: string) => void;
  onClose: () => void;
  t: UiStrings;
}

/**
 * Bottom sheet for editing one copy field: regenerate it, type a replacement,
 * or pick from generated variants. Its mode and in-flight state are local —
 * nothing above needs them, and they reset naturally when the host opens a
 * different field (the parent remounts via `key`).
 */
export function FieldSheet({
  field,
  currentValue,
  onRegenerate,
  onVariants,
  onApply,
  onClose,
  t,
}: Props) {
  const [mode, setMode] = useState<Mode>("actions");
  const [manualValue, setManualValue] = useState(currentValue);
  const [variants, setVariants] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function handleRegenerate() {
    if (busy) return;
    setBusy(true);
    const ok = await onRegenerate();
    setBusy(false);
    if (ok) onClose();
  }

  async function handleLoadVariants() {
    if (busy) return;
    setMode("variants");
    setBusy(true);
    setVariants([]);
    setVariants(await onVariants());
    setBusy(false);
  }

  return (
    <div className="cc-sheet">
      <div className="cc-sheet-head">
        <div>
          <div className="cc-sheet-kicker">{t.chat.editingLabel}</div>
          <div className="cc-sheet-title">{t.fields[field]}</div>
        </div>
        <button type="button" className="cc-sheet-close" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>

      <div className="cc-actions">
        <button type="button" className="cc-act" disabled={busy} onClick={handleRegenerate}>
          <RegenerateIcon />
          {busy && mode === "actions" ? "…" : t.chat.actionRegenerate}
        </button>
        <button
          type="button"
          className={`cc-act${mode === "manual" ? " cc-act-on" : ""}`}
          onClick={() => setMode("manual")}
        >
          <PencilIcon />
          {t.chat.actionManual}
        </button>
        <button
          type="button"
          className={`cc-act${mode === "variants" ? " cc-act-on" : ""}`}
          disabled={busy}
          onClick={handleLoadVariants}
        >
          <VariantsIcon />
          {t.chat.actionVariants}
        </button>
      </div>

      {mode === "manual" && (
        <div className="cc-manual">
          <textarea
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            rows={field === "body" ? 3 : 2}
          />
          <button
            type="button"
            className="primary"
            onClick={() => {
              onApply(manualValue);
              onClose();
            }}
          >
            {t.chat.save}
          </button>
        </div>
      )}

      {mode === "variants" && (
        <div className="cc-variants">
          <div className="cc-sheet-kicker">
            {t.chat.variantsTitle} · {t.fields[field]}
          </div>
          {busy ? (
            <div className="cc-status">
              <span>{t.chat.creating}</span>
              <BusyDots />
            </div>
          ) : (
            variants.map((variant) => (
              <button
                type="button"
                key={variant}
                className="cc-var"
                onClick={() => {
                  onApply(variant);
                  onClose();
                }}
              >
                {variant}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
