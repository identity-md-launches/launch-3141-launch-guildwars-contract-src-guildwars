// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Minimal subset of the Foundry cheatcode interface. The project vendors no forge-std (its `lib/`
/// is empty and protected), so the tests talk to the cheatcode address directly.
interface Vm {
    function warp(uint256 newTimestamp) external;
    function prank(address msgSender) external;
    function startPrank(address msgSender) external;
    function stopPrank() external;
    function expectRevert() external;
    function expectRevert(bytes calldata revertData) external;
    function chainId(uint256 newChainId) external;
    function deal(address account, uint256 newBalance) external;
    function assume(bool condition) external pure;
    function etch(address target, bytes calldata newRuntimeBytecode) external;
}

/// @dev Tiny assertion base. A failing assertion reverts with the message, which Forge reports as a failure.
abstract contract BaseTest {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function assertTrue(bool ok, string memory message) internal pure {
        require(ok, message);
    }

    function assertEq(uint256 a, uint256 b, string memory message) internal pure {
        if (a != b) revert(string.concat(message, ": ", _toString(a), " != ", _toString(b)));
    }

    function assertEq(address a, address b, string memory message) internal pure {
        require(a == b, message);
    }

    function assertEq(bool a, bool b, string memory message) internal pure {
        require(a == b, message);
    }

    function expectRevertMessage(string memory message) internal {
        vm.expectRevert(abi.encodeWithSignature("Error(string)", message));
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
