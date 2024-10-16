// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const { ethers } = require("hardhat");

async function main() {
    const PYTH_SOL_USDC_PRICE_FEED = '0x60314704340deddf371fd42472148f248e9d1a6d1a5eb2ac3acd8b7fd5d6b243';
    const PythPriceFeedsFactory = await ethers.getContractFactory(
        "PythPriceFeeds"
    );
    const PythPriceFeedsAddress = "0xb9E8133DC36B7ED288ba541C4f792D20b40fBd63";
    let PythPriceFeeds;

    if (ethers.isAddress(PythPriceFeedsAddress)) {
        PythPriceFeeds = PythPriceFeedsFactory.attach(
            PythPriceFeedsAddress
        );
    } else {
        PythPriceFeeds = await ethers.deployContract(
            "PythPriceFeeds", 
            [PYTH_SOL_USDC_PRICE_FEED]
        );
        await PythPriceFeeds.waitForDeployment();

        console.log(
            `PythPriceFeeds deployed to ${PythPriceFeeds.target}`
        );
    }

    console.log(
        await PythPriceFeeds.latestRoundData(), 'latestRoundData SOL/ USDC'
    );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});