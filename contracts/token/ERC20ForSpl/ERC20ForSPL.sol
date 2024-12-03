// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ISPLToken} from '../../precompiles/ISPLToken.sol';
import {IMetaplex} from '../../precompiles/IMetaplex.sol';
import {ICallSolana} from "../../precompiles/ICallSolana.sol";
import {ISolanaNative} from "../../precompiles/ISolanaNative.sol";
import {QueryAccount} from "../../precompiles/QueryAccount.sol";
import {SolanaDataConverterLib} from "../../utils/SolanaDataConverterLib.sol";

contract ERC20ForSpl {
    using SolanaDataConverterLib for *;

    ISPLToken constant SPLToken = ISPLToken(0xFf00000000000000000000000000000000000004);
    IMetaplex constant Metaplex = IMetaplex(0xff00000000000000000000000000000000000005);
    bytes32 immutable public tokenMint;
    mapping(address => mapping(address => uint256)) private _allowances;
    bytes32 public constant TOKEN_PROGRAM = 0x06ddf6e1d765a193d9cbe146ceeb79ac1cb485ed5f5b37913a8cf5857eff00a9;
    bytes32 public constant ASSOCIATED_TOKEN_PROGRAM = 0x8c97258f4e2489f1bb3d1029148e0d830b5a1399daff1084048e7bd8dbe9f859;
    ICallSolana public constant CALL_SOLANA = ICallSolana(0xFF00000000000000000000000000000000000006);
    ISolanaNative constant SolanaNative = ISolanaNative(0xfF00000000000000000000000000000000000007);

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);
    event ApprovalSolana(address indexed owner, bytes32 indexed spender, uint64 amount);
    event TransferSolana(address indexed from, bytes32 indexed to, uint64 amount);

    /// @notice Request to reading data from Solana account has failed.
    error FailedQueryAccountRequest(bytes32 account);

    constructor(bytes32 _tokenMint) {
        require(SPLToken.getMint(_tokenMint).isInitialized, "ERC20: invalid token mint");
        require(Metaplex.isInitialized(_tokenMint), "ERC20: missing MetaPlex metadata");

        tokenMint = _tokenMint;
    }

    function name() public view returns (string memory) {
        return Metaplex.name(tokenMint);
    }

    function symbol() public view returns (string memory) {
        return Metaplex.symbol(tokenMint);
    }

    function decimals() public view returns (uint8) {
        return SPLToken.getMint(tokenMint).decimals;
    }

    function totalSupply() public view returns (uint256) {
        return SPLToken.getMint(tokenMint).supply;
    }

    function balanceOf(address account) public view returns (uint256) {
        uint balance = SPLToken.getAccount(solanaAccount(account)).amount;
        bytes32 solanaAddress = SolanaNative.solanaAddress(account);

        if (solanaAddress != bytes32(0)) {
            bytes32 tokenMintATA = getTokenMintATA(solanaAddress);
            if (!SPLToken.isSystemAccount(tokenMintATA)) {
                (bool success, bytes memory data) = QueryAccount.data(uint256(tokenMintATA), 0, 165);
                require(success, FailedQueryAccountRequest(tokenMintATA));
                uint64 tokenMintATABalance = (data.toUint64(64)).readLittleEndianUnsigned64();
                uint64 tokenMintATAApproved = (data.toUint64(121)).readLittleEndianUnsigned64();

                if (tokenMintATAApproved > 0) {
                    balance+= (tokenMintATAApproved > tokenMintATABalance) ? tokenMintATABalance : tokenMintATAApproved;
                }
            }
        }
        return balance;
    }

    function allowance(address owner, address spender) public view returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) public returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }


    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        _spendAllowance(from, msg.sender, amount);
        _transfer(from, to, amount);
        return true;
    }

    function burn(uint256 amount) public returns (bool) {
        _burn(msg.sender, amount);
        return true;
    }


    function burnFrom(address from, uint256 amount) public returns (bool) {
        _spendAllowance(from, msg.sender, amount);
        _burn(from, amount);
        return true;
    }

    
    function approveSolana(bytes32 spender, uint64 amount) public returns (bool) {
        bytes32 fromSolana = solanaAccount(msg.sender);
        if (amount > 0) {
            SPLToken.approve(fromSolana, spender, amount);
        } else {
            SPLToken.revoke(fromSolana);
        }

        emit Approval(msg.sender, address(0), amount);
        emit ApprovalSolana(msg.sender, spender, amount);
        return true;
    }

    function transferSolana(bytes32 to, uint64 amount) public returns (bool) {
        SPLToken.transfer(solanaAccount(msg.sender), to, uint64(amount));

        emit Transfer(msg.sender, address(0), amount);
        emit TransferSolana(msg.sender, to, amount);
        return true;
    }

    function claim(bytes32 from, uint64 amount) external returns (bool) {
        return claimTo(from, msg.sender, amount);
    }

    function claimTo(bytes32 from, address to, uint64 amount) public returns (bool) {
        bytes32 toSolana = solanaAccount(to);

        if (SPLToken.isSystemAccount(toSolana)) {
            SPLToken.initializeAccount(salt(to), tokenMint);
        }

        SPLToken.transferWithSeed(salt(msg.sender), from, toSolana, amount);
        emit Transfer(address(0), to, amount);
        return true;
    }

    function _approve(address owner, address spender, uint256 amount) internal {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _spendAllowance(address owner, address spender, uint256 amount) internal {
        uint256 currentAllowance = allowance(owner, spender);
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "ERC20: insufficient allowance");
            _approve(owner, spender, currentAllowance - amount);
        }
    }

    function _burn(address from, uint256 amount) internal {
        require(from != address(0), "ERC20: burn from the zero address");
        require(amount <= type(uint64).max, "ERC20: burn amount exceeds uint64 max");

        bytes32 fromSolana = solanaAccount(from);

        require(SPLToken.getAccount(fromSolana).amount >= amount, "ERC20: burn amount exceeds balance");
        SPLToken.burn(tokenMint, fromSolana, uint64(amount));

        emit Transfer(from, address(0), amount);
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "ERC20: transfer from the zero address");
        require(to != address(0), "ERC20: transfer to the zero address");

        bytes32 fromSolana;
        bytes32 fromSolanaAccount = SolanaNative.solanaAddress(from);
        if (fromSolanaAccount != bytes32(0)) {
            bytes32 fromTokenMintATA = getTokenMintATA(fromSolanaAccount);
            if (!SPLToken.isSystemAccount(fromTokenMintATA)) {
                fromSolana = fromTokenMintATA;
            } else {
                fromSolana = solanaAccount(from);
            }
        } else {
            fromSolana = solanaAccount(from);
        }

        bytes32 toSolana;
        bytes32 toSolanaAccount = SolanaNative.solanaAddress(to);
        if (toSolanaAccount != bytes32(0)) {
            bytes32 toTokenMintATA = getTokenMintATA(toSolanaAccount);
            if (!SPLToken.isSystemAccount(toTokenMintATA)) {
                toSolana = toTokenMintATA;
            } else {
                toSolana = solanaAccount(to);
            }
        } else {
            toSolana = solanaAccount(to);
        }

        if (SPLToken.isSystemAccount(toSolana)) {
            SPLToken.initializeAccount(salt(to), tokenMint);
        }

        require(amount <= type(uint64).max, "ERC20: transfer amount exceeds uint64 max");
        require(SPLToken.getAccount(fromSolana).amount >= amount, "ERC20: transfer amount exceeds balance");

        SPLToken.transfer(fromSolana, toSolana, uint64(amount));
        emit Transfer(from, to, amount);
    }

    function salt(address account) public pure returns (bytes32) {
        return bytes32(uint256(uint160(account)));
    }

    function solanaAccount(address account) public pure returns (bytes32) {
        return SPLToken.findAccount(salt(account));
    }

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
}

contract ERC20ForSplMintable is ERC20ForSpl {
    address immutable _admin;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        address _mint_authority
    ) ERC20ForSpl(_initialize(_name, _symbol, _decimals)) {
        _admin = _mint_authority;
    }

    function findMintAccount() public pure returns (bytes32) {
        return SPLToken.findAccount(bytes32(0));
    }

    function mint(address to, uint256 amount) public {
        require(msg.sender == _admin, "ERC20: must have minter role to mint");
        require(to != address(0), "ERC20: mint to the zero address");
        require(amount <= type(uint64).max, "ERC20: mint amount exceeds uint64 max");
        require(totalSupply() + amount <= type(uint64).max, "ERC20: total mint amount exceeds uint64 max");

        bytes32 toSolana = solanaAccount(to);
        if (SPLToken.isSystemAccount(toSolana)) {
            SPLToken.initializeAccount(salt(to), tokenMint);
        }

        SPLToken.mintTo(tokenMint, toSolana, uint64(amount));
        emit Transfer(address(0), to, amount);
    }

    function _initialize(
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) private returns (bytes32) {
        bytes32 mintAddress = SPLToken.initializeMint(bytes32(0), _decimals);
        Metaplex.createMetadata(mintAddress, _name, _symbol, "");
        return mintAddress;
    }
}