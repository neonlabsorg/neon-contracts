// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title CallSolanaValidationLib
/// @notice This contract serves as a helper library when interacting with precompile CallSolana ( 0xFF00000000000000000000000000000000000006 )
/// @author https://twitter.com/mnedelchev_
library CallSolanaHelperLib {
    /// @notice This method prepares Solana's instruction data into bincode serialized format
    /// @param programId The programId of the instruction
    /// @param accounts The instruction accounts list, e.g. abi.encodePacked(0x123, true, true). The Solana account is in bytes32 format
    /// @param instructionData The instruction data
    function prepareSolanaInstruction(
        bytes32 programId,
        bytes[] memory accounts,
        bytes memory instructionData
    ) internal pure returns (bytes memory) {
        uint accountsLen = accounts.length;
        bytes memory accountsList;
        for (uint i = 0; i < accountsLen; ++i) {
            accountsList = abi.encodePacked(
                accountsList, 
                accounts[i]
            );
        }

        return abi.encodePacked(
            programId, 
            _reverseShift(accountsLen),
            accountsList,
            _reverseShift(
                instructionData.length
            ),
            instructionData
        );
    }

    /// @notice Converts address type into bytes32.
    function addressToBytes32(address account) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(account)));
    }

    /// @notice Returns the Neon EVM's program arbitrary token account seeds for given EVM wallet.
    function getArbitraryTokenAccountSeeds(address token, address owner) internal pure returns (bytes memory) {
        return abi.encodePacked(
            hex"03",
            hex"436f6e747261637444617461", // ContractData
            token,
            addressToBytes32(owner)
        );
    }

    /// @notice Returns a Solana ATA account seeds.
    function getAssociateTokenAccountSeeds(bytes32 owner, bytes32 programId, bytes32 mint) internal pure returns (bytes memory) {
        return abi.encodePacked(
            owner,
            programId,
            mint
        );
    }

    function _reverseShift(uint256 value) internal pure returns (bytes memory) {
        bytes memory shiftedValue = new bytes(8);

        // Calculate the number of bytes that the input value occupies
        uint256 tempValue = value;
        uint256 numBytes = 0;
        while (tempValue > 0) {
            numBytes++;
            tempValue >>= 8;
        }

        // Reverse and shift the bytes to the leftmost position
        for (uint256 i = 0; i < numBytes; i++) {
            shiftedValue[i] = bytes1(uint8(value >> ((numBytes - 1 - i) * 8)));
        }
        return shiftedValue;
    }
}