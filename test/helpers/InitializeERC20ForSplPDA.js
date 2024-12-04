const web3 = require("@solana/web3.js");
const {
    getAssociatedTokenAddress,
    createInitializeMint2Instruction,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    MINT_SIZE,
    createMintToInstruction,
    createAssociatedTokenAccountInstruction
} = require('@solana/spl-token');
const { Metaplex } = require("@metaplex-foundation/js");
const bs58 = require("bs58");
const { createCreateMetadataAccountV3Instruction } = require("@metaplex-foundation/mpl-token-metadata");
require("dotenv").config();

/onst connection = new web3.Connection("https://api.devnet.solana.com", "processed");
//const connection = new web3.Connection(process.env.CURVESTAND_SOL, "processed");

const keypair = web3.Keypair.fromSecretKey(
    bs58.decode(process.env.PRIVATE_KEY_SOLANA)
);
console.log(keypair.publicKey.toBase58(), 'publicKey');

async function init() {
    
    let tx = new web3.Transaction();
    tx.add(
        web3.SystemProgram.allocate({
            accountPubkey: allocatedAccount.publicKey,
            space: 165
        })
    );

    
    await web3.sendAndConfirmTransaction(connection, tx, [keypair]);
    return;
}
init();