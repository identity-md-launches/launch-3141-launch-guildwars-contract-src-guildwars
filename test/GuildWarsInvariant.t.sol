// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./utils/BaseTest.sol";
import {GuildWarsHandler} from "./utils/GuildWarsHandler.sol";

/// @notice Foundry's invariant targeting ABI is exposed directly, as this repository
/// uses its existing self-contained cheatcode harness instead of forge-std.
/// forge-config: default.invariant.runs = 256
/// forge-config: default.invariant.depth = 96
/// forge-config: default.invariant.fail-on-revert = true
contract GuildWarsInvariantTest is BaseTest {
    struct FuzzSelector {
        address addr;
        bytes4[] selectors;
    }
    GuildWarsHandler private handler;

    function setUp() public {
        handler = new GuildWarsHandler();
    }

    function targetContracts() public view returns (address[] memory targets) {
        targets = new address[](1);
        targets[0] = address(handler);
    }

    function targetSelectors() public view returns (FuzzSelector[] memory targets) {
        targets = new FuzzSelector[](1);
        bytes4[] memory selectors = new bytes4[](13);
        selectors[0] = handler.createGuild.selector;
        selectors[1] = handler.joinGuild.selector;
        selectors[2] = handler.leaveGuild.selector;
        selectors[3] = handler.checkInActor.selector;
        selectors[4] = handler.kickMember.selector;
        selectors[5] = handler.removeInactiveMember.selector;
        selectors[6] = handler.transferCaptain.selector;
        selectors[7] = handler.claimCaptain.selector;
        selectors[8] = handler.changeSettings.selector;
        selectors[9] = handler.toggleLooking.selector;
        selectors[10] = handler.advanceTime.selector;
        selectors[11] = handler.settleWar.selector;
        selectors[12] = handler.unauthorizedManagement.selector;
        targets[0] = FuzzSelector(address(handler), selectors);
    }

    function invariant_membershipCountsAndCaptainAuthority() public view {
        handler.assertRegistry();
    }

    function invariant_currentAndHistoricalSeasonAccounting() public view {
        handler.assertSeasonLedgers();
    }

    function invariant_dailyHistoryAndTierAwardConservation() public view {
        handler.assertHistoryAndTierConservation();
    }

    /// @dev A deterministic reachability check ensures every action can succeed,
    /// including ones that random campaigns reach less often (settlement/takeover).
    function test_handlerExercisesEveryTransition() public {
        handler.createGuild(2, 5);
        handler.joinGuild(3, 3);
        handler.checkInActor(3, 1);
        handler.changeSettings(3, false, true);
        handler.leaveGuild(3);
        handler.advanceTime(1 days, 1);
        handler.joinGuild(3, 0);
        handler.transferCaptain(0, 1);
        handler.kickMember(0);
        handler.toggleLooking(0, true);
        handler.advanceTime(14 days, 1);
        handler.claimCaptain(3);
        handler.removeInactiveMember(1, 2);
        handler.unauthorizedManagement(0);
        handler.settleWar(1, 0);
        handler.assertRegistry();
        handler.assertSeasonLedgers();
        handler.assertHistoryAndTierConservation();
        for (uint256 i; i < 13; ++i) {
            assertTrue(handler.successes(i) > 0, "handler action is unreachable");
        }
    }
}
