// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./utils/BaseTest.sol";
import {MockTarget, MockSetup} from "./utils/Mocks.sol";
import {GuildWars} from "../src/GuildWars.sol";

/// @notice Offline behaviour tests against mock SqueekMining / SqueekStaking contracts.
contract GuildWarsTest is BaseTest {
    using MockSetup for MockTarget;

    uint256 constant MONDAY = 1_800_230_400; // Monday 2027-01-18 00:00 UTC
    uint256 constant MIN_POWER = 1e18;
    bytes32 constant CODE_HASH = keccak256("s3cret");

    GuildWars gw;
    MockTarget mining;
    MockTarget staking;

    address capA = address(0xA1);
    address capB = address(0xB1);
    address bob = address(0xB0B);
    address eve = address(0xE7E);

    function setUp() public {
        vm.warp(MONDAY);
        mining = new MockTarget();
        staking = new MockTarget();
        mining.setRound(654);
        staking.setPower(0);
        staking.setStake(0, 0, 0);
        gw = new GuildWars(address(mining), address(staking), MIN_POWER);
    }

    // ------------------------------------------------------------------ helpers
    function _create(address captain, string memory name) internal returns (uint256 id) {
        vm.prank(captain);
        id = gw.createGuild(name, 5, CODE_HASH);
    }

    function _join(address wallet, uint256 guildId) internal {
        vm.prank(wallet);
        gw.join(guildId, "s3cret");
    }

    function _checkIn(address wallet) internal returns (uint256 points) {
        vm.prank(wallet);
        points = gw.checkIn();
    }

    function _guildOf(address wallet) internal view returns (uint256 id) {
        (id,,,,,,,) = gw.members(wallet);
    }

    function _memberCount(uint256 guildId) internal view returns (uint16 count) {
        (,,,, count,,,) = gw.getGuild(guildId);
    }

    function _tierPoints(uint256 guildId) internal view returns (uint32 pts) {
        (,,,,, pts,,) = gw.getGuild(guildId);
    }

    function _captain(uint256 guildId) internal view returns (address captain) {
        (captain,,,,,,,) = gw.getGuild(guildId);
    }

    // ------------------------------------------------------------------ guild creation and joining
    function test_createGuildAndJoin() public {
        uint256 id = _create(capA, "Night Owls-1");
        assertEq(id, 1, "first guild id");
        (address captain, string memory name, uint8 seats, bool recruiting, uint16 count,, uint8 tier,) =
            gw.getGuild(id);
        assertEq(captain, capA, "captain");
        assertTrue(keccak256(bytes(name)) == keccak256("Night Owls-1"), "name");
        assertEq(seats, 5, "seats");
        assertTrue(recruiting, "recruiting");
        assertEq(count, 1, "member count");
        assertEq(tier, 0, "bronze");

        _join(bob, id);
        assertEq(_guildOf(bob), id, "bob joined");
        assertEq(_memberCount(id), 2, "two members");
        assertEq(gw.guildSeasonMembers(id, gw.currentSeason()), 2, "season member count tracks joins");
    }

    function test_createGuildValidation() public {
        vm.startPrank(capA);
        expectRevertMessage("seats 5-20");
        gw.createGuild("Alpha", 4, CODE_HASH);
        expectRevertMessage("seats 5-20");
        gw.createGuild("Alpha", 21, CODE_HASH);
        expectRevertMessage("name length");
        gw.createGuild("", 5, CODE_HASH);
        expectRevertMessage("name length");
        gw.createGuild("abcdefghijklmnopqrstuvwxy", 5, CODE_HASH);
        expectRevertMessage("bad character");
        gw.createGuild("Alpha!", 5, CODE_HASH);
        gw.createGuild("Alpha", 5, CODE_HASH);
        expectRevertMessage("already in a guild");
        gw.createGuild("Beta", 5, CODE_HASH);
        vm.stopPrank();
    }

    function test_joinChecks() public {
        uint256 id = _create(capA, "Alpha");
        vm.prank(bob);
        expectRevertMessage("no such guild");
        gw.join(99, "s3cret");
        vm.prank(bob);
        expectRevertMessage("wrong code");
        gw.join(id, "nope");

        vm.prank(capA);
        gw.setRecruiting(false);
        vm.prank(bob);
        expectRevertMessage("not recruiting");
        gw.join(id, "s3cret");
        vm.prank(capA);
        gw.setRecruiting(true);

        vm.prank(capA);
        gw.setInviteCode(keccak256("rotated"));
        vm.prank(bob);
        expectRevertMessage("wrong code");
        gw.join(id, "s3cret");
        vm.prank(bob);
        gw.join(id, "rotated");

        vm.prank(bob);
        expectRevertMessage("already in a guild");
        gw.join(id, "rotated");

        // fill the remaining seats, then one more must fail
        for (uint160 i = 1; i <= 3; i++) {
            vm.prank(address(0x1000 + i));
            gw.join(id, "rotated");
        }
        vm.prank(eve);
        expectRevertMessage("guild full");
        gw.join(id, "rotated");
    }

    function test_onlyCaptainManagesGuild() public {
        uint256 id = _create(capA, "Alpha");
        _join(bob, id);
        vm.startPrank(bob);
        expectRevertMessage("not captain");
        gw.setRecruiting(false);
        expectRevertMessage("not captain");
        gw.setInviteCode(bytes32(0));
        expectRevertMessage("not captain");
        gw.kick(capA);
        expectRevertMessage("not captain");
        gw.transferCaptain(capA);
        vm.stopPrank();
        // wallets outside any guild cannot either
        vm.prank(eve);
        expectRevertMessage("not captain");
        gw.setRecruiting(false);
    }

    // ------------------------------------------------------------------ check-in points
    function test_checkInBasePoints() public {
        _create(capA, "Alpha");
        assertEq(_checkIn(capA), 10, "base");
        (,, uint32 last, uint32 streak, uint64 lastRound, bool roundKnown,,) = gw.members(capA);
        assertEq(last, MONDAY / 1 days, "day recorded");
        assertEq(streak, 1, "streak");
        assertEq(lastRound, 654, "round stored");
        assertTrue(roundKnown, "round known");
        assertEq(gw.memberSeasonPoints(capA, gw.currentSeason()), 10, "member points");
        assertEq(gw.guildSeasonTotal(1, gw.currentSeason()), 10, "guild total");
    }

    function test_checkInOncePerDay() public {
        _create(capA, "Alpha");
        _checkIn(capA);
        vm.prank(capA);
        expectRevertMessage("already checked in today");
        gw.checkIn();
        vm.warp(MONDAY + 1 days);
        assertEq(_checkIn(capA), 10, "next day");
        (,,, uint32 streak,,,,) = gw.members(capA);
        assertEq(streak, 2, "streak continues");
        vm.warp(MONDAY + 3 days);
        _checkIn(capA);
        (,,, streak,,,,) = gw.members(capA);
        assertEq(streak, 1, "streak resets after a gap");
    }

    function test_checkInRequiresGuild() public {
        vm.prank(eve);
        expectRevertMessage("not in a guild");
        gw.checkIn();
    }

    function test_roundBonusDoubles() public {
        _create(capA, "Alpha");
        assertEq(_checkIn(capA), 10, "first check-in never has the round bonus");
        vm.warp(MONDAY + 1 days);
        assertEq(_checkIn(capA), 10, "same round, no bonus");
        mining.setRound(655);
        vm.warp(MONDAY + 2 days);
        assertEq(_checkIn(capA), 20, "round advanced since last check-in");
        vm.warp(MONDAY + 3 days);
        assertEq(_checkIn(capA), 10, "round already seen");
    }

    function test_stakerBonus() public {
        _create(capA, "Alpha");
        staking.setPower(MIN_POWER);
        assertEq(_checkIn(capA), 12, "10 x 1.25 rounded down");
        staking.setPower(MIN_POWER - 1);
        vm.warp(MONDAY + 1 days);
        assertEq(_checkIn(capA), 10, "below threshold");
    }

    function test_bothBonusesCapAt25() public {
        _create(capA, "Alpha");
        _checkIn(capA);
        vm.warp(MONDAY + 1 days);
        mining.setRound(655);
        staking.setPower(5 * MIN_POWER);
        assertEq(_checkIn(capA), 25, "20 x 1.25");
        assertEq(gw.MAX_POINTS(), 25, "max");
    }

    function test_freshStakeIsIgnored() public {
        _create(capA, "Alpha");
        staking.setPower(2 * MIN_POWER);
        // 60 % of the principal is still fresh until round 700 > 654: effective = 2e18 * 40 / 100 = 0.8e18
        staking.setStake(100, 60, 700);
        assertEq(_checkIn(capA), 10, "fresh share ignored");
        // freshness expired (freshUntil <= nextRound): full power counts
        vm.warp(MONDAY + 1 days);
        staking.setStake(100, 60, 654);
        assertEq(_checkIn(capA), 12, "freshness over");
        // everything fresh: effective power 0
        vm.warp(MONDAY + 2 days);
        staking.setStake(100, 100, 700);
        assertEq(_checkIn(capA), 10, "all fresh");
        // half fresh of a large enough stake still passes
        vm.warp(MONDAY + 3 days);
        staking.setStake(100, 50, 700);
        assertEq(_checkIn(capA), 12, "half fresh of 2x power");
    }

    function test_failingReadsMeanNoBonus() public {
        _create(capA, "Alpha");
        staking.setPower(MIN_POWER);
        _checkIn(capA);

        // reverting targets
        vm.warp(MONDAY + 1 days);
        mining.setReverting(true);
        staking.setReverting(true);
        mining.setRound(655);
        assertEq(_checkIn(capA), 10, "both reads revert");

        // out-of-gas targets (gas is capped per read, the check-in still succeeds)
        vm.warp(MONDAY + 2 days);
        mining.setReverting(false);
        staking.setReverting(false);
        mining.setBurning(true);
        staking.setBurning(true);
        assertEq(_checkIn(capA), 10, "both reads burn gas");

        // short return data
        vm.warp(MONDAY + 3 days);
        mining.setBurning(false);
        staking.setBurning(false);
        mining.set(MockSetup.CHECKPOINT_STATUS, abi.encode(uint256(1)));
        staking.set(MockSetup.ACCOUNT_POWER, abi.encode(MIN_POWER));
        assertEq(_checkIn(capA), 10, "short returns");

        // the round value cannot be a uint64: treated as a failed read
        vm.warp(MONDAY + 4 days);
        mining.set(MockSetup.CHECKPOINT_STATUS, abi.encode(false, uint256(type(uint64).max) + 1, false));
        staking.setPower(MIN_POWER);
        staking.set(MockSetup.STAKE_OF, abi.encode(uint256(1), uint256(0)));
        assertEq(_checkIn(capA), 10, "oversized round and short stakeOf");

        // reads recover: the round seen before the outage was 654, now 700 -> x2, staking x1.25
        vm.warp(MONDAY + 5 days);
        mining.setRound(700);
        staking.setStake(0, 0, 0);
        assertEq(_checkIn(capA), 25, "recovered");
    }

    /// Audit finding ad63a60d (medium): a mining proxy answering with non-canonical boolean words must mean
    /// "no bonus", never a revert of every check-in.
    function test_malformedBoolWordsDoNotRevertCheckIn() public {
        _create(capA, "Alpha");
        mining.set(MockSetup.CHECKPOINT_STATUS, abi.encode(uint256(2), uint256(654), uint256(1)));
        assertEq(_checkIn(capA), 10, "first check-in");
        (,, uint32 last,,, bool roundKnown,,) = gw.members(capA);
        assertEq(last, MONDAY / 1 days, "recorded");
        assertTrue(roundKnown, "round still tracked from the second word");

        vm.warp(MONDAY + 1 days);
        mining.set(MockSetup.CHECKPOINT_STATUS, abi.encode(type(uint256).max, uint256(655), type(uint256).max));
        assertEq(_checkIn(capA), 20, "round advanced, bonus applies despite garbage flag words");
    }

    /// Any 96-byte answer with a uint64-sized round is accepted; anything else is "no bonus". Never a revert.
    function testFuzz_readRoundNeverReverts(uint256 w0, uint256 n, uint256 w2, uint8 extra) public {
        _create(capA, "Alpha");
        _checkIn(capA);
        vm.warp(MONDAY + 1 days);
        bytes memory ret = abi.encode(w0, n, w2);
        if (extra % 2 == 1) ret = bytes.concat(ret, new bytes(extra)); // trailing bytes are tolerated
        mining.set(MockSetup.CHECKPOINT_STATUS, ret);
        uint256 points = _checkIn(capA);
        bool roundOk = n <= type(uint64).max;
        assertEq(points, roundOk && n > 654 ? 20 : 10, "points");
    }

    // ------------------------------------------------------------------ leaving, kicking, captains
    function test_leaveAppliesCooldownAndRemovesPoints() public {
        uint256 id = _create(capA, "Alpha");
        _join(bob, id);
        _checkIn(bob);
        uint256 season = gw.currentSeason();
        assertEq(gw.guildSeasonTotal(id, season), 10, "total before");

        vm.prank(bob);
        gw.leave();
        assertEq(_guildOf(bob), 0, "left");
        assertEq(_memberCount(id), 1, "count");
        assertEq(gw.guildSeasonTotal(id, season), 0, "points leave with the member");
        assertEq(gw.memberSeasonPoints(bob, season), 0, "member points cleared");
        assertEq(gw.guildSeasonMembers(id, season), 1, "season member count updated");

        vm.prank(bob);
        expectRevertMessage("cool-down");
        gw.join(id, "s3cret");
        vm.prank(bob);
        expectRevertMessage("cool-down");
        gw.createGuild("Beta", 5, CODE_HASH);

        vm.warp(MONDAY + 1 days - 1);
        vm.prank(bob);
        expectRevertMessage("cool-down");
        gw.join(id, "s3cret");
        vm.warp(MONDAY + 1 days);
        _join(bob, id);
        assertEq(_guildOf(bob), id, "rejoined after 24 h");
    }

    function test_captainMustTransferBeforeLeaving() public {
        uint256 id = _create(capA, "Alpha");
        _join(bob, id);
        vm.prank(capA);
        expectRevertMessage("transfer captain first");
        gw.leave();

        vm.prank(capA);
        expectRevertMessage("not a member");
        gw.transferCaptain(eve);
        vm.prank(capA);
        gw.transferCaptain(bob);
        assertEq(_captain(id), bob, "new captain");

        vm.prank(capA);
        gw.leave();
        assertEq(_memberCount(id), 1, "one left");
    }

    function test_lastMemberLeavingClosesGuild() public {
        uint256 id = _create(capA, "Alpha");
        vm.prank(capA);
        gw.leave();
        (address captain,,, bool recruiting, uint16 count,,,) = gw.getGuild(id);
        assertEq(captain, address(0), "closed");
        assertTrue(!recruiting, "not recruiting");
        assertEq(count, 0, "empty");
        vm.warp(MONDAY + 1 days);
        vm.prank(bob);
        expectRevertMessage("no such guild");
        gw.join(id, "s3cret");
    }

    function test_kick() public {
        uint256 id = _create(capA, "Alpha");
        _join(bob, id);
        _checkIn(bob);
        vm.prank(capA);
        expectRevertMessage("cannot kick yourself");
        gw.kick(capA);
        vm.prank(capA);
        expectRevertMessage("not a member");
        gw.kick(eve);
        vm.prank(capA);
        gw.kick(bob);
        assertEq(_guildOf(bob), 0, "kicked");
        assertEq(gw.guildSeasonTotal(id, gw.currentSeason()), 0, "kicked member's points removed");
    }

    function test_claimCaptainAfterInactivity() public {
        uint256 id = _create(capA, "Alpha");
        _join(bob, id);
        vm.prank(bob);
        expectRevertMessage("captain active");
        gw.claimCaptain();
        vm.prank(capA);
        expectRevertMessage("already captain");
        gw.claimCaptain();

        vm.warp(MONDAY + 13 days);
        vm.prank(bob);
        expectRevertMessage("captain active");
        gw.claimCaptain();

        // a captain check-in refreshes the activity day
        _checkIn(capA);
        vm.warp(MONDAY + 14 days);
        vm.prank(bob);
        expectRevertMessage("captain active");
        gw.claimCaptain();

        vm.warp(MONDAY + 27 days);
        vm.prank(bob);
        gw.claimCaptain();
        assertEq(_captain(id), bob, "claimed");
    }

    function test_removeInactive() public {
        uint256 id = _create(capA, "Alpha");
        _join(bob, id);
        vm.prank(eve);
        expectRevertMessage("still active");
        gw.removeInactive(bob);
        vm.prank(eve);
        expectRevertMessage("captain");
        gw.removeInactive(capA);
        vm.prank(eve);
        expectRevertMessage("not in a guild");
        gw.removeInactive(eve);

        vm.warp(MONDAY + 13 days);
        vm.prank(eve);
        expectRevertMessage("still active");
        gw.removeInactive(bob);
        vm.warp(MONDAY + 14 days);
        vm.prank(eve);
        gw.removeInactive(bob);
        assertEq(_guildOf(bob), 0, "removed");
        assertEq(_memberCount(id), 1, "count");
    }

    function test_lookingForGuildFlag() public {
        vm.prank(eve);
        gw.setLookingForGuild(true);
        (,,,,,, bool looking,) = gw.members(eve);
        assertTrue(looking, "flag set");
    }

    // ------------------------------------------------------------------ seasons
    function test_seasonRollsOverOnMonday() public {
        uint256 s = gw.currentSeason();
        vm.warp(MONDAY + 7 days - 1);
        assertEq(gw.currentSeason(), s, "Sunday 23:59:59 same season");
        vm.warp(MONDAY + 7 days);
        assertEq(gw.currentSeason(), s + 1, "Monday 00:00 next season");
        vm.warp(MONDAY - 1);
        assertEq(gw.currentSeason(), s - 1, "Sunday before");
    }

    function test_tierThresholds() public view {
        assertEq(gw.tierOf(0), 0, "bronze");
        assertEq(gw.tierOf(999), 0, "bronze top");
        assertEq(gw.tierOf(1000), 1, "silver");
        assertEq(gw.tierOf(2999), 1, "silver top");
        assertEq(gw.tierOf(3000), 2, "gold");
        assertEq(gw.tierOf(5999), 2, "gold top");
        assertEq(gw.tierOf(6000), 3, "legend");
        assertEq(gw.tierOf(type(uint32).max), 3, "legend max");
    }

    function testFuzz_tierIsMonotonic(uint32 a, uint32 b) public view {
        vm.assume(a <= b);
        assertTrue(gw.tierOf(a) <= gw.tierOf(b), "monotonic");
    }

    // ------------------------------------------------------------------ wars
    function test_warTieAndDoubleSettlement() public {
        uint256 a = _create(capA, "Alpha");
        uint256 b = _create(capB, "Beta");
        uint256 season = gw.currentSeason();
        _checkIn(capA);
        _checkIn(capB);

        vm.prank(capA);
        expectRevertMessage("season not over");
        gw.submitWar(season, a, b);

        vm.warp(MONDAY + 7 days);
        vm.prank(eve);
        expectRevertMessage("not a captain of these guilds");
        gw.submitWar(season, a, b);
        vm.prank(capA);
        expectRevertMessage("same guild");
        gw.submitWar(season, a, a);

        vm.prank(capA);
        gw.submitWar(season, a, b);
        assertEq(_tierPoints(a), 150, "tie A");
        assertEq(_tierPoints(b), 150, "tie B");
        assertTrue(gw.warDone(season, a) && gw.warDone(season, b), "settled");

        vm.prank(capB);
        expectRevertMessage("already settled");
        gw.submitWar(season, b, a);
    }

    function test_warAverageBeatsSize() public {
        uint256 a = _create(capA, "Alpha");
        uint256 b = _create(capB, "Beta");
        _join(bob, b);
        _join(eve, b);
        uint256 season = gw.currentSeason();
        _checkIn(capA); // A: 10 / 1 member = 10
        _checkIn(capB); // B: 20 / 3 members = 6.67
        _checkIn(bob);

        (uint256 totalA, uint16 countA, uint256 avgA) = gw.seasonScore(a, season);
        (uint256 totalB, uint16 countB, uint256 avgB) = gw.seasonScore(b, season);
        assertEq(totalA, 10, "total A");
        assertEq(countA, 1, "count A");
        assertEq(avgA, 10 * 1e6, "avg A");
        assertEq(totalB, 20, "total B");
        assertEq(countB, 3, "count B");
        assertEq(avgB, uint256(20 * 1e6) / 3, "avg B");

        vm.warp(MONDAY + 7 days);
        vm.prank(capB);
        gw.submitWar(season, b, a);
        assertEq(_tierPoints(a), 300, "A wins");
        assertEq(_tierPoints(b), 0, "B loses nothing");
    }

    function test_warRequiresActivityThatSeason() public {
        uint256 a = _create(capA, "Alpha");
        uint256 b = _create(capB, "Beta");
        uint256 season = gw.currentSeason();
        _checkIn(capA);
        vm.warp(MONDAY + 7 days);
        vm.prank(capA);
        expectRevertMessage("guild inactive that season");
        gw.submitWar(season, a, b);
    }

    function test_seasonScoreFrozenAfterSeasonEnds() public {
        uint256 a = _create(capA, "Alpha");
        _join(bob, a);
        uint256 season = gw.currentSeason();
        _checkIn(capA);
        _checkIn(bob);
        vm.warp(MONDAY + 7 days);
        _join(eve, a); // next season: must not change last season's count
        _checkIn(eve);
        (uint256 total, uint16 count,) = gw.seasonScore(a, season);
        assertEq(total, 20, "last season total");
        assertEq(count, 2, "last season count");
        (, uint16 countNow,) = gw.seasonScore(a, season + 1);
        assertEq(countNow, 3, "this season count");
    }

    /// Four wins take a guild to Silver (1200 points); it can then no longer be paired with a Bronze guild.
    function test_warTierMismatch() public {
        uint256 a = _create(capA, "Alpha");
        uint256 b = _create(capB, "Beta");
        for (uint256 i = 0; i < 4; i++) {
            uint256 start = MONDAY + i * 7 days;
            vm.warp(start);
            uint256 season = gw.currentSeason();
            _checkIn(capA);
            _checkIn(capB);
            vm.warp(start + 1 days);
            _checkIn(capA); // A averages 20, B averages 10
            vm.warp(start + 7 days);
            vm.prank(capA);
            gw.submitWar(season, a, b);
        }
        assertEq(_tierPoints(a), 1200, "silver");
        (,,,,,, uint8 tierA,) = gw.getGuild(a);
        assertEq(tierA, 1, "tier 1");

        uint256 s5 = gw.currentSeason();
        _checkIn(capA);
        _checkIn(capB);
        assertEq(gw.guildSeasonTier(a, s5), 1, "snapshot silver");
        assertEq(gw.guildSeasonTier(b, s5), 0, "snapshot bronze");
        vm.warp(MONDAY + 5 * 7 days);
        vm.prank(capA);
        expectRevertMessage("tier mismatch");
        gw.submitWar(s5, a, b);
    }

    // ------------------------------------------------------------------ no value accepted
    function test_rejectsEther() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(gw).call{value: 1}("");
        assertTrue(!ok, "plain transfer rejected");
        (ok,) = address(gw).call{value: 1}(abi.encodeWithSignature("checkIn()"));
        assertTrue(!ok, "value with a call rejected");
        assertEq(address(gw).balance, 0, "holds nothing");
    }

    // ------------------------------------------------------------------ documented limitations (pinned)
    // These pin behaviour the audit reported as low/informational and CONTRACT.md documents as known
    // limitations of the design. They are kept unchanged on purpose; see ADAPTATION.md.

    /// Audit 2d815999 (low): the invite code is a shared secret; once used it is public calldata.
    function test_limitation_inviteCodeIsSharedSecret() public {
        uint256 id = _create(capA, "Alpha");
        _join(bob, id);
        _join(eve, id); // eve copied the code from bob's transaction
        assertEq(_memberCount(id), 3, "anyone holding the code can join while recruiting");
        vm.prank(capA);
        gw.setRecruiting(false); // captain's defence
        vm.prank(address(0x5555));
        expectRevertMessage("not recruiting");
        gw.join(id, "s3cret");
    }

    /// Audit 4ff9738b (low): one captain's submission consumes both guilds' single war of the season.
    function test_limitation_warSubmittedByOneCaptainSettlesBoth() public {
        uint256 a = _create(capA, "Alpha");
        uint256 b = _create(capB, "Beta");
        uint256 c = _create(eve, "Gamma");
        uint256 season = gw.currentSeason();
        _checkIn(capA);
        _checkIn(capB);
        _checkIn(eve);
        vm.warp(MONDAY + 7 days);
        vm.prank(capA);
        gw.submitWar(season, a, b);
        vm.prank(capB);
        expectRevertMessage("already settled");
        gw.submitWar(season, b, c);
    }

    /// Audit 0f48204d (info): only leave() starts the 24 h cool-down; kick and inactivity removal do not.
    function test_limitation_kickHasNoCooldown() public {
        uint256 a = _create(capA, "Alpha");
        uint256 b = _create(capB, "Beta");
        _join(bob, a);
        vm.prank(capA);
        gw.kick(bob);
        _join(bob, b);
        assertEq(_guildOf(bob), b, "kicked wallet may join another guild at once");
    }

    /// Audit 14fc849d (info): the tier is snapshotted at the first touch of a season, so points gained by a
    /// later submitWar for the previous season do not change the snapshot already taken.
    function test_limitation_tierSnapshotTakenAtFirstTouch() public {
        uint256 a = _create(capA, "Alpha");
        uint256 b = _create(capB, "Beta");
        uint256 season = gw.currentSeason();
        _checkIn(capA);
        vm.warp(MONDAY + 1 days);
        _checkIn(capA);
        _checkIn(capB);
        vm.warp(MONDAY + 7 days);
        _checkIn(capA); // first touch of season+1 snapshots the tier before the war is settled
        vm.prank(capA);
        gw.submitWar(season, a, b);
        assertEq(_tierPoints(a), 300, "won");
        assertEq(gw.guildSeasonTier(a, season + 1), 0, "snapshot unchanged by a later settlement");
    }
}
