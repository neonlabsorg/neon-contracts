# ERC20ForSPL standard

The **ERC20ForSPL** standard provides a standard **ERC20** interface supplemented with custom functions and variables 
providing compatibility with _Solana_'s **SPL Token** interface. This standard allows _NeonEVM_ users and dApps to 
interact with **ERC20** tokens deployed on _NeonEVM_ as well as native _Solana_ SPL tokens.

## ERC20ForSPL vs ERC20ForSPLMintable contracts

The **ERC20ForSPL** contract should be deployed on _NeonEVM_ as an interface to interact with already deployed, native 
**SPL Token** on _Solana_. 

On the other hand, when deploying the **ERC20ForSPLMintable** contract on _NeonEVM_, a new **SPL Token** is deployed on 
_Solana_ and its administrator is given permission to mint new tokens.

## ERC20ForSPLFactory contract

The **ERC20ForSPLFactory** contract should be used to deploy new instances of both **ERC20ForSPL** and 
**ERC20ForSPLMintable** contracts on _NeonEVM_ by calling the `createErc20ForSpl` and `createErc20ForSplMintable` 
functions respectively.

**ERC20ForSPLFactory** is already deployed on _Neon mainnet_ and _Neon devnet_:

| Network        | ERC20ForSPLFactory contract address          |
|----------------|----------------------------------------------|
| _Neon mainnet_ | `0x6B226a13F5FE3A5cC488084C08bB905533804720` |
| _Neon devnet_  | `0xF6b17787154C418d5773Ea22Afc87A95CAA3e957` |


## Custom functions and variables

| bytes32 tokenMint                                                   |
|:--------------------------------------------------------------------|
| Hex-encoded 32 bytes address of the underlying _Solana_ SPL Token.  |

| **transferSolana**(bytes32 to, uint64 amount) → bool                                                                                                                          |
|:------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Transfers to a _Solana_ SPL Token account. <br/><br/>`to` The 32 bytes SPL Token account address of the recipient <br/>`amount` The amount to be transferred to the recipient |

| **transferSolanaFrom**(address from, bytes32 to, uint64 amount) → bool                                                                                                                                                                                                                                                                                 |
|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Spends the ERC20 allowance provided by the `from` account to `msg.sender` by transferring to a _Solana_ SPL Token account. <br/><br/>`from` The address of the _NeonEVM_ account that provided allowance to `msg.sender` <br/>`to` The 32 bytes SPL Token account address of the recipient <br/>`amount` The amount to be transferred to the recipient |

| **approveSolana**(bytes32 spender, uint64 amount) → bool                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
|:---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Provides SPL Token delegation to a _Solana_ SPL Token account. Token delegation is similar to an ERC20 allowance but it is not stored in the ERC20 `_allowances` mapping and can only be spent using the `claim` or `claimTo` functions. The SPL Token standard's concept of delegation differs from ERC20 allowances in that it is only possible to delegate to one single SPL Token account and subsequent delegations will erase previous delegations.<br/><br/>`spender` The 32 bytes address of the delegate account, i.e. the _Solana_ SPL Token account to be approved <br/>`amount` The amount to be delegated to the delegate |

| **claim**(bytes32 from, uint64 amount) → bool                                                                                                                                                                                                                                                                                                                                                                              |
|:---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Spends the SPL Token delegation provided  by the `from` _Solana_ SPL Token account to the _NeonEVM_ arbitrary token account attributed to `msg.sender`<br/><br/>`from` The 32 bytes SPL Token account address which provided delegation to the _NeonEVM_ arbitrary token account attributed to `msg.sender` <br/>`amount` The amount to be transferred to the _NeonEVM_ arbitrary token account attributed to `msg.sender` |

| **claimTo**(bytes32 from, address to, uint64 amount) → bool                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Spends the SPL Token delegation provided  by the `from` _Solana_ SPL Token account to the _NeonEVM_ arbitrary token account attributed to `msg.sender` and transfers to the _NeonEVM_ arbitrary token account attributed to the `to` address<br/><br/>`from` The 32 bytes SPL Token account address which provided delegation to the _NeonEVM_ arbitrary token account attributed to `msg.sender`  <br/>`to` The _NeonEVM_ address of the recipient <br/>`amount` The amount to be transferred to the _NeonEVM_ arbitrary token account attributed to `msg.sender` |

| **solanaAccount**(address account) → bytes32                                                                                                                                                                                                                     |
|:-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Returns the 32 bytes address of the arbitrary token account attributed to the `account` address by _NeonEVM_.<br/><br/>`account` The address of the account for which we want to get the 32 bytes address of the arbitrary token account attributed by _NeonEVM_ |

| **getAccountDelegateData**(address account) → (bytes32, uint64)                                                                                                                                                                                                                                                                                                                                                                                                                                             |
|:------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Returns the 32 bytes _Solana_ SPL Token account address of the delegate and the amount that was delegated to that delegate by the _NeonEVM_ arbitrary token account attributed to the `account` address. Returned data corresponds to SPL Token delegation only and does not include any ERC20 allowances provided by the `account` address.<br/><br/>`account` The address of the account to which _NeonEVM_ has attributed an arbitrary token account for which we want to get SPL Token delegation data. |

| **getTokenMintATA**(bytes32 account) → bytes32                                                                                                                                                                                                                                                     |
|:---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Returns the 32 bytes SPL Token associated token account (ATA) address for this contract's `tokenMint` and provided _Solana_ account address.<br/><br/>`account` The 32 bytes _Solana_ address of the account for which we want to get the address of the SPL Token associated token account (ATA). |

## Solana native support

_NeonEVM_ now supports transactions scheduling for native _Solana_ users. Using the **Neon dApp** website, native 
_Solana_ accounts are attributed a _NeonEVM_ account and can easily schedule _NeonEVM_ transactions, signing with their 
_Solana_ account. Scheduled transactions are then picked-up by Neon proxies and executed on _NeonEVM_.

This _Solana native_ feature of _NeonEVM_ allows native _Solana_ users to seamlessly execute state-mutative transactions 
on _NeonEVM_ from their native Solana wallet.
