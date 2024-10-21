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
        bytes[] memory accounts = new bytes[](5);
        accounts[0] = abi.encodePacked(CALL_SOLANA.getPayer(), true, true);
        accounts[1] = abi.encodePacked(vrfNetworkState, false, true);
        accounts[2] = abi.encodePacked(vrfTreasury, false, true);
        accounts[3] = abi.encodePacked(
            randomnessAccountAddress(seed), 
            false, 
            true
        );
        accounts[4] = abi.encodePacked(bytes32(0), false, false); // System program

        CALL_SOLANA.execute(
            lamports,
            CallSolanaHelperLib.prepareSolanaInstruction(
                vrfProgramId,
                accounts,
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
        (bool success, bytes memory data) = QueryAccount.data(uint256(randomnessAccountAddress(seed)), 0, 137); // 137 is the total bytes size of Randomness account
        require(success, InvalidRandomnessAccount());
        require((data.toUint64(73)).readLittleEndianUnsigned64() > 0, InvalidRandomnessValue());

        return (
            data.toBytes32(9), // VRF Initiator publicKey offset
            data.toBytes32(41), // VRF Seed offset
            (data.toUint64(73)).readLittleEndianUnsigned64() // VRF Randomness offset
        );
    }
}