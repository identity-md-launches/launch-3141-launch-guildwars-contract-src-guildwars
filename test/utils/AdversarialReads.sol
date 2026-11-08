// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Selector-specific failures keep the three dependency reads independently testable.
contract AdversarialReads {
    enum Behavior {
        ReturnData,
        Revert,
        BurnGas,
        WriteStorage
    }
    mapping(bytes4 => bytes) private answers;
    mapping(bytes4 => Behavior) private behaviors;
    uint256 public writes;

    function configure(bytes4 selector, bytes memory answer, Behavior behavior) external {
        answers[selector] = answer;
        behaviors[selector] = behavior;
    }

    fallback(bytes calldata input) external returns (bytes memory) {
        bytes4 selector = bytes4(input[:4]);
        Behavior behavior = behaviors[selector];
        if (behavior == Behavior.Revert) revert("dependency unavailable");
        if (behavior == Behavior.BurnGas) {
            // A real gas-exhaustion loop, with no state-writing opcode to cause an earlier static violation.
            assembly { for {} 1 {} {} }
        }
        if (behavior == Behavior.WriteStorage) ++writes;
        return answers[selector];
    }
}

contract WalletAwareStaking {
    address private immutable expectedWallet;

    constructor(address expectedWallet_) {
        expectedWallet = expectedWallet_;
    }

    function accountPower(address wallet) external view returns (uint256, uint256) {
        require(wallet == expectedWallet, "wrong accountPower wallet");
        return (type(uint256).max, 1e18);
    }

    function stakeOf(address wallet) external view returns (uint256, uint256, uint64) {
        require(wallet == expectedWallet, "wrong stakeOf wallet");
        return (40e18, 0, 0);
    }
}
