# Adaptation for the IdentityMD launch (evm_contracts, Sepolia 11155111)

This file lists every change made to launch `GuildWars` through the project factory, the file it touched
and the rule or audit finding that required it. Nothing else was redesigned.

## Launch shape

- One contract is deployed: `GuildWars` (`src/GuildWars.sol`). No launch token, pool or distributor is added
  (contracts-only launch).
- Constructor arguments, in order, exactly as the brief states:
  1. `mining` = `0x2dccb11fcc2defdd188555e45acb52231e82e218` (official SqueekMining proxy)
  2. `staking` = `0x50fd1780526c3186a0c037c7622203bc4fb611ca` (official SqueekStaking proxy)
  3. `minStakerPower` = `1000000000000000000`
- The contract has no owner, admin, pause, proxy, DELEGATECALL, CALLCODE or SELFDESTRUCT, so no ownership
  argument exists and nothing is assigned to `msg.sender` (the factory). The owner checks therefore have nothing
  to flag.
- `foundry.toml` already uses `bytecode_hash = "none"` and `cbor_metadata = false`; it was not changed.
- Deployment, broadcast and explorer verification are done by the launch's deployer after this work; no
  script, key or `launch.json` is part of this change. Both official proxies were read on Sepolia while
  adapting (`checkpointStatus()` returned `(false, 655, false)`, `accountPower`/`stakeOf` returned zero
  tuples for an unstaked wallet), so the interface shapes match the live contracts.

## Changes to `src/GuildWars.sol`

### 1. Constructor no longer requires code at the dependency addresses (lines 91-97)

- Before: `require(mining_ != address(0) && mining_.code.length > 0, "bad mining")` and the same for staking.
- After: only the zero-address checks remain. The three immutables are unchanged.
- Why: launch rule "a constructor runs on an empty chain in the launch checks, so it must not call another
  contract or require an address to have code" and audit finding `8362b504` (medium), which reproduces:
  `new GuildWars(mining, staking, 1e18)` reverted with `bad mining` on a chain without the proxies (this is
  exactly what the protected floor does). The check added no runtime protection: `_readRound` and
  `_isStaker` already treat a codeless target as "no bonus".
- Tests: `test/GuildWarsLaunch.t.sol` (`test_constructorDeploysOnEmptyChainWithLaunchArguments`,
  `test_checkInWorksWhileDependenciesHaveNoCode`, `test_constructorRejectsZeroAddresses`). The first two fail
  on the original source with `bad mining`.

### 2. `_readRound` decodes the three return words as `uint256` (line 377)

- Before: `abi.decode(ret, (bool, uint256, bool))`.
- After: `abi.decode(ret, (uint256, uint256, uint256))`; only the second word (`nextRound`) is used, as before.
- Why: audit finding `ad63a60d` (medium), which reproduces: Solidity's decoder reverts on a `bool` word other
  than 0/1, so a mining proxy answering e.g. `(2, 654, 1)` made every `checkIn()` revert, contradicting
  CONTRACT.md ("a failed, reverting or malformed read only means no bonus") and the function's own NatSpec.
  With `uint256` words the decode of 96 or more bytes cannot revert.
- Tests: `test/GuildWars.t.sol` (`test_malformedBoolWordsDoNotRevertCheckIn`, fuzz
  `testFuzz_readRoundNeverReverts`). Both fail on the original source with `EvmError: Revert`.

## Audit findings reproduced but left unchanged

Each of these reproduces as described, but each is a documented property of the requester's design rather
than a defect the launch rules or the game's stated behaviour require to change. Fixing them would change the
public interface or the game flow (a redesign), which this adaptation must not do. Each one is now pinned by a
test (`test_limitation_*` in `test/GuildWars.t.sol`) and listed under "Known limitations" in CONTRACT.md so
the requester can decide after launch.

- `2d815999` (low) invite code replay: `join(guildId, code)` publishes the code in calldata, so anyone holding
  it can join while the guild is recruiting. This is how a shared invite code works (the mockup and SPEC.md
  describe captains "sharing the guild's code"). The captain's defences are closing recruiting, rotating the
  code and kicking. A per-invitee code would change `join`'s contract with the website.
- `4ff9738b` (low) one captain's `submitWar` settles both guilds' single war of the season. README.md and
  CONTRACT.md state that "a captain of either guild submits the war"; a two-sided acceptance would add a pending
  state and a second transaction to the flow. Documented as a limitation next to the existing "captains choose
  their opponent" note.
- `0f48204d` (info) only `leave()` starts the 24 h cool-down; `kick()` and `removeInactive()` do not. The docs
  describe a cool-down "after leaving". Applying it to kicked or inactive members would penalise wallets that
  did not choose to leave; no points are duplicated either way (the removed wallet's current-season points are
  deleted and check-ins are one per wallet per day). Documented as an asymmetry.
- `14fc849d` (info) the tier snapshot is taken at the first touch of a season, so a `submitWar` for the
  previous season submitted afterwards does not raise that season's snapshot. This is the documented lazy
  snapshot; tier points are cosmetic. Documented.

## Tests (`test/`)

The repository arrived without its test files (CONTRACT.md mentions 15 offline tests that were not committed)
and without `lib/forge-std`. Because `lib/` and `remappings.txt` are protected, the tests use a small
self-contained harness instead of forge-std:

- `test/utils/BaseTest.sol`: the cheatcode interface subset used (`warp`, `prank`, `expectRevert`, `chainId`,
  `deal`, `assume`) and `assertEq`/`assertTrue` helpers that revert with a message.
- `test/utils/Mocks.sol`: `MockTarget`, a per-selector stand-in for SqueekMining/SqueekStaking that can also
  revert or burn gas.
- `test/GuildWarsLaunch.t.sol`: launch requirements (empty-chain constructor, argument values, runtime size,
  no `owner()`).
- `test/GuildWars.t.sol`: the behaviour CONTRACT.md lists (guild creation and joining, recruiting and code
  rotation, exact points 10/12/20/25, freshness rule, failing and malformed reads, leaving and cool-down, kick
  and captain rules, inactivity removal, wars, season rollover, no payable entry) plus the pinned limitations
  and two fuzz tests.

`forge build` and `forge test` pass with the project's configuration (38 tests), including with
`FOUNDRY_FUZZ_SEED=0x0658040091b9fcc750617114ef01c0e13b3adbda2bbbdeb00f976236d1703960`. Tests use fixed
timestamps and fresh deployments per test, so they pass in any order and in parallel with an empty
environment.

## Documentation

- `CONTRACT.md`: constructor and guarded-read notes updated to match the code; the four limitations above
  added; test section updated.
- `README.md`: launch and test notes added. The requester's text is otherwise unchanged.
