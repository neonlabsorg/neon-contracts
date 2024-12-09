const web3 = require("@solana/web3.js");
const { ethers } = require("ethers");
const { 
    NeonProxyRpcApi,
    signerPrivateKey 
} = require("@neonevm/token-transfer-core");
const { neonTransferMintTransactionEthers } = require("@neonevm/token-transfer-ethers");
const bs58 = require("bs58");
const { config } = require('../config');
require("dotenv").config();

const provider = new ethers.JsonRpcProvider(process.env.CURVESTAND);
const connection = new web3.Connection(process.env.CURVESTAND_SOL, "processed");
const neonTokenProxyRpcApi = new NeonProxyRpcApi(process.env.CURVESTAND);

const keypair = web3.Keypair.fromSecretKey(
    bs58.decode(process.env.PRIVATE_KEY_SOLANA)
);
console.log(keypair.publicKey.toBase58(), 'publicKey');


const walletsToSendTokens = process.argv.slice(2);
if (walletsToSendTokens.length == 0) {
    console.error('No wallets passed as script argument in order to fill them with some tokens.');
    process.exit();
}

async function init() {
    const neon_getEvmParamsRequest = await fetch(process.env.CURVESTAND, {
        method: 'POST',
        body: JSON.stringify({"method":"neon_getEvmParams","params":[],"id":1,"jsonrpc":"2.0"}),
        headers: { 'Content-Type': 'application/json' }
    });
    const neon_getEvmParams = await neon_getEvmParamsRequest.json();

    const eth_chainIdRequest = await fetch(process.env.CURVESTAND, {
        method: 'POST',
        body: JSON.stringify({"method":"eth_chainId","params":[],"id":1,"jsonrpc":"2.0"}),
        headers: { 'Content-Type': 'application/json' }
    });
    const chainId = (await eth_chainIdRequest.json()).result;

    const token = {
        chainId: chainId,
        address_spl: config.DATA.ADDRESSES.ERC20ForSplTokenMint,
        address: config.DATA.ADDRESSES.ERC20ForSpl,
        decimals: 9,
        name: 'Dev Neon EVM',
        symbol: 'devNEON',
        logoURI: 'https://neonevm.org/img/logo.svg'
    };

    for (let i = 0, len = walletsToSendTokens.length; i < len; ++i) {
        if (!ethers.isAddress(walletsToSendTokens[i])) {
            console.error('Invalid EVM address -', walletsToSendTokens[i]);
            process.exit();
        }

        const solanaWalletSigner = new ethers.Wallet(signerPrivateKey(keypair.publicKey, walletsToSendTokens[i]), provider);
        const transaction = await neonTransferMintTransactionEthers({
            connection,
            proxyApi: neonTokenProxyRpcApi,
            neonEvmProgram: new web3.PublicKey(neon_getEvmParams.result.neonEvmProgramId),
            solanaWallet: keypair.publicKey,
            neonWallet: walletsToSendTokens[i],
            walletSigner: solanaWalletSigner,
            splToken: token,
            amount: 10,
            chainId: token.chainId
        });
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        transaction.sign(keypair);

        const signature = await web3.sendAndConfirmTransaction(
            connection,
            transaction,
            [keypair]
        );
        console.log('SIGNATURE', signature);
    }
}
init();