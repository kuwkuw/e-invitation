import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChatPanel } from "../src/components/editor/ChatPanel";
import { UI } from "../src/i18n";

afterEach(cleanup);

// jsdom does not implement scrollIntoView (github.com/jsdom/jsdom#1695), and
// ChatPanel's autoscroll effect calls it on every mount that has messages —
// unrelated to the peek line, but without a no-op stand-in every render below
// throws instead of exercising what this file is actually testing.
Element.prototype.scrollIntoView = () => {};

const t = UI.uk.chat;

const messages = [
  { role: "user" as const, text: "Весілля 12 жовтня" },
  { role: "assistant" as const, text: "Готово! Ось ваше запрошення." },
  { role: "user" as const, text: "Зроби текст тепліший" },
  { role: "assistant" as const, text: "Оновила вітання та основний текст." },
];

function renderPanel(overrides: Partial<Parameters<typeof ChatPanel>[0]> = {}) {
  return render(
    <ChatPanel
      messages={messages}
      phase="active"
      hasInvitation={true}
      onSend={() => {}}
      t={t}
      {...overrides}
    />,
  );
}

describe("ChatPanel peek line", () => {
  it("peeks the latest assistant message, not the host's own words", () => {
    const { container } = renderPanel();
    expect(container.querySelector(".cc-peek")?.textContent).toBe(
      "Оновила вітання та основний текст.",
    );
  });

  it("peeks the generating status while a call is in flight", () => {
    const { container } = renderPanel({ phase: "generating" });
    expect(container.querySelector(".cc-peek")?.textContent).toBe(t.creating);
  });

  it("peeks nothing before the first exchange", () => {
    const { container } = renderPanel({ messages: [], phase: "empty" });
    expect(container.querySelector(".cc-peek")).toBeNull();
  });

  it("opens the full transcript when the peek line is pressed", () => {
    const { container } = renderPanel();
    expect(container.querySelector(".cc-chat.open")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: t.openLog }));
    expect(container.querySelector(".cc-chat.open")).not.toBeNull();
  });

  it("closes it again, because a phone screen is the card's", () => {
    const { container } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: t.openLog }));
    fireEvent.click(screen.getByRole("button", { name: t.closeLog }));
    expect(container.querySelector(".cc-chat.open")).toBeNull();
  });
});
