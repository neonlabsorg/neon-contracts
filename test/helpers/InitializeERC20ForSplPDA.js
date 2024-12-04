const web3 = require("@solana/web3.js");
const {
    getAssociatedTokenAddress,
    TOKEN_PROGRAM_ID,
    createInitializeAccount2Instruction,
    createTransferInstruction
} = require('@solana/spl-token');
const bs58 = require("bs58");
require("dotenv").config();

const connection = new web3.Connection("https://api.devnet.solana.com", "processed");
//const connection = new web3.Connection(process.env.CURVESTAND_SOL, "processed");

const keypair = web3.Keypair.fromSecretKey(
    bs58.decode(process.env.PRIVATE_KEY_SOLANA)
);
console.log(keypair.publicKey.toBase58(), 'publicKey');

async function init() {
    const tokenMint = new web3.PublicKey('CoDh2mktc3eBVseLZZs6PGBk5Fk5TjnMMTUtLGfYGk1e');
    const tokenNeonPdaAccount = new web3.PublicKey('CoDh2mktc3eBVseLZZs6PGBk5Fk5TjnMMTUtLGfYGk1e');
    const account = new web3.PublicKey('41Dzti2JuC1jumK5AfjxBSvYGhxtNPLGav54x7K8pnhD');

    let keypairAta = await getAssociatedTokenAddress(
        tokenMint,
        keypair.publicKey,
        false
    );
    console.log(keypairAta, 'keypairAta');

    let tx = new web3.Transaction();
    tx.add(
        web3.SystemProgram.allocate({
            accountPubkey: account,
            space: 165
        })
    );

    tx.add(
        web3.SystemProgram.assign({
            accountPubkey: account,
            programId: TOKEN_PROGRAM_ID
        })
    );

    tx.add(
        createInitializeAccount2Instruction(
            account, 
            tokenMint, 
            tokenNeonPdaAccount
        )
    );

    tx.add(
        createTransferInstruction(
            keypairAta,
            account,
            keypair.publicKey,
            10 * 10 ** 9,
            []
        )
    );
    
    await web3.sendAndConfirmTransaction(connection, tx, [keypair]);
    return;
}
init();