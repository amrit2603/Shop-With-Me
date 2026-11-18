---
name: VYUMI — Shop With Me
description: A violet evening backdrop around a warm, shared shopping stage.
colors:
  backdrop-start: "#2a2540"
  backdrop-end: "#161326"
  backdrop-glow: "#4a4259"
  bg: "#101014"
  surface: "#1c1b23"
  surface-raised: "#292731"
  surface-sunken: "#15141c"
  surface-hover: "#34313d"
  surface-overlay: "rgba(20,19,26,.94)"
  glass: "rgba(255,255,255,.045)"
  border: "rgba(255,255,255,.14)"
  border-subtle: "rgba(255,255,255,.08)"
  border-hover: "#77717f"
  text: "#faf8fc"
  text-muted: "#bbb6c6"
  text-subtle: "#b3adbe"
  accent: "#ffcf7a"
  accent-hover: "#ffe1a8"
  accent-fg: "#221b12"
  accent-subtle: "rgba(255,207,122,.10)"
  primary: "#faf8fc"
  primary-hover: "#e8e3ed"
  primary-fg: "#18151d"
  status-green: "#79d8b3"
  status-red: "#ffa5b0"
  orb-white: "#fff9eb"
  orb-gold: "#eeb955"
  orb-blue: "#265bbc"
  orb-dark: "#0b0f19"
typography:
  display:
    fontFamily: "Manrope, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(2.5rem,5.1vw,4.5rem)"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-.03em"
  headline:
    fontFamily: "Manrope, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(2rem,4vw,3rem)"
    fontWeight: 600
    letterSpacing: "-.03em"
  title:
    fontFamily: "Manrope, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(1.25rem,2.2vw,1.7rem)"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-.03em"
  body:
    fontFamily: "Manrope, Segoe UI, system-ui, sans-serif"
    fontSize: ".9375rem"
    lineHeight: 1.5
  label:
    fontFamily: "Manrope, Segoe UI, system-ui, sans-serif"
    fontSize: ".8125rem"
rounded:
  sm: "8px"
  md: "14px"
  lg: "20px"
  xl: "26px"
  full: "9999px"
  stage: "34px"
  stage-mobile: "24px"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "16px"
  space-4: "24px"
  space-5: "32px"
  space-6: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-fg}"
    rounded: "{rounded.full}"
    padding: "12px 24px"
    height: "50px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.full}"
    padding: "12px"
  input-name:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.text}"
    rounded: "{rounded.full}"
    padding: "12px 20px"
    height: "50px"
  card-glass:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.text}"
    rounded: "{rounded.xl}"
    padding: "24px"
  reaction:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "12px"
  reaction-selected:
    backgroundColor: "{colors.accent-subtle}"
  navigation:
    backgroundColor: "{colors.surface-overlay}"
    textColor: "{colors.text}"
    height: "72px"
---

# Design System: VYUMI — Shop With Me

## Overview

**Creative North Star: "The shared shopping stage"**

A near-black rounded stage sits inside a fixed violet-grey evening gradient. Warm light, sparse stars and a slowly changing gold-and-blue CSS orb give the entry screen its atmosphere. White actions and legible Manrope text carry the workflow.

Operational screens use restrained translucent panels around actual products, people and reactions. The decorative sample on entry is explicitly a preview; operational presence and results reflect real state. Preserve VYUMI and Shop With Me naming, plain copy and the existing name-only entry.

**Key Characteristics:**
- Violet surroundings and a near-black stage.
- White primary actions with warm gold emphasis.
- Self-hosted Manrope and restrained glass panels.
- A gold-and-blue liquid orb with reduced-motion support.

This record describes the built CSS and sampled components. `frontend/src/theme.css` owns presentation values; `World.css` applies the shared world after component styles. Public result HTML uses both stylesheets, and canvas exports read computed color, font-family and export font-size tokens through `utils/theme.js`. The final-choice canvas retains its existing 1080 × 720px composition. The frontmatter records the reusable core, not every compatibility alias or migrated component dimension. Sidecar tonal strips are synthesized previews of these colors, not additional shipped theme tokens.

## Colors

The palette combines muted violet surroundings, warm white text and gold highlights; blue belongs primarily to the liquid material.

### Primary
- **Warm White** (`primary`): filled primary actions, including entry and chat send. Its dark foreground keeps the action distinct from the stage.
- **Stage Gold** (`accent`): links, focus outlines, active selections, host tags and live connection status. The subtle variant fills selected surfaces.

### Secondary
- **Liquid Gold, Porcelain Highlight, Liquid Blue and Deep Ink** (`orb-*`): layered radial gradients and inset lighting in the decorative orb. These are material colors, not extra action variants.
- **Soft Mint and Rose** (`status-green`, `status-red`): success and error states. Amber aliases the gold accent in the source.

### Neutral
- **Violet Evening** (`backdrop-*`): the fixed outer gradient and upper-left glow.
- **Near Black** (`bg`): the enclosing stage.
- **Charcoal Layers** (`surface`, `surface-raised`, `surface-sunken`, `surface-hover`): solid cards, selected tabs, fields and hover states.
- **Quiet Glass** (`glass`, `surface-overlay`): translucent panels and opaque-enough overlays. Border tokens distinguish edges without a bright frame.
- **Warm White, Muted Lavender and Subtle Lavender** (`text`, `text-muted`, `text-subtle`): primary content, supporting copy and secondary metadata.

**The White Action Rule.** Preserve white filled primary actions; gold marks focus and selection rather than replacing the primary action fill.

## Typography

**Display Font:** Manrope, with Segoe UI, system-ui and sans-serif fallbacks.
**Body Font:** the same self-hosted variable Manrope face (available weights 200–800).

The single-family system uses moderately weighted headings and tight heading tracking. It relies on size and contrast rather than a contrasting display face. Legacy utility monospace stacks remain for codes; they are not the main brand voice.

### Hierarchy
- **Display:** the entry headline; the frontmatter records its desktop clamp. Below 700px it uses `clamp(2.1rem,9vw,3.2rem)`.
- **Headline:** page titles such as saved products and builder headings. Result headings have their own existing clamps in the theme.
- **Title:** the current party product, with balanced wrapping and a compact line height.
- **Body:** default interface copy; supporting entry copy is constrained to 440px, and saved-page introductory copy to 65ch.
- **Label:** form labels and compact metadata. The source also uses a .75rem small-text step and .6875rem presence metadata; these are existing dimensions, not a mandate to shrink new body copy.

## Layout

The desktop body inset is 20px, reducing to 8px at 700px. The stage clips its contents and has a minimum height based on the visible viewport. The navbar container is capped at 1400px, 72px tall on desktop and 60px tall on mobile.

Entry is capped at 1280px with a 790px minimum desktop height. Its centered name form is capped at 480px. The decorative orb begins 400px down; the 260px invitation and sample panels sit at 490px and 550px respectively in the final desktop cascade. Below 700px, these become a vertical flow; the orb becomes a 210px frame with a 340 × 360px body. These dimensions describe the current entry composition, not a reusable page template.

The room container is capped at 1440px. Desktop room columns are flexible main content plus a 300px sidebar, reducing to 270px at 1050px and one column at 900px. Within the stage, product media and details are equal columns; below 700px they stack, while reactions remain a two-column grid. Product image height is 270px, then 240px at 1050px, and 144px in the final mobile override. Desktop reaction cards have an 82px minimum height; mobile cards have 62px.

Catalog cards use three columns, reducing to two at 700px. Saved content is capped at 1140px; public results at 820px. On mobile, fixed room tabs provide access to chat and summary, and the room reserves 88px bottom padding. Comments and Help me choose start open; management and product comparison remain secondary disclosures.

The reusable spacing rhythm is in the frontmatter. Existing component-specific padding, gaps and margins remain centralized as `--inset-*`, `--gap-*` and `--outset-*` in the theme; do not replace their dimensions merely to force a uniform scale.

## Elevation & Depth

Depth combines tonal layers, translucent fills, fine borders and soft ambient shadows. The near-black stage receives a broad ambient shadow and warm upper-left glow. Product media uses a small shadow plus an image drop-shadow. Blur belongs to navigation, floating entry panels and overlays; routine operational glass panels use fill and borders without blanket blur.

### Shadow Vocabulary
- **Small:** `--shadow-sm`, for cards, primary buttons and selected tabs.
- **Medium:** `--shadow-md`, for the party stage and result container.
- **Large:** `--shadow-lg`, for floating entry cards and room-ready overlays.
- **Stage:** `--shadow-stage`, for the outer enclosure.
- **Liquid:** `--shadow-1`, inset highlights and a warm halo on the orb.

**The Restrained Glass Rule.** Keep blur on floating or overlay surfaces; preserve readable solid and translucent operational layers.

The sidecar carries exact shadow and motion values. Without backdrop-filter support, the invitation, sample and navbar fall back to solid surface fill. The orb alternates its radius and rotation over 14 seconds; stars breathe over 7 seconds. Reduced motion stops both, suppresses hover transforms, and the base stylesheet minimizes other animation and transition durations.

## Shapes

The stage has the largest ordinary corner radius, reducing on mobile. Cards use the extra-large radius; galleries and tool containers use the large radius; fields and reaction cards use the medium radius. Pills are used for main actions, entry fields, invitation actions and navigation controls. Party controls preserve their existing medium-radius treatment rather than forcing every button into a pill.

The orb is the exception to rectilinear containers: asymmetric percentage radii change between two shapes while the material rotates. Participant avatars are circles with overlapping edges; product thumbnails keep small rounded corners. Fine one-pixel borders provide most surface separation.

## Components

### Buttons
White primary pills are prominent and direct. The entry action is 50px tall with the frontmatter padding; global button and summary targets have a 44px minimum height. Hover shifts buttons up 1px, active shifts them down 1px, and primary hover uses `primary-hover`. Disabled primary buttons have half opacity and no shadow. Other controls retain their source-specific muted or outline variants.

### Inputs / Fields
Fields use a sunken fill, visible border and light text; the entry name field is a pill, while ordinary fields use medium corners. Labels stay visible. Focus is a gold two-pixel outline with a four-pixel offset in the shared world; more-specific existing component focus rules can retain a three-pixel offset. Invalid messages remain inline alerts; do not substitute decorative state for an error message.

### Navigation
The sticky navbar is a dark translucent strip with 16px blur and a subtle lower border. Links use rounded targets and glass hover fill. The identity trigger has glass fill and a visible border. Mobile room tabs use a dark overlay, medium shadow, large corners and 52px minimum tab heights.

### Chips
Host tags use gold text on a subtle gold fill. Saved/navigation chips and room-code actions use glass fill and pill corners. Participant identity colors come from the existing ten-color avatar palette in the theme; preserve their dark avatar foreground.

### Cards / Containers
Catalog and saved cards use solid surface fill, extra-large corners and small shadows. Entry invitation/sample cards use glass, blur and large shadows. Chat and summary containers use glass, fine borders and small shadows. Tool disclosures have large corners and 18px padding; they are not floating overlays.

### Party reactions and presence
Four labelled emoji reaction controls form a two-by-two grid. Counts use tabular numbers; the selected state adds gold fill, border and an inset one-pixel gold ring. Emoji reactions are explicitly part of the supplied brief. Online avatars, the room count and connection status use actual state. Never substitute decorative sample data into this row.

### Liquid orb
The entry orb is CSS, not a video or remote image. Radial gold and blue patches, near-white inset highlights and a deep dark base create its reflective material. It is hidden from assistive technology and must not obscure entry controls.

## Do's and Don'ts

### Do:
- **Do** reuse theme tokens and the shared World layer for new surfaces and exports.
- **Do** preserve the violet backdrop, near-black stage, white actions and warm gold selection language.
- **Do** keep visible labels, keyboard focus, reduced-motion behavior and 44px control targets.
- **Do** keep comments and assistance visible initially, with management and comparison choices secondary.
- **Do** distinguish the decorative sample preview from live room state.

### Don't:
- **Don't** restore the superseded navy/lime identity or replace self-hosted Manrope with a new display family.
- **Don't** add blur to every operational panel or introduce a new action color system.
- **Don't** treat CSS dimensions or this documentation as proof of WCAG certification or cross-device verification.
- **Don't** promote incidental migrated aliases, legacy glow effects or compact metadata sizes into new global design rules.

Not canonized: the brief explicitly pins an entry eyebrow pill, while Impeccable's general craft floor refuses eyebrows; it remains a user-directed exception rather than a reusable component rule. Existing legacy glow aliases and utility font stacks are recorded as compatibility context, not prescribed for future surfaces. Documentation does not repair source or certify rendering.

## November 3 requested workflow adjustments

The landing alone now fills the viewport without the outer margin or stage radius; operational screens retain the violet/glass world. Share cards have WhatsApp and Copy link only, with dialog dismissal retained and room entry outside the card. Help me choose is a maximum of three tappable questions. Manage party lists members and follow state; votes show complete product cards. Personal saves and identity are tab-scoped. The mobile product image is 120px high to keep all four reactions above bottom navigation after adding Leave room / Log out.

## Latest landing/sharing restoration

The later full-viewport landing override was reverted by user request: use the preceding rounded stage with 20px desktop / 8px mobile outer space and the existing centered composition. The invitation now includes native Share with direct URL/copy fallback and a clickable code with separate Code copied feedback. Other tab/room fixes and the established design tokens remain.


## Latest invite/party simplification

The initial landing remains the rounded violet composition. The invited state uses one centered panel with the retained invitation above the name field. Share and WhatsApp are spaced sibling actions, WhatsApp accented using existing tokens. Leave demo is a centered full-width menu action. Shopping defaults to following the host with Previous/Next product; one member picker serves follow/transfer under Manage party. Vote sidebar cards are compact, with full data/actions/comments in expandable details and a bounded scroll list. Main product comments and assistance remain visible.


## Product tools refinement

Live-stage product details use Save/View/More. Product help shows a question form and collapsed comparison/optional quick choice. Product comments are a separate compact thread/composer. These scoped variants reuse existing tokens and handlers; default product cards, votes, party controls and the landing composition stay intact. Room-chat badges represent an explicit product selection only.


November 4 superseding brief: independent shared shopping cards, chat and votes. No party entry/follow/host-browsing controls, product comment UI or product image downloads. Retain room invite/name flow, private saves/sharing and compact product help. Legacy backend data/APIs remain for compatibility.


November4: compact selectable paper/charcoal room tiles retain Buy/votes; details/help/save/share move to one animated panel below. Landing uses source-derived ThreeUI glass-button adapter, retaining existing typography and native actions. Frontend47/browser13 and finalfocused1 passed; lint/build/detector passed. Exact full upstream font integration is partial; see TILES_AND_BUTTONS_RELEASE.md.
