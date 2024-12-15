const { ethers } = require("hardhat");
const { expect } = require("chai");
const web3 = require("@solana/web3.js");
const bs58 = require("bs58");
const {
    getAssociatedTokenAddress,
    getAccount,
    createAssociatedTokenAccountInstruction,
    createApproveInstruction,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
} = require('@solana/spl-token');
const { 
    NeonProxyRpcApi,
    signerPrivateKey 
} = require("@neonevm/token-transfer-core");
const { neonTransferMintTransactionEthers } = require("@neonevm/token-transfer-ethers");
const { config } = require('./config');
require("dotenv").config();
const connection = new web3.Connection(process.env.CURVESTAND_SOL, "processed", {confirmTransactionInitialTimeout: 0});

let owner, user1, user2, user3;
const solanaUser1 = web3.Keypair.fromSecretKey( // Solana user with ATA balance
    bs58.decode(process.env.PRIVATE_KEY_SOLANA)
);
const solanaUser2 = web3.Keypair.fromSecretKey( // Solana user with ATA & PDA balance
    bs58.decode(process.env.PRIVATE_KEY_SOLANA_2)
);
const solanaUser3 = web3.Keypair.fromSecretKey( // SOlana user with PDA balance
    bs58.decode(process.env.PRIVATE_KEY_SOLANA_3)
);
console.log(solanaUser1.publicKey.toBase58(), 'solanaUser1');
console.log(solanaUser2.publicKey.toBase58(), 'solanaUser2');
console.log(solanaUser3.publicKey.toBase58(), 'solanaUser3');
const ERC20ForSPLFactoryAddress = config.DATA.ADDRESSES.ERC20ForSplFactory;
const ERC20ForSPLAddress = config.DATA.ADDRESSES.ERC20ForSpl;
const approverATAWithTokens = '';
let ERC20ForSPLFactory;
let ERC20ForSPL;
let ownerSolanaPublicKey;
let user1SolanaPublicKey;
let user2SolanaPublicKey;
let user3SolanaPublicKey;
let grantedTestersWithBalance;
let neon_getEvmParams;
const TOKEN_MINT = config.utils.publicKeyToBytes32(config.DATA.ADDRESSES.ERC20ForSplTokenMint);
const TOKEN_MINT_DECIMALS = 9;
const RECEIPTS_COUNT = 3;
const SOLANA_TX_TIMEOUT = 20000;

describe('Test init', async function () {
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
            // deploy ERC20ForSPL
            tx = await ERC20ForSPLFactory.createErc20ForSpl(TOKEN_MINT);
            await tx.wait(RECEIPTS_COUNT);

            const getErc20ForSpl = await ERC20ForSPLFactory.getErc20ForSpl(TOKEN_MINT);

            ERC20ForSPL = ERC20ForSplContractFactory.attach(getErc20ForSpl);
            console.log('\nCreating instance of just now deployed ERC20ForSPL contract on Neon EVM with address', "\x1b[32m", ERC20ForSPL.target, "\x1b[30m", '\n');
        }

        const neon_getEvmParamsRequest = await fetch(process.env.CURVESTAND, {
            method: 'POST',
            body: JSON.stringify({"method":"neon_getEvmParams","params":[],"id":1,"jsonrpc":"2.0"}),
            headers: { 'Content-Type': 'application/json' }
        });
        neon_getEvmParams = await neon_getEvmParamsRequest.json();
        console.log(neon_getEvmParams, 'neon_getEvmParams');

        const TokenMintAccount = await ERC20ForSPL.tokenMint();
        ownerSolanaPublicKey = ethers.encodeBase58(await ERC20ForSPL.solanaAccount(owner.address));
        user1SolanaPublicKey = ethers.encodeBase58(await ERC20ForSPL.solanaAccount(user1.address));
        user2SolanaPublicKey = ethers.encodeBase58(await ERC20ForSPL.solanaAccount(user2.address));
        user3SolanaPublicKey = ethers.encodeBase58(await ERC20ForSPL.solanaAccount(user3.address));
        console.log('\nTokenMintAccount -', TokenMintAccount);
        console.log('nTokenMintAccount -', ethers.encodeBase58(TokenMintAccount));
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
        console.log(grantedTestersWithBalance, 'grantedTestersWithBalance');
        if (!grantedTestersWithBalance) {
            await setupTesters(
                [owner.address, user1.address, user2.address, user3.address],
                [solanaUser1, solanaUser2, solanaUser3]
            );
            grantedTestersWithBalance = true;

            console.log(await ERC20ForSPL.balanceOf(owner.address), 'owner');
            console.log(await ERC20ForSPL.balanceOf(user1.address), 'user1');
            console.log(await ERC20ForSPL.balanceOf(user2.address), 'user2');
            console.log(await ERC20ForSPL.balanceOf(user3.address), 'user3');
        }
    });

    describe('ERC20ForSPL tests', function() {
        it('check PDA accounts calculation', async function () {
            const pdaAccountOnChain = ethers.encodeBase58(await ERC20ForSPL.solanaAccount(owner.address));
            const pdaAccountOffChain = config.utils.calculatePdaAccount(
                'ContractData',
                ERC20ForSPL.target,
                owner.address,
                new web3.PublicKey(neon_getEvmParams.result.neonEvmProgramId)
            )[0].toBase58();
            console.log(pdaAccountOnChain, 'pdaAccountOnChain');
            console.log(pdaAccountOffChain, 'pdaAccountOffChain');

            expect(pdaAccountOnChain).to.eq(pdaAccountOffChain);
        });

        /* it('validate empty storage slots', async function () {
            for (let i = 0; i < 10; ++i) {
                expect(await ethers.provider.getStorage(ERC20ForSPL.target, i)).to.eq('0x0000000000000000000000000000000000000000000000000000000000000000');
            }
        });

        it('test claim & claimTo', async function () {
            if (grantedTestersWithBalance) {
                if (approverATAWithTokens != '') {
                    const ownerBalance = await ERC20ForSPL.balanceOf(owner.address);
                    let tx = await ERC20ForSPL.connect(owner).claim(
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
            } else {
                this.skip();
            }
        });

        it('burn from owner', async function () {
            if (grantedTestersWithBalance) {
                const ownerBalance = await ERC20ForSPL.balanceOf(owner.address);
                const totalSupply = await ERC20ForSPL.totalSupply();

                const burnAmount = ethers.parseUnits('1', TOKEN_MINT_DECIMALS);
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
        }); */

        // *********************************************************************************************************
        // *************************************** Solana native tests *********************************************
        // *********************************************************************************************************

        it('Validate Solana user 1 have performed at least 1 scheduled transaction', async function () {
            if (grantedTestersWithBalance) {
                const currentAllowance1 = await ERC20ForSPL.allowance(config.utils.SolanaNativeHelper.getPayer(solanaUser1), owner.address);

                console.log(currentAllowance1, 'currentAllowance1');
                await _scheduleTransaction(
                    solanaUser1, 
                    ERC20ForSPL.target, 
                    ERC20ForSPL.interface.encodeFunctionData("approve", [owner.address, Number(currentAllowance1) + 1000])
                );

                // wait scheduled tx to be processed
                await config.utils.asyncTimeout(SOLANA_TX_TIMEOUT)

                expect(await ERC20ForSPL.allowance(config.utils.SolanaNativeHelper.getPayer(solanaUser1), owner.address)).to.be.greaterThan(currentAllowance1);
            } else {
                this.skip();
            }
        });

        it('Validate Solana user 2 have performed at least 1 scheduled transaction', async function () {
            this.skip(); // temporary skip until bug is resolved
            if (grantedTestersWithBalance) {
                const currentAllowance2 = await ERC20ForSPL.allowance(config.utils.SolanaNativeHelper.getPayer(solanaUser2), owner.address);

                await _scheduleTransaction(
                    solanaUser2, 
                    ERC20ForSPL.target, 
                    ERC20ForSPL.interface.encodeFunctionData("approve", [owner.address, Number(currentAllowance2) + 2000])
                );

                // wait scheduled tx to be processed
                await config.utils.asyncTimeout(SOLANA_TX_TIMEOUT);

                expect(await ERC20ForSPL.allowance(config.utils.SolanaNativeHelper.getPayer(solanaUser2), owner.address)).to.be.greaterThan(currentAllowance2);
            } else {
                this.skip();
            }
        });

        it('validate Solana user balanceOf ( user with only ATA balance )', async function () {
            if (grantedTestersWithBalance) {
                const payer = config.utils.SolanaNativeHelper.getPayer(solanaUser1);

                console.log(payer, 'payer');
                console.log(await ERC20ForSPL.balanceOf(payer));

                const solanaUserAta = await getAssociatedTokenAddress(
                    new web3.PublicKey(config.DATA.ADDRESSES.ERC20ForSplTokenMint),
                    solanaUser1.publicKey,
                    false
                );
                console.log(solanaUserAta, 'solanaUserAta');
                const ataAccount = await getAccount(connection, solanaUserAta);
                console.log(ataAccount, 'ataAccount');
                const ataBalance = (ataAccount.delegatedAmount > ataAccount.amount) ? ataAccount.amount : ataAccount.delegatedAmount;

                expect(await ERC20ForSPL.balanceOf(payer)).to.be.greaterThan(0);
                expect(await ERC20ForSPL.balanceOf(payer)).to.eq(ataBalance);
            } else {
                this.skip();
            }
        });

        it('validate Solana user balanceOf ( user with both PDA & ATA balances )', async function () {
            this.skip(); // temporary skip until bug is resolved
            if (grantedTestersWithBalance) {
                const svmKeypair = web3.Keypair.fromSecretKey(
                    bs58.decode(process.env.PRIVATE_KEY_SOLANA)
                );
                const payer = config.utils.SolanaNativeHelper.getPayer(svmKeypair);
                console.log(payer, 'payer');
                console.log(await ERC20ForSPL.balanceOf(payer));

                const solanaUserAta = await getAssociatedTokenAddress(
                    new web3.PublicKey(config.DATA.ADDRESSES.ERC20ForSplTokenMint),
                    svmKeypair.publicKey,
                    false
                );
                console.log(solanaUserAta, 'solanaUserAta');
                const ataAccount = await getAccount(connection, solanaUserAta);
                const ataBalance = (ataAccount.delegatedAmount > ataAccount.amount) ? ataAccount.amount : ataAccount.delegatedAmount;

                const solanaUserPda = ethers.encodeBase58(await ERC20ForSPL.solanaAccount(payer));
                console.log(solanaUserPda, 'solanaUserPda');

                expect(await ERC20ForSPL.balanceOf(payer)).to.be.greaterThan(0);
                expect(await ERC20ForSPL.balanceOf(payer)).to.eq(
                    ataBalance + (await getAccount(connection, solanaUserPda)).amount
                );
            } else {
                this.skip();
            }
        });

        it('transfer from Solana user with ATA balance to Neon user', async function () {
            if (grantedTestersWithBalance) {
                const payer = config.utils.SolanaNativeHelper.getPayer(solanaUser1);

                console.log(payer, 'payer');
                console.log(await ERC20ForSPL.balanceOf(payer));

                const solanaUserAta = await getAssociatedTokenAddress(
                    new web3.PublicKey(config.DATA.ADDRESSES.ERC20ForSplTokenMint),
                    solanaUser1.publicKey,
                    false
                );
                console.log(solanaUserAta, 'solanaUserAta');

                const payerBalance = await ERC20ForSPL.balanceOf(payer);
                const ownerBalance = await ERC20ForSPL.balanceOf(owner.address);
                const ataAccount = await getAccount(connection, solanaUserAta);
                console.log(await ERC20ForSPL.balanceOf(payer), 'await ERC20ForSPL.balanceOf(payer)');
                console.log(await ERC20ForSPL.balanceOf(owner.address), 'await ERC20ForSPL.balanceOf(owner.address)');
                console.log(await getAccount(connection, solanaUserAta), 'await getAccount(connection, solanaUserAta)');

                console.log('\n\n_scheduleTransaction\n\n');

                const transferAmount = 1000;
                await _scheduleTransaction(
                    solanaUser1, 
                    ERC20ForSPL.target, 
                    ERC20ForSPL.interface.encodeFunctionData("transfer", [owner.address, transferAmount])
                );

                // wait scheduled tx to be processed
                await config.utils.asyncTimeout(SOLANA_TX_TIMEOUT);
                console.log(await ERC20ForSPL.balanceOf(payer), 'await ERC20ForSPL.balanceOf(payer)');
                console.log(await ERC20ForSPL.balanceOf(owner.address), 'await ERC20ForSPL.balanceOf(owner.address)');
                console.log(await getAccount(connection, solanaUserAta), 'await getAccount(connection, solanaUserAta)');

                expect(await ERC20ForSPL.balanceOf(owner.address)).to.be.greaterThan(ownerBalance);
                expect(payerBalance).to.be.greaterThan(await ERC20ForSPL.balanceOf(payer));
                expect(ataAccount.amount).to.be.greaterThan((await getAccount(connection, solanaUserAta)).amount);
            } else {
                this.skip();
            }
        });

        /* it('transfer from Solana user with PDA balance to Neon user', async function () {
            if (grantedTestersWithBalance) {
                
            } else {
                this.skip();
            }
        });

        it('transfer from Solana user with PDA & ATA balance to Neon user', async function () {
            // validate that PDA tokens have been spent
            if (grantedTestersWithBalance) {
                
            } else {
                this.skip();
            }
        });

        it('transfer from Neon user to Solana user', async function () {
            // validate that the tokens are being received to Solana user's ATA account
            if (grantedTestersWithBalance) {
                
            } else {
                this.skip();
            }
        }); */

        it('transfer from Solana user to Solana user', async function () {
            return;
            // validate that the tokens are being received to Solana user's ATA account
            if (grantedTestersWithBalance) {
                const payer = config.utils.SolanaNativeHelper.getPayer(solanaUser1);
                const payer2 = config.utils.SolanaNativeHelper.getPayer(solanaUser2);

                console.log(payer, 'payer');
                console.log(await ERC20ForSPL.balanceOf(payer), 'balanceOf(payer)');

                console.log(payer2, 'payer2');
                console.log(await ERC20ForSPL.balanceOf(payer2), 'balanceOf(payer2)');

                const solanaUserAta = await getAssociatedTokenAddress(
                    new web3.PublicKey(config.DATA.ADDRESSES.ERC20ForSplTokenMint),
                    solanaUser1.publicKey,
                    false
                );
                console.log(solanaUserAta, 'solanaUserAta');

                const solanaUser2Ata = await getAssociatedTokenAddress(
                    new web3.PublicKey(config.DATA.ADDRESSES.ERC20ForSplTokenMint),
                    solanaUser2.publicKey,
                    false
                );
                console.log(solanaUser2Ata, 'solanaUser2Ata');

                const payerBalance = await ERC20ForSPL.balanceOf(payer);
                const ataAccount = await getAccount(connection, solanaUserAta);

                const payer2Balance = await ERC20ForSPL.balanceOf(payer2);
                const ataAccount2 = await getAccount(connection, solanaUser2Ata);

                console.log(await ERC20ForSPL.balanceOf(payer), 'await ERC20ForSPL.balanceOf(payer)');
                console.log((await getAccount(connection, solanaUserAta)).amount, 'getAccount amount');
                console.log(await ERC20ForSPL.balanceOf(payer2), 'await ERC20ForSPL.balanceOf(payer2)');
                console.log((await getAccount(connection, solanaUser2Ata)).amount, 'getAccount amount');

                console.log('\n\n_scheduleTransaction\n\n');

                const transferAmount = 1000;
                await _scheduleTransaction(
                    solanaUser1, 
                    ERC20ForSPL.target, 
                    ERC20ForSPL.interface.encodeFunctionData("transfer", [payer2, transferAmount])
                );

                // wait scheduled tx to be processed
                await config.utils.asyncTimeout(SOLANA_TX_TIMEOUT);

                console.log(await ERC20ForSPL.balanceOf(payer), 'await ERC20ForSPL.balanceOf(payer)');
                console.log((await getAccount(connection, solanaUserAta)).amount, 'getAccount amount');
                console.log(await ERC20ForSPL.balanceOf(payer2), 'await ERC20ForSPL.balanceOf(payer2)');
                console.log((await getAccount(connection, solanaUser2Ata)).amount, 'getAccount amount');
            } else {
                this.skip();
            }
        });

        // *********************************************************************************************************
        // ************************************** /Solana native tests *********************************************
        // *********************************************************************************************************
    });
});

async function _scheduleTransaction(svmKeypair, target, callData) {
    console.log(svmKeypair, '_scheduleTransaction');
    const payer = config.utils.SolanaNativeHelper.getPayer(svmKeypair);
    console.log(payer, 'payer');

    const eth_getTransactionCountRequest = await fetch(process.env.CURVESTAND_EVM_SOL, {
        method: 'POST',
        body: JSON.stringify({"method":"eth_getTransactionCount","params":[payer, "latest"],"id":1,"jsonrpc":"2.0"}),
        headers: { 'Content-Type': 'application/json' }
    });
    const nonce = (await eth_getTransactionCountRequest.json()).result;
    console.log(nonce, 'nonce');

    const eth_chainIdRequest = await fetch(process.env.CURVESTAND_EVM_SOL, {
        method: 'POST',
        body: JSON.stringify({"method":"eth_chainId","params":[],"id":1,"jsonrpc":"2.0"}),
        headers: { 'Content-Type': 'application/json' }
    });
    const chainId = (await eth_chainIdRequest.json()).result;
    console.log(chainId, 'chainId');

    const type = 0x7F;
    const neonSubType = 0x01;

    let txBody = {
        payer: payer,
        sender: '0x',
        nonce: ethers.toBeHex(parseInt(nonce, 16)),
        index: '0x',
        intent: '0x',
        intentCallData: '0x',
        target: target,
        callData: callData,
        value: '0x',
        chainID: chainId,
        gasLimit: ethers.toBeHex(10000000),
        maxFeePerGas: ethers.toBeHex(5000000000000),
        maxPriorityFeePerGas: ethers.toBeHex(Date.now())
    };

    const result = [];
    for (const property in txBody) {
        result.push(txBody[property]);
    }

    console.log(ethers.encodeRlp(result), 'ethers.encodeRlp(result)');
    let neonTransaction = Buffer.concat([
        config.utils.SolanaNativeHelper.numberToBuffer([type]), 
        config.utils.SolanaNativeHelper.numberToBuffer([neonSubType]), 
        config.utils.SolanaNativeHelper.hexToBuffer(ethers.encodeRlp(result))
    ]).toString('hex');

    const [balanceAddress] = config.utils.SolanaNativeHelper.neonBalanceProgramAddressSync(payer, new web3.PublicKey(neon_getEvmParams.result.neonEvmProgramId), parseInt(chainId, 16));
    const [treeAccountAddress] = config.utils.SolanaNativeHelper.neonTreeAccountAddressSync(payer, new web3.PublicKey(neon_getEvmParams.result.neonEvmProgramId), parseInt(chainId, 16), nonce);
    const [authorityPoolAddress] = config.utils.SolanaNativeHelper.neonAuthorityPoolAddressSync(new web3.PublicKey(neon_getEvmParams.result.neonEvmProgramId));
    const associatedTokenAddress = await getAssociatedTokenAddress(new web3.PublicKey('So11111111111111111111111111111111111111112'), authorityPoolAddress, true);
    const index = Math.floor(Math.random() * neon_getEvmParams.result.neonTreasuryPoolCount) % neon_getEvmParams.result.neonTreasuryPoolCount;

    const treasuryPool = {
        index: index,
        publicKey: config.utils.SolanaNativeHelper.treasuryPoolAddressSync(new web3.PublicKey(neon_getEvmParams.result.neonEvmProgramId), index)[0]
    };

    let instruction = await config.utils.SolanaNativeHelper.createScheduledTransactionInstruction(
        process.env.CURVESTAND_SOL,
        {
            neonEvmProgram: new web3.PublicKey(neon_getEvmParams.result.neonEvmProgramId),
            signerAddress: svmKeypair.publicKey,
            balanceAddress,
            treeAccountAddress,
            associatedTokenAddress,
            treasuryPool,
            neonTransaction
        }
    );

    const transaction = new web3.Transaction();
    transaction.add(instruction);

    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.sign(svmKeypair);

    web3.sendAndConfirmTransaction(
        connection,
        transaction,
        [svmKeypair]
    );
}

async function setupTesters(evmUsers, svmUsers) {
    console.log('====== setupTesters ======');

    const provider = new ethers.JsonRpcProvider(process.env.CURVESTAND);
    const neonTokenProxyRpcApi = new NeonProxyRpcApi(process.env.CURVESTAND);

    const eth_chainIdRequest = await fetch(process.env.CURVESTAND, {
        method: 'POST',
        body: JSON.stringify({"method":"eth_chainId","params":[],"id":1,"jsonrpc":"2.0"}),
        headers: { 'Content-Type': 'application/json' }
    });
    const chainId = (await eth_chainIdRequest.json()).result;

    // airdrop NEONs
    await config.utils.airdropNEON(evmUsers[0]);
    await config.utils.airdropNEON(evmUsers[1]);
    await config.utils.airdropNEON(evmUsers[2]);
    await config.utils.airdropNEON(evmUsers[3]);

    // airdrop SOLs
    await config.utils.airdropSOL(svmUsers[0]);
    await config.utils.airdropSOL(svmUsers[1]);
    await config.utils.airdropSOL(svmUsers[2]);
    
    // transfer ERC20ForSpl tokens from Solana to Neon EVM
    const token = {
        chainId: chainId,
        address_spl: config.DATA.ADDRESSES.ERC20ForSplTokenMint,
        address: ERC20ForSPL.target,
        decimals: 9,
        name: 'Dev Neon EVM',
        symbol: 'devNEON',
        logoURI: 'https://neonevm.org/img/logo.svg'
    };

    let solanaWalletSigner = new ethers.Wallet(signerPrivateKey(solanaUser2.publicKey, evmUsers[0]), provider);
    let neonTransferMintTransactionEthersTx = await neonTransferMintTransactionEthers({
        connection,
        proxyApi: neonTokenProxyRpcApi,
        neonEvmProgram: new web3.PublicKey(neon_getEvmParams.result.neonEvmProgramId),
        solanaWallet: solanaUser2.publicKey,
        neonWallet: evmUsers[0],
        walletSigner: solanaWalletSigner,
        splToken: token,
        amount: 100,
        chainId: token.chainId
    });
    neonTransferMintTransactionEthersTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    neonTransferMintTransactionEthersTx.sign(solanaUser2);

    web3.sendAndConfirmTransaction(
        connection,
        neonTransferMintTransactionEthersTx,
        [solanaUser2]
    );
    await config.utils.asyncTimeout(SOLANA_TX_TIMEOUT);
    console.log('Sent NEONs to', evmUsers[0]);

    // send tokens to user 1 & 2
    let tx = await ERC20ForSPL.transfer(evmUsers[1], ethers.parseUnits('10', TOKEN_MINT_DECIMALS));
    await tx.wait(RECEIPTS_COUNT);
    console.log('Sent NEONs to', evmUsers[1]);

    tx = await ERC20ForSPL.transfer(evmUsers[2], ethers.parseUnits('10', TOKEN_MINT_DECIMALS));
    await tx.wait(RECEIPTS_COUNT);
    console.log('Sent NEONs to', evmUsers[2]);

    // ATA creation for 2nd Solana user
    let solanaUserAta = await getAssociatedTokenAddress(
        new web3.PublicKey(config.DATA.ADDRESSES.ERC20ForSplTokenMint),
        solanaUser2.publicKey,
        false
    );
    let transaction = new web3.Transaction();
    transaction.add(
        createAssociatedTokenAccountInstruction(
            solanaUser2.publicKey,
            solanaUserAta,
            solanaUser2.publicKey,
            new web3.PublicKey(config.DATA.ADDRESSES.ERC20ForSplTokenMint),
            TOKEN_PROGRAM_ID, 
            ASSOCIATED_TOKEN_PROGRAM_ID
        )
    );
    web3.sendAndConfirmTransaction(
        connection,
        transaction,
        [solanaUser2]
    );
    await config.utils.asyncTimeout(SOLANA_TX_TIMEOUT);
    console.log('Created ATA', solanaUserAta);

    // grant approval from first and second Solana user to delegate PDA accounts
    let delegateTx = new web3.Transaction();

    let keypairTokenAta = await getAssociatedTokenAddress(
        new web3.PublicKey(config.DATA.ADDRESSES.ERC20ForSplTokenMint),
        svmUsers[0].publicKey,
        false
    );

    let delegatedPda = config.utils.calculatePdaAccount(
        'AUTH',
        ERC20ForSPL.target,
        config.utils.SolanaNativeHelper.getPayer(svmUsers[0]),
        new web3.PublicKey(neon_getEvmParams.result.neonEvmProgramId)
    );

    console.log(keypairTokenAta, 'keypairTokenAta');
    console.log(await ERC20ForSPL.getUserExtAuthority(config.utils.SolanaNativeHelper.getPayer(svmUsers[0])), 'getUserExtAuthority');
    console.log(delegatedPda, 'delegatedPda');

    delegateTx.add(
        createApproveInstruction(
            keypairTokenAta,
            delegatedPda[0],
            svmUsers[0].publicKey,
            '18446744073709551615' // max uint64
        )
    );

    web3.sendAndConfirmTransaction(connection, delegateTx, [svmUsers[0]]);
    await config.utils.asyncTimeout(SOLANA_TX_TIMEOUT);

    delegateTx = new web3.Transaction();

    keypairTokenAta = await getAssociatedTokenAddress(
        new web3.PublicKey(config.DATA.ADDRESSES.ERC20ForSplTokenMint),
        svmUsers[1].publicKey,
        false
    );

    delegatedPda = config.utils.calculatePdaAccount(
        'AUTH',
        ERC20ForSPL.target,
        config.utils.SolanaNativeHelper.getPayer(svmUsers[1]),
        new web3.PublicKey(neon_getEvmParams.result.neonEvmProgramId)
    );

    console.log(keypairTokenAta, 'keypairTokenAta');
    console.log(await ERC20ForSPL.getUserExtAuthority(config.utils.SolanaNativeHelper.getPayer(svmUsers[1])), 'getUserExtAuthority');
    console.log(delegatedPda, 'delegatedPda');

    delegateTx.add(
        createApproveInstruction(
            keypairTokenAta,
            delegatedPda[0],
            svmUsers[1].publicKey,
            '18446744073709551615' // max uint64
        )
    );

    web3.sendAndConfirmTransaction(connection, delegateTx, [svmUsers[1]]);
    await config.utils.asyncTimeout(SOLANA_TX_TIMEOUT);
}