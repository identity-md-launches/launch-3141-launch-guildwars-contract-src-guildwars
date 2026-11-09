# Worker validation — Squeek Guild Wars

## Display update (2026-11-09)

This is the current revision record. The 2026-11-08 reports and screenshots retained below are historical and do not establish rendered checks of this export. The implementation is delivered in `web/` and `dist/`; native-browser verification remains incomplete because the available launchers failed. This is a worker report, not independent certification.

### Scope and implementation

The existing dark dashboard, hamsters, tug of war, hash routes and wallet flow are retained. `chain.ts`, `Transactions.tsx`, `Wallet.tsx`, ABI, runtime fingerprint, contract source and dependency/build configuration are unchanged. Reads and simulations still use only the existing public Sepolia RPC; there is no new service, analytics, token, tip feature or contract.

| Requested change | Implemented source and evidence |
| --- | --- |
| Guild IDs everywhere | `web/src/components.tsx:117` keeps IDs inline at all widths; `web/src/model.ts:58` supplies `guildLabel()` for headings, war controls/results, trophies, profiles, action reviews and SVG share cards. Hamster identity uses the original name/ID. A not-yet-created style preview has no assigned ID. Model and DOM checks cover copied names. |
| Warn without blocking creation | `web/src/CreateJoin.tsx:28`, `web/src/CreateJoin.tsx:145`: existing `GuildCreated` names are trimmed, whitespace collapsed and lowercased. All matching IDs appear in the required warning beneath the field and in the existing review explanation. Creation remains enabled. DOM checks enter a spaced/case-varied name and open `createGuild` review. |
| Rankings score context | `web/src/Rankings.tsx:18`, `web/src/Rankings.tsx:143`, `web/src/Rankings.tsx:197`: Members is current members / seats at every width; sample text and the default-off 5+ checkbox use `seasonMembers`. Existing sort options remain. Clear filters clears the checkbox. Required averages sentence is under the table. DOM case deliberately uses 6 current members / 4 season members to distinguish the two. |
| War context | `web/src/War.tsx:225`, `web/src/War.tsx:311`, `web/src/War.tsx:378`, `web/src/War.tsx:400`: form and comparison show selected-season counts, with the exact size warning at a difference of at least 3. Each guild roster counts `Left` and `Kicked` events within the selected UTC season. Same-tier/cosmetic notice sits immediately below Submit a war. DOM checks current/past seasons and the 2-versus-3 size-gap boundary. |
| Kick awareness | `web/src/MyGuild.tsx:28`, `web/src/MyGuild.tsx:254`, `web/src/MyGuild.tsx:300`, `web/src/MyGuild.tsx:351`: required removal/rejoin explanation beside captain controls and in the kick review. Recent changes shows the latest five `Kicked` events for this guild, newest first, with wallet and UTC block time. Events already receive timestamps from the existing store. DOM checks exact action arguments, explanation, wallet and timestamp. |
| Known limits | `web/src/Rules.tsx:56`: four plain-language points; the no-tokens/no-payouts notice stays in Rules and the persistent footer. DOM asserts the four entries and notice. |
| Honest zero/one states | DOM mounts Rankings, War and Create with zero guilds and with Golden Squeek #1. Rankings shows no synthetic rows for zero; War keeps its two-guild empty state and submission disabled for both scenarios; Create remains available. |
| Required static export | Production build with the existing relative Vite base; local fonts, wallet marks, favicon/social image and licenses retained. HTML already has title, description, favicon, og:title and og:image. Asset/path/byte audit recorded separately. |

Departure context counts departure events, including a departure followed by a rejoin; it is not a net change to the current roster. Recent changes lists removals only, as requested. Guild identity, warnings and context are derived from runtime events/getters, with no seeded production guilds.

### Commands and results

Dependencies were installed from the unchanged `web/package-lock.json` into `test/scratch/site/`, a scratch copy of the frontend. The final source/configuration matches the delivered `web/`; its static output was copied into `dist/`. All installed packages, browser downloads, caches and generated test harness bundles stay in deleted scratch space. No ignore file was added or changed.

```sh
npm ci --prefix test/scratch/site --cache test/scratch/npm-cache --no-audit --no-fund
npm run typecheck --prefix test/scratch/site
npm run build --prefix test/scratch/site
npm run test:unit --prefix test/scratch/site
npm install --prefix test/scratch/site --cache test/scratch/npm-cache --no-save happy-dom
node test/scratch/site/tests/display.mjs
```

| Check | Actual current result |
| --- | --- |
| Typecheck | Passed, `tsc --noEmit` |
| Production build | Passed, Vite 7.3.7, 824 modules, complete static export |
| Model tests | 16 passed, 0 failed; includes name normalization, copied-name cards, removal-season boundaries and original model regressions |
| DOM interactions | 7 groups passed, 0 failed; real React components, substituted store/account/transaction hooks, no native layout engine |
| Read-only live state | Passed via ABI-encoded calls forwarded through curl to the existing public RPC: chain 11155111, block 12,096,958, season 2967, one guild Golden Squeek #1, 1/10 members, score 20. Runtime hash matches the unchanged expected fingerprint. No wallet or write. |
| Native browser tool | Attempted; launch failed: `chrome_crashpad_handler: --database is required`, then SIGTRAP |
| Native Chromium UI suite | Attempted; launch failed with SIGTRAP (exit 133); no interaction checks ran |
| Pinned taste@1 | Attempted with `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste`; exited 2 because Chromium could not launch. **No current score or screenshot.** |
| Other browser fallback | Firefox launch failed (“Couldn't find the application directory”); WebKit installation reported missing host libraries. Neither is a pass. |
| 375px overflow / 390px first screen | **Not verified in a native browser.** Source rules reviewed; the product/hero/action layout is preserved and the extra filter follows it. DOM success is not evidence of pixel layout. |
| Accessibility rendering | No current Axe, visible-focus, screen-reader or rendered contrast pass claimed. Existing keyboard/focus/motion implementation is preserved. |

Current evidence: [build](web/verification/display/build.txt), [typecheck](web/verification/display/typecheck.txt), [unit tests](web/verification/display/unit-tests.txt), [DOM results](web/verification/display/dom-results.json), [live state](web/verification/display/live-state.json), [runtime limitations](web/verification/display/browser-status.json), [bundle audit](web/verification/display/bundle-audit.json). Native error logs were kept only in scratch; the concise status file records the actual errors without local machine paths.

### Better Interface review: six domains

Read and applied the pinned workflow, core principles for all six domains, relevant supporting sections and documentation method. Preserve the established dashboard design; no unrelated visual redesign. Source review and DOM coverage are distinguished from native rendering throughout.

| Domain | Coverage, evidence and limits |
| --- | --- |
| Accessibility | Source/DOM checked: native labelled checkbox, associated duplicate warning/status, unchanged button/field semantics, complete wallet links, semantic `<time>`, kick consequence before review, busy-disabled form. No current native keyboard/focus, screen-reader, Axe, forced-color or physical-device session. |
| Layout | Source checked: names wrap, IDs remain visible, Members never hidden, filter controls wrap in DOM order, recent-change rows wrap, mobile War controls remain stacked. Corrected mobile tier width from an initial 110px basis to 140px to retain room for “All tiers”; 375px overflow and actual first screen remain unmeasured. |
| Writing | Checked requested exact warnings/notices, clear toggle ON state, nonblocking duplicate names, selected-season terminology, UTC time, no-fake-data empty states, public identity on cards, and four Known limits. DOM exercises the resulting text and relevant states. |
| Typography | Source checked: six existing size tokens, same three families/local fonts and weights, muted 12px context, regular tracking, inline readable IDs and complete addresses. No font added. Native wrapping, font loading and zoom are unverified for this revision. |
| Colors | Source-token calculations repeated: main text/surface 16.38:1, muted/surface 5.76:1, light accent/surface 9.50:1, control-border/surface 3.42:1. Warning/context reuse those tokens. These are declared solid-pair calculations, not measured rendered contrast; image/gradient backgrounds unverified. |
| UI | Source/DOM checked: native checkbox checked/unchecked, empty/matching/cleared filters, form warnings and busy-disabled state, comparisons, actual review payload, newest-first removal list. No new motion, shadows or nested cards. Real signatures, wallet/passkey sessions, pending receipts and slow-motion animation replay were not performed. |

### Findings and fixes

| Severity / source | Finding, correction, recheck |
| --- | --- |
| High — `web/src/styles.css:1952`, `web/src/components.tsx:117`, `web/src/model.ts:58` | The mobile rule hid IDs and several captions omitted them. Keep the ID inline at every width and reuse a name-with-ID formatter across profiles, war, trophies and cards. DOM and share-card tests pass; rendered mobile confirmation remains unavailable. |
| Medium — `web/src/Rankings.tsx:27`, `web/src/Rankings.tsx:197` | Average score alone lacked sample context. Add season-based filter/sample text while keeping current members/seats separate. A 6-current/4-season fixture is excluded by the filter and still shows 6/10 seats when filters clear. |
| High — `web/src/CreateJoin.tsx:28`, `web/src/CreateJoin.tsx:145` | Copied names lacked a pre-sign warning. Compare creation events, show matching IDs inline and in review, preserve creation. Case/space normalization and continuing creation pass DOM/model checks. |
| Medium — `web/src/War.tsx:225`, `web/src/War.tsx:378` | Comparison lacked visible pairing/roster context. Show season counts, selected-season departure totals and required warnings. DOM checks same-size, gap 2, gap 3 and a past-season switch. |
| High — `web/src/MyGuild.tsx:300`, `web/src/MyGuild.tsx:351` | Removal consequences/roster visibility were incomplete. Use the exact explanation in review and display actual timestamped removal events. DOM verifies the payload and newest-first times; no real kick was sent. |
| Low — `web/src/styles.css:2557` | Initial new mobile tier basis was too narrow for the existing default label's declared 16px type plus select padding. Raised it to 140px and allowed the controls to wrap. Source calculation rechecked; native screenshot remains unperformed. |

`DESIGN.md` describes the final implemented tokens, components and responsive source. Existing design-guidance licenses/attribution are preserved. This revision's implementation and nonvisual checks are complete; the requested native mobile inspection and rendered design/probe checks are **incomplete because browser runtimes failed**. No requester-only input is missing and no `.imd-blocked.json` is appropriate. Prior screenshot and probe claims below apply only to the older export.

---

## Historical validation records (2026-11-08)

Implementation and revision checks completed on 2026-11-08. These are the worker's observations, not independent certification. Production is the repository-root `dist/`; source, lockfile, tests, and reports are in `web/`. No contract was deployed or changed. The revision record below supersedes the original test counts; the original implementation record is retained afterwards.

## Revision: reproduced findings and targeted fixes

All three findings reproduced against the accepted production export at 390×844 in Chromium, without connecting a wallet. Verdicts are in [.imd-responses.json](.imd-responses.json). Before/after captures and counts are in [regression-results.json](web/verification/revision/regression-results.json).

| Finding / final source | Reproduction, correction and recheck |
| --- | --- |
| High — `web/src/model.ts:118`, `web/src/model.ts:161`, `web/src/store.ts:160` | Removing the fixtures' extra creator `Joined` events left guild rosters at 1 and 0 members, and both war views at 1 member total. `GuildCreated` now adds its normalized captain to current and historical rosters; creation blocks receive timestamps for season filtering. Both initial and receipt fixtures now match the contract's actual event sequence. Recheck: rosters 2 and 1; current/past war rosters 3; captains' points present. Unit tests cover creation at the Monday boundary, earlier-season exclusion, normalization and later departure. Browser checks also assert creation-block timestamp requests. |
| Medium — `web/src/components.tsx:178`, `web/src/Community.tsx:218`, `web/src/Community.tsx:292`, `web/src/War.tsx:418` | With every RPC request failing, Trophies claimed no awards and three zero-achiever totals; War claimed no results; recruiting/profiles stayed in reading placeholders. Those states now require a successful snapshot before asserting empty results or counts. `HistoryStatus` supplies loading/error copy and a nearby Refresh button. Checks cover initial pending/failure on all four routes, Refresh recovery to a known empty history, and preservation of a successful snapshot when a later refresh fails. |
| Medium — `web/src/Community.tsx:348` | A transient uncached profile error persisted after a successful same-block Refresh, with only 2 getter calls. The effect now depends on `game.updatedAt`, retaining its cancellation cleanup and friendly errors. Separate browser cases fail `members` and `memberSeasonPoints`: each recovers on Refresh at block 12,089,906, makes 4 total profile getter calls, clears the alert and shows profile stats without navigation. |

### Revision verification

Dependencies were installed from the unchanged lockfile in an isolated copy at `test/scratch/revision/workspace/web`, so repository dependency/configuration paths remain untouched. The final source/tests/configuration in that copy match `web/`; its production export was copied byte-for-byte into the delivered `dist/`. Scratch dependencies, browser downloads and caches are excluded from submission.

Actual commands (run from the repository root):

```sh
npm ci --prefix test/scratch/revision/workspace/web --cache test/scratch/npm-cache --no-audit --no-fund
npm --prefix test/scratch/revision/workspace/web run typecheck
npm --prefix test/scratch/revision/workspace/web run test:unit
npm --prefix test/scratch/revision/workspace/web run build
PLAYWRIGHT_BROWSERS_PATH="$PWD/test/scratch/browsers" npm --prefix test/scratch/revision/workspace/web run test:ui
PLAYWRIGHT_BROWSERS_PATH="$PWD/test/scratch/browsers" npm --prefix test/scratch/revision/workspace/web run test:live
IMD_PLAYWRIGHT="$PWD/test/scratch/revision/workspace/web/node_modules/playwright/index.mjs" PLAYWRIGHT_BROWSERS_PATH="$PWD/test/scratch/browsers" node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```

| Check | Actual revision result |
| --- | --- |
| Production build | Pass, Vite 7.3.7; relative assets and hash navigation at `/preview/` |
| Typecheck | Pass, `tsc --noEmit` |
| Unit tests | 14 passed, 0 failed |
| Chromium interactions | 20 passed, 0 failed; WebKit explicitly skipped because host libraries are unavailable |
| Accessibility | No violations in the selected Axe WCAG 2 A/AA and 2.1 AA checks on seven routes and the added history-error state; no script/local resource errors in the interaction suite |
| Reflow | No horizontal page overflow at 320/390/760/1440; includes all four affected initial-error views |
| Live read | Pass; chain 11155111, block 12,090,387, guildCount 0, zero RPC errors, matching existing runtime fingerprint; read-only public RPC, no connected wallet or writes |
| First 390×844 screen | Product, Create action and complete empty-guild message visible; action bottom 395.41px, empty-message bottom 839.75px |
| Pinned taste@1 | 12/16 raw checks; render, layout, targets, resolved-solid contrast, type sizes, glyphs, slogans, repetition, copy budget, surfaces, motion and metadata pass |

Command outputs and machine-readable evidence: [build](web/verification/revision/build.txt), [typecheck](web/verification/revision/typecheck.txt), [unit tests](web/verification/revision/unit-tests.txt), [interactions](web/verification/revision/interaction-results.json), [live read](web/verification/revision/live-read.json), [taste](web/verification/revision/taste.json), [bundle audit](web/verification/revision/bundle-audit.json).

The four raw probe exceptions remain outside this revision's defects: casing/tracking follow the explicit “Uppercase small labels with wide letter spacing” direction; mono prose follows “IBM Plex Mono for text”; the eyebrow heuristic identifies navigation “Trophies” near the hero and a season metric label near “Reading…”, rather than added heading kickers. The probe measures the initial loading route on this runner; successful live reads use the existing read-only curl bridge. Its contrast check leaves 53 boxes over art/gradients unmeasured.

### Better Interface review of the revision

Read the pinned workflow, core principles of all six domains and documentation method. Scope: affected membership displays and history/profile recovery; preserve the accepted visual system. The visual idea remains generated guild hamsters in the existing dark community-game dashboard.

| Domain | Coverage and evidence |
| --- | --- |
| Accessibility | Checked native Refresh button, visible label in accessible name, status text, error-state Axe scan, existing keyboard wallet/focus-restoration checks and reduced-motion check. Screen readers and native-device access remain unperformed. |
| Layout | Checked actual exported mobile creator roster, historical war and history-error screenshots, default live first screen, all four error routes at 320/390/760/1440 and existing desktop guild/war overflow tests. Native 200% zoom, RTL and pseudo-localization remain unperformed. |
| Writing | Corrected unknown-as-empty claims; consistent loading/error/retry text and existing friendly profile errors. Rechecked no zero achievers or empty-history claims before the first successful snapshot. |
| Typography | Existing families, six-size tokens and local fonts retained. Viewed wrapping of full addresses, creator scores and the two-line history error; live check confirms all local faces loaded. Other platform font rendering unverified. |
| Colors | Existing tokens retained; new history error reuses `--danger` on `.card`; Axe error-state contrast and the probe's resolved-solid checks pass. No new color system or blanket contrast claim; gradient/art pairs remain outside measured coverage. |
| UI | Shared `HistoryStatus` reuses `.empty-state` and `.secondary`; checked loading, failed, retry, successful-empty and stale-snapshot states. Existing signature review, pending, rejection, receipt, SVG download and reduced-motion interactions pass. No real signatures or 10%-speed DevTools replay. |

Viewed screenshots: [creator roster at 390](web/verification/revision/screenshots/creator-roster-390.png), [past war at 390](web/verification/revision/screenshots/creator-war-390.png), [history error at 390](web/verification/revision/screenshots/history-error-390.png), [live first screen](web/verification/revision/screenshots/live-390-first.png). The assigned browser tool was attempted and failed at launch with “Socket path too long”; standalone Playwright Chromium produced these screenshots and the recorded interactions. This is a tool limitation, not a claimed browser-tool pass.

Complete for the stated revision scope. Remaining limits: no native wallets/Coinbase passkeys, real signatures, physical phones, screen readers, native zoom or WebKit session. The existing ABI-pin discrepancy and public RPC/reorg limitations are unchanged. No ignore file, contract, build configuration or dependency manifest/lockfile was changed.

## Original implementation results (retained record)

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
