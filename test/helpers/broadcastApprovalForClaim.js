const web3 = require("@solana/web3.js");
const { ethers } = require("hardhat");
const {
    getAssociatedTokenAddress,
    createApproveInstruction,
} = require('@solana/spl-token');
const bs58 = require("bs58");
const { config } = require('../config');
require("dotenv").config();

const connection = new web3.Connection(process.env.SVM_NODE, "processed");

const solanaUser4 = web3.Keypair.fromSecretKey( // Solana user with tokens balance for airdropping tokens
    bs58.decode(process.env.PRIVATE_KEY_SOLANA_4)
);
console.log(solanaUser4.publicKey.toBase58(), 'publicKey');

async function init() {
    const tokenMint = new web3.PublicKey(config.DATA.ADDRESSES.ERC20ForSplTokenMint);
    const ERC20ForSPL = config.DATA.ADDRESSES.ERC20ForSpl;

    const neon_getEvmParamsRequest = await fetch(process.env.EVM_NODE, {
        method: 'POST',
        body: JSON.stringify({"method":"neon_getEvmParams","params":[],"id":1,"jsonrpc":"2.0"}),
        headers: { 'Content-Type': 'application/json' }
    });
    const neon_getEvmParams = await neon_getEvmParamsRequest.json();

    const solanaUser4TokenAta = await getAssociatedTokenAddress(
        tokenMint,
        solanaUser4.publicKey,
        false
    );
    console.log(solanaUser4TokenAta, 'solanaUser4TokenAta');

    const delegatedPdaUser1 = config.utils.calculatePdaAccount(
        'AUTH',
        ERC20ForSPL,
        new ethers.Wallet(process.env.PRIVATE_KEY_OWNER, ethers.provider).address,
        new web3.PublicKey(neon_getEvmParams.result.neonEvmProgramId)
    );

    const tx = new web3.Transaction();
    tx.add(
        createApproveInstruction(
            solanaUser4TokenAta,
            delegatedPdaUser1[0],
            solanaUser4.publicKey,
            '18446744073709551615' // max uint64
        )
    );

    await web3.sendAndConfirmTransaction(connection, tx, [solanaUser4]);
    return;
}
init();