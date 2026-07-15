# inv-app invitation design system — conventions

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

Each token maps 1:1 to a CSS class (`palette-warm`, `type-serif`, `layout-banner`, `ornament-floral`) defined in `_ds_bundle.css`. **Never invent new token values, pass CSS, or restyle the card internals** — pick from the enums. Palettes set the custom properties `--bg`, `--ink`, `--accent`, `--wash`, `--edge`; typography sets `--font-display`/`--font-body`. If you style your own surrounding UI, reuse those custom properties from a `.inv` context or the app-chrome palette in `styles.css` (page background `#f6f5f2`, ink `#23211d`, muted `#6b6659`).

The `copy` prop carries the six text slots of an invitation: `title`, `greeting`, `body`, `details_line` (supports `\n` line breaks), `rsvp_prompt`, `closing`. Realistic, human copy — Ukrainian or English.

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

Give the card a constrained column (~520 px max-width) on a neutral page background; it centers itself and carries its own shadow and padding.
