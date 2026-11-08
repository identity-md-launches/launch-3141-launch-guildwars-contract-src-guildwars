// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {GuildWarsFixture, GuildWarsVm} from "./utils/GuildWarsFixture.sol";

/// forge-config: default.fuzz.runs = 1000
contract GuildWarsSeasonsTest is GuildWarsFixture {
    function testFuzz_weekChangesOnlyAtMondayUtc(uint16 weekSeed, uint32 offsetSeed) public {
        uint256 monday = MONDAY + uint256(weekSeed) * 7 days;
        uint256 offset = bound(offsetSeed, 0, 7 days - 1);
        uint256 initialSeason = game.currentSeason();
        vm.warp(monday - 1);
        assertEq(game.currentSeason(), initialSeason + weekSeed - 1, "Sunday belongs to previous week");
        vm.warp(monday + offset);
        assertEq(game.currentSeason(), initialSeason + weekSeed, "all seconds of week share a season");
        vm.warp(monday + 7 days);
        assertEq(game.currentSeason(), initialSeason + weekSeed + 1, "next Monday starts next season");
    }

    function testFuzz_scoreAverageHasCorrectFloor(uint8 seatsSeed, uint8 activeSeed) public {
        uint256 count = bound(seatsSeed, 1, 20);
        uint256 active = bound(activeSeed, 1, count);
        uint256 id = populate(alice, count, 0x20000);
        checkIn(alice);
        for (uint256 i = 1; i < active; ++i) {
            checkIn(address(uint160(0x20000 + i)));
        }
        (uint256 total, uint16 denominator, uint256 average) = game.seasonScore(id, game.currentSeason());
        assertEq(total, active * 10, "total independently counted check-ins");
        assertEq(denominator, count, "inactive members still count in average");
        // Floor inequalities exercise division without reimplementing it.
        assertTrue(average * count <= total * 1e6, "average cannot round upward");
        assertTrue((average + 1) * count > total * 1e6, "average loses less than one scaled unit");
    }

    function testFuzz_warUsesAverageAndAwardsExactly300(
        uint8 countSeedA,
        uint8 countSeedB,
        uint8 activeSeedA,
        uint8 activeSeedB,
        bool reverse
    ) public {
        uint256 countA = bound(countSeedA, 1, 20);
        uint256 countB = bound(countSeedB, 1, 20);
        uint256 activeA = bound(activeSeedA, 1, countA);
        uint256 activeB = bound(activeSeedB, 1, countB);
        uint256 a = populate(alice, countA, 0x20000);
        uint256 b = populate(carol, countB, 0x30000);
        checkIn(alice);
        checkIn(carol);
        for (uint256 i = 1; i < activeA; ++i) {
            checkIn(address(uint160(0x20000 + i)));
        }
        for (uint256 i = 1; i < activeB; ++i) {
            checkIn(address(uint160(0x30000 + i)));
        }
        uint256 season = game.currentSeason();
        vm.warp(MONDAY + 7 days);
        vm.prank(reverse ? carol : alice);
        game.submitWar(season, reverse ? b : a, reverse ? a : b);
        // Compare rational averages by cross multiplication, independent of SCORE_SCALE.
        uint256 lhs = activeA * countB;
        uint256 rhs = activeB * countA;
        assertEq(guild(a).tierPoints, lhs == rhs ? 150 : lhs > rhs ? 300 : 0, "A award");
        assertEq(guild(b).tierPoints, lhs == rhs ? 150 : lhs < rhs ? 300 : 0, "B award");
        assertEq(uint256(guild(a).tierPoints) + guild(b).tierPoints, 300, "one war creates exactly 300 tier points");
        assertTrue(game.warDone(season, a) && game.warDone(season, b), "both guilds settled");
    }

    function test_warRejectionsLeaveBothGuildsUnsettled() public {
        uint256 a = create(alice, 5);
        uint256 b = create(carol, 5);
        join(bob, a);
        uint256 season = game.currentSeason();
        checkIn(alice);
        checkIn(carol);
        vm.warp(MONDAY + 7 days - 1);
        vm.prank(alice);
        expectRevertMessage("season not over");
        game.submitWar(season, a, b);
        vm.warp(MONDAY + 7 days);
        vm.prank(alice);
        expectRevertMessage("season not over");
        game.submitWar(season + 2, a, b);
        vm.prank(bob);
        expectRevertMessage("not a captain of these guilds");
        game.submitWar(season, a, b);
        create(outsider, 5);
        vm.prank(outsider);
        expectRevertMessage("not a captain of these guilds");
        game.submitWar(season, a, b);
        vm.prank(alice);
        expectRevertMessage("same guild");
        game.submitWar(season, a, a);
        assertTrue(!game.warDone(season, a) && !game.warDone(season, b), "rejections consume no settlement");
        assertEq(guild(a).tierPoints, 0, "no phantom award A");
        assertEq(guild(b).tierPoints, 0, "no phantom award B");
    }

    function test_nonexistentAndInactiveGuildsRejectedInEitherPosition() public {
        uint256 a = create(alice, 5);
        uint256 b = create(carol, 5);
        uint256 season = game.currentSeason();
        checkIn(alice);
        vm.warp(MONDAY + 7 days);
        vm.startPrank(alice);
        expectRevertMessage("guild inactive that season");
        game.submitWar(season, a, b);
        expectRevertMessage("guild inactive that season");
        game.submitWar(season, b, a);
        expectRevertMessage("guild inactive that season");
        game.submitWar(season, a, 0);
        expectRevertMessage("guild inactive that season");
        game.submitWar(season, type(uint256).max, a);
        expectRevertMessage("guild inactive that season");
        game.submitWar(season - 1, a, b);
        vm.stopPrank();
        assertTrue(!game.warDone(season, a), "valid guild stays eligible");
    }

    function test_removingOnlyContributorMakesGuildIneligible() public {
        uint256 a = create(alice, 5);
        uint256 b = create(carol, 5);
        join(bob, a);
        checkIn(bob);
        checkIn(carol);
        uint256 season = game.currentSeason();
        vm.prank(alice);
        game.kick(bob);
        vm.warp(MONDAY + 7 days);
        vm.prank(carol);
        expectRevertMessage("guild inactive that season");
        game.submitWar(season, a, b);
        assertTrue(!game.warDone(season, b), "failed match does not settle other guild");
    }

    function test_settledSecondArgumentCannotConsumeFreshFirstArgument() public {
        uint256 a = create(alice, 5);
        uint256 b = create(bob, 5);
        uint256 c = create(carol, 5);
        checkIn(alice);
        checkIn(bob);
        checkIn(carol);
        uint256 season = game.currentSeason();
        vm.warp(MONDAY + 7 days);
        vm.prank(bob);
        game.submitWar(season, b, c);
        vm.prank(alice);
        expectRevertMessage("already settled");
        game.submitWar(season, a, b);
        assertTrue(!game.warDone(season, a), "fresh guild not consumed on second eligibility failure");
        assertEq(guild(a).tierPoints, 0, "fresh guild not awarded");
        assertEq(guild(b).tierPoints, 150, "settled award cannot change");
        vm.prank(carol);
        expectRevertMessage("already settled");
        game.submitWar(season, c, b);
    }

    function test_successfulWarDoesNotChangeScoresOrMembership() public {
        uint256 a = create(alice, 5);
        uint256 b = create(carol, 5);
        join(bob, a);
        checkIn(alice);
        checkIn(carol);
        uint256 season = game.currentSeason();
        bytes32 beforeA = scoreHash(a, season);
        bytes32 beforeB = scoreHash(b, season);
        vm.warp(MONDAY + 7 days);
        vm.prank(alice);
        game.submitWar(season, a, b);
        assertTrue(scoreHash(a, season) == beforeA && scoreHash(b, season) == beforeB, "settlement preserves snapshots");
        assertEq(guild(a).count, 2, "A membership unchanged");
        assertEq(guild(b).count, 1, "B membership unchanged");
        assertEq(member(bob).guildId, a, "member association unchanged");
        assertEq(guild(a).tierPoints, 0, "loser never loses points");
        assertEq(guild(b).tierPoints, 300, "higher average wins");
    }

    function test_newCaptainCanSettleAndOldCaptainCannot() public {
        uint256 a = create(alice, 5);
        uint256 b = create(carol, 5);
        join(bob, a);
        checkIn(alice);
        checkIn(carol);
        uint256 season = game.currentSeason();
        vm.warp(MONDAY + 7 days);
        vm.prank(alice);
        game.transferCaptain(bob);
        vm.prank(alice);
        expectRevertMessage("not a captain of these guilds");
        game.submitWar(season, a, b);
        vm.prank(bob);
        game.submitWar(season, a, b);
        assertTrue(game.warDone(season, a), "current captain controls settlement");
    }

    function test_previousSeasonFrozenAcrossLeaveKickJoinAndNewCheckIns() public {
        uint256 a = create(alice, 5);
        uint256 b = create(carol, 5);
        join(bob, a);
        join(outsider, a);
        checkIn(alice);
        checkIn(bob);
        checkIn(outsider);
        checkIn(carol);
        uint256 season = game.currentSeason();
        bytes32 beforeA = scoreHash(a, season);
        bytes32 beforeB = scoreHash(b, season);
        vm.warp(MONDAY + 7 days);
        vm.prank(bob);
        game.leave();
        vm.prank(alice);
        game.kick(outsider);
        join(outsider, b);
        checkIn(outsider);
        vm.warp(MONDAY + 8 days);
        join(bob, b);
        checkIn(bob);
        assertTrue(scoreHash(a, season) == beforeA, "old A snapshot frozen");
        assertTrue(scoreHash(b, season) == beforeB, "old B snapshot frozen");
        assertEq(game.memberSeasonPoints(bob, season), 10, "historic wallet points preserved");
        assertEq(game.guildSeasonTotal(a, season + 1), 0, "no old contribution subtracted from new season");
        assertEq(game.guildSeasonTotal(b, season + 1), 20, "new season only includes new check-ins");
        vm.prank(carol);
        game.submitWar(season, a, b);
        assertEq(guild(a).tierPoints, 150, "historic average still tied A");
        assertEq(guild(b).tierPoints, 150, "historic average still tied B");
    }

    function test_seasonRolloverResetsPointsButPreservesStreak() public {
        uint256 id = create(alice, 5);
        vm.warp(MONDAY + 7 days - 1);
        checkIn(alice);
        uint256 season = game.currentSeason();
        vm.warp(MONDAY + 7 days);
        checkIn(alice);
        assertEq(member(alice).streak, 2, "streak crosses weekly boundary");
        assertEq(game.memberSeasonPoints(alice, season), 10, "previous week");
        assertEq(game.memberSeasonPoints(alice, season + 1), 10, "new week");
        assertEq(game.guildSeasonTotal(id, season + 1), 10, "guild total starts fresh");
    }

    function test_warEventReportsScaledScoresAndWinningGuildId() public {
        uint256 a = create(alice, 5);
        uint256 b = create(carol, 5);
        join(bob, a);
        checkIn(alice);
        checkIn(carol);
        uint256 season = game.currentSeason();
        vm.warp(MONDAY + 7 days);
        logsVm.recordLogs();
        vm.prank(alice);
        game.submitWar(season, a, b);
        GuildWarsVm.Log[] memory logs = logsVm.getRecordedLogs();
        assertEq(logs.length, 1, "one war event");
        assertEq(logs[0].emitter, address(game), "emitter");
        assertTrue(
            logs[0].topics[0] == keccak256("WarResult(uint256,uint256,uint256,uint256,uint256,uint256)"), "signature"
        );
        assertEq(uint256(logs[0].topics[1]), season, "season topic");
        assertEq(uint256(logs[0].topics[2]), a, "guild A topic");
        assertEq(uint256(logs[0].topics[3]), b, "guild B topic");
        (uint256 scoreA, uint256 scoreB, uint256 winner) = abi.decode(logs[0].data, (uint256, uint256, uint256));
        assertEq(scoreA, 5e6, "A scaled score");
        assertEq(scoreB, 10e6, "B scaled score");
        assertEq(winner, b, "winner is guild ID, not array position or caller");
    }

    function populate(address captain, uint256 count, uint160 base) internal returns (uint256 id) {
        id = create(captain, 20);
        for (uint256 i = 1; i < count; ++i) {
            join(address(base + uint160(i)), id);
        }
    }
}
