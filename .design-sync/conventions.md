# inv-app invitation design system — conventions

This design system is **the system**: the invitation card, its closed design tokens, and the app's material (the `:root` tokens adr-018 installed, at adr-019's paper values, with the sheet and paper classes). INVINTO's product screens are designed in a separate project, **E-invitation design**, which binds this DS. The only two template sets here are component specs, `card-background` and `lang-switcher`. Every screen mockup (landing, editor, share panel, guest RSVP, host dashboard, notifications, gallery) lives in that project. Don't add screens here.

## Setup

No provider or wrapper is required. Components are self-contained; everything they need ships in `styles.css` and its `@import` closure (`_ds_bundle.css` + Google Fonts). Make sure that stylesheet is loaded — without it cards render as unstyled text. Fonts load from Google Fonts at runtime: the card's four (Playfair Display, Cormorant Garamond, Manrope, Marck Script) and the chrome's two (Literata for headings, Golos Text for body text). All six cover Cyrillic — this DS is bilingual Ukrainian/English and copy is frequently Ukrainian.

## The styling idiom: closed design-token enums

The core component is `InvitationPreview`. Its entire appearance is driven by the `design` prop — four **closed enums**, never free-form values:

| Token | Values |
|---|---|
| `palette` | `warm` `elegant` `playful` `minimal` `festive` `romantic` |
| `typography` | `serif` `sans` `script` |
| `layout` | `classic` `banner` `split` |
| `ornament` | `none` `floral` `geometric` `sparkle` |

Each token maps 1:1 to a CSS class (`palette-warm`, `type-serif`, `layout-banner`, `ornament-floral`) defined in `_ds_bundle.css`. **Never invent new token values, pass CSS, or restyle the card internals** — pick from the enums. Palettes set the custom properties `--bg`, `--ink`, `--accent`, `--wash`, `--edge`; typography sets `--font-display`/`--font-body`.

If you style your own surrounding UI, use the app's material tokens — the `:root` block at the top of `_ds_bundle.css` (adr-018's system, adr-019's paper values) — rather than raw hex: `--ground` (page ground), `--surface` (card stock), `--table` (the darker field a card is set on), `--ui-ink` / `--ink-muted` / `--ink-faint` (text tiers; `--ink-faint` is for labels, never sentences), `--ui-accent` (the oxblood), `--edge`, `--ui-font-display` / `--ui-font-body`, the `--r-*` radii and `--e-*` elevations, and the `.sheet` / `.sheet-solid` classes (`.sheet-solid` for anything that carries text). Every surface is opaque: nothing is translucent and no rule sets `backdrop-filter`. Two paper materials go **around** a card, never on it or inside it: `.grain` (a dot texture over whatever background colour carries it) and `.deckle` (the torn-edged mat of card stock, 12 px of pad). **Inside a `.inv` card, or on any element that carries a `palette-*` class, `--ink`, `--accent`, `--wash` and `--edge` are the card's own** — read the product's through `--ui-ink` and `--ui-accent`. `--ink-placeholder` and `--ink-whisper` are the two tiers below `--ink-faint`, kept for a decorative glyph and the INVINTO wordmark: never put readable text on them.

The `copy` prop carries the six text slots of an invitation: `title`, `greeting`, `body`, `details_line` (supports `\n` line breaks), `rsvp_prompt`, `closing`. Realistic, human copy — Ukrainian or English.

The optional `background` prop is an **opaque server-issued asset id** (adr-009) that the card resolves to `/api/backgrounds/<id>` and composites under the copy behind a palette-tinted scrim. **Omit it when designing** — there is no server here to serve the asset, and the card without it is exactly the CSS-only design. (`minimal` ignores it by design; `split` confines the image to the side panel.)

## Where the truth lives

- `styles.css` → imports `_ds_bundle.css`: every `palette-*` / `type-*` / `layout-*` / `ornament-*` class and the `.inv*` card structure. Read it before styling anything yourself.
- `components/general/InvitationPreview/InvitationPreview.d.ts`: the exact props contract.
- `components/general/InvitationPreview/InvitationPreview.prompt.md`: usage examples (six verified compositions covering every palette, layout, typography, and ornament).

## Idiomatic use

```jsx
<InvitationPreview
  copy={{
    title: "Запрошення на день народження",
    greeting: "Дорогі друзі!",
    body: "Запрошуємо вас відсвяткувати цей особливий день разом із нами.",
    details_line: "12 серпня, 18:00 — Кафе «Затишок», Львів",
    rsvp_prompt: "Будь ласка, підтвердіть свою присутність.",
    closing: "З любов'ю, Олена",
  }}
  design={{ palette: "warm", typography: "serif", layout: "classic", ornament: "floral" }}
/>
```

Give the card a constrained column on a neutral page background; it centers itself and carries its own shadow, border, padding and a 380 px min-height. For reference, the editor sets it as the guest page does: on the deckled mat (`.cc-mat > .deckle`), 460 px wide at most with the mat's 12 px pad included (`.cc-preview-inner`: `width: min(460px, 100%)`), so the card itself is 436 px there, centred on the grained table (`--table` with `.grain`) with 28 px of padding.
