// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title CallSolanaValidationLib
/// @notice This contract serves as a helper library when interacting with precompile CallSolana ( 0xFF00000000000000000000000000000000000006 )
/// @author https://twitter.com/mnedelchev_
library CallSolanaHelperLib {
    /// @notice This method prepares Solana's instruction data into bincode serialized format
    /// @param programId The programId of the instruction
    /// @param accounts The instruction accounts list in bytes32 format
    /// @param isSigner List of bool format containing info if the particular account is signer
    /// @param isWritable List of bool format containing info if the particular account is writable
    /// @param instructionData The instruction data
    function prepareSolanaInstruction(
        bytes32 programId,
        bytes32[] memory accounts,
        bool[] memory isSigner,
        bool[] memory isWritable,
        bytes memory instructionData
    ) internal pure returns (bytes memory) {
        bytes memory programIdAndAccounts;
        assembly {
            // define the accounts length
            let accountsLen := mload(accounts)
            
            // Get the free memory pointer
            programIdAndAccounts := mload(0x40) // Load the current free memory pointer
            
            let dataLength := add(8, add(8, mul(accountsLen, 34)))
            // Set the new free memory pointer to accommodate the new bytes variable
            mstore(0x40, add(programIdAndAccounts, add(dataLength, 0x20))) // Update free memory pointer

            // Store the length of the bytes array at the beginning
            mstore(programIdAndAccounts, dataLength)

            let dataPtr := add(programIdAndAccounts, 0x20)

            // add accounts length
            mstore8(dataPtr, accountsLen)
            dataPtr := add(dataPtr, 8)
            
            // add accounts
            for { 
                let i := 0 // Initialize the loop variable
            } lt(i, accountsLen) { 
                i := add(i, 1) // Increment the loop variable
            } {
                mstore(dataPtr, mload(add(accounts, add(0x20, mul(i, 0x20)))))
                mstore8(add(dataPtr, 32), mload(add(isSigner, add(0x20, mul(i, 0x20)))))
                mstore8(add(dataPtr, 33), mload(add(isWritable, add(0x20, mul(i, 0x20)))))
                dataPtr := add(dataPtr, 34)
            }

            // add instruction data length
            mstore8(dataPtr, mload(instructionData))
            dataPtr := add(dataPtr, 8) 
        }

        return abi.encodePacked(
            programId,
            programIdAndAccounts,
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