# Solana VRF on Neon EVM

### On-chain VRF
The following smart contract is an interface to existing [VRF functionality](https://orao.network/solana-vrf) provided by Orao Network program on Solana. Smart contract methods:
* `requestRandomness` - this method is requested whenever a VRF value has to be generated
* `getRandomness` - this method is a getter and returns the VRF value once it's being fulfilled
* `randomnessAccountAddress` - this method is a getter and returns the account where the fulfilled VRF value will be stored

You can interact with this smart contract at [https://neonscan.org/address/0xdbb9e8b20020F306465C7D116E8F192266c4Bc31#contract](https://neonscan.org/address/0xdbb9e8b20020F306465C7D116E8F192266c4Bc31#contract).

### Off-chain subscription to fulfilled randomness
```
const { AnchorProvider } = require("@coral-xyz/anchor");
const { Orao } = require("@orao-network/solana-vrf");
const provider = AnchorProvider.env();
const vrf = new Orao(provider);

const seed = 'Buffer_OR_Uint8Array_SEED';
const randomness = await vrf.waitFulfilled(seed);
console.log(Buffer.from(randomness.randomness).readBigUInt64LE(), 'randomness');
```