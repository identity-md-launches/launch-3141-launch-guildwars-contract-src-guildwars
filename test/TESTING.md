# GuildWars tests

The added suites run offline against the accepted `src/GuildWars.sol`. They extend
the original tests and use the existing small cheatcode harness. No dependencies,
RPC credentials, configuration changes, storage injection, or broadcast are needed.
The original launch suite checks the supplied Sepolia constructor arguments on an
empty chain. These tests do not deploy to Sepolia or verify explorer source.

Run with the assignment's seed:

```sh
forge build
FOUNDRY_FUZZ_SEED=0x0658040091b9fcc750617114ef01c0e13b3adbda2bbbdeb00f976236d1703960 forge test
```

For workspace-restricted runs, append `--out test/scratch/out --cache-path
test/scratch/cache` to each command. Those flags only relocate generated files.

| Suite | Added coverage |
| --- | --- |
| `GuildWarsMembership.t.sol` | Accepted names; every disallowed byte; seat limits; authorization; captain transfer and takeover; exact cooldown and inactivity boundaries; repeated removal; guild switching; closed guilds; independent looking flag |
| `GuildWarsCheckIn.t.sol` | UTC midnight; streak continuity; zero/max rounds; failed-read recovery; correct wallet arguments; NFT versus SQK power; freshness and rounding thresholds; independent short/reverting/gas-exhausting/state-writing reads; event/accounting agreement |
| `GuildWarsSeasons.t.sol` | Monday boundaries; average rounding; average-based winners in both argument orders; eligibility and replay failures; captain changes; archived scores; season rollover; settlement events |
| `GuildWarsSafety.t.sol` | Every mutating entry point rejects ETH before its guards; empty calldata and unsupported privileged selectors revert |
| `GuildWarsInvariant.t.sol` | Random sequences across twelve wallets, up to eight guilds, and multiple seasons; three invariants checked after every handler call |

New stateless fuzz tests run 1,000 cases each. The invariant campaign runs 256
sequences of 96 calls with `fail-on-revert = true`. Counts are configured inline.
Only the thirteen handler actions are targeted; mocks and setup cannot be mutated
directly by the invariant engine. Expected rejection paths use exact revert
messages. Unexpected failures and assertion failures fail the campaign.

The handler tracks membership and an independent award ledger. The expected
check-in award comes from the chosen dependency scenario, not from the contract's
returned award or accounting storage. Exits debit only that wallet's current-season
contribution. Historical ledger entries remain fixed. War outcomes use rational
cross multiplication, and score rounding uses floor inequalities, rather than
duplicating the implementation's scaled division.

The invariant properties came from five review passes using the supplied Pashov
fizz and Trail of Bits property-testing references:

| Review pass | Property and contract basis |
| --- | --- |
| Conservation | Current guild totals equal current members' contributions; stored counts equal the number of associated wallets (`_record`, `_addMember`, `_removeMember`, `seasonScore`) |
| State transitions | Captain belongs to a live guild; an empty guild is closed; permissions move with captaincy; cooldown, streak, and round history survive the documented transitions (`leave`, `kick`, `transferCaptain`, `claimCaptain`, `checkIn`) |
| Round trips and rounding | Kicking/rejoining cannot award points twice that day or carry old points to a new guild; averages floor by less than one scaled unit; exact mature-power thresholds distinguish a one-wei deficit |
| Adversarial inputs | Unauthorized operations and replayed settlements revert atomically; each read failure loses only its matching bonus; oversized arithmetic responses are investigated separately |
| Game-specific properties | A wallet earns at most seven capped check-ins per week; ended-season totals/counts/tiers stay fixed; one settlement per guild per season; each war awards exactly 300 total cosmetic tier points |

`test_handlerExercisesEveryTransition` makes every handler action succeed at least
once in a deterministic sequence, including captain takeover and historical war
settlement. Random actions whose prerequisites are absent can return without a
transaction; the reachability test distinguishes this from an inaccessible action.

The invariant dependency scenarios deliberately use ordinary bounded power and
principal values. The full-width staking multiplication overflow is reported in
`.imd-findings.json` with a standalone failing reproducer. It was executed under
`test/scratch/`, then retained as the report's `proof`, so it is not a passing test
that treats a reverted check-in as correct. It requires anomalous dependency data;
ordinary player reachability in the official staking implementation is not claimed.

The no-ETH invariant covers ordinary game operations. It makes no claim that an
EVM address can prevent forced ETH transfers or unsolicited ERC-20 transfers.
The documented opponent-choice, invite-code visibility, removal cooldown, and lazy
tier snapshot limitations remain part of the accepted design.
