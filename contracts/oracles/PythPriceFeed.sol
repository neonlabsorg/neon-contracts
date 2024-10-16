// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../utils/SolanaDataConverterLib.sol";
import "../precompiles/QueryAccount.sol";


/// @author https://twitter.com/mnedelchev_
/// @custom:oz-upgrades-unsafe-allow constructor
contract PythPriceFeed is OwnableUpgradeable, UUPSUpgradeable {
    using SolanaDataConverterLib for bytes;
    using SolanaDataConverterLib for uint64;

    bytes32 public PYTH_PRICE_FEED_ACCOUNT;

    error InvalidPriceFeedData();

    /// @notice Disabling the initializers to prevent the implementation getting hijacked
    constructor() {
        _disableInitializers();
    }

    function initialize(bytes32 _PYTH_PRICE_FEED_ACCOUNT) public initializer {       
        __Ownable_init(msg.sender);

        PYTH_PRICE_FEED_ACCOUNT = _PYTH_PRICE_FEED_ACCOUNT;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function latestRoundData() external view returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
    ) {
        (bool success, bytes memory data) = QueryAccount.data(
            uint256(PYTH_PRICE_FEED_ACCOUNT), 
            0, 
            134
        );
        require(success, InvalidPriceFeedData());

        int64 price = (data.toUint64(73)).readLittleEndianSigned64();
        int64 publishTime = (data.toUint64(93)).readLittleEndianSigned64();
        roundId = uint80(int80(publishTime));

        return (
            roundId,
            int256(price),
            uint256(int256(publishTime)),
            uint256(int256(publishTime)),
            roundId
        );
    }
}