---
name: BookMyVilla — Join Us reference adaptation
description: Code-derived documentation for the Join Us route; shared incumbent context is recorded separately.
colors:
  join-gold: "#c17c00"
  join-yellow: "#ffd64d"
  join-ink: "#101720"
  join-muted: "#4f5869"
  join-line: "#efdfba"
  join-cream: "#fcfaf6"
  join-process: "#f9f6ef"
  join-card: "#fffdf9"
  join-icon-fill: "#fcf0ce"
  join-icon-ink: "#9e6500"
  join-action-ink: "#101b15"
  join-action-hover: "#ffe484"
  join-action-hover-ink: "#102b22"
  join-eyebrow: "#ab6900"
  join-verified: "#126649"
  join-verified-fill: "#dbf7e9"
  join-verified-line: "#abe7cd"
  join-white: "#fff"
  shared-forest: "#2D433D"
  shared-gold: "#D4AF37"
  shared-sage: "#4A6762"
  shared-beige: "#F2ECE4"
  shared-ink: "#1A1A1A"
  shared-muted: "#5C5C5C"
typography:
  join-display:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "clamp(50px, 5.15vw, 73px)"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  join-heading:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "clamp(28px, 3.05vw, 43px)"
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: "-0.035em"
  join-body:
    fontFamily: "Outfit, sans-serif"
  join-label:
    fontFamily: "Outfit, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "2.8px"
  join-action:
    fontFamily: "Outfit, sans-serif"
    fontSize: "14px"
    fontWeight: 600
  shared-body:
    fontFamily: "Outfit, Inter, sans-serif"
    lineHeight: 1.6
  shared-heading:
    fontFamily: "Outfit, Inter, sans-serif"
    fontWeight: 700
rounded:
  join-panel: "13px"
  join-card: "11px"
  join-pill: "999px"
  join-circle: "50%"
  shared-default: "16px"
spacing:
  join-benefit-gap: "14px"
  join-card-gap: "18px"
  join-action-gap: "16px"
  join-mobile-gutter: "18px"
components:
  join-action-primary:
    backgroundColor: "{colors.join-yellow}"
    textColor: "{colors.join-action-ink}"
    typography: "{typography.join-action}"
    rounded: "{rounded.join-pill}"
    padding: "9px 25px"
  join-action-secondary:
    backgroundColor: "rgba(10, 34, 26, 0.88)"
    textColor: "{colors.join-yellow}"
    typography: "{typography.join-action}"
    rounded: "{rounded.join-pill}"
    padding: "9px 25px"
  join-action-hover:
    backgroundColor: "{colors.join-action-hover}"
    textColor: "{colors.join-action-hover-ink}"
  join-benefit-card:
    rounded: "{rounded.join-panel}"
    padding: "12px 17px 17px"
  join-owner-card:
    backgroundColor: "{colors.join-card}"
    rounded: "{rounded.join-card}"
  join-verified-chip:
    backgroundColor: "{colors.join-verified-fill}"
    textColor: "{colors.join-verified}"
    rounded: "{rounded.join-pill}"
    padding: "3px 7px"
---

# Design System: BookMyVilla — Join Us reference adaptation

## Overview

This is a scan of the implemented `/join-us` partner content. The cream surface, gold accents, serif headings and photographic cards follow the user's supplied reference. Header and footer use the same `HomeHeader`, `HomeFooter` and `Home.css` as Home, Explore, Packages and About. The reference governs middle content only. This is a scoped reference adaptation, not a site-wide rebrand.

The incumbent shared system uses forest, gold, sage and beige with Outfit headings and body text. The `join-*` entries apply only within the Join Us page; the `shared-*` entries record existing context from `frontend/src/styles/variables.css`. No new product positioning or qualitative brand language is inferred.

**Key Characteristics:**

- Cream content sections framed by a dark photographic hero, shared transparent header and shared forest footer.
- Playfair Display display headings paired with Outfit utility and body text.
- Gold linework, round icon medallions, pill actions and compact owner cards.

**The Route Scope Rule.** Apply the Join Us values only to this route; preserve the shared incumbent system elsewhere.

## Colors

Primary route accents are yellow for hero actions and dark-surface highlights, and gold for section heading accents, step numbers and metrics. Cream, process tint and card white separate content surfaces. Ink and muted text carry the hierarchy; pale gold borders define panels. Header colors and active-link styling come from the shared Home stylesheet.

Icon medallions use their own pale fill and darker gold ink. Verified badges use a separate green foreground, mint fill and mint border. The shared palette is recorded for context and remains the authority for other pages.

**The Contrast Role Rule.** Use the darker gold text roles on pale surfaces and yellow on the dark hero, as implemented.

## Typography

The route's Playfair Display overrides apply only to its hero and section headings within `main`. Outfit carries descriptions, card text, navigation, steps and actions. Header/footer typography comes from the shared components and Home stylesheet. Desktop benefit copy is compact (13.5px); section descriptions use (14px), and hero copy uses (16px). Card titles and metadata grow on small screens.

At widths up to (600px), the hero title uses `clamp(42px, 11.8vw, 65px)` with line height (1.04), and section headings use (29px) with line height (1.18). The hero description line height increases to (1.45), and manually inserted desktop line breaks disappear.

Font sources and licenses are recorded in `frontend/src/assets/fonts/README.md`; the route imports local Google Fonts and Font Awesome stylesheets.

## Layout

Desktop content uses a centered container (88.6% wide, maximum 1280px). The hero is full width with a height of `clamp(380px, 33.75vw, 480px)`, bottom-aligned content, a left-to-right dark gradient and a cover photograph cropped at `center 57%`. Benefits and owners use four columns; numbered steps use three columns; the metric strip uses four columns. Section headings place titles and descriptions side by side.

The shared header switches to hamburger navigation up to (1100px); its horizontal padding changes to (24px) up to (980px) and (16px) up to (640px). The shared footer grid becomes two columns up to (980px) and one column up to (640px). Route content has separate breakpoints: up to (1100px), cards and steps tighten spacing and owner metadata can wrap. Up to (960px), benefits and owners use two columns, owner photographs are (185px) high, the hero is (430px) high and step content becomes vertical within three columns.

Up to (600px), the container has (18px) side gutters; the hero has a minimum height of (550px), an automatic height and a right-shifted crop (`66% center`). Hero actions stack and have a minimum height of (48px). Heading/description rows, benefits, steps and owner cards become one column. Step arrows disappear; owner photographs are (190px) high. Metrics become a two-by-two grid.

## Elevation & Depth

Thin borders and alternating surface tones carry most separation. Owner cards have a low warm shadow (`0 6px 20px rgba(91, 68, 28, 0.08)`); the primary hero action has a compact shadow (`0 5px 18px rgba(21, 20, 7, 0.18)`). The shared header is transparent at the top and gains its shared forest background, blur and shadow when scrolled or when the mobile menu opens. Hero depth comes from photography and the directional shade rather than a floating panel.

The shared global shadow remains an incumbent context token (`0 8px 32px 0 rgba(31, 38, 135, 0.1)`), not the route card shadow.

## Shapes

Benefits and the metric strip use gently rounded panels; owner cards use slightly tighter corners and clip their photographs. Actions, owner labels, ratings and verification chips are pills. Icon medallions are circles (58px on desktop benefits, 68px for steps). The shared default corner radius is separate from these route-specific shapes.

## Components

Primary registration links route to `/register-property`; the secondary hero link opens the configured owner portal in a new tab. Both share the same hover colors. Partner-content links/buttons have a visible gold outline (3px, offset 5px); heading and focus overrides apply within `main`, preserving shared header, footer and login-dialog styles. Global link/button transitions use (0.3s ease); the route disables transitions and smooth scrolling under reduced-motion preference.

Join Us remains a text link in the shared `HomeHeader`, with the shared active-link underline on desktop. The same header supplies responsive navigation, login modal and profile controls across Home, Explore, Packages, About and Join Us; the route does not override header geometry or styling.

The same `HomeFooter` supplies the brand/social area, Quick Links, Support, Contact Us and legal links across those pages. Footer content, spacing, typography, focus and responsive behavior are inherited without route overrides.

Benefit panels contain an icon medallion, title and description. Process steps are a semantic ordered list with decorative directional arrows. Owner cards include a lazy-loaded photograph, property label, optional rating, property/location text and a verification chip. The four reference owner records remain present; approved API owners are appended and receive no invented rating. Metrics reproduce reference/demo content, so this scan does not validate them as business facts.

Pre-existing villa assets are reused without image modification. Their origins and the composition contract are recorded in `.impeccable/surfaces/join-us.md`. Partner content has no form fields; the shared header provides its existing login modal, which is outside this scoped token scan.

## Do's and Don'ts

- **Do** keep Join Us overrides scoped to the route wrapper.
- **Do** preserve the registration, explore and configured owner portal destinations.
- **Do** retain the responsive column changes and visible keyboard focus treatment.
- **Don't** promote route-specific cream, yellow or Playfair Display values into global site tokens.
- **Don't** infer product positioning, API owner ratings or validated business metrics from reference/demo content.
- **Don't** introduce unobserved form, dialog or component patterns into this scan.
