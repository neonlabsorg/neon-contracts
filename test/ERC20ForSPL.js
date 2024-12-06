const { ethers } = require("hardhat");
const { expect } = require("chai");
const web3 = require("@solana/web3.js");
const { config } = require('./config');
require("dotenv").config();

describe('Test init', async function () {
    let owner, user1, user2, user3;
    let ERC20ForSPLFactoryAddress = '0x9cb7E7BFe60a53e4c78727317724cCf5B111Ff48';
    let ERC20ForSPLAddress = '0x2639EC8aEfB542E4bDFCCcfd1B0d05076760AE26';
    let approverATAWithTokens = 'EVW8d8254iCKFhNpXGipKJTqcuVQsPkUpUxvpqQ4x7vR';
    let ERC20ForSPLFactory;
    let ERC20ForSPL;
    let tokenMintAccount;
    let ownerSolanaPublicKey;
    let user1SolanaPublicKey;
    let user2SolanaPublicKey;
    let user3SolanaPublicKey;
    let grantedTestersWithBalance;
    let tx;
    let neon_getEvmParams;
    const TOKEN_MINT = config.utils.publicKeyToBytes32('Gbb4zD39NupDG4ZEM73GmXLMBPS1CqPnPZpxcQUToizq'); // SPLToken on Curve stand
    const TOKEN_MINT_DECIMALS = 6;
    const RECEIPTS_COUNT = 3;

    before(async function() {
        [owner, user1, user2, user3] = await ethers.getSigners();
        const ERC20ForSplContractFactory = await ethers.getContractFactory('contracts/token/ERC20ForSpl/erc20_for_spl.sol:ERC20ForSpl');
        const ERC20ForSplFactoryContractFactory = await ethers.getContractFactory('contracts/token/ERC20ForSpl/erc20_for_spl_factory.sol:ERC20ForSplFactory');
        
        if (ethers.isAddress(ERC20ForSPLFactoryAddress)) {
            console.log('\nCreating instance of already deployed ERC20ForSPLFactory contract on Neon EVM with address', "\x1b[32m", ERC20ForSPLFactoryAddress, "\x1b[30m", '\n');
            ERC20ForSPLFactory = ERC20ForSplFactoryContractFactory.attach(ERC20ForSPLFactoryAddress);
        } else {
            // deploy ERC20ForSPLFactory
            ERC20ForSPLFactory = await ethers.deployContract('contracts/token/ERC20ForSpl/erc20_for_spl_factory.sol:ERC20ForSplFactory');
            await ERC20ForSPLFactory.waitForDeployment();
            console.log('\nCreating instance of just now deployed ERC20ForSplFactory contract on Neon EVM with address', "\x1b[32m", ERC20ForSPLFactory.target, "\x1b[30m", '\n'); 
        }

        if (ethers.isAddress(ERC20ForSPLAddress)) {
            console.log('\nCreating instance of already deployed ERC20ForSPL contract on Neon EVM with address', "\x1b[32m", ERC20ForSPLAddress, "\x1b[30m", '\n');
            ERC20ForSPL = ERC20ForSplContractFactory.attach(ERC20ForSPLAddress);
        } else {
            // ====== TEMPORARY ======
            ERC20ForSPL = await ethers.deployContract('contracts/token/ERC20ForSpl/erc20_for_spl.sol:ERC20ForSpl', [
                TOKEN_MINT,
                [
                    owner.address,
                    user1.address,
                    user2.address,
                    user3.address
                ]
            ]);
            await ERC20ForSPL.waitForDeployment();
            // ====== /TEMPORARY ======

            // deploy ERC20ForSPL
            /* tx = await ERC20ForSPLFactory.createErc20ForSpl(TOKEN_MINT);
            await tx.wait(RECEIPTS_COUNT);

            const getErc20ForSpl = await ERC20ForSPLFactory.getErc20ForSpl(TOKEN_MINT);

            ERC20ForSPL = ERC20ForSplContractFactory.attach(getErc20ForSpl);  */
            console.log('\nCreating instance of just now deployed ERC20ForSPL contract on Neon EVM with address', "\x1b[32m", ERC20ForSPL.target, "\x1b[30m", '\n');
        }

        const TokenMintAccount = await ERC20ForSPL.tokenMint();
        tokenMintAccount = ethers.encodeBase58(TokenMintAccount);
        ownerSolanaPublicKey = ethers.encodeBase58(await ERC20ForSPL.solanaAccount(owner.address));
        user1SolanaPublicKey = ethers.encodeBase58(await ERC20ForSPL.solanaAccount(user1.address));
        user2SolanaPublicKey = ethers.encodeBase58(await ERC20ForSPL.solanaAccount(user2.address));
        user3SolanaPublicKey = ethers.encodeBase58(await ERC20ForSPL.solanaAccount(user3.address));
        console.log('\nTokenMintAccount -', TokenMintAccount);
        console.log('tokenMintAccount -', tokenMintAccount);
        console.log('\nOwner addresses:');
        console.log('Neon EVM address -', owner.address);
        console.log('Solana data account -', ownerSolanaPublicKey);
        console.log('\nUser1 addresses:');
        console.log('Neon EVM address -', user1.address);
        console.log('Solana data account -', user1SolanaPublicKey);
        console.log('\nUser2 addresses:');
        console.log('Neon EVM address -', user2.address);
        console.log('Solana data account -', user2SolanaPublicKey);
        console.log('\nUser3 addresses:');
        console.log('Neon EVM address -', user3.address);
        console.log('Solana data account -', user3SolanaPublicKey);

        console.log('\n Balances:');
        console.log(await ERC20ForSPL.balanceOf(owner.address), 'owner');
        console.log(await ERC20ForSPL.balanceOf(user1.address), 'user1');
        console.log(await ERC20ForSPL.balanceOf(user2.address), 'user2');
        console.log(await ERC20ForSPL.balanceOf(user3.address), 'user3');

        grantedTestersWithBalance = await ERC20ForSPL.balanceOf(owner.address) != 0 && await ERC20ForSPL.balanceOf(user1.address) != 0 && await ERC20ForSPL.balanceOf(user2.address) != 0;
    });

    describe('ERC20ForSPL tests', function() {
        it('validate empty storage slots', async function () {
            for (let i = 0; i < 10; ++i) {
                expect(await ethers.provider.getStorage(ERC20ForSPL.target, i)).to.eq('0x0000000000000000000000000000000000000000000000000000000000000000');
            }
        });

        it('test claim & claimTo', async function () {
            if (approverATAWithTokens != '') {
                const ownerBalance = await ERC20ForSPL.balanceOf(owner.address);
                tx = await ERC20ForSPL.connect(owner).claim(
                    config.utils.publicKeyToBytes32(approverATAWithTokens),
                    ethers.parseUnits('1', TOKEN_MINT_DECIMALS)
                );
                await tx.wait(RECEIPTS_COUNT);

                expect(await ERC20ForSPL.balanceOf(owner.address)).to.be.greaterThan(ownerBalance);

                const user1Balance = await ERC20ForSPL.balanceOf(user1.address);
                tx = await ERC20ForSPL.connect(owner).claimTo(
                    config.utils.publicKeyToBytes32(approverATAWithTokens),
                    user1.address,
                    ethers.parseUnits('1', TOKEN_MINT_DECIMALS)
                );
                await tx.wait(RECEIPTS_COUNT);

                expect(await ERC20ForSPL.balanceOf(user1.address)).to.be.greaterThan(user1Balance);
            } else {
                console.log('Empty approverATAWithTokens - skipping test');
                this.skip();
            }
        });

        it('burn from owner', async function () {
            if (grantedTestersWithBalance) {
                const ownerBalance = await ERC20ForSPL.balanceOf(owner.address);
                const totalSupply = await ERC20ForSPL.totalSupply();

                const burnAmount = ethers.parseUnits('10', TOKEN_MINT_DECIMALS);
                let tx = await ERC20ForSPL.connect(owner).burn(burnAmount);
                await tx.wait(RECEIPTS_COUNT);

                expect(ownerBalance).to.be.greaterThan(await ERC20ForSPL.balanceOf(owner.address));
                expect(ownerBalance).to.eq(await ERC20ForSPL.balanceOf(owner.address) + burnAmount);
                expect(totalSupply).to.be.greaterThan(await ERC20ForSPL.totalSupply());
            } else {
                this.skip();
            }
        });

        it('transfer from user1 to user2', async function () {
            if (grantedTestersWithBalance) {
                const user1InitialBalance = await ERC20ForSPL.balanceOf(user1.address);
                const user2InitialBalance = await ERC20ForSPL.balanceOf(user2.address);
                const transferAmount = ethers.parseUnits('5', TOKEN_MINT_DECIMALS);
                let tx = await ERC20ForSPL.connect(user1).transfer(user2.address, transferAmount);
                await tx.wait(RECEIPTS_COUNT);

                expect(await ERC20ForSPL.balanceOf(user1.address)).to.eq(user1InitialBalance - transferAmount);
                expect(await ERC20ForSPL.balanceOf(user2.address)).to.eq(user2InitialBalance + transferAmount);
            } else {
                this.skip();
            }
        });

        it('transfer from user2 to user1', async function () {
            if (grantedTestersWithBalance) {
                const user1InitialBalance = await ERC20ForSPL.balanceOf(user1.address);
                const user2InitialBalance = await ERC20ForSPL.balanceOf(user2.address);

                const transferAmount = ethers.parseUnits('5', TOKEN_MINT_DECIMALS);
                let tx = await ERC20ForSPL.connect(user2).transfer(user1.address, transferAmount);
                await tx.wait(RECEIPTS_COUNT);

                expect(await ERC20ForSPL.balanceOf(user1.address)).to.greaterThan(user1InitialBalance);
                expect(await ERC20ForSPL.balanceOf(user2.address)).to.lessThan(user2InitialBalance);
            } else {
                this.skip();
            }
        });

        it('transfer from user1 to user2 using transferSolana', async function () {
            if (grantedTestersWithBalance) {
                const user1Balance = await ERC20ForSPL.balanceOf(user1.address);
                const user2Balance = await ERC20ForSPL.balanceOf(user2.address);

                const transferAmount = ethers.parseUnits('5', TOKEN_MINT_DECIMALS);
                let tx = await ERC20ForSPL.connect(user1).transferSolana(await ERC20ForSPL.solanaAccount(user2.address), transferAmount);
                await tx.wait(RECEIPTS_COUNT);

                const user1BalanceAfter = await ERC20ForSPL.balanceOf(user1.address);
                const user2BalanceAfter = await ERC20ForSPL.balanceOf(user2.address);
                expect(user1Balance).to.be.greaterThan(user1BalanceAfter);
                expect(user2BalanceAfter).to.be.greaterThan(user2Balance);
            } else {
                this.skip();
            }
        });

        it('transfer from user2 to user1 by using transferSolana', async function () {
            if (grantedTestersWithBalance) {
                const user1Balance = await ERC20ForSPL.balanceOf(user1.address);
                const user2Balance = await ERC20ForSPL.balanceOf(user2.address);

                const transferAmount = ethers.parseUnits('5', TOKEN_MINT_DECIMALS);
                let tx = await ERC20ForSPL.connect(user2).transferSolana(await ERC20ForSPL.solanaAccount(user1.address), transferAmount);
                await tx.wait(RECEIPTS_COUNT);

                const user1BalanceAfter = await ERC20ForSPL.balanceOf(user1.address);
                const user2BalanceAfter = await ERC20ForSPL.balanceOf(user2.address);
                expect(user1BalanceAfter).to.be.greaterThan(user1Balance);
                expect(user2Balance).to.be.greaterThan(user2BalanceAfter);
            } else {
                this.skip();
            }
        });

        it('approve from user2 to user1', async function () {
            if (grantedTestersWithBalance) {
                const user2Allowance = await ERC20ForSPL.allowance(user2.address, user1.address);

                let tx = await ERC20ForSPL.connect(user2).approve(user1.address, ethers.parseUnits('1', TOKEN_MINT_DECIMALS));
                await tx.wait(RECEIPTS_COUNT);

                const user2AllowanceAfter = await ERC20ForSPL.allowance(user2.address, user1.address);
                expect(user2AllowanceAfter).to.be.greaterThan(user2Allowance);
            } else {
                this.skip();
            }
        });
        
        it('transferFrom from user2 to user1', async function () {
            if (grantedTestersWithBalance) {
                const user2Allowance = await ERC20ForSPL.allowance(user2.address, user1.address);
                const user1Balance = await ERC20ForSPL.balanceOf(user1.address);
                const user2Balance = await ERC20ForSPL.balanceOf(user2.address);

                let tx = await ERC20ForSPL.connect(user1).transferFrom(user2.address, user1.address, user2Allowance);
                await tx.wait(RECEIPTS_COUNT);

                const user2AllowanceAfter = await ERC20ForSPL.allowance(user2.address, user1.address);
                const user1BalanceAfter = await ERC20ForSPL.balanceOf(user1.address);
                const user2BalanceAfter = await ERC20ForSPL.balanceOf(user2.address);
                expect(user2Allowance).to.be.greaterThan(user2AllowanceAfter);
                expect(user2AllowanceAfter).to.eq(0);
                expect(user1BalanceAfter).to.be.greaterThan(user1Balance);
                expect(user2Balance).to.be.greaterThan(user2BalanceAfter);
            } else {
                this.skip();
            }
        });

        it('approveSolana from user1 to user2 and owner; revoke with approveSolana', async function () {
            if (grantedTestersWithBalance) {
                let amount = ethers.parseUnits('1', TOKEN_MINT_DECIMALS);
                let tx = await ERC20ForSPL.connect(user1).approveSolana(await ERC20ForSPL.solanaAccount(user2.address), amount);
                await tx.wait(RECEIPTS_COUNT);
                let accountDelegateData = await ERC20ForSPL.getAccountDelegateData(user1.address);
                expect(accountDelegateData[0]).to.eq(await ERC20ForSPL.solanaAccount(user2.address));
                expect(accountDelegateData[1]).to.eq(BigInt(amount));

                let amount1 = ethers.parseUnits('2', TOKEN_MINT_DECIMALS);
                let tx1 = await ERC20ForSPL.connect(user1).approveSolana(await ERC20ForSPL.solanaAccount(owner.address), amount1);
                await tx1.wait(RECEIPTS_COUNT);
                
                let accountDelegateData1 = await ERC20ForSPL.getAccountDelegateData(user1.address);
                expect(accountDelegateData1[0]).to.eq(await ERC20ForSPL.solanaAccount(owner.address));
                expect(accountDelegateData1[1]).to.eq(BigInt(amount1));

                // test revoke approveSolana
                let tx2 = await ERC20ForSPL.connect(user1).approveSolana(await ERC20ForSPL.solanaAccount(owner.address), 0);
                await tx2.wait(RECEIPTS_COUNT);
                
                let accountDelegateData2 = await ERC20ForSPL.getAccountDelegateData(user1.address);
                expect(accountDelegateData2[0]).to.eq('0x0000000000000000000000000000000000000000000000000000000000000000');
                expect(accountDelegateData2[1]).to.eq(0);
            } else {
                this.skip();
            }
        });

        it('Malicious transfer ( supposed to revert )', async function () {
            if (grantedTestersWithBalance) {
                // user3 has no tokens at all
                await expect(
                    ERC20ForSPL.connect(user3).transfer(user1.address, ethers.parseUnits('1', TOKEN_MINT_DECIMALS))
                ).to.be.reverted;
            } else {
                this.skip();
            }
        });

        it('Malicious transferFrom ( supposed to revert )', async function () {
            if (grantedTestersWithBalance) {
                // user3 has no approval at all
                await expect(
                    ERC20ForSPL.connect(user3).transferFrom(user2.address, user3.address, ethers.parseUnits('1', TOKEN_MINT_DECIMALS))
                ).to.be.reverted;
            } else {
                this.skip();
            }
        });

        it('Malicious burn ( supposed to revert )', async function () {
            if (grantedTestersWithBalance) {
                // user3 has no tokens at all
                await expect(
                    ERC20ForSPL.connect(user3).burn(ethers.parseUnits('1', TOKEN_MINT_DECIMALS))
                ).to.be.reverted;
            } else {
                this.skip();
            }
        });

        it('Malicious uint64 overflow ( supposed to revert )', async function () {
            if (grantedTestersWithBalance) {
                // 18446744073709551615 is the maximum uint64
                await expect(
                    ERC20ForSPL.connect(user1).transfer(user2.address, '18446744073709551616')
                ).to.be.revertedWithCustomError(
                    ERC20ForSPL,
                    'AmountExceedsUint64'
                );

                await expect(
                    ERC20ForSPL.connect(user1).burn('18446744073709551616')
                ).to.be.revertedWithCustomError(
                    ERC20ForSPL,
                    'AmountExceedsUint64'
                );
            } else {
                this.skip();
            }
        });
    });
});