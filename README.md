# Squeek Guild Wars

Unofficial community project for Squeekchain (Ethereum Sepolia testnet). **No tokens, no payouts.**

Wallets form guilds of up to 20 members. Each wallet does one signed check-in per UTC day. A guild's score is the average of its members' points. Each week guilds of the same tier face each other in a war, drawn as a tug of war between the two guilds' generated hamsters.

## Status

Contract written and tested offline (see `CONTRACT.md`); website not built yet. `guild-wars-mockup.html` is the reference mockup (open it in a browser). All names and numbers in it are fake and its buttons only simulate. The real site must follow its layout, wording, hamster generator and tug-of-war animation, with every number read from the chain.

## Rules in short

- Check-in: 10 base points. x2 if a SqueekMining round was settled since the wallet's previous check-in (read on chain). x1.25 if the wallet is above a staker threshold at check-in (fixed bonus, not by amount). Maximum 25 per check-in.
- Guild score: average of members' season points.
- Seasons last one week. Winner of a war +300 tier points, loser +0 (nobody loses tier points), tie +150 each. A captain of either guild submits the war after the season ended.
- Tiers: Bronze 0, Silver 1,000, Gold 3,000, Legend 6,000.
- Rewards are cosmetic only: trophies, tier badges, emblems, titles, shareable war cards.

## Official addresses (Sepolia, release core-sepolia-20261103)

Source: https://docs.squeekchain.com/assets/deployments/sepolia.json

| Contract | Address |
|---|---|
| SqueekMining (proxy) | 0x2dccb11fcc2defdd188555e45acb52231e82e218 |
| SqueekStaking (proxy) | 0x50fd1780526c3186a0c037c7622203bc4fb611ca |
| SqueekToken | 0xd78a3956cf63164d1fa1c622ad3c66623162fa1e |
| SqueekNFT | 0xc4c7982657f00509548f3a3a41db7fa439a6856b |

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
