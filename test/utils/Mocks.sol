// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Stand-in for SqueekMining / SqueekStaking: answers every selector with the bytes set for it,
/// or reverts, or burns all gas. Lets the tests drive every shape of return data the guarded reads
/// must tolerate (short, malformed, reverting, out of gas).
contract MockTarget {
    mapping(bytes4 => bytes) private _returns;
    bool public reverting;
    bool public burning;

    function set(bytes4 selector, bytes memory data) external {
        _returns[selector] = data;
    }

    function setReverting(bool value) external {
        reverting = value;
    }

    function setBurning(bool value) external {
        burning = value;
    }

    fallback(bytes calldata data) external returns (bytes memory) {
        if (reverting) revert("mock revert");
        if (burning) {
            uint256 x;
            while (true) {
                x += 1;
                assembly {
                    sstore(x, x)
                }
            }
        }
        return _returns[bytes4(data[:4])];
    }
}

/// @dev Helpers to configure MockTarget as the two official contracts.
library MockSetup {
    bytes4 internal constant CHECKPOINT_STATUS = bytes4(keccak256("checkpointStatus()"));
    bytes4 internal constant ACCOUNT_POWER = bytes4(keccak256("accountPower(address)"));
    bytes4 internal constant STAKE_OF = bytes4(keccak256("stakeOf(address)"));

    function setRound(MockTarget mining, uint256 nextRound) internal {
        mining.set(CHECKPOINT_STATUS, abi.encode(false, nextRound, false));
    }

    function setPower(MockTarget staking, uint256 sqkPower) internal {
        staking.set(ACCOUNT_POWER, abi.encode(uint256(0), sqkPower));
    }

    function setStake(MockTarget staking, uint256 principal, uint256 fresh, uint256 freshUntil) internal {
        staking.set(STAKE_OF, abi.encode(principal, fresh, freshUntil));
    }
}
