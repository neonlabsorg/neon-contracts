// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../../utils/SolanaDataConverterLib.sol";
import "../../precompiles/QueryAccount.sol";


/// @author https://twitter.com/mnedelchev_
/// @custom:oz-upgrades-unsafe-allow constructor
contract PythAggregatorV3 is OwnableUpgradeable, UUPSUpgradeable {
    using SolanaDataConverterLib for bytes;
    using SolanaDataConverterLib for uint32;
    using SolanaDataConverterLib for uint64;

    bytes32 public priceId;
    bytes32 public priceFeedSolanaAccount;

    error InvalidPriceFeedData();

    /// @notice Disabling the initializers to prevent the implementation getting hijacked
    constructor() {
        _disableInitializers();
    }

    function initialize(bytes32 _priceId, bytes32 _priceFeedSolanaAccount) public initializer {       
        __Ownable_init(msg.sender);

        priceId = _priceId;
        priceFeedSolanaAccount = _priceFeedSolanaAccount;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function _getPythDataFromSolana() internal view returns(int64, int64, int32) {
        (bool success, bytes memory data) = QueryAccount.data(
            uint256(priceFeedSolanaAccount), 
            0, 
            134
        );
        require(success, InvalidPriceFeedData());

        int64 price = (data.toUint64(73)).readLittleEndianSigned64(); // 73 bytes is the offset of the price value inside the Pyth's price feed account on Solana
        int64 publishTime = (data.toUint64(93)).readLittleEndianSigned64(); // 93 bytes is the offset of the publish_time value inside the Pyth's price feed account on Solana
        int32 expo = (data.toUint32(89)).readLittleEndianSigned32(); // 89 bytes is the offset of the exponent value inside the Pyth's price feed account on Solana

        return (price, publishTime, expo);
    }

    function decimals() public view virtual returns (uint8) {
        (, , int32 expo) = _getPythDataFromSolana();
        return uint8(-1 * int8(expo));
    }

    function description() public pure returns (string memory) {
        return "A port of a chainlink aggregator powered by pyth network feeds";
    }

    function version() public pure returns (uint256) {
        return 1;
    }

    function latestAnswer() public view virtual returns (int256) {
        (int64 price, ,) = _getPythDataFromSolana();
        return int256(price);
    }

    function latestTimestamp() public view returns (uint256) {
        (, int64 publishTime, ) = _getPythDataFromSolana();
        return uint256(int256(publishTime));
    }

    function latestRound() public view returns (uint256) {
        // use timestamp as the round id
        return latestTimestamp();
    }

    function getAnswer(uint256) public view returns (int256) {
        return latestAnswer();
    }

    function getTimestamp(uint256) external view returns (uint256) {
        return latestTimestamp();
    }

    function getRoundData(uint80 _roundId) external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        (int64 price, int64 publishTime, ) = _getPythDataFromSolana();
        return (
            _roundId,
            int256(price),
            uint256(int256(publishTime)),
            uint256(int256(publishTime)),
            _roundId
        );
    }


    function latestRoundData() external view returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
    ) {
        (int64 price, int64 publishTime, ) = _getPythDataFromSolana();
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