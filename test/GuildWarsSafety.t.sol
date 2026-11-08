// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {GuildWarsFixture} from "./utils/GuildWarsFixture.sol";
import {GuildWars} from "src/GuildWars.sol";

/// forge-config: default.fuzz.runs = 1000
contract GuildWarsSafetyTest is GuildWarsFixture {
    function testFuzz_allMutatingEntryPointsRejectValue(uint96 valueSeed) public {
        uint256 value = bound(valueSeed, 1, 1 ether);
        uint256 id = create(alice, 5);
        join(bob, id);
        uint256 season = game.currentSeason();
        bytes[] memory calls = new bytes[](12);
        calls[0] = abi.encodeCall(GuildWars.createGuild, ("Value test", 5, CODE));
        calls[1] = abi.encodeCall(GuildWars.join, (id, "invite"));
        calls[2] = abi.encodeCall(GuildWars.leave, ());
        calls[3] = abi.encodeCall(GuildWars.kick, (bob));
        calls[4] = abi.encodeCall(GuildWars.removeInactive, (bob));
        calls[5] = abi.encodeCall(GuildWars.transferCaptain, (bob));
        calls[6] = abi.encodeCall(GuildWars.claimCaptain, ());
        calls[7] = abi.encodeCall(GuildWars.setRecruiting, (false));
        calls[8] = abi.encodeCall(GuildWars.setInviteCode, (keccak256("new code")));
        calls[9] = abi.encodeCall(GuildWars.setLookingForGuild, (true));
        calls[10] = abi.encodeCall(GuildWars.checkIn, ());
        calls[11] = abi.encodeCall(GuildWars.submitWar, (season - 1, id, id + 1));
        vm.deal(alice, value);
        bytes32 beforeScore = scoreHash(id, season);
        for (uint256 i; i < calls.length; ++i) {
            vm.prank(alice);
            (bool ok, bytes memory reason) = address(game).call{value: value}(calls[i]);
            assertTrue(!ok, "entry point accepted ETH");
            assertEq(reason.length, 0, "nonpayable dispatcher rejects value before function guards");
        }
        assertEq(address(game).balance, 0, "no ETH retained");
        assertEq(alice.balance, value, "all rejected value returned");
        assertTrue(scoreHash(id, season) == beforeScore, "scores unchanged");
        assertEq(guild(id).captain, alice, "captain unchanged");
        assertEq(guild(id).count, 2, "membership unchanged");
        assertTrue(guild(id).recruiting, "recruiting unchanged");
        assertTrue(!member(alice).lookingForGuild, "looking flag unchanged");
    }

    function test_emptyCalldataAndUnexpectedSelectorsRevertEvenWithoutValue() public {
        bytes[] memory calls = new bytes[](7);
        calls[0] = "";
        calls[1] = abi.encodeWithSignature("owner()");
        calls[2] = abi.encodeWithSignature("pause()");
        calls[3] = abi.encodeWithSignature("unpause()");
        calls[4] = abi.encodeWithSignature("transferOwnership(address)", alice);
        calls[5] = abi.encodeWithSignature("upgradeTo(address)", address(mining));
        calls[6] = abi.encodeWithSignature("initialize(address)", alice);
        for (uint256 i; i < calls.length; ++i) {
            vm.prank(alice);
            (bool ok,) = address(game).call(calls[i]);
            assertTrue(!ok, "unexpected privileged or fallback entry point");
        }
        assertEq(game.guildCount(), 0, "unexpected selectors do not mutate registry");
        assertEq(game.mining(), address(mining), "dependency binding unchanged");
        assertEq(game.staking(), address(staking), "dependency binding unchanged");
    }
}
