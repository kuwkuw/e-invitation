import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PastDateBanner } from "../src/components/editor/PastDateBanner";
import { UI } from "../src/i18n";

afterEach(cleanup);

describe("PastDateBanner", () => {
  it("says nothing when publishing is not blocked", () => {
    const { container } = render(
      <PastDateBanner blocked={false} message={UI.uk.chat.pastDateBlock} />,
    );
    expect(container.querySelector(".cc-banner")).toBeNull();
  });

  it("states the reason the Publish button is disabled", () => {
    const { container } = render(
      <PastDateBanner blocked={true} message={UI.uk.chat.pastDateBlock} />,
    );
    const banner = container.querySelector(".cc-banner");
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toBe(UI.uk.chat.pastDateBlock);
  });

  // FR-1.8's reason must reach a host who cannot see the chat log — which is
  // every mobile host once the log collapses behind the composer.
  it("announces itself politely, so it is not only a visual cue", () => {
    const { container } = render(
      <PastDateBanner blocked={true} message={UI.uk.chat.pastDateBlock} />,
    );
    expect(container.querySelector(".cc-banner")?.getAttribute("role")).toBe("status");
  });
});
