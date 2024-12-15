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

const connection = new web3.Connection(process.env.CURVESTAND_SOL, "processed");

const keypair = web3.Keypair.fromSecretKey(
    bs58.decode(process.env.PRIVATE_KEY_SOLANA)
);
console.log(keypair.publicKey.toBase58(), 'publicKey');

const keypair2 = web3.Keypair.fromSecretKey(
    bs58.decode(process.env.PRIVATE_KEY_SOLANA_2)
);
console.log(keypair2.publicKey.toBase58(), 'publicKey');

async function init() {
    const seed = 'seed' + Date.now().toString(); // random seed on each script call
    const createWithSeed = await web3.PublicKey.createWithSeed(keypair.publicKey, seed, new web3.PublicKey(TOKEN_PROGRAM_ID));
    console.log(createWithSeed, 'createWithSeed');

    let keypairAta = await getAssociatedTokenAddress(
        createWithSeed,
        keypair.publicKey,
        false
    );
    console.log(keypairAta, 'keypairAta');

    let keypairAta2 = await getAssociatedTokenAddress(
        createWithSeed,
        keypair2.publicKey,
        false
    );
    console.log(keypairAta2, 'keypairAta2');

    const minBalance = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);

    let tx = new web3.Transaction();
    tx.add(
        web3.SystemProgram.createAccountWithSeed({
            fromPubkey: keypair.publicKey,
            basePubkey: keypair.publicKey,
            newAccountPubkey: createWithSeed,
            seed: seed,
            lamports: minBalance, // enough lamports to make the account rent exempt
            space: MINT_SIZE,
            programId: new web3.PublicKey(TOKEN_PROGRAM_ID) // programId
        })
    );

    tx.add(
        createInitializeMint2Instruction(
            createWithSeed, 
            9, // decimals
            keypair.publicKey,
            keypair.publicKey,
            new web3.PublicKey(TOKEN_PROGRAM_ID) // programId
        )
    );

    const metaplex = new Metaplex(connection);
    const metadata = metaplex.nfts().pdas().metadata({mint: createWithSeed});
    tx.add(
        createCreateMetadataAccountV3Instruction(
            {
                metadata: metadata,
                mint: createWithSeed,
                mintAuthority: keypair.publicKey,
                payer: keypair.publicKey,
                updateAuthority: keypair.publicKey
            },
            {
                createMetadataAccountArgsV3: {
                    data: {
                        name: "Dev Neon EVM",
                        symbol: "devNEON",
                        uri: 'https://ipfs.io/ipfs/QmW2JdmwWsTVLw1Gx4ympCn1VHJiuojfNLS5ZNLEPcBd5x/doge.json',
                        sellerFeeBasisPoints: 0,
                        collection: null,
                        creators: null,
                        uses: null
                    },
                    isMutable: true,
                    collectionDetails: null
                },
            }
        )
    );

    tx.add(
        createAssociatedTokenAccountInstruction(
            keypair.publicKey,
            keypairAta,
            keypair.publicKey,
            createWithSeed,
            TOKEN_PROGRAM_ID, 
            ASSOCIATED_TOKEN_PROGRAM_ID
        )
    );

    tx.add(
        createAssociatedTokenAccountInstruction(
            keypair.publicKey,
            keypairAta2,
            keypair2.publicKey,
            createWithSeed,
            TOKEN_PROGRAM_ID, 
            ASSOCIATED_TOKEN_PROGRAM_ID
        )
    );

    tx.add(
        createMintToInstruction(
            createWithSeed,
            keypairAta,
            keypair.publicKey,
            1230 * 10 ** 9 // mint 1000 tokens
        )
    );

    tx.add(
        createMintToInstruction(
            createWithSeed,
            keypairAta2,
            keypair.publicKey,
            1230 * 10 ** 9 // mint 1000 tokens
        )
    );

    await web3.sendAndConfirmTransaction(connection, tx, [keypair]);
    
    return;
}
init();