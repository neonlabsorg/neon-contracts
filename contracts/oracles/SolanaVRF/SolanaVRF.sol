// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../../utils/SolanaDataConverterLib.sol";
import "../../precompiles/QueryAccount.sol";
import "../../precompiles/ICallSolana.sol";


/// @title SolanaVRF
/// @author https://twitter.com/mnedelchev_
/// @notice This contract serves as an interface contract to ORAO’s verifiable random function on Solana.
contract SolanaVRF {
    using SolanaDataConverterLib for bytes;
    using SolanaDataConverterLib for uint64;

    ICallSolana public constant CALL_SOLANA = ICallSolana(0xFF00000000000000000000000000000000000006);
    bytes32 public vrfProgramId = 0x0747b11afa91b4d1f922f27b0ebac1dab23b2129a4bef34f32a47b58f5cefc78;
    bytes32 public vrfNetworkState = 0x3ede735db98b5ca2accac3bc1269e54b5409e5ea2c2bf6b2be0d80db10ee8f8c;
    bytes32 public vrfTreasury = 0x7f2dcd2aa425a24abf0d8fe12b60aa8f4768370d0fd99c738aefe6f2150f03b8;
    bytes public vrfInstructionId = hex"2697d106c3661cd9";

    /// @notice This method serves to request VRF randomness from Solana
    /// @param seed Random generated seed in bytes32 format
    /// @param lamports The SOL amount to be requested from the CALL_SOLANA's payer in order to create the Randomness Solana account
    /// @custom:getter getRandomness
    function requestRandomness(
        bytes32 seed,
        uint64 lamports
    ) external {
        bytes memory accountsList = abi.encodePacked(
            abi.encodePacked(CALL_SOLANA.getPayer(), true, true),
            abi.encodePacked(vrfNetworkState, false, true),
            abi.encodePacked(vrfTreasury, false, true),
            abi.encodePacked(
                randomnessAccountAddress(seed), 
                false, 
                true
            ),
            abi.encodePacked(bytes32(0), false, false) // System program
        );

        CALL_SOLANA.execute(
            lamports,
            abi.encodePacked(
                vrfProgramId, 
                _reverseShift(5), // accountsList length
                accountsList,
                _reverseShift(
                    abi.encodePacked(
                        vrfInstructionId,
                        seed
                    ).length
                ),
                vrfInstructionId,
                seed
            )
        );
    }


    /// @notice This method serves to return the public key of Randomness Solana account
    /// @dev Calculates as PDA([Buffer.from("orao-vrf-randomness-request"), seed], vrf_id)
    /// @param seed Random generated seed in bytes32 format
    function randomnessAccountAddress(bytes32 seed) public view returns(bytes32) {
        return CALL_SOLANA.getSolanaPDA(
            vrfProgramId,
            abi.encodePacked(
                hex"6f72616f2d7672662d72616e646f6d6e6573732d72657175657374", // orao-vrf-randomness-request
                seed
            )
        );
    }

    /// @notice This method serves to read VRF data from Solana
    /// @param solanaAddress The Solana account address from where data will be readen
    /// @param offset The offset in bytes ( starting to read from this byte )
    /// @param len The length of the Solana data account ( stopping to read to this byte )
    /// @return Initiator
    /// @return Seed
    /// @return Randomness
    function getRandomness(bytes32 solanaAddress, uint64 offset, uint64 len) public view returns(bytes32, bytes32, uint64) {
        (bool success, bytes memory data) = QueryAccount.data(uint256(solanaAddress), offset, len);
        require(success, "failed to query account data");

        return (
            data.toBytes32(9), // VRF Initiator publicKey offset
            data.toBytes32(41), // VRF Seed offset
            (data.toUint64(73)).readLittleEndianUnsigned64() // VRF Randomness offset
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