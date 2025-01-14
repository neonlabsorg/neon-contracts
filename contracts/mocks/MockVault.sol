// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IERC20ForSPL {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    function transferSolanaFrom(address from, bytes32 to, uint64 amount) external returns (bool);
}

contract MockVault {
    address public immutable ERC20ForSPLAddress;

    constructor(address _ERC20ForSPLAddress) {
        ERC20ForSPLAddress = _ERC20ForSPLAddress;
    }

    event Deposit(address indexed msgSender, uint256 amount);

    event DepositToSolana(address indexed msgSender, bytes32 indexed account, uint64 amount);

    function deposit(uint256 amount) external {
        IERC20ForSPL(ERC20ForSPLAddress).transferFrom(msg.sender, address(this), amount);
        emit Deposit(msg.sender, amount);
    }

    // method that mimic erc20forspl token usage with composability where tokens are being taken from msg.sender and directly sent to Token account on Solana
    function depositToSolana(uint64 amount, bytes32 to) external {
        IERC20ForSPL(ERC20ForSPLAddress).transferSolanaFrom(msg.sender, to, amount);
        emit DepositToSolana(msg.sender, to, amount);
    }
}