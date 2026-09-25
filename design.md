# Design System Inspired by Spotify

> Auto-extracted from `https://open.spotify.com/` on 2026-09-24

## 1. Visual Theme & Atmosphere

High-contrast dark mode with vivid accents — feels modern, technical, and focused.

The hero section leads with "Your Library".

**Key Characteristics:**
- SpotifyMixUI as the heading font
- SpotifyMixUI as the body font for all running text
- Heading weight 700
- Dark background (#121212) as the primary canvas
- Primary accent `#1ed760` used for CTAs and brand highlights
- 6 shadow level(s) detected — tinted shadows
- Rounded corners (6px+) creating a friendly, approachable feel
- Tags: dark, rounded, colorful, compact, sans-serif

## 2. Color Palette & Roles

### Primary
- **Primary Accent** (`#1ed760`) · `--color-primary`: Brand color, CTA backgrounds, link text, interactive highlights.
- **Secondary Accent** (`#b02808`) · `--color-secondary`: Secondary brand, hover states, complementary highlights.
- **Background** (`#121212`) · `--color-bg`: Page background, primary canvas.
- **Background Secondary** (`#000000`) · `--color-bg-secondary`: Cards, surfaces, alternating sections.

### Text
- **Text Primary** (`#b3b3b3`) · `--color-text`: Headings and body text.
- **Text Secondary** (`#535353`) · `--color-text-secondary`: Muted text, captions, placeholders.

### Borders & Surfaces
- **Border** (`#535353`) · `--color-border`: Dividers, outlines, input borders.

### Full Extracted Palette

| # | Hex | CSS Variable | Role | Area | Contrast |
|---|---|---|---|---|---|
| 1 | `#121212` | `--palette-1` | section | large | text-light |
| 2 | `#000000` | `--palette-2` | block | large | text-light |
| 3 | `#535353` | `--palette-3` | section | large | text-light |
| 4 | `#1f1f1f` | `--palette-4` | button | large | text-light |
| 5 | `#1ed760` | `--palette-5` | button | large | text-dark |
| 6 | `#777777` | `--palette-6` | block | medium | text-light |
| 7 | `#4f7f77` | `--palette-7` | block | medium | text-light |
| 8 | `#ffffff` | `--palette-8` | button | medium | text-dark |
| 9 | `#b01090` | `--palette-9` | block | medium | text-light |
| 10 | `#c0555c` | `--palette-10` | block | medium | text-light |
| 11 | `#b82818` | `--palette-11` | block | medium | text-light |
| 12 | `#6f7780` | `--palette-12` | block | medium | text-light |
| 13 | `#b02808` | `--palette-13` | block | medium | text-light |

## 3. Typography Rules

- **Heading Font:** `SpotifyMixUI`, sans-serif
- **Body Font:** `SpotifyMixUI`, sans-serif

### Type Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing |
|---|---|---|---|---|---|
| H1 | SpotifyMixUI | 16px | 700 | normal | normal |
| H2 | SpotifyMixUITitle | 24px | 700 | normal | normal |
| H3 | SpotifyMixUI | 16px | 700 | normal | normal |
| H4 | SpotifyMixUI | 16px | 700 | normal | normal |
| Body | SpotifyMixUI | 14px | 700 | normal | normal |

### Type Scale

| Token | Size | Suggested Usage |
|---|---|---|
| Display | `24px` | headings |
| H1 | `16px` | headings |
| H2 | `14px` | headings |
| H3 | `13.3333px` | headings |
| H4 | `12px` | headings |

### Japanese Typography (CJK)

This site uses Japanese (CJK) text. Apply the following rules:

- **Line height:** Use `1.7`–`2.0` for body text (CJK needs more vertical space than Latin)
- **Letter spacing:** Use `0.04em`–`0.08em` for body text (improves Japanese readability)
- **Font fallback:** Always include a Japanese font fallback: `SpotifyMixUI, "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif`
- **Word break:** Use `word-break: normal` and `overflow-wrap: anywhere` — never `break-all` for Japanese
- **Kinsoku (禁則処理):** Avoid line breaks before closing brackets 」）】 or after opening brackets 「（【
- **Heading line-height:** `1.3`–`1.5` (tighter than body, but looser than Latin headings)
- **Minimum body font size:** `14px` (Japanese characters are complex, smaller is hard to read)

## 4. Component Stylings

### Primary Button

```css
.btn-primary {
  background: #121212;
  color: #ffffff;
  border-radius: 0px;
  padding: 0px 0px;
  font-size: 16px;
  font-weight: 400;
  border: none;
  cursor: pointer;
}
```

### Filled Button

```css
.btn-filled {
  background: #1f1f1f;
  color: #ffffff;
  border-radius: 50px;
  padding: 12px 12px;
  font-size: 16px;
  font-weight: 400;
  border: none;
  cursor: pointer;
}
```

### Pill Button

```css
.btn-pill {
  background: transparent;
  color: #b3b3b3;
  border-radius: 9999px;
  padding: 12px 12px;
  font-size: 16px;
  font-weight: 400;
  border: none;
  cursor: pointer;
}
```

### Pill Button 2

```css
.btn-pill-2 {
  background: #ffffff;
  color: #000000;
  border-radius: 9999px;
  padding: 8px 32px;
  font-size: 16px;
  font-weight: 700;
  border: none;
  cursor: pointer;
}
```

### Pill Button 3

```css
.btn-pill-3 {
  background: #1f1f1f;
  color: #b3b3b3;
  border-radius: 9999px;
  padding: 8px 16px;
  font-size: 13.3333px;
  font-weight: 400;
  border: none;
  cursor: pointer;
}
```

### Pill Button 4

```css
.btn-pill-4 {
  background: transparent;
  color: #9e9eff;
  border-radius: 9999px;
  padding: 0px 0px;
  font-size: 14px;
  font-weight: 700;
  border: none;
  cursor: pointer;
}
```

### Card

```css
.card {
  background: #1f1f1f;
  border-radius: 8px;
  padding: 16px;
}
```

## 5. Layout Principles

- **Base spacing unit:** `16px` — use multiples (32px, 48px, 64px, etc.)

### Spacing Scale (extracted from real elements)

| Token | Value | Role |
|---|---|---|
| spacing-1 | `16px` | element |
| spacing-2 | `12px` | element |
| spacing-3 | `8px` | element |
| spacing-4 | `4px` | element |
| spacing-5 | `2px` | element |
| spacing-6 | `11px` | element |
| spacing-7 | `24px` | card |
| spacing-8 | `40px` | card |

### Border Radius Scale

| Token | Value | Element |
|---|---|---|
| radius-button | `6px` | button |
| radius-card | `50px` | card |
| radius-subtle | `2px` | subtle |
| radius-button | `8px` | button |
| radius-button | `10px` | button |
| radius-subtle | `4px` | subtle |

## 6. Depth & Elevation

| Level | Shadow | Usage |
|---|---|---|
| High | `rgba(0, 0, 0, 0.5) 0px 8px 24px 0px` | Modals, floating elements |
| Mid | `rgba(0, 0, 0, 0.3) 0px 8px 8px 0px` | Dropdowns, popovers |
| Low | `rgb(18, 18, 18) 0px 1px 0px 0px, rgb(124, 124, 124) 0px 0px 0px 1px inset` | Cards, subtle elevation |
| Low | `rgba(0, 0, 0, 0.5) 0px 2px 4px 0px` | Cards, subtle elevation |
| Mid | `rgb(128, 128, 128) 0px 0px 5px 0px` | Dropdowns, popovers |


## 7. Do's and Don'ts

### Do
- Use `#121212` as the primary background color
- Use `SpotifyMixUI` for all headings and `SpotifyMixUI` for body text
- Use `#1ed760` as the single dominant accent/CTA color
- Maintain `16px` as the base spacing unit — all gaps should be multiples
- Keep the overall feel dark — use dark surfaces throughout
- Use rounded corners (`6px`+) consistently for all interactive elements
- Embrace bold color combinations — playful energy is the point
- Apply the shadow system for elevation — use the extracted shadow values
- Use weight 700 for headings to match the brand's typographic voice
- Use `line-height: 1.7-2.0` for Japanese body text
- Include Japanese font fallback (Noto Sans JP, Hiragino, Yu Gothic)

### Don't
- Don't use colors outside the extracted palette without justification
- Don't substitute SpotifyMixUI/SpotifyMixUI with generic alternatives
- Don't use irregular spacing — stick to 16px grid
- Don't introduce bright white surfaces — they break the dark palette
- Don't use sharp corners — they feel hostile in this rounded design language
- Don't use oversized hero text — this brand uses restrained type
- Don't use pure black (#000000) for text — use `#b3b3b3` instead
- Don't add decorative elements not present in the original design — no badges, ribbons, banners, or ornaments unless the source site uses them
- Don't invent UI patterns the source site doesn't have — if the original has no NEW badge, don't add one just because a red is in the palette
- Don't use `word-break: break-all` for Japanese text — it breaks in the middle of words
- Don't set body font size below 14px for Japanese — characters are too complex
- Don't use Latin-optimized line-height (1.2-1.4) for Japanese body text

## 8. Responsive Behavior

| Breakpoint | Width | Notes |
|---|---|---|
| Mobile | < 640px | Single column, stack sections, reduce font sizes ~80% |
| Tablet | 640–1024px | 2-column where appropriate, maintain spacing ratios |
| Desktop | 1024–1440px | Full layout as designed |
| Wide | > 1440px | Max-width container, center content |

- Touch targets: minimum 44×44px on mobile
- Maintain 16px base unit across breakpoints — only scale multipliers

## 9. Agent Prompt Guide

### Quick Color Reference

```
Background:  #121212
Text:        #b3b3b3
Accent:      #1ed760
Secondary:   #b02808
Border:      #535353
```

### Example Prompts

1. "Build a hero section with a `#121212` background, `SpotifyMixUI` heading in `#b3b3b3`, and a `#1ed760` CTA button with 0px radius."
2. "Create a pricing card using background `#000000`, border `#535353`, `SpotifyMixUI` for text, and 48px padding."
3. "Design a navigation bar — `#121212` background, `#b3b3b3` links, `#1ed760` for active state."
4. "Build a feature grid with 3 columns, 48px gap, each card using the card component style."
5. "Create a footer with `#000000` background, `#b3b3b3` text, and 32px padding."

### Iteration Guide

1. Start with layout structure (sections, grid, spacing)
2. Apply colors from the palette — background first, then text, then accents
3. Set typography — font families, sizes from the type scale, weights
4. Add components — buttons, cards, inputs using the specs above
5. Apply border-radius consistently across all elements
6. Add shadows for depth — use the extracted shadow values, not defaults
7. Check responsive behavior — test mobile and tablet layouts
8. Final pass — verify all colors match, spacing is consistent, fonts are correct
