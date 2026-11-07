# Squeek Guild Wars: full spec (v1)

## 1. Objective

Build and deploy **Squeek Guild Wars**, a team game for Squeekchain on the **Ethereum Sepolia testnet** (chainId 11155111). Wallets form guilds of up to 20 members. Each wallet does one signed check-in per day. Guilds are scored by the **average** points of their members, and each week guilds of the same tier face each other in a "war". Guilds earn tiers, season trophies and shareable result cards. There is no token, no payout and no custody of funds anywhere in this project.

The game is unofficial and community-built. It must say so on the page.

## 2. Hard rules (do not break any of these)

1. Never ask for, store, or handle a private key or seed phrase. The user's wallet signs everything in the browser.
2. The contracts you write must **never hold SQK, ETH, or NFTs**. No payable functions, no `receive()`/`fallback()` that accepts value, no token transfers, no approvals requested from users.
3. Use **only** the official Squeekchain addresses below. Never use any other contract that is named Squeek or SQK.
4. No promises of rewards, tokens, airdrops or any monetary value anywhere in the UI or text. Rewards are cosmetic only (section 8).
5. No fake guilds, fake wallets or seeded fake data. If there are no guilds yet, show an honest empty state.
6. Text in English. Do not claim the project is official.

Official record: https://docs.squeekchain.com/assets/deployments/sepolia.json (release `core-sepolia-20261103`). Read addresses and ABIs from it and from https://docs.squeekchain.com/assets/abi/ at build time and confirm them again in the final report.

| Contract | Address |
|---|---|
| SqueekMining (proxy) | 0x2dccb11fcc2defdd188555e45acb52231e82e218 |
| SqueekStaking (proxy) | 0x50fd1780526c3186a0c037c7622203bc4fb611ca |
| SqueekToken | 0xd78a3956cf63164d1fa1c622ad3c66623162fa1e |
| SqueekNFT | 0xc4c7982657f00509548f3a3a41db7fa439a6856b |

Public read API: `https://api.squeekchain.com/v1/status` (hamster state, rpm, block height; numeric fields arrive as strings; treat `coreStatus` alone as unreliable and use `rpmMilli > 0` or speed > 0 for "running").

## 3. Game rules

**Guilds.** A wallet can create a guild (name up to 24 characters, letters, digits, space, hyphen) or join one with an invite code. One guild per wallet. Seats: the captain sets 5 to 20. Captain can close or open recruiting, can remove a member, and can hand the captain role to another member. If the captain has not checked in for 14 days, any member may claim the role.

**Leaving.** A wallet that leaves a guild cannot join another for 24 hours. A member with no check-in for 14 days is removed automatically the next time anyone interacts with the guild.

**Daily check-in.** One check-in per wallet per UTC day (a signed transaction, small Sepolia gas). It gives points:

- Base: 10 points.
- **Activity multiplier x2** if at least one SqueekMining round has been settled since that wallet's previous check-in. Read this on chain from SqueekMining (the `nextRound` value returned by `checkpointStatus()`, selector `0x001c856f`, returns `(corePaused, nextRound, roundSettled)`); the contract compares the current `nextRound` with the value stored at the wallet's last check-in. The contract must not depend on the off-chain API for scoring.
- **Staker bonus x1.25** (fixed, not proportional to amount) if, at check-in time, the wallet has staked power at or above a minimum threshold in SqueekStaking. The contract reads this on chain at the moment of check-in, so no historical snapshot is needed. **Verify from the official ABI which read function gives a wallet's staked power**, pick a threshold that excludes dust amounts (document the number and why), and report if no suitable read function exists. If it does not exist, ship v1 without the staker bonus and say so clearly in the report instead of faking it.
- Multipliers combine, bonus rounded down. Maximum per check-in is 25 points.

**Guild score** for a season = the **average** season points of all current members (members who joined mid-season count from their join date; divide by member count, not seats).

**Seasons and wars.** A season is one week (Monday 00:00 UTC to Sunday 23:59 UTC). Guilds are grouped by tier and paired for a head-to-head. The winner is the guild with the higher average. Winner earns +300 tier points; the loser earns 0 and **never loses points or tier**. Ties give both +150. Guilds with an odd count in a tier face the next closest guild in the same tier; a guild with no opponent gets a bye (+150).

**Tiers** by cumulative tier points: Bronze 0, Silver 1,000, Gold 3,000, Legend 6,000. Check-in points do not directly count toward tier points; only war results and the checkpoint mission do.

**Checkpoint mission (bonus, ship only if it works cleanly).** `checkpoint()` on SqueekMining is permissionless. When `roundSettled` is true and `corePaused` is false, the first guild member who successfully calls it through the app earns their guild 100 tier points (max once per round, max twice per day per guild). The page must run a read-only simulation first and only then offer the real call, and show clearly that it is a real transaction on the official contract. If this cannot be done safely, leave it out and say so in the report.

## 4. Smart contract spec (one registry contract, Solidity ^0.8.24, no upgradeability, no owner functions)

State per guild: id, name, captain, seats, recruiting flag, member count, tier points, invite code hash. State per wallet: guild id, joined-at day, last check-in day, last seen `nextRound`, season points, consecutive-day streak, "looking for a guild" flag.

Functions (names may vary): `createGuild(name, seats)`, `join(guildId, code)`, `leave()`, `kick(wallet)`, `transferCaptain(wallet)`, `claimCaptain()`, `setRecruiting(bool)`, `setLookingForGuild(bool)`, `checkIn()`, `recordWar(season)` (permissionless, computes pairings and results deterministically from stored data, callable by anyone once per season), `claimCheckpointCredit(round)` (only if the mission is shipped).

Events for everything above so that leaderboards, history and trophies can be rebuilt from logs.

Requirements:
- No admin, no pause, no proxy, no external calls except **view calls** to SqueekMining and SqueekStaking, wrapped so a failing or reverting read can never block a check-in (treat it as "no bonus").
- Reentrancy not applicable (no value transfers); still use checks-effects-interactions.
- Gas-bounded: no unbounded loops over all guilds in a single transaction. If pairing needs iteration, do it in bounded steps or compute the pairing off chain from events and let the contract only **verify** the submitted pairing, rejecting anything inconsistent.
- Foundry or Hardhat tests covering: one check-in per day, multiplier cases, leave cool-down, kick, captain transfer and takeover, seat caps, odd guild counts, ties, season rollover, and a failing external read.
- Deploy to Sepolia, verify the source on the block explorer, and list the address in the README.

## 5. Web app (static site, hosted by IMD)

Plain, fast, readable on a phone. Design: light grey background (#d3d3dc), card style with a faint dot grid, condensed uppercase display font (Barlow Condensed) and IBM Plex Mono for text, blue accent #4a63d8. **A working reference mockup, `guild-wars-mockup.html`, is committed in the repository root** (copy it into the build as `reference/guild-wars-mockup.html`). Follow its layout, wording, hamster generator and tug-of-war animation; replace every fake number with on-chain data. Pages:

- **Rankings**: guild table (rank, name, tier, members/seats, score per member), season end countdown.
- **My guild**: tier progress bar, hamster state (running/asleep from the public API, display only), check-in button, member table (wallet, staker yes/no, days active, points), recruiting toggle for the captain.
- **This week's war**: the two guilds, their per-member scores, a lead bar, time left, past results.
- **Recruiting**: list of guilds with open seats, plus an opt-in board of wallets that flagged "looking for a guild" with their public profile card. Captains can send an invite by sharing the guild's code; the app never contacts anyone.
- **Create / Join**: forms with clear text before every signature.
- **Trophy room and profile**: season trophies (generated as SVG in the browser from on-chain events), guild emblems, wallet titles.
- **How scoring works**: the rules above in plain language.

Wallet connection: the browser wallet only signs. All reads use a public JSON-RPC (`https://ethereum-sepolia-rpc.publicnode.com`) instead of the wallet's own RPC. Check the network and offer a switch to Sepolia. Show friendly errors (wallet pending, rejected, wrong network). Disable buttons after a click so a transaction is never sent twice. Refresh data every 30 seconds.

**Guild hamster.** Every guild gets its own hamster, generated in the browser as an inline SVG from a deterministic hash of the guild id and name (so the same guild always gets the same hamster, and nothing is stored). Variations: fur colour (at least 6 palettes), eye style (at least 3), and one accessory (none, headband, party hat, bandana, crown). Show it next to the guild name in the rankings, on the guild page and on result cards. The tier can add a visible detail (for example a small medal per tier) without changing the base hamster. Respect `prefers-reduced-motion`.

**Tug of war on the war page.** The two guilds' hamsters face each other on either side of a rope with a centre line and a flag. The flag position follows the current per-member score gap between the two guilds (clamped so it never leaves the rope), and the hamsters slide with it. When a check-in event for either guild is seen (on the 30-second refresh), that guild's hamster plays a short pull animation. At the end of the week the winner hamster stays on top and the card is saved to the trophy room. This animation is cosmetic: it must be driven only by on-chain data and must not rely on any off-chain server.

**Shareable war card**: after each war, a button generates a PNG or SVG card ("Midnight Runners beat Nap Nation by 14%") for sharing. Pure client side.

## 6. Anti-abuse (explain these in the README)

- Score is an **average**, so adding empty wallets lowers it.
- Seat cap of 20, one guild per wallet, one check-in per UTC day per wallet.
- 24 h leave cool-down; 14-day inactivity removal.
- Staker bonus is fixed and gated by a meaningful threshold; document the unstake fee behaviour of SqueekStaking (read it from the docs, do not assume) and whether a "stake right before check-in" trick is cheap or expensive.
- Describe honestly what is **not** prevented (many wallets can still be created) and why the impact is limited (points have no monetary value).

## 7. Streaks and titles (free, no SQK needed)

Titles earned from on-chain history: 7, 30 and 100 consecutive check-in days; "Checkpoint Hero" for each successful mission call; "Captain" for creating a guild with at least 8 members at season end. Titles are shown on profiles. They are computed from events, not transferable, and not tokens.

## 8. Rewards (cosmetic only)

Season trophy for the top 3 guilds, tier badge (Bronze to Legend), guild emblem unlocked per tier (pixel hamster, wheel, cheese, and so on), wallet titles, shareable war cards. No tokens, no NFTs in v1, no payouts.

## 9. Optional, only if it fits the budget

A voluntary "Tip the creator" button that sends a small amount of SQK from the user's wallet to the creator wallet (section 12), with the amount chosen and signed by the user and the full address shown in clear text. It must be clearly optional and not tied to any game benefit.

## 10. Non-goals

No token, no NFT contract, no marketplace, no staking contract of our own, no backend with private keys, no AI calls, no trackers, no analytics.

## 11. Acceptance criteria (the final report must show evidence for each)

1. Contract deployed to Sepolia and verified; address and explorer link given.
2. Tests pass; list them and the command to run them.
3. A real flow on Sepolia using test wallets: create guild, join, check-in, leave, with transaction links.
4. The activity multiplier verified on chain with at least one check-in that got it and one that did not, with `nextRound` values shown.
5. Staker bonus either verified with the exact read function and threshold, or explicitly marked "not shipped" with the reason.
6. Checkpoint mission either working with a simulated call and a real transaction link, or explicitly "not shipped".
7. Each guild shows its own generated hamster, and the war page shows the tug of war moving with real data.
8. The site loads on a phone, reads only official addresses, and shows honest empty states.
9. README with rules, addresses, anti-abuse notes, known limits, and the one sentence: "Unofficial community project; no tokens, no payouts."
10. A short written security note listing every external call the contract makes and why none can lock funds (it holds none).

## 12. Repository and creator wallet

- Existing public GitHub repository to build from and commit to: https://github.com/jojay64/squeek-guild-wars (it already contains `README.md` and the reference mockup `guild-wars-mockup.html` in the root). Keep the mockup file, add the contract, tests and site alongside it.
- Creator wallet for the optional tip: `0x0c0E611A29b339D8c1048F2Edf9d4160A5fb8F22` (show it in full, in clear text, and let users compare it with the one in the README).
