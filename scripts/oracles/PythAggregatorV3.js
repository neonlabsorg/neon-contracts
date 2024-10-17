// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const { ethers } = require("hardhat");

async function main() {
    const PYTH_SOL_USD_PRICE_FEED_ID = '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d';
    const PYTH_SOL_USD_PRICE_FEED_ACCOUNT = '0x60314704340deddf371fd42472148f248e9d1a6d1a5eb2ac3acd8b7fd5d6b243'; // 7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE
    const PythAggregatorV3Factory = await ethers.getContractFactory("PythAggregatorV3");
    const PythAggregatorV3Address = "0x66D23Fc4521d75613921f6475ce1776ed4A8F109";
    let PythAggregatorV3;

    if (ethers.isAddress(PythAggregatorV3Address)) {
        PythAggregatorV3 = PythAggregatorV3Factory.attach(
            PythAggregatorV3Address
        );
    } else {
        PythAggregatorV3 = await upgrades.deployProxy(PythAggregatorV3Factory, [
            PYTH_SOL_USD_PRICE_FEED_ID,
            PYTH_SOL_USD_PRICE_FEED_ACCOUNT
        ], {kind: 'uups'});
        await PythAggregatorV3.waitForDeployment();

        console.log(
            `PythAggregatorV3 deployed to ${PythAggregatorV3.target}`
        );
    }

    console.log('\n Listing data for Pyth SOL/ USDC price feed:');
    console.log(await PythAggregatorV3.decimals(), 'decimals');
    console.log(await PythAggregatorV3.description(), 'description');
    console.log(await PythAggregatorV3.version(), 'version');
    console.log(await PythAggregatorV3.latestAnswer(), 'latestAnswer');
    console.log(await PythAggregatorV3.latestTimestamp(), 'latestTimestamp');
    console.log(await PythAggregatorV3.latestRound(), 'latestRound');
    console.log(await PythAggregatorV3.getAnswer(0), 'getAnswer');
    console.log(await PythAggregatorV3.getTimestamp(0), 'getTimestamp');
    console.log(await PythAggregatorV3.getRoundData(10), 'getRoundData');
    console.log(await PythAggregatorV3.latestRoundData(), 'latestRoundData');
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});