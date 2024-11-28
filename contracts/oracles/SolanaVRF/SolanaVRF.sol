// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../../utils/SolanaDataConverterLib.sol";
import "../../utils/CallSolanaHelperLib.sol";
import "../../precompiles/QueryAccount.sol";
import "../../precompiles/ICallSolana.sol";

/// @title SolanaVRF
/// @author https://twitter.com/mnedelchev_
/// @notice This contract serves as an interface contract to ORAO’s verifiable random function on Solana.
contract SolanaVRF {
    using SolanaDataConverterLib for *;

    ICallSolana public constant CALL_SOLANA = ICallSolana(0xFF00000000000000000000000000000000000006);
    bytes32 public vrfProgramId = 0x0747b11afa91b4d1f922f27b0ebac1dab23b2129a4bef34f32a47b58f5cefc78;
    bytes32 public vrfNetworkState = 0x3ede735db98b5ca2accac3bc1269e54b5409e5ea2c2bf6b2be0d80db10ee8f8c;
    bytes32 public vrfTreasury = 0x7f2dcd2aa425a24abf0d8fe12b60aa8f4768370d0fd99c738aefe6f2150f03b8;
    bytes public vrfInstructionId = hex"2697d106c3661cd9";
    uint64 public fulfilledAccountLength = 137;

    /// @notice The Randomness account on Solana is not fulfilled yet.
    error RandomnessAccountNotFulfilled();

    /// @notice The Randomness account on Solana is invalid.
    error InvalidRandomnessAccount();

    /// @notice The Randomness account on Solana is created, but still not fulfilled.
    error InvalidRandomnessValue();

    /// @notice This method serves to request VRF randomness from Solana
    /// @param seed Random generated seed in bytes32 format
    /// @param lamports The SOL amount to be requested from the CALL_SOLANA's payer in order to create the Randomness Solana account
    /// @custom:getter getRandomness
    function requestRandomness(
        bytes32 seed,
        uint64 lamports
    ) external {
        bytes32[] memory accounts = new bytes32[](5);
        accounts[0] = CALL_SOLANA.getPayer();
        accounts[1] = vrfNetworkState;
        accounts[2] = vrfTreasury;
        accounts[3] = randomnessAccountAddress(seed);
        accounts[4] = bytes32(0); // System program

        bool[] memory isSigner = new bool[](5);
        isSigner[0] = true;
        isSigner[1] = false;
        isSigner[2] = false;
        isSigner[3] = false;
        isSigner[4] = false;

        bool[] memory isWritable = new bool[](5);
        isWritable[0] = true;
        isWritable[1] = true;
        isWritable[2] = true;
        isWritable[3] = true;
        isWritable[4] = false;

        CALL_SOLANA.execute(
            lamports,
            CallSolanaHelperLib.prepareSolanaInstruction(
                vrfProgramId,
                accounts,
                isSigner,
                isWritable,
                abi.encodePacked(
                    vrfInstructionId,
                    seed
                )
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
    /// @param seed The seed you've previously passed at method requestRandomness
    /// @return Initiator
    /// @return Seed
    /// @return Randomness
    function getRandomness(bytes32 seed) public view returns(bytes32, bytes32, uint64) {
        (bool success, uint256 length) = QueryAccount.length(uint256(randomnessAccountAddress(seed)));
        require(success && length == fulfilledAccountLength, RandomnessAccountNotFulfilled());

        bytes memory data;
        (success, data) = QueryAccount.data(uint256(randomnessAccountAddress(seed)), 0, fulfilledAccountLength);
        require(success, InvalidRandomnessAccount());

        uint64 vrfValue = (data.toUint64(73)).readLittleEndianUnsigned64();
        require(vrfValue > 0, InvalidRandomnessValue());

        return (
            data.toBytes32(9), // VRF Initiator publicKey offset
            data.toBytes32(41), // VRF Seed offset
            vrfValue // VRF Randomness value
        );
    }
}