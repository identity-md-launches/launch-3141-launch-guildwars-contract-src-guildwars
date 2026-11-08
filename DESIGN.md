# Squeek Guild Wars design

## Overview

A compact, dark game dashboard for the Squeekchain community. The visual idea is a pair of determined hamsters pulling together, with dotted Doto headlines and restrained purple details. Rankings and Create / Join are the entry point; the remaining hash routes share the same navigation, content edges, panels, and wallet control.

The existing Solidity project is unchanged. The website lives in `web/`, with a ready-to-serve export in `dist/`. This document describes the implemented source, not the older HTML mockup.

## Colors

Canonical tokens are in [`web/src/styles.css`](web/src/styles.css), in `:root`.

| Token              | Value     | Role                                                   |
| ------------------ | --------- | ------------------------------------------------------ |
| `--bg`             | `#07070b` | Page and header background                             |
| `--surface`        | `#0d0d14` | Cards, fields, dialogs                                 |
| `--surface-hover`  | `#15151f` | Hover treatment                                        |
| `--border`         | `#232334` | Card borders, separators, inactive navigation          |
| `--control-border` | `#70617f` | Input/select outlines, raised for visibility           |
| `--text`           | `#ecebf5` | Main text                                              |
| `--muted`          | `#8a8aa3` | Supporting text and metadata                           |
| `--accent`         | `#a259ff` | Active navigation, tier progress, rope flag            |
| `--accent-light`   | `#c9a5ff` | Links, title accent, focus ring                        |
| `--green`          | `#2fd47a` | Small section squares and text-labelled success states |
| `--primary`        | `#f4f3fa` | Primary action fill                                    |
| `--ink`            | `#15131d` | Primary action text                                    |
| `--danger`         | `#ff9dba` | Errors and leaving/removal emphasis                    |

The 18px dot grid uses `#23233480` dots of radius 0.65px over the page. Hamster fur and the bronze/silver/gold emblems use their own illustration palettes in `art.tsx`; they are not additional action colors. Color is accompanied by text or an icon for statuses and tiers.

Calculated from the declared solid tokens: text/surface 16.38:1, muted/surface 5.76:1, accent-light/surface 9.50:1, green/surface 9.97:1, and control-border/surface 3.42:1. See `VALIDATION.md` for coverage and the unmeasured gradient/background cases.

## Typography

All four WOFF2 faces are local in `web/src/assets/fonts/`; their licenses are in `web/public/licenses/` and the export.

| Family                         | Loaded weight | Use                                                       |
| ------------------------------ | ------------- | --------------------------------------------------------- |
| Doto, `monospace`              | 900           | Page titles, VS, decorative title numbers                 |
| Barlow Condensed, `sans-serif` | 600           | Guild names, section headings, large metric values, brand |
| IBM Plex Mono, `monospace`     | 400, 600      | Text, labels, addresses, controls, data                   |

The six size tokens are 12, 14, 16, 24, 36, and 64px at the 16px root. `--text-xs` through `--text-display` define them. The Rankings headline is 64px on wide screens and 36px at 1050px and below; other page titles are 36px. Section headings are 24px. Body copy uses 14px in the dashboard, 12px for supporting metadata, and 16px for phone fields. Font synthesis is disabled; all loaded faces were observed as loaded in the live Chromium check.

Body line height is 1.6; short headings use 1.15, and the Rankings title 1.12. Doto titles track at −0.045em. Small labels use uppercase styling and +0.1em tracking, as requested; season labels use +0.06em below 760px. Table headings move from +0.08em to natural spacing on small screens. Normal prose has natural tracking. These explicit choices take precedence over the probe's generic mono/caps preferences.

Headings balance their lines. Addresses and long names wrap, remain selectable, and expose the full value. Only the wallet utility uses an abbreviated address, with the complete address in its dialog. Changing numbers use tabular numerals where relevant. Rules paragraphs have a maximum measure of 70ch.

## Layout

The header, navigation, and main content align inside a 1200px maximum width with 32px inline padding. The resulting wide content edge is 1136px. At 760px and below, inline padding is 20px. Spacing follows the declared 4, 8, 12, 16, 24, 32, and 48px scale, with explicit multiples for large gaps. Related controls typically use 8–12px gaps; sections use 24–32px.

Implemented breakpoints:

- **1200px and above:** the extra community footer text appears.
- **1050px and below:** the hero headline becomes 36px, captain tools use fewer columns, and the War season control moves to its own row.
- **760px and below:** navigation becomes two rows; large layouts stack; tier data moves into each guild's name cell; member actions wrap; forms use 16px text; dialogs become bottom sheets.
- **540px and below:** the decorative hero illustration is hidden, the hero padding shrinks, and the ranking empty-state illustration is hidden so its message fits the first 390×844 screen. War selectors stack at full width. Recruiting and title cards use one column. Tiers retain two columns.

Tables keep their structure and wrap names; they do not depend on horizontal page scrolling. Captain/member controls stay in normal flow. The native dialog scrolls within the viewport and accounts for the bottom safe area. Browser checks covered 320, 390, 760, and 1440px. Native browser zoom and physical phones remain untested.

## Elevation & Depth

Panels are flat: a surface fill and structural 1px border, without a card shadow. The headline has a soft `#a259ff22` text glow. Faint orbit outlines appear only in the desktop hamster artwork. Dialogs use the native modal layer, a `#000b` backdrop, and 5px backdrop blur. No fixed toolbar covers page content.

## Shapes

Cards use the requested 12px radius. Buttons and fields use 7px; small badges 5px; wallet rows 8px; desktop dialogs 16px. Phone dialogs have square bottom corners. Status dots are circular; the green heading marker is a 6px square. Emblems use shield outlines, while hamsters use soft, rounded SVG geometry.

## Components

| Source             | Pattern and behavior                                                                                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `App.tsx`          | Header, shared navigation, hash routing, main focus on route changes, persistent footer                                                                          |
| `components.tsx`   | `SectionTitle`, forward-looking `Empty`, `TierBadge`, `GuildName`, complete `WalletAddress`, `MemberBadges`, season `Countdown`, recoverable `ReadStatus`        |
| `Wallet.tsx`       | `WalletControl`: EIP-6963 names/icons, generic browser fallback, four phone links, Coinbase Wallet/Smart Wallet, network switch, pending/error/disconnect states |
| `Wallet.tsx`       | `Dialog`: native modal focus trapping, Escape/backdrop/close, focus restoration; busy transactions prevent dismissal                                             |
| `Transactions.tsx` | Shared action review, simulation, wallet pending, receipt pending, confirmed/error states; submitted transactions retry receipt lookup rather than sending again |
| `styles.css`       | `.primary` off-white action; `.secondary` outlined action; `.icon-button`; `.card`; labelled fields; segmented Create / Join control                             |
| `art.tsx`          | `Hamster`, `Emblem`, `Trophy`, escaped downloadable SVG share card                                                                                               |
| `War.tsx`          | `TugOfWar`, per-member averages, semantic lead meter, current/past comparison, submit review                                                                     |

Buttons expose rest, hover, active, focus-visible, and disabled states. Focus uses a 2px light-purple outline with 4px offset. Primary controls are at least 44px high; the compact refresh control is 32px and separated from adjacent controls. Form errors identify and focus the relevant field. Status and error announcements use status/alert regions.

Before the first successful history snapshot, War, Trophies, Recruiting and public profiles reuse `HistoryStatus` from `components.tsx`. It uses the existing `.empty-state` spacing, muted loading copy and a status region. Failed history uses the danger text token and a secondary “Refresh” button (accessible name “Refresh history”) beside the message. Counts and empty claims appear only after a snapshot exists; a later read failure keeps that snapshot and the shared `ReadStatus` warning. Title cards show “History unavailable” rather than zero achievers when the initial read fails. This adds no new color, type, spacing or responsive tokens.

Motion is opt-in under `prefers-reduced-motion: no-preference`: 150ms interaction transitions, 0.96 press scale, a finite 600ms pull sequence repeated twice for newly observed check-ins, a rope-flag transition, and a loading spinner. Reduced motion keeps the score and lead text without those animations. Initial history loading does not animate old check-ins.

## Do's and Don'ts

- Start another route inside `App.tsx` and reuse `page-title`, `SectionTitle`, `card`, and the shared content edges.
- Give its main action `.primary`; use `.secondary` for peers. Explain every contract action through `useTransaction().act`.
- Preserve the prescribed colors, three families, six-size scale, and modest density. Use the accent for navigation/links and game progress, with green kept small.
- Show unavailable reads as loading or errors. Empty states must follow a successful snapshot. Never add fixture guilds to the app.
- Generate guild art from its real ID and name. Keep previews labelled as previews.
- Reuse the existing public-RPC client and contract address; do not introduce wallet-based game reads, new contracts, or another indexer.
- Keep controls usable with a keyboard and honour reduced motion. Preserve full addresses and complete guild names.

Design guidance was adapted from Jakub Krehel's Better Interface (MIT, commit `267330e1adfc66a718fb65fa6918c1f06d0a689e`); documentation guidance from Paul Bakaus's Impeccable (Apache-2.0, commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`). Both notices/licenses are retained in `web/verification/design-guidance-LICENSE.txt`.
