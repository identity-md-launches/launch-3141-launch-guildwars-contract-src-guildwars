// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./utils/BaseTest.sol";
import {GuildWars} from "../src/GuildWars.sol";

/// @notice Launch requirements: the factory deploys GuildWars with the three constructor arguments on a
/// chain where the official proxies may not exist (the rehearsal chain is empty), and the contract must
/// keep working, bonus-free, while a dependency address has no code.
contract GuildWarsLaunchTest is BaseTest {
    address constant MINING = 0x2dCcB11fcC2dEfdd188555e45aCb52231e82e218;
    address constant STAKING = 0x50fd1780526C3186A0c037c7622203bC4fb611ca;
    uint256 constant MIN_STAKER_POWER = 1e18;
    uint256 constant MONDAY = 1_800_230_400; // Monday 2027-01-18 00:00 UTC

    /// Audit finding 8362b504 (medium): the constructor must not require code at the dependency addresses.
    function test_constructorDeploysOnEmptyChainWithLaunchArguments() public {
        vm.chainId(11155111);
        assertEq(MINING.code.length, 0, "precondition: no code at mining");
        assertEq(STAKING.code.length, 0, "precondition: no code at staking");

        GuildWars gw = new GuildWars(MINING, STAKING, MIN_STAKER_POWER);

        assertEq(gw.mining(), MINING, "mining");
        assertEq(gw.staking(), STAKING, "staking");
        assertEq(gw.minStakerPower(), MIN_STAKER_POWER, "minStakerPower");
        assertTrue(address(gw).code.length <= 24_576, "runtime exceeds EIP-170");
    }

    function test_constructorRejectsZeroAddresses() public {
        expectRevertMessage("bad mining");
        new GuildWars(address(0), STAKING, MIN_STAKER_POWER);
        expectRevertMessage("bad staking");
        new GuildWars(MINING, address(0), MIN_STAKER_POWER);
    }

    /// With no code at either dependency the guarded reads return empty data and check-ins earn base points.
    function test_checkInWorksWhileDependenciesHaveNoCode() public {
        vm.chainId(11155111);
        vm.warp(MONDAY);
        GuildWars gw = new GuildWars(MINING, STAKING, MIN_STAKER_POWER);
        address alice = address(0xA11CE);
        vm.startPrank(alice);
        gw.createGuild("Alpha", 5, keccak256("code"));
        uint256 points = gw.checkIn();
        vm.stopPrank();
        assertEq(points, 10, "base points without dependencies");
    }

    /// The contract has no owner and no admin: there is no owner() to hand to the factory.
    function test_noOwnerFunction() public {
        GuildWars gw = new GuildWars(MINING, STAKING, MIN_STAKER_POWER);
        (bool ok,) = address(gw).staticcall(abi.encodeWithSignature("owner()"));
        assertTrue(!ok, "owner() must not exist");
    }
}
