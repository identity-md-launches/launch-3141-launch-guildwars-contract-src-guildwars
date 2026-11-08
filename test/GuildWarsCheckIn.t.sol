// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {GuildWarsFixture, GuildWarsVm} from "./utils/GuildWarsFixture.sol";
import {MockTarget, MockSetup} from "./utils/Mocks.sol";
import {AdversarialReads, WalletAwareStaking} from "./utils/AdversarialReads.sol";
import {GuildWars} from "src/GuildWars.sol";

/// forge-config: default.fuzz.runs = 1000
contract GuildWarsCheckInTest is GuildWarsFixture {
    using MockSetup for MockTarget;

    function test_checkInUsesUtcMidnightRatherThan24Hours() public {
        create(alice, 5);
        vm.warp(MONDAY + 1 days - 1);
        assertEq(checkIn(alice), 10, "first day");
        vm.warp(MONDAY + 1 days);
        assertEq(checkIn(alice), 10, "new UTC day one second later");
        assertEq(member(alice).streak, 2, "consecutive days");
        vm.warp(MONDAY + 2 days - 1);
        vm.prank(alice);
        expectRevertMessage("already checked in today");
        game.checkIn();
        assertEq(game.memberSeasonPoints(alice, game.currentSeason()), 20, "duplicate does not credit");
    }

    function testFuzz_streakDependsOnConsecutiveUtcDays(uint16 gapSeed, uint32 offsetSeed) public {
        uint256 gap = bound(gapSeed, 1, 365);
        uint256 offset = bound(offsetSeed, 0, 1 days - 1);
        create(alice, 5);
        checkIn(alice);
        vm.warp(MONDAY + 1 days + offset);
        checkIn(alice);
        vm.warp(MONDAY + (1 + gap) * 1 days + offset);
        checkIn(alice);
        assertEq(member(alice).streak, gap == 1 ? 3 : 1, "streak resets only on a missed day");
    }

    function test_roundZeroIsKnownAndMaxRoundDoesNotOverflow() public {
        create(alice, 5);
        mining.setRound(0);
        assertEq(checkIn(alice), 10, "first round zero");
        assertTrue(member(alice).roundKnown, "zero is a valid known round");
        vm.warp(MONDAY + 1 days);
        mining.setRound(type(uint64).max);
        assertEq(checkIn(alice), 20, "arbitrary round jump gives only one multiplier");
        assertEq(member(alice).lastRound, type(uint64).max, "maximum round stored");
        vm.warp(MONDAY + 2 days);
        assertEq(checkIn(alice), 10, "same maximum round gives no second multiplier");
    }

    function testFuzz_roundIncreaseMagnitudeDoesNotIncreaseBonus(uint64 increaseSeed) public {
        uint64 increase = uint64(bound(increaseSeed, 1, type(uint64).max - 100));
        create(alice, 5);
        checkIn(alice);
        vm.warp(MONDAY + 1 days);
        mining.setRound(100 + increase);
        assertEq(checkIn(alice), 20, "round bonus is fixed regardless of jump");
    }

    function test_failedRoundReadPreservesHistoryAndIndependentStakingBonus() public {
        create(alice, 5);
        staking.setPower(MIN_POWER);
        assertEq(checkIn(alice), 12, "staking bonus");
        mining.setReverting(true);
        vm.warp(MONDAY + 1 days);
        assertEq(checkIn(alice), 12, "mining outage does not disable mature staking");
        assertEq(member(alice).lastRound, 100, "outage cannot replace last good round");
        assertTrue(member(alice).roundKnown, "known round retained");
        mining.setReverting(false);
        mining.setRound(101);
        vm.warp(MONDAY + 2 days);
        assertEq(checkIn(alice), 25, "recovery compares against last good round");
    }

    function test_failedInitialRoundReadCannotFabricateRoundBonusOnRecovery() public {
        create(alice, 5);
        mining.setReverting(true);
        checkIn(alice);
        assertTrue(!member(alice).roundKnown, "no history from failed initial read");
        mining.setReverting(false);
        mining.setRound(1000);
        vm.warp(MONDAY + 1 days);
        assertEq(checkIn(alice), 10, "first successful round establishes baseline");
        vm.warp(MONDAY + 2 days);
        mining.setRound(1001);
        assertEq(checkIn(alice), 20, "subsequent advance earns round bonus");
    }

    function test_failedRoundReadDoesNotTreatFreshStakeAsMature() public {
        create(alice, 5);
        staking.setPower(MIN_POWER);
        staking.setStake(100, 100, 101);
        mining.setReverting(true);
        assertEq(checkIn(alice), 10, "unknown round cannot mature a fresh deposit");
    }

    function test_nftPowerAloneNeverQualifiesForStakerBonus() public {
        create(alice, 5);
        staking.set(MockSetup.ACCOUNT_POWER, abi.encode(type(uint256).max, MIN_POWER - 1));
        assertEq(checkIn(alice), 10, "only SQK power counts");
    }

    function test_stakingReadsUseCheckingWalletAsArgument() public {
        WalletAwareStaking target = new WalletAwareStaking(bob);
        game = new GuildWars(address(mining), address(target), MIN_POWER);
        uint256 id = create(alice, 5);
        join(bob, id);
        assertEq(checkIn(bob), 12, "both staking reads queried Bob");
        assertEq(checkIn(alice), 10, "Alice cannot use Bob's power");
    }

    function testFuzz_stakerThresholdIsInclusive(uint128 power) public {
        create(alice, 5);
        staking.setPower(power);
        assertEq(checkIn(alice), power >= MIN_POWER ? 12 : 10, "inclusive power threshold");
    }

    function test_stakerThresholdPinnedEdges() public {
        create(alice, 5);
        uint256[5] memory powers = [uint256(0), 1, MIN_POWER - 1, MIN_POWER, type(uint256).max];
        for (uint256 i; i < powers.length; ++i) {
            vm.warp(MONDAY + i * 1 days);
            staking.setPower(powers[i]);
            assertEq(checkIn(alice), i < 3 ? 10 : 12, "threshold edge without fresh stake");
        }
    }

    function test_freshPowerRoundingOneWeiBelowAndAtThreshold() public {
        create(alice, 5);
        staking.setStake(3, 1, 101);
        staking.setPower(1_499_999_999_999_999_999);
        assertEq(checkIn(alice), 10, "effective power floors to threshold minus one");
        vm.warp(MONDAY + 1 days);
        staking.setPower(1_500_000_000_000_000_000);
        assertEq(checkIn(alice), 12, "effective power exactly threshold qualifies");
    }

    function test_freshnessExpiresAtExactRound() public {
        create(alice, 5);
        staking.setPower(MIN_POWER);
        staking.setStake(100, 100, 101);
        assertEq(checkIn(alice), 10, "fresh through previous round");
        vm.warp(MONDAY + 1 days);
        mining.setRound(101);
        assertEq(checkIn(alice), 25, "matures at equality plus round bonus");
    }

    function test_zeroAndExcessFreshPrincipalDoNotDivideOrUnderflow() public {
        create(alice, 5);
        staking.setPower(MIN_POWER);
        staking.setStake(0, 1, 101);
        assertEq(checkIn(alice), 10, "zero principal with fresh stake gives no bonus");
        vm.warp(MONDAY + 1 days);
        staking.setStake(100, type(uint256).max, 101);
        assertEq(checkIn(alice), 10, "excess fresh stake gives no bonus");
    }

    // Algebraic threshold oracle: power = threshold * principal / mature, choosing
    // mature=1 makes an exact boundary without duplicating the production ratio.
    // The full-uint256 overflow case is reproduced separately in the findings report.
    function testFuzz_freshStakeExactBoundaryAndOneWeiBelow(uint64 principalSeed) public {
        uint256 principal = bound(principalSeed, 2, type(uint64).max);
        uint256 exactPower = MIN_POWER * principal;
        create(alice, 5);
        staking.setStake(principal, principal - 1, 101);
        staking.setPower(exactPower - 1);
        assertEq(checkIn(alice), 10, "one wei below required total power");
        vm.warp(MONDAY + 1 days);
        staking.setPower(exactPower);
        assertEq(checkIn(alice), 12, "exact mature power threshold");
    }

    function testFuzz_shortResponsesDisableOnlyTheirOwnBonus(uint8 whichSeed, uint8 lengthSeed) public {
        create(alice, 5);
        checkIn(alice);
        vm.warp(MONDAY + 1 days);
        mining.setRound(101);
        staking.setPower(MIN_POWER);
        uint256 which = whichSeed % 3;
        uint256 size = bound(lengthSeed, 0, which == 1 ? 63 : 95);
        if (which == 0) mining.set(MockSetup.CHECKPOINT_STATUS, new bytes(size));
        if (which == 1) staking.set(MockSetup.ACCOUNT_POWER, new bytes(size));
        if (which == 2) staking.set(MockSetup.STAKE_OF, new bytes(size));
        assertEq(checkIn(alice), which == 0 ? 12 : 20, "read failure is isolated");
        assertEq(member(alice).lastRound, which == 0 ? 100 : 101, "only successful round is stored");
    }

    function testFuzz_trailingResponseBytesDoNotAlterPoints(uint8 trailingLength) public {
        create(alice, 5);
        checkIn(alice);
        vm.warp(MONDAY + 1 days);
        bytes memory trailing = new bytes(trailingLength);
        mining.set(MockSetup.CHECKPOINT_STATUS, bytes.concat(abi.encode(false, uint64(101), true), trailing));
        staking.set(MockSetup.ACCOUNT_POWER, bytes.concat(abi.encode(uint256(0), MIN_POWER), trailing));
        staking.set(MockSetup.STAKE_OF, bytes.concat(abi.encode(uint256(100), uint256(0), uint64(0)), trailing));
        assertEq(checkIn(alice), 25, "three valid static tuples tolerate extra bytes");
    }

    function test_eachExternalReadCanRevertRunOutOfGasOrAttemptStorageWrite() public {
        AdversarialReads target = new AdversarialReads();
        game = new GuildWars(address(target), address(target), MIN_POWER);
        create(alice, 5);
        uint256 day;
        for (uint256 behavior = 1; behavior <= 3; ++behavior) {
            for (uint256 which; which < 3; ++which) {
                target.configure(
                    MockSetup.CHECKPOINT_STATUS,
                    abi.encode(false, uint64(100 + day), false),
                    AdversarialReads.Behavior.ReturnData
                );
                target.configure(
                    MockSetup.ACCOUNT_POWER, abi.encode(uint256(0), MIN_POWER), AdversarialReads.Behavior.ReturnData
                );
                target.configure(
                    MockSetup.STAKE_OF,
                    abi.encode(uint256(100), uint256(0), uint64(0)),
                    AdversarialReads.Behavior.ReturnData
                );
                vm.warp(MONDAY + day * 1 days);
                checkIn(alice); // establish a valid baseline for each case
                ++day;
                vm.warp(MONDAY + day * 1 days);
                target.configure(
                    MockSetup.CHECKPOINT_STATUS,
                    abi.encode(false, uint64(100 + day), false),
                    AdversarialReads.Behavior.ReturnData
                );
                bytes4 selector = which == 0
                    ? MockSetup.CHECKPOINT_STATUS
                    : which == 1 ? MockSetup.ACCOUNT_POWER : MockSetup.STAKE_OF;
                target.configure(selector, new bytes(0), AdversarialReads.Behavior(behavior));
                assertEq(checkIn(alice), which == 0 ? 12 : 20, "failing dependency never blocks base check-in");
                assertEq(target.writes(), 0, "static calls cannot write dependency storage");
                ++day;
            }
        }
    }

    function test_checkedInEventMatchesReturnAccountingAndFlags() public {
        uint256 id = create(alice, 5);
        checkIn(alice);
        vm.warp(MONDAY + 1 days);
        mining.setRound(101);
        staking.setPower(MIN_POWER);
        logsVm.recordLogs();
        uint256 points = checkIn(alice);
        GuildWarsVm.Log[] memory logs = logsVm.getRecordedLogs();
        assertEq(logs.length, 1, "one check-in event");
        assertEq(logs[0].emitter, address(game), "event emitter");
        assertEq(logs[0].topics.length, 3, "two indexed arguments");
        assertTrue(
            logs[0].topics[0] == keccak256("CheckedIn(uint256,address,uint256,uint256,uint64,uint8,uint32)"),
            "event signature"
        );
        assertEq(uint256(logs[0].topics[1]), id, "event guild");
        assertEq(address(uint160(uint256(logs[0].topics[2]))), alice, "event wallet");
        (uint256 season, uint256 emittedPoints, uint64 round, uint8 flags, uint32 streak) =
            abi.decode(logs[0].data, (uint256, uint256, uint64, uint8, uint32));
        assertEq(season, game.currentSeason(), "event season");
        assertEq(emittedPoints, points, "event award");
        assertEq(round, 101, "event round");
        assertEq(flags, 3, "both bonus flags");
        assertEq(streak, 2, "event streak");
        assertEq(game.memberSeasonPoints(alice, season), 10 + points, "event agrees with member ledger");
        assertEq(game.guildSeasonTotal(id, season), 10 + points, "event agrees with guild ledger");
    }
}
