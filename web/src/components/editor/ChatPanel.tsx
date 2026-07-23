import { useEffect, useRef, useState } from "react";
import type { ChatMsg, Phase } from "../../hooks/useInvitationEditor";
import type { ChatStrings } from "../../i18n";
import { BusyDots, SendIcon, SparkleIcon } from "./icons";

interface Props {
  messages: ChatMsg[];
  phase: Phase;
  /** True once an invitation exists, which changes the composer's hint from
   *  "describe your event" to "add a detail". */
  hasInvitation: boolean;
  onSend: (text: string) => void;
  t: ChatStrings;
}

/** The conversation column: examples before the first message, the transcript
 *  after, and the composer. Owns the draft text — nothing above needs it. */
export function ChatPanel({ messages, phase, hasInvitation, onSend, t }: Props) {
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const generating = phase === "generating";

  // A new message, or the generating spinner appearing, is what should scroll
  // to the bottom — these deps are the intended triggers, not values read.
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps are triggers, not reads
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, phase]);

  function submit() {
    const text = input.trim();
    if (!text || generating) return;
    setInput("");
    onSend(text);
  }

  return (
    <section className="cc-chat">
      <div className="cc-messages">
        {phase === "empty" && messages.length === 0 ? (
          <div className="cc-start">
            <div className="cc-start-title">{t.startTitle}</div>
            <div className="cc-start-hint">{t.startHint}</div>
            <div className="cc-start-examples">{t.tryExamples}</div>
            <div className="cc-chips">
              {t.examples.map((example) => (
                <button
                  type="button"
                  key={example}
                  className="cc-chip"
                  onClick={() => setInput(example.replace(/…$/, ""))}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              // The chat log is append-only: entries are never reordered,
              // removed or edited, so the index is a stable identity.
              // biome-ignore lint/suspicious/noArrayIndexKey: append-only chat log
              <div key={i} className={`cc-msg ${msg.role}`}>
                <div className="cc-bubble">{msg.text}</div>
              </div>
            ))}
            {generating && (
              <div className="cc-status">
                <SparkleIcon />
                <span>{t.creating}</span>
                <BusyDots />
              </div>
            )}
            <div ref={endRef} />
          </>
        )}
      </div>
      <div className="cc-composer">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={hasInvitation ? t.placeholderRefine : t.placeholderEmpty}
          maxLength={500}
        />
        <button
          type="button"
          className={`cc-send${input.trim() && !generating ? " ready" : ""}`}
          aria-label={t.send}
          disabled={!input.trim() || generating}
          onClick={submit}
        >
          <SendIcon />
        </button>
      </div>
    </section>
  );
}
