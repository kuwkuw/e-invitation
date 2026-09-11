import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { GalleryOccasionPage } from "../src/GalleryOccasionPage";

// `vite.config.ts` sets globals:false, so RTL never auto-cleans — without this
// every case starts by matching the previous case's DOM.
afterEach(cleanup);

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/gallery/:occasion" element={<GalleryOccasionPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("GalleryOccasionPage", () => {
  it("renders the four wedding examples", () => {
    renderAt("/gallery/wedding");
    expect(screen.getByText("Ми одружуємось!")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /Взяти цей/ })).toHaveLength(4);
  });

  it("points each use-this link at its own sample", () => {
    renderAt("/gallery/wedding");
    const links = screen.getAllByRole("link", { name: /Взяти цей/ });
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/create?sample=wedding-romantic",
      "/create?sample=wedding-formal",
      "/create?sample=wedding-festive",
      "/create?sample=wedding-minimal",
    ]);
  });

  it("says the link is dead for an unknown occasion", () => {
    renderAt("/gallery/nope");
    expect(screen.queryByText("Ми одружуємось!")).toBeNull();
    expect(screen.getByText(/Такої сторінки немає/)).toBeTruthy();
  });

  // Range is half the promise (adr-017 §2): four cards in one palette would
  // tell a visitor the product has exactly one look.
  it("shows the four examples in four different palettes", () => {
    const { container } = renderAt("/gallery/wedding");
    const palettes = [...container.querySelectorAll(".inv")].map((el) =>
      [...el.classList].find((c) => c.startsWith("palette-")),
    );
    expect(palettes).toHaveLength(4);
    expect(new Set(palettes).size).toBe(4);
  });

  it("links onward to the other occasions that have content", () => {
    renderAt("/gallery/wedding");
    // Only wedding is populated so far, so there is nothing else to offer yet.
    expect(screen.queryByRole("link", { name: "Весілля" })).toBeNull();
  });
});
