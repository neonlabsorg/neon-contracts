// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IERC20ForSPL {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract MockVault {
    address public immutable ERC20ForSPLAddress;

    constructor(address _ERC20ForSPLAddress) {
        ERC20ForSPLAddress = _ERC20ForSPLAddress;
    }

    event Deposit(address indexed msgSender, uint256 amount);

    function deposit(uint256 amount) external {
        IERC20ForSPL(ERC20ForSPLAddress).transferFrom(msg.sender, address(this), amount);
        emit Deposit(msg.sender, amount);
    }
}