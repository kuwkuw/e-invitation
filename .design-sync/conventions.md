# inv-app invitation design system — conventions

This design system is **the system**: the invitation card, its closed design tokens, and the app's material (the adr-018 `:root` tokens and glass). INVINTO's product screens are designed in a separate project, **E-invitation design**, which binds this DS. Two template sets here are component specs and belong to the system: `card-background` and `lang-switcher`. The other template sets you may find here (landing, share panel, guest RSVP, host dashboard, auth gate, gallery, RSVP notifications, the superseded creation chat) are older screen mockups waiting to move to that project. Read them as a record of how a screen was decided, never as components to build from, and don't add new screens here.

## Setup

No provider or wrapper is required. Components are self-contained; everything they need ships in `styles.css` and its `@import` closure (`_ds_bundle.css` + Google Fonts). Make sure that stylesheet is loaded — without it cards render as unstyled text. Fonts (Playfair Display, Cormorant Garamond, Manrope, Marck Script) load from Google Fonts at runtime and all cover Cyrillic — this DS is bilingual Ukrainian/English and copy is frequently Ukrainian.

## The styling idiom: closed design-token enums

The core component is `InvitationPreview`. Its entire appearance is driven by the `design` prop — four **closed enums**, never free-form values:

| Token | Values |
|---|---|
| `palette` | `warm` `elegant` `playful` `minimal` `festive` `romantic` |
| `typography` | `serif` `sans` `script` |
| `layout` | `classic` `banner` `split` |
| `ornament` | `none` `floral` `geometric` `sparkle` |

Each token maps 1:1 to a CSS class (`palette-warm`, `type-serif`, `layout-banner`, `ornament-floral`) defined in `_ds_bundle.css`. **Never invent new token values, pass CSS, or restyle the card internals** — pick from the enums. Palettes set the custom properties `--bg`, `--ink`, `--accent`, `--wash`, `--edge`; typography sets `--font-display`/`--font-body`.

If you style your own surrounding UI, use the app's material tokens — the `:root` block at the top of `_ds_bundle.css` (adr-018) — rather than raw hex: `--ground` (page ground), `--surface`, `--ui-ink` / `--ink-muted` / `--ink-faint` (text tiers; `--ink-faint` clears only 3:1, so labels, never sentences), `--ui-accent`, `--edge`, the `--r-*` radii and `--e-*` elevations, and the `.glass` / `.glass-solid` classes (`.glass-solid` for anything that carries text). **Inside a `.inv` card, or on any element that carries a `palette-*` class, `--ink`, `--accent`, `--wash` and `--edge` are the card's own** — read the product's through `--ui-ink` and `--ui-accent`. `--ink-placeholder` and `--ink-whisper` sit below 3:1: never put readable text on them.

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

Give the card a constrained column on a neutral page background; it centers itself and carries its own shadow, border, padding and a 380 px min-height. For reference, the editor renders it up to 460 px wide (`.cc-preview-inner`: `width: min(460px, 100%)`), centred on the palette-tinted ground with 28 px of padding.
