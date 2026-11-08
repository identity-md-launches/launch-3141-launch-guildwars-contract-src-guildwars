// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./BaseTest.sol";
import {MockTarget, MockSetup} from "./Mocks.sol";
import {GuildWars} from "src/GuildWars.sol";

interface GuildWarsVm {
    struct Log {
        bytes32[] topics;
        bytes data;
        address emitter;
    }

    function recordLogs() external;
    function getRecordedLogs() external returns (Log[] memory);
}

abstract contract GuildWarsFixture is BaseTest {
    using MockSetup for MockTarget;

    uint256 internal constant MONDAY = 1_800_230_400;
    uint256 internal constant MIN_POWER = 1e18;
    bytes32 internal constant CODE = keccak256("invite");
    GuildWarsVm internal constant logsVm = GuildWarsVm(address(vm));

    GuildWars internal game;
    MockTarget internal mining;
    MockTarget internal staking;
    address internal alice = address(uint160(uint256(keccak256("GuildWars test alice"))));
    address internal bob = address(uint160(uint256(keccak256("GuildWars test bob"))));
    address internal carol = address(uint160(uint256(keccak256("GuildWars test carol"))));
    address internal outsider = address(uint160(uint256(keccak256("GuildWars test outsider"))));

    struct GuildView {
        address captain;
        string name;
        uint8 seats;
        bool recruiting;
        uint16 count;
        uint32 tierPoints;
        uint8 tier;
        uint32 activeDay;
    }

    function setUp() public virtual {
        vm.chainId(11155111);
        vm.warp(MONDAY);
        mining = new MockTarget();
        staking = new MockTarget();
        mining.setRound(100);
        staking.setPower(0);
        staking.setStake(100, 0, 0);
        game = new GuildWars(address(mining), address(staking), MIN_POWER);
    }

    function create(address who, uint8 seats) internal returns (uint256 id) {
        vm.prank(who);
        id = game.createGuild("Guild-1", seats, CODE);
    }

    function join(address who, uint256 id) internal {
        vm.prank(who);
        game.join(id, "invite");
    }

    function checkIn(address who) internal returns (uint256 points) {
        vm.prank(who);
        points = game.checkIn();
    }

    function member(address who) internal view returns (GuildWars.Member memory m) {
        (
            m.guildId,
            m.joinedDay,
            m.lastCheckInDay,
            m.streak,
            m.lastRound,
            m.roundKnown,
            m.lookingForGuild,
            m.cooldownUntil
        ) = game.members(who);
    }

    function guild(uint256 id) internal view returns (GuildView memory g) {
        (g.captain, g.name, g.seats, g.recruiting, g.count, g.tierPoints, g.tier, g.activeDay) = game.getGuild(id);
    }

    function bound(uint256 value, uint256 min, uint256 max) internal pure returns (uint256) {
        require(min <= max, "invalid test bounds");
        if (value >= min && value <= max) return value;
        return min + value % (max - min + 1);
    }

    function assertBytesEq(bytes memory a, bytes memory b, string memory message) internal pure {
        assertTrue(keccak256(a) == keccak256(b), message);
    }

    function scoreHash(uint256 id, uint256 season) internal view returns (bytes32) {
        (uint256 total, uint16 count, uint256 average) = game.seasonScore(id, season);
        return keccak256(
            abi.encode(total, count, average, game.guildSeasonTier(id, season), game.guildSeasonTouched(id, season))
        );
    }
}
