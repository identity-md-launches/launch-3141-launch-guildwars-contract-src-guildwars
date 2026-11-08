// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {GuildWarsFixture} from "./GuildWarsFixture.sol";
import {MockTarget, MockSetup} from "./Mocks.sol";
import {GuildWars} from "src/GuildWars.sol";

/// @dev Receipt-based ghost ledger: amounts come from the configured scenario's
/// expected award, never from the registry's accounting getters. Only this handler
/// is targeted, so its twelve wallets exhaust the set of possible members.
contract GuildWarsHandler is GuildWarsFixture {
    using MockSetup for MockTarget;

    struct WalletGhost {
        uint256 guildId;
        uint256 joinedDay;
        uint256 lastDay;
        uint256 streak;
        uint64 round;
        bool roundKnown;
        bool looking;
        uint256 cooldown;
    }

    struct GuildGhost {
        address captain;
        uint8 seats;
        bool recruiting;
        uint256 tierPoints;
        uint256 captainDay;
        bool rotatedCode;
    }

    struct SeasonGhost {
        uint256 total;
        uint256 count;
        uint8 tier;
        bool touched;
        bool settled;
    }

    struct SeasonKey {
        uint256 guildId;
        uint256 season;
    }

    address[12] public actors;
    mapping(address => WalletGhost) private wallets;
    mapping(uint256 => GuildGhost) private guilds;
    mapping(address => mapping(uint256 => uint256)) private walletPoints;
    mapping(uint256 => mapping(uint256 => SeasonGhost)) private seasons;
    mapping(address => mapping(uint256 => uint256)) private dailyCheckIns;
    SeasonKey[] private touched;
    uint256 public created;
    uint256 public settledWars;
    uint64 private round = 100;
    // create, join, leave, check-in, kick, remove, transfer, claim, settings,
    // looking flag, clock, settlement, rejected authority.
    uint256[13] public successes;

    constructor() {
        setUp();
        for (uint256 i; i < actors.length; ++i) {
            actors[i] = address(uint160(uint256(keccak256(abi.encode("GuildWars invariant actor", i)))));
        }
        createGuild(0, 0);
        createGuild(4, 0);
        createGuild(8, 0);
        joinGuild(1, 0);
        joinGuild(5, 1);
        joinGuild(9, 2);
        checkInActor(0, 0);
        checkInActor(1, 1);
        checkInActor(4, 0);
        checkInActor(8, 1);
    }

    function registry() external view returns (GuildWars) {
        return game;
    }

    function createGuild(uint256 actorSeed, uint8 seatSeed) public {
        address who = actor(actorSeed);
        WalletGhost storage w = wallets[who];
        if (w.guildId != 0 || block.timestamp < w.cooldown || created == 8) return;
        uint8 seats = uint8(bound(seatSeed, 5, 20));
        vm.prank(who);
        uint256 id = game.createGuild("Random Guild", seats, CODE);
        ++created;
        assertEq(id, created, "IDs increase without reuse");
        guilds[id] = GuildGhost(who, seats, true, 0, day(), false);
        w.guildId = id;
        w.joinedDay = day();
        touch(id);
        ++successes[0];
    }

    function joinGuild(uint256 actorSeed, uint256 guildSeed) public {
        address who = actor(actorSeed);
        WalletGhost storage w = wallets[who];
        uint256 id = 1 + guildSeed % created;
        GuildGhost storage g = guilds[id];
        if (
            w.guildId != 0 || block.timestamp < w.cooldown || g.captain == address(0) || !g.recruiting
                || countMembers(id) == g.seats
        ) return;
        vm.prank(who);
        game.join(id, g.rotatedCode ? "rotated" : "invite");
        w.guildId = id;
        w.joinedDay = day();
        touch(id);
        ++successes[1];
    }

    function leaveGuild(uint256 actorSeed) public {
        address who = actor(actorSeed);
        WalletGhost storage w = wallets[who];
        uint256 id = w.guildId;
        if (id == 0) return;
        GuildGhost storage g = guilds[id];
        if (who == g.captain && countMembers(id) != 1) return;
        vm.prank(who);
        game.leave();
        removeFromLedger(who);
        w.cooldown = block.timestamp + 1 days;
        if (countMembers(id) == 0) {
            g.captain = address(0);
            g.recruiting = false;
        }
        ++successes[2];
    }

    function checkInActor(uint256 actorSeed, uint8 scenario) public {
        address who = actor(actorSeed);
        WalletGhost storage w = wallets[who];
        uint256 id = w.guildId;
        if (id == 0) return;
        if (w.lastDay == day()) {
            vm.prank(who);
            expectRevertMessage("already checked in today");
            game.checkIn();
            return;
        }
        bool miningFails = scenario & 4 != 0;
        bool stakingFails = scenario & 8 != 0;
        bool hasPower = scenario & 1 != 0;
        bool fresh = scenario & 2 != 0;
        mining.setReverting(miningFails);
        staking.setReverting(stakingFails);
        mining.setRound(round);
        staking.setPower(hasPower ? MIN_POWER : 0);
        staking.setStake(100, fresh ? 100 : 0, uint256(round) + 1);
        bool doublePoints = !miningFails && w.roundKnown && round > w.round;
        bool staker = hasPower && !fresh && !stakingFails;
        uint256 expected = doublePoints ? (staker ? 25 : 20) : (staker ? 12 : 10);
        assertEq(checkIn(who), expected, "award matches independent scenario");
        if (!miningFails) {
            w.round = round;
            w.roundKnown = true;
        }
        w.streak = w.lastDay + 1 == day() ? w.streak + 1 : 1;
        w.lastDay = day();
        ++dailyCheckIns[who][day()];
        assertEq(dailyCheckIns[who][day()], 1, "wallet can earn only once per UTC day across guilds");
        uint256 season = game.currentSeason();
        walletPoints[who][season] += expected;
        seasons[id][season].total += expected;
        if (who == guilds[id].captain) guilds[id].captainDay = day();
        touch(id);
        ++successes[3];
    }

    function kickMember(uint256 actorSeed) public {
        address who = actor(actorSeed);
        uint256 id = wallets[who].guildId;
        if (id == 0 || who == guilds[id].captain) return;
        vm.prank(guilds[id].captain);
        game.kick(who);
        removeFromLedger(who);
        ++successes[4];
    }

    function removeInactiveMember(uint256 actorSeed, uint256 callerSeed) public {
        address who = actor(actorSeed);
        WalletGhost storage w = wallets[who];
        if (w.guildId == 0 || who == guilds[w.guildId].captain) return;
        uint256 lastActive = w.lastDay > w.joinedDay ? w.lastDay : w.joinedDay;
        if (day() < lastActive + 14) return;
        vm.prank(actor(callerSeed));
        game.removeInactive(who);
        removeFromLedger(who);
        ++successes[5];
    }

    function transferCaptain(uint256 captainSeed, uint256 recipientSeed) public {
        address captain = actor(captainSeed);
        address to = actor(recipientSeed);
        uint256 id = wallets[captain].guildId;
        if (id == 0 || guilds[id].captain != captain || to == captain || wallets[to].guildId != id) return;
        vm.prank(captain);
        game.transferCaptain(to);
        guilds[id].captain = to;
        guilds[id].captainDay = day();
        ++successes[6];
    }

    function claimCaptain(uint256 actorSeed) public {
        address who = actor(actorSeed);
        uint256 id = wallets[who].guildId;
        if (id == 0 || guilds[id].captain == who || day() < guilds[id].captainDay + 14) return;
        vm.prank(who);
        game.claimCaptain();
        guilds[id].captain = who;
        guilds[id].captainDay = day();
        ++successes[7];
    }

    function changeSettings(uint256 guildSeed, bool recruiting, bool rotate) public {
        uint256 id = 1 + guildSeed % created;
        GuildGhost storage g = guilds[id];
        if (g.captain == address(0)) return;
        vm.prank(g.captain);
        game.setRecruiting(recruiting);
        g.recruiting = recruiting;
        if (rotate) {
            g.rotatedCode = !g.rotatedCode;
            vm.prank(g.captain);
            game.setInviteCode(keccak256(bytes(g.rotatedCode ? "rotated" : "invite")));
        }
        ++successes[8];
    }

    function toggleLooking(uint256 actorSeed, bool looking) public {
        address who = actor(actorSeed);
        vm.prank(who);
        game.setLookingForGuild(looking);
        wallets[who].looking = looking;
        ++successes[9];
    }

    function advanceTime(uint32 secondsSeed, uint8 roundStep) public {
        uint256 delta = bound(secondsSeed, 1, 14 days);
        vm.warp(block.timestamp + delta);
        round += uint64(roundStep);
        ++successes[10];
    }

    function settleWar(uint256 keySeed, uint256 opponentSeed) public {
        SeasonKey memory key = touched[keySeed % touched.length];
        SeasonGhost storage a = seasons[key.guildId][key.season];
        if (key.season >= game.currentSeason() || a.total == 0 || a.count == 0 || a.settled) return;
        for (uint256 i; i < created; ++i) {
            uint256 other = 1 + ((opponentSeed % created + i) % created);
            SeasonGhost storage b = seasons[other][key.season];
            if (other == key.guildId || b.total == 0 || b.count == 0 || b.settled || a.tier != b.tier) continue;
            address captain = guilds[key.guildId].captain;
            if (captain == address(0)) captain = guilds[other].captain;
            if (captain == address(0)) continue;
            vm.prank(captain);
            game.submitWar(key.season, key.guildId, other);
            // Exact rational comparison, independent of the production scaled division.
            uint256 lhs = a.total * b.count;
            uint256 rhs = b.total * a.count;
            if (lhs == rhs) {
                guilds[key.guildId].tierPoints += 150;
                guilds[other].tierPoints += 150;
            } else {
                guilds[lhs > rhs ? key.guildId : other].tierPoints += 300;
            }
            a.settled = true;
            b.settled = true;
            ++settledWars;
            ++successes[11];
            return;
        }
    }

    function unauthorizedManagement(uint256 actorSeed) public {
        address who = actor(actorSeed);
        uint256 id = wallets[who].guildId;
        if (id != 0 && guilds[id].captain == who) return;
        vm.startPrank(who);
        expectRevertMessage("not captain");
        game.setRecruiting(false);
        expectRevertMessage("not captain");
        game.setInviteCode(keccak256("unauthorized"));
        vm.stopPrank();
        ++successes[12];
    }

    function assertRegistry() external view {
        assertEq(game.guildCount(), created, "guild count matches creations");
        for (uint256 id = 1; id <= created; ++id) {
            GuildView memory actual = guild(id);
            GuildGhost storage expected = guilds[id];
            uint256 count = countMembers(id);
            assertEq(actual.count, count, "member count equals wallet registry sum");
            assertEq(actual.seats, expected.seats, "seat limit immutable");
            assertTrue(count <= actual.seats, "no guild exceeds capacity");
            assertEq(actual.captain, expected.captain, "captain follows authorized transitions");
            assertEq(actual.activeDay, expected.captainDay, "captain activity follows transitions");
            assertEq(actual.recruiting, expected.recruiting, "recruiting follows captain settings");
            if (count == 0) {
                assertEq(actual.captain, address(0), "empty guild closed");
                assertTrue(!actual.recruiting, "empty guild cannot recruit");
            } else {
                assertEq(wallets[actual.captain].guildId, id, "every live captain belongs to their guild");
            }
        }
        for (uint256 i; i < actors.length; ++i) {
            address who = actors[i];
            GuildWars.Member memory actual = member(who);
            WalletGhost storage expected = wallets[who];
            assertEq(actual.guildId, expected.guildId, "wallet belongs only to expected guild");
            assertEq(actual.joinedDay, expected.joinedDay, "joined day follows latest membership");
            assertEq(actual.cooldownUntil, expected.cooldown, "only voluntary leave imposes cooldown");
            assertEq(actual.lookingForGuild, expected.looking, "looking flag is wallet-local");
        }
    }

    function assertSeasonLedgers() external view {
        for (uint256 i; i < touched.length; ++i) {
            SeasonKey memory key = touched[i];
            SeasonGhost storage expected = seasons[key.guildId][key.season];
            (uint256 total, uint16 count, uint256 average) = game.seasonScore(key.guildId, key.season);
            assertEq(total, expected.total, "season total equals awards less departing member points");
            assertEq(count, expected.count, "season denominator follows membership only during that season");
            assertEq(game.guildSeasonMembers(key.guildId, key.season), expected.count, "stored denominator");
            assertEq(game.guildSeasonTotal(key.guildId, key.season), expected.total, "stored total");
            assertEq(game.guildSeasonTier(key.guildId, key.season), expected.tier, "first activity fixes season tier");
            assertTrue(game.guildSeasonTouched(key.guildId, key.season), "active season marked touched");
            assertEq(
                game.warDone(key.season, key.guildId), expected.settled, "each guild settles at most once per season"
            );
            if (count == 0) {
                assertEq(total + average, 0, "empty guild has zero score");
            } else {
                assertTrue(average * count <= total * 1e6, "average rounds down");
                assertTrue((average + 1) * count > total * 1e6, "average error below one unit");
                assertTrue(total <= uint256(count) * 7 * 25, "at most seven capped awards per member per week");
            }
        }
        uint256 current = game.currentSeason();
        for (uint256 id = 1; id <= created; ++id) {
            uint256 sum;
            for (uint256 i; i < actors.length; ++i) {
                if (wallets[actors[i]].guildId == id) sum += walletPoints[actors[i]][current];
            }
            assertEq(game.guildSeasonTotal(id, current), sum, "current guild total is sum of current members' points");
        }
    }

    function assertHistoryAndTierConservation() external view {
        uint256 awarded;
        for (uint256 id = 1; id <= created; ++id) {
            GuildView memory actual = guild(id);
            assertEq(actual.tierPoints, guilds[id].tierPoints, "only settled wars award tier points");
            assertEq(actual.tier, tier(guilds[id].tierPoints), "tier thresholds");
            awarded += actual.tierPoints;
        }
        assertEq(awarded, settledWars * 300, "every war conserves total tier award of 300");
        uint256 season = game.currentSeason();
        for (uint256 i; i < actors.length; ++i) {
            address who = actors[i];
            WalletGhost storage expected = wallets[who];
            GuildWars.Member memory actual = member(who);
            assertEq(actual.lastCheckInDay, expected.lastDay, "daily lock survives membership changes");
            assertEq(actual.streak, expected.streak, "streak follows UTC-day continuity");
            assertEq(actual.lastRound, expected.round, "only good mining reads update round history");
            assertEq(actual.roundKnown, expected.roundKnown, "known round survives bad reads and exits");
            assertEq(
                game.memberSeasonPoints(who, season),
                walletPoints[who][season],
                "wallet ledger equals awards less resets"
            );
            assertTrue(walletPoints[who][season] <= 7 * 25, "wallet earns at most seven awards per week");
        }
        assertEq(address(game).balance, 0, "ordinary game operations do not retain ETH");
        assertEq(game.mining(), address(mining), "mining binding immutable");
        assertEq(game.staking(), address(staking), "staking binding immutable");
        assertEq(game.minStakerPower(), MIN_POWER, "threshold immutable");
    }

    function removeFromLedger(address who) private {
        uint256 id = wallets[who].guildId;
        uint256 season = game.currentSeason();
        seasons[id][season].total -= walletPoints[who][season];
        walletPoints[who][season] = 0;
        wallets[who].guildId = 0;
        touch(id);
    }

    function touch(uint256 id) private {
        uint256 season = game.currentSeason();
        SeasonGhost storage snapshot = seasons[id][season];
        if (!snapshot.touched) {
            snapshot.touched = true;
            snapshot.tier = tier(guilds[id].tierPoints);
            touched.push(SeasonKey(id, season));
        }
        snapshot.count = countMembers(id);
    }

    function countMembers(uint256 id) private view returns (uint256 count) {
        for (uint256 i; i < actors.length; ++i) {
            if (wallets[actors[i]].guildId == id) ++count;
        }
    }

    function actor(uint256 seed) private view returns (address) {
        return actors[seed % actors.length];
    }

    function day() private view returns (uint256) {
        return block.timestamp / 1 days;
    }

    function tier(uint256 points) private pure returns (uint8) {
        if (points < 1000) return 0;
        if (points < 3000) return 1;
        if (points < 6000) return 2;
        return 3;
    }
}
