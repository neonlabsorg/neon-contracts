// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ISPLTokenProgram} from "../../precompiles/ISPLTokenProgram.sol";
import {IMetaplexProgram} from "../../precompiles/IMetaplexProgram.sol";
import {ICallSolana} from "../../precompiles/ICallSolana.sol";
import {ISolanaNative} from "../../precompiles/ISolanaNative.sol";
import {QueryAccount} from "../../precompiles/QueryAccount.sol";


/// @title ERC20ForSplBackbone
/// @author https://twitter.com/mnedelchev_
/// @notice This contract serves as a backbone contract for both ERC20ForSpl and ERC20ForSplMintable smart contracts.
contract ERC20ForSplBackbone {
    ISPLTokenProgram public constant SPLTOKEN_PROGRAM = ISPLTokenProgram(0xFf00000000000000000000000000000000000004);
    IMetaplexProgram public constant METAPLEX_PROGRAM = IMetaplexProgram(0xff00000000000000000000000000000000000005);
    ICallSolana public constant CALL_SOLANA = ICallSolana(0xFF00000000000000000000000000000000000006);
    ISolanaNative public constant SOLANA_NATIVE = ISolanaNative(0xfF00000000000000000000000000000000000007);
    bytes32 public constant TOKEN_PROGRAM = 0x06ddf6e1d765a193d9cbe146ceeb79ac1cb485ed5f5b37913a8cf5857eff00a9;
    bytes32 public constant ASSOCIATED_TOKEN_PROGRAM = 0x8c97258f4e2489f1bb3d1029148e0d830b5a1399daff1084048e7bd8dbe9f859;
    bytes32 immutable public tokenMint;
    mapping(address => mapping(address => uint256)) private _allowances;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);
    event ApprovalSolana(address indexed owner, bytes32 indexed spender, uint64 amount);
    event TransferSolana(address indexed from, bytes32 indexed to, uint64 amount);

    /// @notice Request to reading data from Solana account has failed.
    error FailedQueryAccountRequest(bytes32 account);
    /// @notice Passed EVM address is empty.
    error EmptyAddress();
    /// @notice Spending more than the allowed amount.
    error InvalidAllowance();
    /// @notice Requested amount higher than the actual balance.
    error AmountExceedsBalance();
    /// @notice The token mint on Solana has not metadata stored at the Metaplex program.
    error MissingMetaplex();
    /// @notice The token mint on Solana is invalid.
    error InvalidTokenMint();
    /// @notice Invalid token amount. 
    error AmountExceedsUint64();

    /// @notice Returns the name of the SPLToken. The name value is stored in the Metaplex protocol.
    function name() public view returns (string memory) {
        return METAPLEX_PROGRAM.name(tokenMint);
    }

    /// @notice Returns the symbol of the SPLToken. The symbol value is stored in the Metaplex protocol.
    function symbol() public view returns (string memory) {
        return METAPLEX_PROGRAM.symbol(tokenMint);
    }

    /// @notice Returns the decimals of the SPLToken.
    function decimals() public view returns (uint8) {
        return SPLTOKEN_PROGRAM.getMint(tokenMint).decimals;
    }

    /// @notice Returns the totalSupply of the SPLToken.
    function totalSupply() public view returns (uint256) {
        return SPLTOKEN_PROGRAM.getMint(tokenMint).supply;
    }

    /// @notice Returns the SPLToken balance of an address.
    /// @dev Unlike typical ERC20 the balances of ERC20ForSpl are actually stored on Solana, this standard doesn't include balances mapping. There is condition to check if the account is a Neon EVM user or Solana user - if the user is from Solana then his ATA balance is also included into the total balance calculation.
    function balanceOf(address account) public view returns (uint256) {
        uint balance = SPLTOKEN_PROGRAM.getAccount(solanaAccount(account)).amount;
        bytes32 solanaAddress = SOLANA_NATIVE.solanaAddress(account);

        if (solanaAddress != bytes32(0)) {
            bytes32 tokenMintATA = getTokenMintATA(solanaAddress);
            if (!SPLTOKEN_PROGRAM.isSystemAccount(tokenMintATA)) {
                ISPLTokenProgram.Account memory tokenMintATAData = SPLTOKEN_PROGRAM.getAccount(tokenMintATA);
                balance+= (tokenMintATAData.delegated_amount > tokenMintATAData.amount) ? tokenMintATAData.amount : tokenMintATAData.delegated_amount;
            }
        }
        return balance;
    }

    /// @notice Returns the allowances made to Ethereum-like addresses.
    function allowance(address owner, address spender) public view returns (uint256) {
        return _allowances[owner][spender];
    }

    /// @notice ERC20's approve method
    /// @custom:getter allowance
    function approve(address spender, uint256 amount) public returns (bool) {
        if (spender == address(0)) revert EmptyAddress();
        _approve(msg.sender, spender, amount);
        return true;
    }

    /// @notice ERC20's transfer method
    /// @custom:getter balanceOf
    function transfer(address to, uint256 amount) public returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    /// @notice ERC20's transferFrom method. Before calling this method the from address has to approve the msg.sender to manage his tokens.
    /// @custom:getter balanceOf
    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        if (from == address(0)) revert EmptyAddress();
        _spendAllowance(from, msg.sender, amount);
        _transfer(from, to, amount);
        return true;
    }

    /// @notice ERC20's burn method
    /// @custom:getter balanceOf
    function burn(uint256 amount) public returns (bool) {
        _burn(msg.sender, amount);
        return true;
    }

    /// @notice ERC20's burnFrom method. Similar to transferFrom function, this method requires the from address to approve the msg.sender first, before calling burnFrom function
    /// @custom:getter balanceOf
    function burnFrom(address from, uint256 amount) public returns (bool) {
        _spendAllowance(from, msg.sender, amount);
        _burn(from, amount);
        return true;
    }

    /// @notice ERC20ForSpl's approve method
    /// @dev With ERC20ForSpl standard we can also make approvals on Solana-like addresses. These type of records are being stored directly on Solana and they're not being recorded inside the _allowances mapping.
    /// @param spender The Solana-like address in bytes32 of the spender
    /// @param amount The amount to be managed by the spender
    /// @custom:getter getAccountDelegateData
    function approveSolana(bytes32 spender, uint64 amount) public returns (bool) {
        bytes32 fromSolana = solanaAccount(msg.sender);
        if (amount > 0) {
            SPLTOKEN_PROGRAM.approve(fromSolana, spender, amount);
        } else {
            SPLTOKEN_PROGRAM.revoke(fromSolana);
        }

        emit Approval(msg.sender, address(0), amount);
        emit ApprovalSolana(msg.sender, spender, amount);
        return true;
    }

    /// @notice ERC20ForSpl's transfer method
    /// @dev With ERC20ForSpl standard we can also make transfers directly to Solana-like addresses. Balances data is being stored directly on Solana
    /// @param to The Solana-like address in bytes32 of the receiver
    /// @param amount The amount to be transfered to the receiver
    /// @custom:getter balanceOf
    function transferSolana(bytes32 to, uint64 amount) public returns (bool) {
        SPLTOKEN_PROGRAM.transfer(solanaAccount(msg.sender), to, uint64(amount));

        emit Transfer(msg.sender, address(0), amount);
        emit TransferSolana(msg.sender, to, amount);
        return true;
    }

    /// @notice Calling method claimTo with msg.sender to parameter
    /// @param from The Solana-like address in bytes32 of the derived entity
    /// @param amount The amount to be transferred out from the derived entity
    /// @custom:getter balanceOf
    function claim(bytes32 from, uint64 amount) external returns (bool) {
        return claimTo(from, msg.sender, amount);
    }

    /// @notice Initiating transferWithSeed instuction on Solana. Before calling this method the derived address has to approve the method caller ( very similar to ERC20's transferFrom method )
    /// @param from The Solana-like address in bytes32 of the derived entity
    /// @param from The Ethereum-like address of the claimer
    /// @param amount The amount to be transferred out from the derived entity
    /// @custom:getter balanceOf
    function claimTo(bytes32 from, address to, uint64 amount) public returns (bool) {
        bytes32 toSolana = solanaAccount(to);

        if (SPLTOKEN_PROGRAM.isSystemAccount(toSolana)) {
            SPLTOKEN_PROGRAM.initializeAccount(_salt(to), tokenMint);
        }

        SPLTOKEN_PROGRAM.transferWithSeed(_salt(msg.sender), from, toSolana, amount);
        emit Transfer(address(0), to, amount);
        return true;
    }

    /// @notice Internal method to keep records inside the _allowances mapping
    function _approve(address owner, address spender, uint256 amount) internal {
        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    /// @notice Internal method to update the _allowances mapping on spending
    function _spendAllowance(address owner, address spender, uint256 amount) internal {
        uint256 currentAllowance = _allowances[owner][spender];
        if (currentAllowance != type(uint256).max) {
            if (currentAllowance < amount) revert InvalidAllowance();
            _approve(owner, spender, currentAllowance - amount);
        }
    }

    /// @notice Internal method to burn amounts of the SPLToken on Solana
    function _burn(address from, uint256 amount) internal {
        if (from == address(0)) revert EmptyAddress();
        if (amount > type(uint64).max) revert AmountExceedsUint64();

        bytes32 fromSolana = solanaAccount(from);
        if (SPLTOKEN_PROGRAM.getAccount(fromSolana).amount < amount) revert AmountExceedsBalance();
        SPLTOKEN_PROGRAM.burn(tokenMint, fromSolana, uint64(amount));

        emit Transfer(from, address(0), amount);
    }

    /// @notice Internal method to transfer amounts of the SPLToken on Solana.
    function _transfer(address from, address to, uint256 amount) internal {
        if (to == address(0)) revert EmptyAddress();

        bytes32 fromSolanaPDA = solanaAccount(from);
        bytes32 fromSolanaATA;
        bytes32 fromSolanaAccount = SOLANA_NATIVE.solanaAddress(from);
        uint64 getAvailableATABalance;
        if (fromSolanaAccount != bytes32(0)) {
            fromSolanaATA = getTokenMintATA(fromSolanaAccount);
            if (!SPLTOKEN_PROGRAM.isSystemAccount(fromSolanaATA)) {
                ISPLTokenProgram.Account memory tokenMintATAData = SPLTOKEN_PROGRAM.getAccount(fromSolanaATA);
                getAvailableATABalance+= (tokenMintATAData.delegated_amount > tokenMintATAData.amount) ? tokenMintATAData.amount : tokenMintATAData.delegated_amount;
            }
        }

        bytes32 toSolana;
        bytes32 toSolanaAccount = SOLANA_NATIVE.solanaAddress(to);
        if (toSolanaAccount != bytes32(0)) {
            bytes32 toTokenMintATA = getTokenMintATA(toSolanaAccount);
            if (!SPLTOKEN_PROGRAM.isSystemAccount(toTokenMintATA)) {
                toSolana = toTokenMintATA;
            } else {
                toSolana = solanaAccount(to);
            }
        } else {
            toSolana = solanaAccount(to);
        }

        if (SPLTOKEN_PROGRAM.isSystemAccount(toSolana)) {
            SPLTOKEN_PROGRAM.initializeAccount(_salt(to), tokenMint);
        }

        if (amount > type(uint64).max) revert AmountExceedsUint64();
        if (SPLTOKEN_PROGRAM.getAccount(fromSolanaPDA).amount + getAvailableATABalance < amount) revert AmountExceedsBalance();

        // always spending the PDA balance with higher priority
        uint64 amountFromPDA = (uint64(amount) > SPLTOKEN_PROGRAM.getAccount(fromSolanaPDA).amount) ? SPLTOKEN_PROGRAM.getAccount(fromSolanaPDA).amount : uint64(amount);
        uint64 amountFromATA = uint64(amount) - amountFromPDA;

        if (amountFromPDA != 0) {
            SPLTOKEN_PROGRAM.transfer(fromSolanaPDA, toSolana, amountFromPDA);
        }

        if (amountFromATA != 0) {
            SPLTOKEN_PROGRAM.transfer(fromSolanaATA, toSolana, amountFromATA);
        }

        emit Transfer(from, to, amount);
    }

    /// @notice Returns the Solana-like address which is binded to the Ethereum-like address.
    /// @dev When an address interacts for the first time with ERC20ForSpl under the hood there is Solana account creation which is binded to the Ethereum-like address used on Neon chain.
    function solanaAccount(address account) public pure returns (bytes32) {
        return SPLTOKEN_PROGRAM.findAccount(_salt(account));
    }

    /// @notice Returns the allowances made to Solana-like addresses.
    /// @dev Solana's architecture is a bit different compared to Ethereum and we can actually have only 1 delegate account at a time. Every new approval overwrites the previous one.
    function getAccountDelegateData(address account) public view returns(bytes32, uint64) {
        ISPLTokenProgram.Account memory tokenAccount = SPLTOKEN_PROGRAM.getAccount(solanaAccount(account));
        return (tokenAccount.delegate, tokenAccount.delegated_amount);
    }

    /// @notice Returns the tokenMint's ATA for given Solana account.
    /// @param account Account on Solana in bytes32 format
    function getTokenMintATA(bytes32 account) public view returns(bytes32) {
        return CALL_SOLANA.getSolanaPDA(
            ASSOCIATED_TOKEN_PROGRAM,
            abi.encodePacked(
                account,
                TOKEN_PROGRAM,
                tokenMint
            )
        );
    }

    /// @notice Converts an address to uint and then converts uint to bytes32.
    /// @param account Account on Solana in bytes32 format
    function _salt(address account) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(account)));
    }
}


/// @title ERC20ForSpl
/// @author https://twitter.com/mnedelchev_
/// @notice This contract serves as an interface contract of already deployed SPLToken on Solana. Through this interface an Ethereum-like address on Neon EVM chain can apply changes on SPLToken account on Solana.
contract ERC20ForSpl is ERC20ForSplBackbone {
    /// @param _tokenMint The Solana-like address of the Token Mint on Solana
    constructor(bytes32 _tokenMint) {
        if (!SPLTOKEN_PROGRAM.getMint(_tokenMint).isInitialized) revert InvalidTokenMint();
        if (!METAPLEX_PROGRAM.isInitialized(_tokenMint)) revert MissingMetaplex();

        tokenMint = _tokenMint;
    }
}


/// @title ERC20ForSplMintable
/// @author https://twitter.com/mnedelchev_
/// @notice This contract serves as an interface to the deployed SPLToken on Solana. Through this interface, Ethereum-like address on Neon EVM chain can apply changes on SPLToken account on Solana.
contract ERC20ForSplMintable is ERC20ForSplBackbone {
    address immutable _admin;

    /// @param _name The name of the SPLToken
    /// @param _symbol The symbol of the SPLToken
    /// @param _decimals The decimals of the SPLToken. This value cannot be bigger than 9, because of Solana's maximum value limit of uint64
    /// @param _owner The owner of the ERC20ForSplMintable contract which has the permissions to mint new tokens
    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        address _owner
    ) {
        _admin = _owner;

        tokenMint = SPLTOKEN_PROGRAM.initializeMint(bytes32(0), _decimals);
        if (!SPLTOKEN_PROGRAM.getMint(tokenMint).isInitialized) revert InvalidTokenMint();

        METAPLEX_PROGRAM.createMetadata(tokenMint, _name, _symbol, "");
        if (!METAPLEX_PROGRAM.isInitialized(tokenMint)) revert MissingMetaplex();
    }

    /// @notice Unauthorized msg.sender.
    error InvalidOwner();

    /// @notice Returns the Solana address of the Token Mint
    function findMintAccount() public pure returns (bytes32) {
        return SPLTOKEN_PROGRAM.findAccount(bytes32(0));
    }

    /// @notice Mint new SPLToken directly on Solana chain
    /// @custom:getter balanceOf
    function mint(address to, uint256 amount) public {
        if (msg.sender != _admin) revert InvalidOwner();
        if (to == address(0)) revert EmptyAddress();
        if (totalSupply() + amount > type(uint64).max) revert AmountExceedsUint64();

        bytes32 toSolana = solanaAccount(to);
        if (SPLTOKEN_PROGRAM.isSystemAccount(toSolana)) {
            SPLTOKEN_PROGRAM.initializeAccount(_salt(to), tokenMint);
        }

        SPLTOKEN_PROGRAM.mintTo(tokenMint, toSolana, uint64(amount));
        emit Transfer(address(0), to, amount);
    }
}