# Worker validation — Squeek Guild Wars

Implementation and checks completed on 2026-11-08. These are the worker's observations, not independent certification. Production is the repository-root `dist/`; source, lockfile, tests, and reports are in `web/`. No contract was deployed or changed.

## Results

| Check                            | Actual result                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| `npm --prefix web run build`     | Pass; Vite 7.3.7 production export, relative asset URLs                             |
| `npm --prefix web run typecheck` | Pass; `tsc --noEmit`                                                                |
| `npm --prefix web run test:unit` | 13 passed, 0 failed                                                                 |
| `npm --prefix web run test:ui`   | 17 passed, 1 explicitly skipped: WebKit host libraries unavailable                  |
| Axe in Chromium                  | 0 violations for the selected WCAG 2 A/AA and 2.1 AA rules on all seven main routes |
| `npm --prefix web run test:live` | Pass; real public-RPC reads, no injected wallet, no writes                          |
| Pinned taste@1 probe             | 12/16 raw checks passed; four reviewed exceptions below                             |
| 390×844 first screen             | Product, Create / Join, and the complete no-guild message visible                   |
| Responsive checks                | No horizontal page overflow at 320, 390, 760, or 1440px                             |
| Static export                    | Local fonts, favicon, social PNG, wallet marks, licenses, JS, and CSS included      |

Final command outputs: [build](web/verification/build.txt), [typecheck](web/verification/typecheck.txt), [unit tests](web/verification/unit-tests.txt), [interaction results](web/verification/interaction-results.json), [live reads](web/verification/live-read.json), and [taste results](web/verification/taste.json). The tests serve the real production export under `/preview/` and close their browser/server when done.

## Scope and implementation coverage

| Requirement                                               | Implementation and evidence                                                                                                                                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| English, phone-friendly dark static site; required notice | Seven hash routes, prescribed palette/type, responsive source in `styles.css`; exact “Unofficial community project; no tokens, no payouts.” in the persistent footer and Rules                                      |
| Only live GuildWars on Sepolia                            | `chain.ts` fixes chain 11155111, address `0x4d9c2fa10fb70100d4c2390212b8f8de286a1d30`, and the requested public RPC; runtime and chain checked before writes                                                        |
| Public reads; wallet only for account/chain/send          | Getter calls, logs, simulations, estimates and receipts use the separate public client. Browser fixtures assert that wallet methods never include game reads or gas estimation                                      |
| Honest empty states                                       | Live guildCount 0 and no logs observed. A failed initial RPC does not render the no-guild state. Refresh recovery tested                                                                                            |
| Rankings                                                  | Event-derived guild IDs; authoritative snapshot scores; name search, tier filter, sorting, member/seat counts, tier emblems and UTC countdown                                                                       |
| My guild                                                  | Tier progress; exact `checkIn()` simulation; base/round/staker breakdown; member points, streaks, last-observed staker bonus; all captain/member controls                                                           |
| Twelve write functions                                    | UI handlers and ABI encoding for create, join, leave, kick, removeInactive, transferCaptain, claimCaptain, setRecruiting, setInviteCode, setLookingForGuild, checkIn, submitWar                                     |
| War                                                       | Two selectors, season snapshots, averages, historic member scores, lead meter, clamped rope flag, newly seen CheckedIn pull, past results, eligibility checks and captain confirmation                              |
| Recruiting/profiles                                       | Open seats, on-chain opt-in/out, full wallet addresses and public activity profiles; board listings hidden while their wallet is in a guild                                                                         |
| Trophies/titles                                           | SVG podiums from actual past WarResult averages; no invented third place; four tier emblems; 7/30/100-day milestones from CheckedIn events                                                                          |
| Invite handling                                           | Cryptographic random `MR-` codes with six characters; keccak256 hash in creation/rotation calldata; shown once after receipt; no persistence; public join-code warning                                              |
| Hamsters                                                  | Keccak hash of ID and name; eight fur palettes, three eye styles, five accessories; inline SVG reused by pages and share cards                                                                                      |
| Share card                                                | Real Blob SVG download tested; 14% case, ties, zero-score comparison, XML escaping, and names containing “by” covered                                                                                               |
| Rules                                                     | Seats, UTC daily points and integer rounding, bonus conditions/failures, weekly seasons, average scoring, tiers, wars, cool-down, inactivity, public codes and captain-selected pairing limitations                 |
| No indexer                                                | Logs from block 12,089,806; 4,000-block chunks with range splitting; memory cache; 12-block reorg overlap; 30-second refresh while visible; same-block getter reads                                                 |
| Safety                                                    | Plain action review, public `eth_call` with connected address, public gas estimate, chain/account recheck, zero transaction value, immediate send lock, disabled pending controls, receipt-only retry after sending |
| Metadata/export/docs                                      | Real title, description, favicon, og:title and 1200×630 PNG; relative asset URLs; README install/preview/rebuild instructions; root DESIGN.md                                                                       |

The voluntary SQK tip is omitted. There is no approval or token-transfer flow.

## Live contract and ABI verification

`web/scripts/verify-contract.mjs` compiled the unchanged `src/GuildWars.sol` with solc 0.8.24, optimizer 200, Cancun EVM, no CBOR metadata. Substituting the three pinned immutable constructor values produced a **byte-for-byte match** with the deployed 11,238-byte runtime. The supplied source was also compared to the pinned source commit `fa2b33700e1689fc9aefe1a143a10b0e0783574f` and matched.

Runtime keccak256:

```text
0xb36deb856be191f1c2c3cb222c7d580cd0c9831bbb9384e4dfe4511c6f29c7a1
```

The ABI is generated from that matching source. **The ABI hash comparison did not match the pin.** Recursively sorted object keys, compiler-order arrays, compact JSON, UTF-8, and keccak256 yield `0xcf3e732f644c698833395dd9527f2b31e6d9a74578c0819db88b2046278bcd86`; the supplied pin is `0xcc93f5639849513738065b2953747ddda5bc0b3e740829e080f4475ca314ad8d`. This discrepancy is retained in [contract-verification.json](web/verification/contract-verification.json), rather than reported as a successful ABI-pin match. The exact runtime match independently verifies the source/interface used by the app. No guessed ABI or alternate contract is used.

The final live report contains its exact UTC timestamp, snapshot block, chain ID, guildCount, season, threshold, log range, runtime hash, loaded fonts and first-screen measurements. It observed zero guilds and zero logs from deployment. No real wallet was connected and no on-chain transaction was sent.

The runner's browser cannot directly reach the public RPC (`net::ERR_EMPTY_RESPONSE`). The live test forwards the browser's read-only JSON-RPC requests unchanged through `curl` to **https://ethereum-sepolia-rpc.publicnode.com**. This is a validation transport, not an application backend. A separate real response returned `Access-Control-Allow-Origin: *`. Fixture tests use synthetic RPC/wallet state only; their guilds, scores and addresses are not imported by the production entry point.

## Better Interface review

The pinned workflow, all six domains' core principles, and the implementation-documentation method were read and applied during construction. Consequential choices: retain the requested mono prose/caps labels, use the source contract's actual integer scoring/freshness behavior, interpret podiums as top recorded submitted-war averages, and label staker badges as last-check-in observations. The hamsters and header mark are original inline SVG rather than the Squeekchain logo.

| Domain        | Coverage | Evidence and limits                                                                                                                                                                                                                                                                                |
| ------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accessibility | Checked  | Native links/buttons/fields/dialog; labels and field-specific errors; live status/error text; keyboard wallet opening, Escape and focus restoration; visible 2px focus ring; all seven Axe scans; reduced motion. No screen-reader or physical-device session                                      |
| Layout        | Checked  | Export at a gateway-like subpath; 320/390/760/1440 overflow measurements; actual 390 and 1440 screenshots; populated guild/war layouts; mobile bottom sheet. Native 200% zoom, RTL and pseudo-localization not performed; product is English-only                                                  |
| Writing       | Checked  | Action verbs, explicit removal/leave/transfer consequences, gas-only payment explanation, public invite/opt-in warnings, specific recoverable errors, honest empty and pending states                                                                                                              |
| Typography    | Checked  | Six-size source scale; three families/three weights; all four local faces observed loaded; wrapping addresses/names; 16px mobile fields. Caps/mono choices are explicit brief overrides; platform font rendering outside Chromium unverified                                                       |
| Colors        | Checked  | Semantic tokens; prescribed palette; actual screenshots and probe's resolved-solid contrast check; source-token pair calculations. The probe leaves 53 text boxes over gradients/art unmeasured; no blanket contrast/compliance claim for them                                                     |
| UI            | Checked  | Structural borders without card shadows; source hover/press/focus states; fixture pending/rejection/success/receipt states; native dialogs; actual SVG download; pull animation/flag movement and reduced-motion stop. No 10%-speed browser Animations-panel replay or real wallet/passkey session |

### Findings corrected

| Severity / source                                      | Finding, change, recheck                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Medium — `web/src/styles.css:2297`                     | The phone's decorative empty hamster pushed its explanation below the first screen. Hide this decoration at ≤540px and reduce hero padding. Final 390×844 message bottom: **839.75px**; Create button bottom: **395.41px**. Both browser suites assert the bounds                          |
| Medium — `web/src/War.tsx:293`                         | Axe rejected an aria-label on a generic lead-bar div. Added `role="meter"`, min/max, numeric value and value text. All route audits pass after the fix                                                                                                                                     |
| Medium — `web/src/Wallet.tsx:104`                      | Detecting phones only from named EIP discovery could hide a wallet browser's generic injected provider. Detection now considers `window.ethereum` and discovery; the no-provider phone picker and injected discovery are checked. Real wallet apps remain untested                         |
| Medium — `web/src/styles.css:39`                       | Input/select outlines reused the faint structural border. Added `--control-border: #70617f`; calculated solid surface contrast is 3.42:1 and the fields were visually rechecked                                                                                                            |
| Medium — `web/src/styles.css:2413`                     | The narrow War selector override requested 14px text. Stacked the selectors and restored 16px. Rechecked 320–1440 layouts; native iOS zoom remains untested                                                                                                                                |
| Medium — `web/src/chain.ts:46`, `web/src/store.ts:108` | A real provider response temporarily lacked the newest snapshot block. Added at most two same-block retries and a specific Refresh message. The lagging-RPC fixture verifies recovery without mixing blocks; final real-RPC read passed                                                    |
| Medium — `web/src/CreateJoin.tsx:23`                   | A shared form error marked the wrong field invalid for some failures. Track the failing field, attach its error, and focus it. Validation and Axe checks pass                                                                                                                              |
| Medium — `web/src/art.tsx:179`                         | A one-line share caption could become too wide, and splitting the sentence at “by” could truncate valid guild names. Build two lines from the structured scores/names, with an intact accessible title. A dedicated “Stand by Me” / “Play by Play” regression and actual SVG download pass |
| Low — `web/src/Rankings.tsx:148`                       | “Highest score” clipped in the narrow native select. Changed it to “Top score”; rechecked the final mobile screenshot                                                                                                                                                                      |
| Low — `web/src/Rankings.tsx:42`                        | The no-payout notice repeated in the hero and footer. Retained the persistent notice and removed the hero duplicate. Probe repetition check passes                                                                                                                                         |

A score-formatting edge case was also corrected in `web/src/model.ts:59`: three displayed decimals keep the smallest possible nonzero gap between 1–20-member guild averages from appearing as zero. The 113/19 versus 119/20 regression passes. Contract comparisons still use the full scaled integers.

Initial typecheck also identified the installed Coinbase connector's object-shaped preference API and generic event-decoding types; both were corrected before the passing final typecheck. These were implementation failures, not claimed passes.

### Pinned design probe

The actual command, with the local Playwright module and browser path supplied, was:

```sh
node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```

The pinned input script is not part of the delivered repository. Its raw result is preserved. It checks the default production route at 320, 390 and 1440, plus reduced motion. Raw score: **12/16**.

- **casing / tracking:** retained because the brief explicitly requests “Uppercase small labels with wide letter spacing.” These are season metadata and table labels.
- **type-faces:** the three families and three weights satisfy the probe's counts; its remaining mono-prose complaint conflicts with the prescribed “IBM Plex Mono for text.” Retained.
- **eyebrows:** the reported “Current season” above “Reading…” is a metric label above a loading value, not a heading kicker. Confirmed against the rendered layout and live season value; no extra kicker added.

The other checks pass: render/local resources, layout, targets, measured contrast, type sizes, glyphs, slogans, repetition, first-screen copy budget, surfaces, motion, and share metadata. Three compact controls are below the 44px comfort target but satisfy the 24px/spacing check. The probe's direct-RPC network state is loading/error on this runner; actual live empty-state evidence comes from the separate read-only bridge check.

## Screenshot evidence

- [Live 390×844 first screen](web/verification/screenshots/live-390-first.png)
- [Live desktop export](web/verification/screenshots/live-1440.png)
- [Visible keyboard focus](web/verification/screenshots/keyboard-focus-390.png)
- [390px wallet sheet](web/verification/screenshots/wallet-390.png)
- [Populated guild layout — synthetic test fixture](web/verification/screenshots/fixture-guild-1440.png)
- [Past war layout — synthetic test fixture](web/verification/screenshots/fixture-war-1440.png)

The assigned browser MCP was attempted but failed to launch due to its temporary socket path length. The screenshots, browser interactions, and measurements above were actually performed using standalone Playwright Chromium. WebKit downloaded but could not launch because its host libraries are missing; it is skipped, not passed.

## Remaining limitations and completion

Complete for the requested website implementation and worker-side checks, with these verification limits: no native extensions/mobile wallets or Coinbase passkeys, real signatures, screen readers, physical devices, WebKit, native zoom, RTL, or slow-motion DevTools replay were tested. The supplied ABI pin remains a documented discrepancy. RPC availability and correctness remain external dependencies; the app preserves the last snapshot and exposes errors/Refresh, and its reorg overlap is 12 blocks. Reloading rebuilds all logs in memory. Native wallet integration requires internet and user approval.

Only the frontend, documentation and export are added; existing Solidity/build/dependency configuration is unchanged. No ignore file was changed. Runtime assets and licenses remain complete. Dependency installations, browser downloads and caches are excluded from the submission; the final path/byte audit is recorded below.

### Final path/byte audit

The final audit is in [bundle-audit.json](web/verification/bundle-audit.json). It counts every added file and conservatively counts the full contents of modified files, including the audit itself, against 8,388,608 bytes. It also checks the exported HTML/CSS asset graph, local social-image dimensions, lockfile/manifest agreement, forbidden paths, caches/archives/source maps, symlinks, and submodules. The only modified existing file is README.md; other deliverables are new under DESIGN.md, VALIDATION.md, web/, and dist/. Existing Solidity and Foundry configuration remain unchanged. No ignore rule was added.
