// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const { ethers } = require("hardhat");

async function main() {
    const PYTH_SOL_USDC_PRICE_FEED = '0x60314704340deddf371fd42472148f248e9d1a6d1a5eb2ac3acd8b7fd5d6b243';
    const PythPriceFeedFactory = await ethers.getContractFactory(
        "PythPriceFeed"
    );
    const PythPriceFeedAddress = "0x4085D39Dc9c97650EB2E69eb9e79B8acc2a28C00";
    let PythPriceFeed;

    if (ethers.isAddress(PythPriceFeedAddress)) {
        PythPriceFeed = PythPriceFeedFactory.attach(
            PythPriceFeedAddress
        );
    } else {
        PythPriceFeed = await ethers.deployContract(
            "PythPriceFeed", 
            [PYTH_SOL_USDC_PRICE_FEED]
        );
        await PythPriceFeed.waitForDeployment();

        console.log(
            `PythPriceFeed deployed to ${PythPriceFeed.target}`
        );
    }

    console.log(
        await PythPriceFeed.latestRoundData(), 'latestRoundData SOL/ USDC'
    );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});