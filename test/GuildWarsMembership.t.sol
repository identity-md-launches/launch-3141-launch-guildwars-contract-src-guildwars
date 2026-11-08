// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {GuildWarsFixture} from "./utils/GuildWarsFixture.sol";
import {GuildWars} from "src/GuildWars.sol";

/// forge-config: default.fuzz.runs = 1000
contract GuildWarsMembershipTest is GuildWarsFixture {
    function testFuzz_validNamesAndAllSeatCounts(bytes32 seed, uint8 lengthSeed, uint8 seatSeed) public {
        bytes memory alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz -";
        bytes memory name = new bytes(bound(lengthSeed, 1, 24));
        for (uint256 i; i < name.length; ++i) {
            name[i] = alphabet[uint8(seed[i]) % alphabet.length];
        }
        uint8 seats = uint8(bound(seatSeed, 5, 20));
        vm.prank(alice);
        uint256 id = game.createGuild(string(name), seats, CODE);
        GuildView memory g = guild(id);
        assertBytesEq(bytes(g.name), name, "name survives storage");
        assertEq(g.seats, seats, "requested seat count");
        assertEq(g.captain, alice, "creator is captain");
        assertEq(g.count, 1, "creator takes one seat");
        assertEq(member(alice).joinedDay, MONDAY / 1 days, "join day");
    }

    function test_everyDisallowedByteRevertsWithoutCreatingGuild() public {
        bytes memory alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz -";
        bool[256] memory allowed;
        for (uint256 i; i < alphabet.length; ++i) {
            allowed[uint8(alphabet[i])] = true;
        }
        vm.startPrank(alice);
        for (uint256 b; b < 256; ++b) {
            if (allowed[b]) continue;
            expectRevertMessage("bad character");
            game.createGuild(string(abi.encodePacked("A", bytes1(uint8(b)), "Z")), 5, CODE);
        }
        vm.stopPrank();
        assertEq(game.guildCount(), 0, "invalid names cannot allocate IDs");
        assertEq(member(alice).guildId, 0, "invalid names cannot add members");
    }

    function testFuzz_invalidSeatCountsAreAtomic(uint8 raw) public {
        uint8 seats = raw < 5 ? raw : uint8(bound(raw, 21, 255));
        vm.prank(alice);
        expectRevertMessage("seats 5-20");
        game.createGuild("Valid name", seats, CODE);
        assertEq(game.guildCount(), 0, "rejected create is atomic");
        assertEq(member(alice).guildId, 0, "creator remains free");
    }

    function testFuzz_capacityIncludesCaptain(uint8 rawSeats) public {
        uint8 seats = uint8(bound(rawSeats, 5, 20));
        uint256 id = create(alice, seats);
        for (uint256 i = 1; i < seats; ++i) {
            join(address(uint160(0x10000 + i)), id);
        }
        assertEq(guild(id).count, seats, "all seats occupied");
        vm.prank(outsider);
        expectRevertMessage("guild full");
        game.join(id, "invite");
        assertEq(member(outsider).guildId, 0, "overflow member not inserted");
        assertEq(game.guildSeasonMembers(id, game.currentSeason()), seats, "season count is capped");
    }

    function test_outsiderCannotUseAnyCaptainEntryPoint() public {
        uint256 id = create(alice, 5);
        join(bob, id);
        vm.startPrank(outsider);
        expectRevertMessage("not captain");
        game.kick(bob);
        expectRevertMessage("not captain");
        game.transferCaptain(bob);
        expectRevertMessage("not captain");
        game.setRecruiting(false);
        expectRevertMessage("not captain");
        game.setInviteCode(keccak256("stolen"));
        expectRevertMessage("not in a guild");
        game.claimCaptain();
        expectRevertMessage("not in a guild");
        game.leave();
        vm.stopPrank();
        assertEq(guild(id).captain, alice, "authority unchanged");
        assertEq(guild(id).count, 2, "membership unchanged");
        join(carol, id);
    }

    function test_transferRejectsSelfZeroAndMemberOfAnotherGuild() public {
        uint256 id = create(alice, 5);
        create(carol, 5);
        vm.startPrank(alice);
        expectRevertMessage("not a member");
        game.transferCaptain(alice);
        expectRevertMessage("not a member");
        game.transferCaptain(address(0));
        expectRevertMessage("not a member");
        game.transferCaptain(carol);
        expectRevertMessage("not a member");
        game.kick(carol);
        vm.stopPrank();
        assertEq(guild(id).captain, alice, "no cross-guild transfer");
    }

    function test_transferRevokesOldCaptainPermissionsAndRefreshesActivity() public {
        uint256 id = create(alice, 5);
        join(bob, id);
        vm.warp(MONDAY + 20 days);
        vm.prank(alice);
        game.transferCaptain(bob);
        assertEq(guild(id).activeDay, (MONDAY + 20 days) / 1 days, "transfer starts activity period");
        vm.startPrank(alice);
        expectRevertMessage("not captain");
        game.setInviteCode(CODE);
        expectRevertMessage("not captain");
        game.setRecruiting(false);
        expectRevertMessage("not captain");
        game.kick(bob);
        expectRevertMessage("not captain");
        game.transferCaptain(alice);
        expectRevertMessage("captain active");
        game.claimCaptain();
        vm.stopPrank();
        vm.prank(bob);
        game.setRecruiting(false);
        assertTrue(!guild(id).recruiting, "new captain can manage guild");
    }

    function testFuzz_leaveCooldownIs24HoursNotNextMidnight(uint32 offsetSeed) public {
        uint256 offset = bound(offsetSeed, 1, 1 days - 1);
        uint256 a = create(alice, 5);
        uint256 b = create(carol, 5);
        join(bob, a);
        vm.warp(MONDAY + offset);
        vm.prank(bob);
        game.leave();
        uint256 until = MONDAY + offset + 1 days;
        assertEq(member(bob).cooldownUntil, until, "full 24 hour cooldown");
        vm.warp(MONDAY + 1 days);
        vm.startPrank(bob);
        expectRevertMessage("cool-down");
        game.join(b, "invite");
        expectRevertMessage("cool-down");
        game.createGuild("New guild", 5, CODE);
        vm.warp(until - 1);
        expectRevertMessage("cool-down");
        game.join(b, "invite");
        expectRevertMessage("cool-down");
        game.createGuild("New guild", 5, CODE);
        vm.warp(until);
        game.createGuild("New guild", 5, CODE);
        vm.stopPrank();
        assertEq(member(bob).guildId, 3, "create allowed exactly at expiry");
    }

    function test_kickAndRejoinCannotResetDailyLimitOrMoveEarnedPoints() public {
        uint256 a = create(alice, 5);
        uint256 b = create(carol, 5);
        join(bob, a);
        checkIn(bob);
        GuildWars.Member memory beforeMember = member(bob);
        vm.prank(alice);
        game.kick(bob);
        join(bob, b);
        vm.prank(bob);
        expectRevertMessage("already checked in today");
        game.checkIn();
        assertEq(game.guildSeasonTotal(a, game.currentSeason()), 0, "old guild loses contribution");
        assertEq(game.guildSeasonTotal(b, game.currentSeason()), 0, "points cannot be carried to new guild");
        assertEq(game.memberSeasonPoints(bob, game.currentSeason()), 0, "new membership starts at zero");
        GuildWars.Member memory afterMember = member(bob);
        assertEq(afterMember.lastCheckInDay, beforeMember.lastCheckInDay, "daily lock persists");
        assertEq(afterMember.lastRound, beforeMember.lastRound, "round history persists");
        assertEq(afterMember.streak, beforeMember.streak, "streak history persists");
        vm.warp(MONDAY + 1 days);
        assertEq(checkIn(bob), 10, "one new check-in next day");
        assertEq(game.guildSeasonTotal(b, game.currentSeason()), 10, "only new points count");
    }

    function test_repeatedRemovalAndLeaveCannotDebitTwice() public {
        uint256 id = create(alice, 5);
        join(bob, id);
        checkIn(alice);
        checkIn(bob);
        vm.prank(alice);
        game.kick(bob);
        vm.prank(alice);
        expectRevertMessage("not a member");
        game.kick(bob);
        vm.prank(bob);
        expectRevertMessage("not in a guild");
        game.leave();
        expectRevertMessage("not in a guild");
        game.removeInactive(bob);
        assertEq(game.guildSeasonTotal(id, game.currentSeason()), 10, "remaining points intact");
        assertEq(guild(id).count, 1, "remaining member intact");
    }

    function test_removeInactiveUsesLastCheckInAtExactDayBoundary() public {
        uint256 id = create(alice, 5);
        join(bob, id);
        vm.warp(MONDAY + 5 days + 23 hours);
        checkIn(bob);
        vm.warp(MONDAY + 19 days - 1);
        vm.prank(outsider);
        expectRevertMessage("still active");
        game.removeInactive(bob);
        vm.warp(MONDAY + 19 days);
        vm.prank(outsider);
        game.removeInactive(bob);
        assertEq(member(bob).guildId, 0, "anyone can remove at day threshold");
        assertEq(guild(id).count, 1, "captain remains");
    }

    function test_rejoinRefreshesInactivityDespiteOldCheckInHistory() public {
        uint256 a = create(alice, 5);
        uint256 b = create(carol, 5);
        join(bob, a);
        checkIn(bob);
        vm.prank(alice);
        game.kick(bob);
        vm.warp(MONDAY + 30 days + 12 hours);
        join(bob, b);
        vm.warp(MONDAY + 44 days - 1);
        expectRevertMessage("still active");
        game.removeInactive(bob);
        vm.warp(MONDAY + 44 days);
        game.removeInactive(bob);
        assertEq(member(bob).guildId, 0, "inactivity measured from latest join");
    }

    function test_claimCaptainAtBoundaryRefreshesClockAndChangesPrivileges() public {
        uint256 id = create(alice, 5);
        join(bob, id);
        join(carol, id);
        vm.warp(MONDAY + 14 days - 1);
        vm.prank(bob);
        expectRevertMessage("captain active");
        game.claimCaptain();
        vm.warp(MONDAY + 14 days);
        vm.prank(bob);
        game.claimCaptain();
        assertEq(guild(id).captain, bob, "member claims captain");
        vm.prank(carol);
        expectRevertMessage("captain active");
        game.claimCaptain();
        vm.prank(alice);
        expectRevertMessage("not captain");
        game.kick(bob);
        expectRevertMessage("captain");
        game.removeInactive(bob);
        vm.prank(bob);
        game.kick(alice);
        assertEq(member(alice).guildId, 0, "former captain is ordinary member");
    }

    function test_nonCaptainCheckInDoesNotRefreshCaptainClock() public {
        uint256 id = create(alice, 5);
        join(bob, id);
        vm.warp(MONDAY + 13 days);
        checkIn(bob);
        assertEq(guild(id).activeDay, MONDAY / 1 days, "member activity does not save captain");
        vm.warp(MONDAY + 14 days);
        vm.prank(bob);
        game.claimCaptain();
        assertEq(guild(id).captain, bob, "active member can take over");
    }

    function test_closedGuildStaysClosedAndIdsAreNeverReused() public {
        uint256 id = create(alice, 5);
        checkIn(alice);
        vm.prank(alice);
        game.leave();
        assertEq(game.guildSeasonTotal(id, game.currentSeason()), 0, "closed current score is zero");
        (uint256 total, uint16 count, uint256 average) = game.seasonScore(id, game.currentSeason());
        assertEq(total + count + average, 0, "empty score has no division by zero");
        vm.prank(alice);
        expectRevertMessage("not captain");
        game.setRecruiting(true);
        vm.warp(MONDAY + 1 days);
        assertEq(create(alice, 5), id + 1, "new guild gets fresh id");
        vm.prank(outsider);
        expectRevertMessage("no such guild");
        game.join(id, "invite");
    }

    function test_lookingFlagIsIdempotentAndIndependentOfMembershipAndScores() public {
        uint256 id = create(alice, 5);
        join(bob, id);
        checkIn(bob);
        bytes32 beforeScore = scoreHash(id, game.currentSeason());
        vm.startPrank(bob);
        game.setLookingForGuild(true);
        game.setLookingForGuild(true);
        vm.stopPrank();
        assertTrue(member(bob).lookingForGuild, "flag set");
        assertEq(member(bob).guildId, id, "flag does not leave guild");
        assertTrue(scoreHash(id, game.currentSeason()) == beforeScore, "flag does not affect scores");
        vm.prank(outsider);
        game.setLookingForGuild(false);
        assertTrue(member(bob).lookingForGuild, "cannot change another wallet flag");
        vm.prank(bob);
        game.setLookingForGuild(false);
        assertTrue(!member(bob).lookingForGuild, "flag cleared");
    }
}
