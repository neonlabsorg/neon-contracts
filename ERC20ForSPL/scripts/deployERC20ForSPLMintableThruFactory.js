// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const { ethers } = require("hardhat");

async function main() {
  const ERC20ForSPLFactoryAddress = "";
  const ERC20ForSPLFactoryInstance = await ethers.getContractAt(
    "ERC20ForSPLFactory",
    ERC20ForSPLFactoryAddress
  );

  let tx = await ERC20ForSPLFactoryInstance.deploy(
    "Test Token",
    "TST",
    "http://integration-test-link.neoninfra.xyz/erc20forspl-info.json",
    9
  );
  const receipt = await tx.wait(3);
  console.log("Token Mint:", receipt.logs[3].args[0]);
  console.log(
    "Token SPL Address:",
    bs58.encode(Buffer.from(receipt.logs[3].args[0].slice(2), "hex"))
  );
  console.log("Token ERC20 Interface Address:", receipt.logs[3].args[1]);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
