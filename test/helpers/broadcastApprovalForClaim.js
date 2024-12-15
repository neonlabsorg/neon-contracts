const web3 = require("@solana/web3.js");
const {
    getAssociatedTokenAddress,
    createApproveInstruction,
} = require('@solana/spl-token');
const bs58 = require("bs58");
const { config } = require('../config');
require("dotenv").config();

const connection = new web3.Connection(process.env.CURVESTAND_SOL, "processed");

const keypair = web3.Keypair.fromSecretKey(
    bs58.decode(process.env.PRIVATE_KEY_SOLANA)
);
console.log(keypair.publicKey.toBase58(), 'publicKey');

async function init() {
    const tokenMint = new web3.PublicKey(config.DATA.ADDRESSES.ERC20ForSplTokenMint);
    const ERC20ForSPL = config.DATA.ADDRESSES.ERC20ForSpl;
    const userAddress = '0x029158417ee0da19f0561e09302429fb9ebf1af7';

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

    const delegatedPda = config.utils.calculatePdaAccount(
        'AUTH',
        ERC20ForSPL,
        userAddress,
        new web3.PublicKey(neon_getEvmParams.result.neonEvmProgramId)
    );
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