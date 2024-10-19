# Solana VRF on Neon EVM

The following smart contract is an interface to existing [VRF functionality](https://orao.network/solana-vrf) provided by Orao Network program on Solana. Smart contract methods:
* `requestRandomness` - this method is requested whenever a VRF value has to be generated
* `getRandomness` - this method is a getter and returns the VRF value once it's being fulfilled
* `randomnessAccountAddress` - this method is a getter and returns the account where the fulfilled VRF value will be stored

You can interact with this smart contract at [https://neonscan.org/address/0x012ae45ba073958a37f3f7595ada016ae6c4b520#contract](https://neonscan.org/address/0x012ae45ba073958a37f3f7595ada016ae6c4b520#contract).