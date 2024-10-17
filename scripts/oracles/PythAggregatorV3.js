// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const { ethers } = require("hardhat");

async function main() {
    const PYTH_PRICE_FEED_ID = '0xd82183dd487bef3208a227bb25d748930db58862c5121198e723ed0976eb92b7';
    const PYTH_PRICE_FEED_ACCOUNT = '0xd0659a310e813dd255d09668f02808dfc34d20b3c89d001758a38dee5af54fa8'; // F2VfCymdNQiCa8Vyg5E7BwEv9UPwfm8cVN6eqQLqXiGo
    const PythAggregatorV3Factory = await ethers.getContractFactory("PythAggregatorV3");
    const PythAggregatorV3Address = "0x5418Bd0bd3A43D6DcC486fb374a2346BE5e07A0D";
    let PythAggregatorV3;

    if (ethers.isAddress(PythAggregatorV3Address)) {
        PythAggregatorV3 = PythAggregatorV3Factory.attach(
            PythAggregatorV3Address
        );
    } else {
        PythAggregatorV3 = await upgrades.deployProxy(PythAggregatorV3Factory, [
            PYTH_PRICE_FEED_ID,
            PYTH_PRICE_FEED_ACCOUNT
        ], {kind: 'uups'});
        await PythAggregatorV3.waitForDeployment();

        console.log(
            `PythAggregatorV3 deployed to ${PythAggregatorV3.target}`
        );
    }

    console.log('\n Listing data for Pyth NEON/ USDC price feed:');
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