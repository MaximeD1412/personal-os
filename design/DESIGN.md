---
name: Sovereign Personal Cockpit
colors:
  surface: '#10141a'
  surface-dim: '#10141a'
  surface-bright: '#353940'
  surface-container-lowest: '#0a0e14'
  surface-container-low: '#181c22'
  surface-container: '#1c2026'
  surface-container-high: '#262a31'
  surface-container-highest: '#31353c'
  on-surface: '#dfe2eb'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#dfe2eb'
  inverse-on-surface: '#2d3137'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffb95f'
  on-tertiary: '#472a00'
  tertiary-container: '#ca8100'
  on-tertiary-container: '#3e2400'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#10141a'
  on-background: '#dfe2eb'
  surface-variant: '#31353c'
typography:
  display-hero:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  title-sm:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
  body-default:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-dense:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-regular:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-micro:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
  telemetry-metric:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 24px
    letterSpacing: -0.02em
  code-mono:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-compact: 0.75rem
  margin: 1.5rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 1.75rem
  space-2xl: 2.5rem
---

## Brand & Style

The design system establishes a focused, tactical, and sovereign operating environment for personal infrastructure and home cockpit management. It prioritizes information density, autonomy, and quiet precision over decorative flourishes. The visual identity sits at the intersection of modern cloud engineering consoles, high-end homelab monitoring, and tactile productivity suites.

### Aesthetic Foundation
- **Modern Technical Minimalism:** dense information grids, disciplined typographic contrast, clean layout boundaries without unnecessary visual weight.
- **Deep Midnight Palette:** layered low-luminance slate tones (the `surface-*` ramp) that relieve visual fatigue during long desk sessions and keep OLED displays crisp.
- **Modular Telemetry Accentuation:** functional accents only. `primary` for active agency, `secondary` for health and validation, `tertiary` for scheduled or pending work, `error` for anomalies.
- **Subtle Surface Framing:** 1px ghost borders (`surface-container-highest`) combined with tonal stacking instead of drop shadows.

**Single source of truth:** every color, size and font below refers to the tokens declared in the frontmatter. No other hex value is allowed in the UI except the alpha variants listed in *Tinted tracks*.

## Colors

### Core Canvas & Surfaces (tonal ramp)
- **App canvas:** `surface` (#10141a).
- **Level 1, sidebar / top bar / wells:** `surface-container-lowest` (#0a0e14). The top bar uses `surface-container-lowest` at 90 % alpha (#0a0e14e6) because it overlays scrolled content.
- **Level 2, standard cards and module panels:** `surface-container` (#1c2026).
- **Level 3, nested widgets, hover and raised rows:** `surface-container-high` (#262a31).
- **Level 4, chips, tags, skeleton bones:** `surface-container-highest` (#31353c).
- **`surface-container-low`** (#181c22) is reserved for large side panels and list wells, never for a card sitting directly on the canvas.
- **Borders:** default `surface-container-highest` (#31353c). Hover / active border `outline-variant` (#424754). Focus ring `primary`.

### Functional Accents
- **Primary / brand action:** `primary` (#adc6ff) with `on-primary` text. `primary-container` (#4d8eff) is reserved for the mobile FAB, the active tab-bar dot and progress tracks, never for a text button.
- **Success / healthy / validated:** `secondary` (#4edea3); `secondary-container` for solid progress.
- **Warning / pending / coming soon:** `tertiary` (#ffb95f).
- **Destructive / critical:** `error` (#ffb4ab); `error-container` (#93000a) for solid destructive fills.

### Tinted tracks (the only alpha values allowed)
- `primary` 20 % (#adc6ff33) and 10 % (#adc6ff1a): selected rows, active filter chips, primary badges.
- `secondary` 15 % (#4edea326): success badges, online pills.
- `tertiary` 15 % (#ffb95f26): warning badges.
- `error-container` 20 % (#93000a33): alert badges.

### Domain pillars
Pillars are differentiated by icon and label, not by extra colors. Agenda and Projets use `primary`, Sport and Finances use `secondary`, Repas, Stock and Courses use `tertiary`, Infrastructure uses `outline`.

### Typography tones
- **Primary high-contrast text:** `on-surface` (#dfe2eb).
- **Secondary readable text:** `on-surface-variant` (#c2c6d6).
- **Muted / meta / placeholders:** `outline` (#8c909f). This is the lowest text tone allowed (5:1 on `surface-container`).
- `outline-variant` (#424754) is a border color and must never be used for text.

## Typography

Inter everywhere. JetBrains Mono (`code-mono`) for identifiers, hashes, paths, JSON and telemetry values that must stay monospaced.

### Scale and usage
- `display-hero` 40/700: public portfolio hero only.
- `headline-lg` 26/600: page title, one per screen. `headline-lg-mobile` 22/600 on mobile.
- `headline-md` 18/600: section headings inside a page.
- `title-sm` 15/600: card titles, list item titles.
- `body-default` 14/400: page subtitle, paragraphs, descriptions longer than about 40 characters.
- `body-dense` 13/400: list item descriptions, table cells.
- `label-regular` 12/500: control labels, tabs, secondary buttons.
- `label-micro` 11/500 uppercase, letter-spacing 0.02em: breadcrumb, eyebrow, badges, metadata. Minimum size in the system, nothing below 11px.
- `telemetry-metric` 20/700: KPI values.

### Rules
- Tabular figures (`tnum`) on every numeric value inside cards, metrics and schedules.
- Descriptive copy inside widgets stays between 45 and 60 characters per line.
- Breadcrumbs are `label-micro` uppercase in `outline`, current segment in `on-surface-variant`, separators are 14px `chevron_right` icons.

## Layout & Spacing

4px base increment.

### Breakpoints
- **Desktop ≥ 1280px:** fixed sidebar 240px under a 64px top bar; fluid 3 to 4 column grid; outer margin 24px (`margin`); gutter 16px (`gutter`).
- **Laptop / tablet 1024 to 1279px:** collapsed icon rail 72px; 2 to 3 columns; gutter 16px.
- **Mobile < 768px:** 390px reference canvas; single column; 56px header; 64px bottom tab bar; margin 16px (`margin-mobile`); gutter 12px (`gutter-compact`).

### Page skeleton (desktop)
1. Breadcrumb (`label-micro`).
2. Page title (`headline-lg`) with subtitle (`body-default`, `outline`) and right-aligned actions.
3. Optional KPI row (telemetry tiles, 140px min height).
4. Content grid.
Main content padding is 24px on all sides below the top bar. Screens are not fixed-height: the frame shrinks to its content and the app scrolls.

### Dashboard grid
- Telemetry tiles min-height 140px; interactive blocks (calendar, task lists) min-height 280px.
- Card padding is 16px on desktop and 12px on mobile, uniform on all sides.

## Elevation & Depth

Hierarchy comes from tonal stacking and 1px borders, never from diffuse shadows.

- Canvas `surface` → card `surface-container` with 1px `surface-container-highest` border → nested `surface-container-high`.
- Hover / selected card: border `outline-variant`.
- Modal / popover: `surface-container-high`, 1px `outline-variant` border, shadow `0 12px 32px -4px rgba(0,0,0,0.65)`.
- Live status glow on online dots: `0 0 10px` of the dot color at 35 % alpha.

## Shapes

- **Cards, panels, modals:** 12px (`md`).
- **Buttons, inputs, selects, nav items, tabs:** 8px (`DEFAULT`).
- **Tags, keyboard hints, small chips:** 4px (`sm`).
- **Status pills, avatars, dots, counters:** full capsule (`full`).
- Nested elements inside a 12px card use 8px.

## Icons

Material Symbols Outlined, one library for the whole product. Four sizes only:
- 16px inside badges, tags, breadcrumbs and dense table rows.
- 18px in sidebar nav items, list rows, buttons.
- 20px in card headers and KPI tiles.
- 24px in the mobile tab bar and page-level actions.
Hero or empty-state icons may use 32px. Icons inherit the text tone of their row.

## Components

### Buttons
Three sizes, one primary look.
- **sm:** height 28, padding 6/12, 12/600. Dense card actions.
- **md:** height 36, padding 8/16, 13/600. Default.
- **lg:** height 40, padding 10/20, 15/600. Page header and mobile primary actions.
- **Primary:** `primary` fill, `on-primary` text. Hover `primary-fixed` (#d8e2ff). Pressed scale 0.98. Disabled 40 % opacity.
- **Secondary / ghost:** `surface-container-high` fill, 1px `surface-container-highest` border, `on-surface` text. Hover: border and text `primary`.
- **Destructive:** `error-container` 20 % fill, 1px `error` border at 30 %, `error` text. Hover: solid `error-container` with `on-error-container` text.
- **Icon button:** same sizes, square, 8px radius. On mobile the hit area is never below 36×36 (44×44 preferred).

### Sidebar (desktop)
240px wide, `surface-container-lowest`, sits under the 64px top bar and stretches to the page bottom. Groups are `label-micro` uppercase in `outline`. Items are 32px tall, 8px radius, 18px icon, 13/500 label in `on-surface-variant`. Active item: `primary` 20 % fill, `primary` icon and text. Hover: `surface-container` fill. "À venir" items carry a `tertiary` pill. Footer: help link and node status pill.

### Top bar
64px, `surface-container-lowest` at 90 %, 1px bottom border `surface-container-highest`. Left: logo and environment pills. Center: command search (`⌘K`). Right: theme toggle and user block.

### Mobile tab bar
64px, `surface` at 90 %, top border `surface-container-highest`. Five items: Accueil, Agenda, Sport, Repas, Plus. Each item 56×44 minimum, 24px icon, 11px label. Active item uses `primary`.

### Modular cards
`surface-container` fill, 1px `surface-container-highest` border, 12px radius, 16px padding.
Header: 20px pillar icon, `title-sm` title, optional right pill or icon button. Footer: 1px top border `surface-container-high`, `label-micro` metadata or `primary` link.

### Checkboxes & task rows
18px box, 4px radius, `surface-container-lowest` fill, 1.5px `outline-variant` border. Checked: `primary` fill, `on-primary` check icon, adjacent label struck through and faded to `outline`.

### Inputs & search
`surface-container-lowest` fill, 1px `surface-container-highest` border, 8px radius, `body-default` in `on-surface`, placeholder `outline`. Height 36 (md) or 40 (lg). Focus: border `primary` and 2px ring `primary` at 20 %. Error: border `error`, helper text `error`.

### Status badges
Capsule, height 22, padding 2/10, 11/600, 6px dot.
- Online / validated: `secondary` dot and text on `secondary` 15 %.
- Pending / soon: `tertiary` on `tertiary` 15 %.
- Alert / degraded: `error` on `error-container` 20 %.
- Neutral / info: `primary` on `primary` 20 %.
Keyword tags are not badges: 4px radius, `surface-container-highest` fill, `on-surface-variant` text.

### Tabs & segmented controls
Container `surface-container-lowest`, 8px radius, 4px padding. Segment 28px, `label-regular`. Active segment `primary` 20 % fill (#adc6ff33) and `primary` text, same treatment as the active sidebar item; inactive `outline` text; hover `surface-container`.

## Interactive states

Every control documents five states: default, hover, focus-visible, pressed, disabled. Selectable items add selected.
- **Hover:** one step up the tonal ramp (`surface-container` → `surface-container-high`) or border `outline-variant`.
- **Focus-visible:** 2px `primary` ring at 20 % plus `primary` border. Never removed.
- **Pressed:** scale 0.98, fill one step darker.
- **Disabled:** 40 % opacity, no hover, cursor not-allowed.
- **Selected row / card:** `primary` 10 % fill and 1px `primary` border at 40 %.
- **Loading / empty / error:** skeleton bones in `surface-container-highest` with shimmer; empty and error states use a 32px icon, `title-sm` title, `body-dense` copy and one primary action.

## Component library (pen.dev)

The reusable components live in the seven `Design System / 0x …` boards of `untitled.pen` (Foundations, Actions, Forms, Data Display, Navigation, Feedback, Layout). Master naming is `Component/Variant`; sizes and tones are override presets. The machine-readable registry is `design-system.json`, the catalogue with props, slots and dependencies is `DESIGN-SYSTEM.md`.

## Accessibility

- Text contrast at least 4.5:1 on its surface. `outline` is the lowest tone allowed for text. Never put text in `outline-variant` or under 60 % alpha.
- Minimum text size 11px; 12px for anything the user must read repeatedly.
- Status is always conveyed by icon or label in addition to color.
- Touch targets on mobile: 44×44 preferred, 36×36 minimum, 8px spacing between adjacent targets.
- Visible focus on every interactive element; tab order follows the visual order.
