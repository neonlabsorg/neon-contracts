// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ISolanaNative} from "../../precompiles/ISolanaNative.sol";


contract TemporaryHelper {
    ISolanaNative public constant SOLANA_NATIVE = ISolanaNative(0xfF00000000000000000000000000000000000007);

    function solanaAddress(address account) external view returns(bytes32) {
        return SOLANA_NATIVE.solanaAddress(account);
    }

    function isSolanaUser(address account) external view returns(bool) {
        return SOLANA_NATIVE.isSolanaUser(account);
    }
}