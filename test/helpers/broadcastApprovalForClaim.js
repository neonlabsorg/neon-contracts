const web3 = require("@solana/web3.js");
const {
    getAssociatedTokenAddress,
    createApproveInstruction,
} = require('@solana/spl-token');
const bs58 = require("bs58");
require("dotenv").config();

//const connection = new web3.Connection("https://api.devnet.solana.com", "processed");
const connection = new web3.Connection(process.env.CURVESTAND_SOL, "processed");

const keypair = web3.Keypair.fromSecretKey(
    bs58.decode(process.env.PRIVATE_KEY_SOLANA)
);
console.log(keypair.publicKey.toBase58(), 'publicKey');

async function init() {
    const tokenMint = new web3.PublicKey('Gbb4zD39NupDG4ZEM73GmXLMBPS1CqPnPZpxcQUToizq');
    const ERC20ForSPL = '0xb475b459418a9A076e0872E1eF4D825848051b10'; // EVM address for erc20forspl contract
    const userAddress = '0xAB1c34b53F12980a4fa9043B70c864CEE6891c0C'; // EVM address for the user

    const neon_getEvmParamsRequest = await fetch(process.env.CURVESTAND, {
        method: 'POST',
        body: JSON.stringify({"method":"neon_getEvmParams","params":[],"id":1,"jsonrpc":"2.0"}),
        headers: { 'Content-Type': 'application/json' }
    });
    const neon_getEvmParams = await neon_getEvmParamsRequest.json();

    const keypairTokenAta = await getAssociatedTokenAddress(
        tokenMint,
        keypair.publicKey,
        false
    );
    console.log(keypairTokenAta, 'keypairTokenAta');

    const neonAccountAddressBytes = Buffer.concat([Buffer.alloc(12), Buffer.from(isValidHex(userAddress) ? userAddress.substring(2) : userAddress, 'hex')]);
    const seed = [
        new Uint8Array([0x03]),
        new Uint8Array(Buffer.from('AUTH', 'utf-8')),
        Buffer.from(ERC20ForSPL.substring(2), 'hex'),
        Buffer.from(neonAccountAddressBytes, 'hex')
    ];
    const delegatedPda = web3.PublicKey.findProgramAddressSync(seed, new web3.PublicKey(neon_getEvmParams.result.neonEvmProgramId));
    console.log(delegatedPda, 'delegatedPda');

    const tx = new web3.Transaction();
    tx.add(
        createApproveInstruction(
            keypairTokenAta,
            delegatedPda[0],
            keypair.publicKey,
            '18446744073709551615' // max uint64
        )
    );

    await web3.sendAndConfirmTransaction(connection, tx, [keypair]);
    return;
}
init();

function isValidHex(hex) {
    const isHexStrict = /^(0x)?[0-9a-f]*$/i.test(hex.toString());
    if (!isHexStrict) {
        throw new Error(`Given value "${hex}" is not a valid hex string.`);
    } else {
        return isHexStrict;
    }
}