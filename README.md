# Squeek Guild Wars

Unofficial community project for Squeekchain (Ethereum Sepolia testnet). **No tokens, no payouts.**

Wallets form guilds of up to 20 members. Each wallet does one signed check-in per UTC day. A guild's score is the average of its members' points. After a season ends, a captain can submit a same-tier pairing, drawn as a tug of war between the guilds' generated hamsters.

## Status

The GuildWars contract is live on Ethereum Sepolia at `0x4d9c2fa10fb70100d4c2390212b8f8de286a1d30`, from block **12,089,806**. The website source is in `web/`; the complete static export is in `dist/`. The older `guild-wars-mockup.html` is an illustrative artifact and is never imported by the production site.

## Website: install, preview, rebuild

Use Node **22.12+** (validated with Node 24) and npm. Frontend dependencies are isolated from the existing Foundry project.

```sh
cd web
npm ci
npm run typecheck
npm run build
npm run preview
```

Open the local preview URL printed by Vite. `npm run dev` starts source development. `npm run build` replaces the repository-root `dist/` with the production export; it does not modify Solidity or deploy anything. Serve the contents of `dist/` on any static HTTP host. Vite uses `base: "./"`; assets are relative and all navigation uses hash routes, so gateway subpaths need no server rewrites. The export is delivered alongside source and `web/package-lock.json`; hosting does not need to rebuild it.

Pages: Rankings, My guild/public guild profiles, War, Recruiting/player profiles, Trophies, Create / Join, and Rules. All displayed game state comes from the live contract and its event history. GuildCount was 0 during validation; the site shows honest empty states until guilds are created. Generated hamster previews and the empty trophy illustration are labelled or decorative, not example players.

## Wallets and data

All game reads, transaction simulations, gas estimates, and receipts use **https://ethereum-sepolia-rpc.publicnode.com**, never the wallet RPC. `web/src/chain.ts` fixes Sepolia (11155111), the single GuildWars address, the source-derived ABI, and the expected deployed runtime hash. Runtime code and chain ID are checked before actions. No other contract is read or written by the site. No API key, seed, private key, relay, or project ID is needed.

The connect control offers EIP-6963 browser wallets, opening this page in MetaMask/Coinbase Wallet/Rabby/Phantom on phones, and Coinbase Smart Wallet. Sepolia switching is available. Each transaction has a plain-language review, an `eth_call` simulation using the connected address, a gas estimate, and a disabled pending button. Wallet requests are for accounts, chain management, and sending the reviewed zero-value transaction. Gas fees are paid to the Sepolia network.

`web/src/store.ts` scans only GuildWars logs from the deployment block in 4,000-block chunks, splits rejected ranges, caches events in memory, rechecks a 12-block overlap, and refreshes every 30 seconds while visible. Reloading rebuilds history. Getter reads are pinned to the same snapshot block. A read failure is distinct from an empty registry and can be retried. Rankings, membership, recruiting, historic member scores, trophies, and titles are reconstructed from this history and verified contract reads.

Check-in estimates come from simulating `checkIn()`; possible values are 10, 12, 20, or 25. Staker badges describe the bonus at the last check-in, not a current staking balance. Past podiums rank recorded WarResult averages only; they are not an automatic global season settlement. Invite codes use browser cryptography and are held only in memory, shown once after confirmation. If lost, a captain can rotate the code. Joining publishes the code in calldata.

## Validation and design

```sh
cd web
npx playwright install chromium-headless-shell
npm run test:unit
npm run test:ui
npm run test:live
```

The UI suite serves the production export under `/preview/` and uses isolated synthetic RPC/wallet fixtures, never real transactions. The live check uses read-only requests to the stated public RPC; it needs `curl` to bridge this contributor runner's restricted browser networking. That bridge exists only in the test, not the site. Both write temporary evidence under `test/scratch/`. WebKit is attempted when installed and its host libraries are available; otherwise it is explicitly skipped.

Actual results, coverage, fixes, remaining limits, and screenshot links are in [VALIDATION.md](VALIDATION.md). Implemented design tokens and responsive behavior are in [DESIGN.md](DESIGN.md). Machine-readable reports and selected screenshots are in `web/verification/`. Native wallets, real signed transactions, physical devices, native 200% zoom, and screen readers were not tested.

The reviewed revision fixes creator membership from `GuildCreated` alone, distinguishes unavailable history from empty results, and retries uncached player profiles on a successful Refresh even at the same block. Revision validation passed the production build, typecheck, 14 unit tests, 20 Chromium interaction checks, and a read-only live Sepolia check (guildCount 0). WebKit was skipped because its host libraries are unavailable. Evidence is in `web/verification/revision/`; the three finding responses are in `.imd-responses.json`.

The compiler-derived ABI's canonical hash differs from the pinned deployment hash. This is recorded rather than presented as a match. The compiled Solidity runtime, with the pinned immutable values inserted, matched the live 11,238-byte runtime exactly. See `web/verification/contract-verification.json`. `npm run verify-contract` regenerates the ABI and runtime fingerprint from the unchanged source and live code; normal site builds use the delivered generated files and do not require this step.

`npm run social` regenerates the 1200×630 local social image once Playwright Chromium is installed. Fonts and wallet-mark licenses are included in `web/public/licenses/` and `dist/licenses/`. The design references' licenses are retained in `web/verification/`.

Connector references: [wagmi configuration](https://wagmi.sh/react/api/createConfig), [MetaMask mobile links](https://docs.metamask.io/metamask-connect/evm/guides/metamask-exclusive/use-deeplinks), [Coinbase mobile links](https://docs.cdp.coinbase.com/wallet-sdk/docs/deep-link), [Phantom browse links](https://docs.phantom.com/phantom-deeplinks/other-methods/browse), and [Rabby's open-dapp handler](https://github.com/RabbyHub/rabby-mobile/blob/develop/apps/mobile/src/hooks/universalLink.ts).

## Rules in short

- Check-in: 10 base points. x2 if a SqueekMining round was settled since the wallet's previous check-in (read on chain). x1.25 if the wallet is above a staker threshold at check-in (fixed bonus, not by amount). Maximum 25 per check-in.
- Guild score: average of members' season points.
- Seasons last one week. Winner of a war +300 tier points, loser +0 (nobody loses tier points), tie +150 each. A captain of either guild submits the war after the season ended.
- Tiers: Bronze 0, Silver 1,000, Gold 3,000, Legend 6,000.
- Rewards are cosmetic only: trophies, tier badges, emblems, titles, shareable war cards.

## Official addresses (Sepolia, release core-sepolia-20261103)

Source: https://docs.squeekchain.com/assets/deployments/sepolia.json

| Contract              | Address                                    |
| --------------------- | ------------------------------------------ |
| SqueekMining (proxy)  | 0x2dccb11fcc2defdd188555e45acb52231e82e218 |
| SqueekStaking (proxy) | 0x50fd1780526c3186a0c037c7622203bc4fb611ca |
| SqueekToken           | 0xd78a3956cf63164d1fa1c622ad3c66623162fa1e |
| SqueekNFT             | 0xc4c7982657f00509548f3a3a41db7fa439a6856b |

## Creator wallet (optional tip, unrelated to the game)

`0x0c0E611A29b339D8c1048F2Edf9d4160A5fb8F22`

The project never asks for a private key or a seed phrase. The contract never holds SQK, ETH or NFTs.

## Contract

`src/GuildWars.sol` (Solidity 0.8.24, no owner, no proxy, holds nothing). Details, differences from `SPEC.md` and known limitations: `CONTRACT.md`.

Build and test with Foundry (no external dependencies):

```
forge build
forge test
```

## Launch (Sepolia)

The contract is deployed once through the IdentityMD project factory with these constructor arguments, in order: `mining` = SqueekMining proxy, `staking` = SqueekStaking proxy (addresses above), `minStakerPower` = `1000000000000000000` (1 power unit). The changes made for the launch and the audit findings handled are listed in `ADAPTATION.md`.
