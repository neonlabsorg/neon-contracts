// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "../utils/SolanaDataConverterLib.sol";
import "../precompiles/QueryAccount.sol";


contract PythPriceFeeds {
    using SolanaDataConverterLib for bytes;
    using SolanaDataConverterLib for uint64;

    bytes32 public immutable PYTH_PRICE_FEED_ACCOUNT;

    constructor(bytes32 _PYTH_PRICE_FEED_ACCOUNT) {
        PYTH_PRICE_FEED_ACCOUNT = _PYTH_PRICE_FEED_ACCOUNT;
    }

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
        require(success, "failed to query account data");

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