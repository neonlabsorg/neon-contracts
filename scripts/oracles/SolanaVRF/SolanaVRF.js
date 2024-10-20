// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const { ethers } = require("hardhat");
const web3 = require('@solana/web3.js');

async function main() {
    const SolanaVRFFactory = await ethers.getContractFactory("SolanaVRF");
    const SolanaVRFAddress = "0x317026f4584e7e2c3656dA848Edb971ceFAD0D6b";
    let SolanaVRF;

    if (ethers.isAddress(SolanaVRFAddress)) {
        SolanaVRF = SolanaVRFFactory.attach(SolanaVRFAddress);

        console.log(
            `SolanaVRF attached at ${SolanaVRFAddress}`
        );
    } else {
        SolanaVRF = await ethers.deployContract("SolanaVRF");
        await SolanaVRF.waitForDeployment();

        console.log(
            `SolanaVRF deployed to ${SolanaVRF.target}`
        );
    }

    async function requestRandomness() {
        const randomKeypair = web3.Keypair.generate();
        const seed = ethers.zeroPadValue(ethers.toBeHex(ethers.decodeBase58(randomKeypair.publicKey.toBase58())), 32);
        console.log(seed, 'seed');
        console.log(await SolanaVRF.randomnessAccountAddress(seed), 'randomnessAccountAddress');

        let tx = await SolanaVRF.requestRandomness(
            seed,
            7103920 // needed SOL amount in lamports in order to create VRF account on Solana
        );
        await tx.wait(1);
        console.log(tx, 'tx');
    }

    async function getRandomness(seed) {
        console.log(
            await SolanaVRF.getRandomness(
                await SolanaVRF.randomnessAccountAddress(seed)
            ), 
            'getRandomness'
        );
    }

    requestRandomness();

    //getRandomness(''); // pass your seed here
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});