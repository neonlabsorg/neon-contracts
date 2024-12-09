const { ethers } = require("hardhat");
const { expect } = require("chai");
const web3 = require("@solana/web3.js");
const { config } = require('./config');
require("dotenv").config();

describe('Test init', async function () {
    let owner, user1, user2, user3;
    const TemporaryHelperAddress = '0x78925E0757450fD22A718B9A0c32907e5949e93e';
    let TemporaryHelper;

    before(async function() {
        [owner, user1, user2, user3] = await ethers.getSigners();
        const TemporaryHelperAddressFactory = await ethers.getContractFactory('contracts/token/ERC20ForSpl/TemporaryHelper.sol:TemporaryHelper');
        
        if (ethers.isAddress(TemporaryHelperAddress)) {
            console.log('\nCreating instance of already deployed TemporaryHelper contract on Neon EVM with address', "\x1b[32m", TemporaryHelperAddress, "\x1b[30m", '\n');
            TemporaryHelper = TemporaryHelperAddressFactory.attach(TemporaryHelperAddress);
        } else {
            // deploy ERC20ForSPLFactory
            TemporaryHelper = await ethers.deployContract('contracts/token/ERC20ForSpl/TemporaryHelper.sol:TemporaryHelper');
            await TemporaryHelper.waitForDeployment();
            console.log('\nCreating instance of just now deployed TemporaryHelper contract on Neon EVM with address', "\x1b[32m", TemporaryHelper.target, "\x1b[30m", '\n'); 
        }
    });

    describe('TemporaryHelper tests', function() {
        it('validate SVM address', async function () {
            const keypair = new web3.PublicKey('8HzCjhBNP3rs7SydUrZAiQGEoqXHNtpNPE475zzHmzba');
            const payer = ethers.dataSlice(ethers.keccak256(keypair.toBytes()), 12, 32);
            console.log(payer, 'payer');

            console.log(await TemporaryHelper.solanaAddress(payer), 'solanaAddress');
            console.log(await TemporaryHelper.isSolanaUser(payer), 'isSolanaUser');
        });
    });
});