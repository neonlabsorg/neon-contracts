const { ethers } = require("hardhat");
const { expect } = require("chai");
const web3 = require("@solana/web3.js");
const bs58 = require("bs58");
const {
    getAssociatedTokenAddress,
    getAccount,
    createApproveInstruction
} = require('@solana/spl-token');
const { config } = require('./config');
require("dotenv").config();
const connection = new web3.Connection(process.env.SVM_NODE, "processed");

let owner, user1, user2, user3;
const solanaUser1 = web3.Keypair.fromSecretKey( // Solana user with ATA balance
    bs58.decode(process.env.PRIVATE_KEY_SOLANA)
);
const solanaUser2 = web3.Keypair.fromSecretKey( // Solana user with ATA & PDA balance
    bs58.decode(process.env.PRIVATE_KEY_SOLANA_2)
);
const solanaUser3 = web3.Keypair.fromSecretKey( // Solana user with PDA balance
    bs58.decode(process.env.PRIVATE_KEY_SOLANA_3)
);
const solanaUser4 = web3.Keypair.fromSecretKey( // Solana user with tokens balance for airdropping tokens
    bs58.decode(process.env.PRIVATE_KEY_SOLANA_4)
);
console.log(solanaUser1.publicKey.toBase58(), 'solanaUser1');
console.log(solanaUser2.publicKey.toBase58(), 'solanaUser2');
console.log(solanaUser3.publicKey.toBase58(), 'solanaUser3');
console.log(solanaUser4.publicKey.toBase58(), 'solanaUser4');
const ERC20ForSPLFactoryAddress = config.DATA.ADDRESSES.ERC20ForSplFactory;
const ERC20ForSPLAddress = config.DATA.ADDRESSES.ERC20ForSpl;
const MockVaultAddress = config.DATA.ADDRESSES.MockVault;
let approverATAWithTokens;
let ERC20ForSPLFactory;
let ERC20ForSPL;
let MockVault;
let ownerSolanaPublicKey;
let user1SolanaPublicKey;
let user2SolanaPublicKey;
let user3SolanaPublicKey;
let grantedTestersWithBalance;
let neon_getEvmParams;
const TOKEN_MINT = config.utils.publicKeyToBytes32(config.DATA.ADDRESSES.ERC20ForSplTokenMint);
const TOKEN_MINT_DECIMALS = 9;
const RECEIPTS_COUNT = 1;
const SOLANA_TX_TIMEOUT = 20000;

describe('Test init', async function () {
    before(async function() {
        [owner, user1, user2, user3] = await ethers.getSigners();
        const ERC20ForSplFactoryContractFactory = await ethers.getContractFactory('contracts/token/ERC20ForSpl/erc20_for_spl_factory.sol:ERC20ForSplFactory');
        const MockVaultFactory = await ethers.getContractFactory('contracts/mocks/MockVault.sol:MockVault');
        const ERC20ForSplContractFactory = await ethers.getContractFactory('contracts/token/ERC20ForSpl/erc20_for_spl.sol:ERC20ForSpl');
        
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

        if (ethers.isAddress(MockVaultAddress)) {
            console.log('\nCreating instance of already deployed MockVaultAddress contract on Neon EVM with address', "\x1b[32m", MockVaultAddress, "\x1b[30m", '\n');
            MockVault = MockVaultFactory.attach(MockVaultAddress);
        } else {
            // deploying MockVault
            MockVault = await ethers.deployContract('contracts/mocks/MockVault.sol:MockVault', [
                ERC20ForSPL.target
            ]);
            await MockVault.waitForDeployment();
            console.log('\nCreating instance of just now deployed MockVault contract on Neon EVM with address', "\x1b[32m", MockVault.target, "\x1b[30m", '\n');
        }

        const neon_getEvmParamsRequest = await fetch(network.config.url, {
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
            await setupTesters();
            grantedTestersWithBalance = true;

            console.log(await ERC20ForSPL.balanceOf(owner.address), 'owner');
            console.log(await ERC20ForSPL.balanceOf(user1.address), 'user1');
            console.log(await ERC20ForSPL.balanceOf(user2.address), 'user2');
            console.log(await ERC20ForSPL.balanceOf(user3.address), 'user3');
        } else {
            const keypairTokenAta = await getAssociatedTokenAddress(
                new web3.PublicKey(config.DATA.ADDRESSES.ERC20ForSplTokenMint),
                solanaUser4.publicKey,
                false
            );
            approverATAWithTokens = keypairTokenAta.toBase58();
        }
    });

    describe('ERC20ForSPL tests', function() {
        it('solanaAccount return value', async function () {
            // Calculate PDA off chain
            const neon_getEvmParamsRequest = await fetch(network.config.url, {
                method: 'POST',
                body: JSON.stringify({"method":"neon_getEvmParams","params":[],"id":1,"jsonrpc":"2.0"}),
                headers: { 'Content-Type': 'application/json' }
            });
            const neon_getEvmParams = await neon_getEvmParamsRequest.json();
            const offChainPDAAccount = config.utils.calculatePdaAccount(
                'ContractData',
                ERC20ForSPL.target,
                user1.address,
                new web3.PublicKey(neon_getEvmParams.result.neonEvmProgramId)
            )[0].toBase58();

            expect(ethers.encodeBase58(await ERC20ForSPL.solanaAccount(user1.address))).to.eq(offChainPDAAccount)
        });

        it('check PDA accounts calculation', async function () {
            const pdaAccountOnChain = ethers.encodeBase58(await ERC20ForSPL.solanaAccount(owner.address));
            const pdaAccountOffChain = config.utils.calculatePdaAccount(
                'ContractData',
                ERC20ForSPL.target,
                owner.address,
                new web3.PublicKey(neon_getEvmParams.result.neonEvmProgramId)
            )[0].toBase58();
            expect(pdaAccountOnChain).to.eq(pdaAccountOffChain);
        });

        it('validate empty storage slots', async function () {
            for (let i = 0; i < 10; ++i) {
                expect(await ethers.provider.getStorage(ERC20ForSPL.target, i)).to.eq('0x0000000000000000000000000000000000000000000000000000000000000000');
            }
        });

        it('test claim & claimTo', async function () {
            if (grantedTestersWithBalance) {
                if (approverATAWithTokens != undefined) {
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

                const burnAmount = ethers.parseUnits('3', TOKEN_MINT_DECIMALS);
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
                const user1Balance = await ERC20ForSPL.balanceOf(user1.address);
                const user2Balance = await ERC20ForSPL.balanceOf(user2.address);
                const transferAmount = ethers.parseUnits('5', TOKEN_MINT_DECIMALS);
                let tx = await ERC20ForSPL.connect(user1).transfer(user2.address, transferAmount);
                await tx.wait(RECEIPTS_COUNT);

                const user1BalanceAfter = await ERC20ForSPL.balanceOf(user1.address);
                const user2BalanceAfter = await ERC20ForSPL.balanceOf(user2.address);
                expect(user1Balance).to.be.greaterThan(user1BalanceAfter);
                expect(user1Balance).to.eq(user1BalanceAfter + transferAmount);
                expect(user2BalanceAfter).to.be.greaterThan(user2Balance);
                expect(user2BalanceAfter).to.eq(user2Balance + transferAmount);
            } else {
                this.skip();
            }
        });

        it('transfer from user2 to user1', async function () {
            if (grantedTestersWithBalance) {
                const user1Balance = await ERC20ForSPL.balanceOf(user1.address);
                const user2Balance = await ERC20ForSPL.balanceOf(user2.address);

                const transferAmount = ethers.parseUnits('5', TOKEN_MINT_DECIMALS);
                let tx = await ERC20ForSPL.connect(user2).transfer(user1.address, transferAmount);
                await tx.wait(RECEIPTS_COUNT);
                
                const user1BalanceAfter = await ERC20ForSPL.balanceOf(user1.address);
                const user2BalanceAfter = await ERC20ForSPL.balanceOf(user2.address);

                expect(user1BalanceAfter).to.be.greaterThan(user1Balance);
                expect(user1BalanceAfter).to.eq(user1Balance + transferAmount);
                expect(user2Balance).to.be.greaterThan(user2BalanceAfter);
                expect(user2Balance).to.eq(user2BalanceAfter + transferAmount);
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
                expect(user1Balance).to.eq(user1BalanceAfter + transferAmount);
                expect(user2BalanceAfter).to.be.greaterThan(user2Balance);
                expect(user2BalanceAfter).to.eq(user2Balance + transferAmount);
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
                expect(user1BalanceAfter).to.eq(user1Balance + transferAmount);
                expect(user2Balance).to.be.greaterThan(user2BalanceAfter);
                expect(user2Balance).to.eq(user2BalanceAfter + transferAmount);
            } else {
                this.skip();
            }
        });

        it('approve from user2 to user1', async function () {
            if (grantedTestersWithBalance) {
                const user2Allowance = await ERC20ForSPL.allowance(user2.address, user1.address);

                const newApprove = user2Allowance + ethers.parseUnits('10', TOKEN_MINT_DECIMALS);
                let tx = await ERC20ForSPL.connect(user2).approve(user1.address, newApprove);
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

                const transferAmount = ethers.parseUnits('1', TOKEN_MINT_DECIMALS);
                let tx = await ERC20ForSPL.connect(user1).transferFrom(user2.address, user1.address, transferAmount);
                await tx.wait(RECEIPTS_COUNT);

                const user2AllowanceAfter = await ERC20ForSPL.allowance(user2.address, user1.address);
                const user1BalanceAfter = await ERC20ForSPL.balanceOf(user1.address);
                const user2BalanceAfter = await ERC20ForSPL.balanceOf(user2.address);
                expect(user2Allowance).to.be.greaterThan(user2AllowanceAfter);
                expect(user2Allowance).to.eq(user2AllowanceAfter + transferAmount);
                expect(user1BalanceAfter).to.be.greaterThan(user1Balance);
                expect(user1BalanceAfter).to.eq(user1Balance + transferAmount);
                expect(user2Balance).to.be.greaterThan(user2BalanceAfter);
                expect(user2Balance).to.eq(user2BalanceAfter + transferAmount);
            } else {
                this.skip();
            }
        });

        it('transferFrom from user1 to MockVault', async function () {
            if (grantedTestersWithBalance) {
                const user1Balance = await ERC20ForSPL.balanceOf(user1.address);
                const mockVaultBalance = await ERC20ForSPL.balanceOf(MockVault.target);

                const transferAmount = ethers.parseUnits('1', TOKEN_MINT_DECIMALS);

                let tx = await ERC20ForSPL.connect(user1).approve(MockVault.target, transferAmount);
                await tx.wait(RECEIPTS_COUNT);

                tx = await MockVault.connect(user1).deposit(transferAmount);
                await tx.wait(RECEIPTS_COUNT);

                const user1BalanceAfter = await ERC20ForSPL.balanceOf(user1.address);
                const mockVaultBalanceAfter = await ERC20ForSPL.balanceOf(MockVault.target);
                expect(user1Balance).to.be.greaterThan(user1BalanceAfter);
                expect(user1Balance).to.eq(user1BalanceAfter + transferAmount);
                expect(mockVaultBalanceAfter).to.be.greaterThan(mockVaultBalance);
                expect(mockVaultBalanceAfter).to.eq(mockVaultBalance + transferAmount);
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

        describe('Reverts',  function() {
            it('approve: reverts with EmptyAddress custom error', async function () {
                // Call approve passing ZERO_ADDRESS as spender
                await expect(
                    ERC20ForSPL.connect(user2).approve(ethers.ZeroAddress, ethers.parseUnits('10', TOKEN_MINT_DECIMALS))
                ).to.be.revertedWithCustomError(
                    ERC20ForSPL,
                    'EmptyAddress'
                );
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
    
            it('Malicious claim - no approval given ( supposed to revert )', async function () {
                if (grantedTestersWithBalance) {
                    await expect(
                        ERC20ForSPL.connect(user3).claim(
                            config.utils.publicKeyToBytes32(approverATAWithTokens),
                            ethers.parseUnits('100', TOKEN_MINT_DECIMALS)
                        )
                    ).to.be.reverted;
                } else {
                    this.skip();
                }
            });
    
            it('Malicious claimTo - no approval given ( supposed to revert )', async function () {
                if (grantedTestersWithBalance) {
                    await expect(
                        ERC20ForSPL.connect(user3).claimTo(
                            config.utils.publicKeyToBytes32(approverATAWithTokens),
                            user2.address,
                            ethers.parseUnits('100', TOKEN_MINT_DECIMALS)
                        )
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

        describe('Scheduling transaction tests', async function () {
            describe('Tests performed from a Solana user with ATA balance', async function () {
                it('Validate Solana user 1 balanceOf ( user with only ATA balance )', async function () {
                    const payer = config.utils.SolanaNativeHelper.getPayer(solanaUser1);

                    const solanaUser1TokenAta = await getAssociatedTokenAddress(
                        new web3.PublicKey(config.DATA.ADDRESSES.ERC20ForSplTokenMint),
                        solanaUser1.publicKey,
                        false
                    );
                    const getUserExtAuthority = ethers.encodeBase58(await ERC20ForSPL.getUserExtAuthority(payer));
                    const solanaUser1TokenAtaAccount = await getAccount(connection, solanaUser1TokenAta);

                    // Validate Solana user 1 have performed at least 1 scheduled transaction
                    // grant approval to the erc20forspl contract if needed
                    if (solanaUser1TokenAtaAccount.delegate == null || solanaUser1TokenAtaAccount.delegate.toBase58() != getUserExtAuthority) {
                        const transaction = new web3.Transaction();
                        transaction.add(createApproveInstruction(
                            solanaUser1TokenAta,
                            new web3.PublicKey(getUserExtAuthority),
                            solanaUser1.publicKey,
                            '18446744073709551615' // max uint64
                        ));
                        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
                        transaction.sign(...[solanaUser1]);

                        const signature = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: false });
                        console.log(`\nhttps://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=${process.env.SVM_NODE}`);

                        // wait scheduled tx to be processed
                        await config.utils.asyncTimeout(SOLANA_TX_TIMEOUT);
                    }

                    expect(await ERC20ForSPL.balanceOf(payer)).to.be.greaterThan(0);
                });

                it('Solana user 1 transfer tokens to user2', async function () {
                    if (grantedTestersWithBalance) {
                        const payer = config.utils.SolanaNativeHelper.getPayer(solanaUser1);
                        const currentBalancePayer = await ERC20ForSPL.balanceOf(payer);
                        const currentBalanceUser2 = await ERC20ForSPL.balanceOf(user2.address);

                        // increase allowance
                        await _scheduleTransaction(
                            solanaUser1, 
                            ERC20ForSPL.target, 
                            ERC20ForSPL.interface.encodeFunctionData("transfer", [user2.address, ethers.parseUnits('1', TOKEN_MINT_DECIMALS)])
                        );

                        expect(currentBalancePayer).to.be.greaterThan(await ERC20ForSPL.balanceOf(payer));
                        expect(await ERC20ForSPL.balanceOf(user2.address)).to.be.greaterThan(currentBalanceUser2);
                    } else {
                        this.skip();
                    }
                }); 

                it('test transferFrom from user2 to Solana user 1', async function () {
                    if (grantedTestersWithBalance) {
                        const payer = config.utils.SolanaNativeHelper.getPayer(solanaUser1);
                        const user2Allowance = await ERC20ForSPL.allowance(user2.address, payer);

                        const newApprove = user2Allowance + ethers.parseUnits('1', TOKEN_MINT_DECIMALS);
                        let tx = await ERC20ForSPL.connect(user2).approve(payer, newApprove);
                        await tx.wait(RECEIPTS_COUNT);

                        const user2AllowanceAfter = await ERC20ForSPL.allowance(user2.address, payer);
                        expect(user2AllowanceAfter).to.be.greaterThan(user2Allowance);

                        const currentBalancePayer = await ERC20ForSPL.balanceOf(payer);
                        const currentBalanceUser2 = await ERC20ForSPL.balanceOf(user2.address);

                        await _scheduleTransaction(
                            solanaUser1, 
                            ERC20ForSPL.target, 
                            ERC20ForSPL.interface.encodeFunctionData("transferFrom", [user2.address, payer, user2AllowanceAfter])
                        );

                        expect(await ERC20ForSPL.balanceOf(payer)).to.be.greaterThan(currentBalancePayer);
                        expect(currentBalanceUser2).to.be.greaterThan(await ERC20ForSPL.balanceOf(user2.address));
                    } else {
                        this.skip();
                    }
                });

                it('test transferFrom from Solana user 1 to MockVault', async function () {
                    if (grantedTestersWithBalance) {
                        const payer = config.utils.SolanaNativeHelper.getPayer(solanaUser1);
                        const transferAmount = ethers.parseUnits('1', TOKEN_MINT_DECIMALS);

                        await _scheduleTransaction(
                            solanaUser1, 
                            ERC20ForSPL.target, 
                            ERC20ForSPL.interface.encodeFunctionData("approve", [MockVault.target, transferAmount])
                        );

                        expect(await ERC20ForSPL.allowance(payer, MockVault.target)).to.eq(transferAmount);

                        const currentBalancePayer = await ERC20ForSPL.balanceOf(payer);
                        const currentBalanceMockVault = await ERC20ForSPL.balanceOf(MockVault.target);

                        await _scheduleTransaction(
                            solanaUser1, 
                            MockVault.target, 
                            MockVault.interface.encodeFunctionData("deposit", [transferAmount])
                        );

                        expect(currentBalancePayer).to.be.greaterThan(await ERC20ForSPL.balanceOf(payer));
                        expect(currentBalancePayer).to.eq(await ERC20ForSPL.balanceOf(payer) + transferAmount);
                        expect(await ERC20ForSPL.balanceOf(MockVault.target)).to.be.greaterThan(currentBalanceMockVault);
                        expect(await ERC20ForSPL.balanceOf(MockVault.target)).to.eq(currentBalanceMockVault + transferAmount);
                    } else {
                        this.skip();
                    }
                });
            });

            describe('Tests performed from a Solana user with ATA & PDA balance', async function () {

            });

            describe('Tests performed from a Solana user with PDA balance', async function () {

            });
        });
    });
});

async function _scheduleTransaction(svmKeypair, target, callData) {
    const payer = config.utils.SolanaNativeHelper.getPayer(svmKeypair);
    console.log(payer, 'payer');

    const signerAddress = svmKeypair.publicKey;

    const eth_getTransactionCountRequest = await fetch(process.env.EVM_SOL_NODE, {
        method: 'POST',
        body: JSON.stringify({"method":"eth_getTransactionCount","params":[payer, "latest"],"id":1,"jsonrpc":"2.0"}),
        headers: { 'Content-Type': 'application/json' }
    });
    const nonce = (await eth_getTransactionCountRequest.json()).result;
    console.log(nonce, 'nonce');

    const eth_chainIdRequest = await fetch(process.env.EVM_SOL_NODE, {
        method: 'POST',
        body: JSON.stringify({"method":"eth_chainId","params":[],"id":1,"jsonrpc":"2.0"}),
        headers: { 'Content-Type': 'application/json' }
    });
    const chainId = (await eth_chainIdRequest.json()).result;
    console.log(chainId, 'chainId');

    const neonEvmProgram = new web3.PublicKey(neon_getEvmParams.result.neonEvmProgramId);
    console.log(neonEvmProgram, 'neonEvmProgram');

    const neonTransaction = config.utils.SolanaNativeHelper.buildTransactionBody(
        payer,
        nonce,
        chainId,
        target,
        callData
    );

    const [balanceAddress] = config.utils.SolanaNativeHelper.neonBalanceProgramAddressSync(payer, neonEvmProgram, parseInt(chainId, 16));
    const [treeAccountAddress] = config.utils.SolanaNativeHelper.neonTreeAccountAddressSync(payer, neonEvmProgram, nonce, parseInt(chainId, 16));
    const [authorityPoolAddress] = config.utils.SolanaNativeHelper.neonAuthorityPoolAddressSync(neonEvmProgram);
    const associatedTokenAddress = await getAssociatedTokenAddress(new web3.PublicKey('So11111111111111111111111111111111111111112'), authorityPoolAddress, true);
    
    const index = Math.floor(Math.random() * neon_getEvmParams.result.neonTreasuryPoolCount) % neon_getEvmParams.result.neonTreasuryPoolCount;
    const treasuryPool = {
        index: index,
        publicKey: config.utils.SolanaNativeHelper.treasuryPoolAddressSync(neonEvmProgram, index)[0]
    };

    let instruction = await config.utils.SolanaNativeHelper.createScheduledTransactionInstruction(
        process.env.SVM_NODE,
        {
            neonEvmProgram,
            signerAddress,
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
    transaction.sign(...[svmKeypair]);

    const signature = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: false });
    console.log(`\nhttps://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=${process.env.SVM_NODE}`);

    // wait scheduled tx to be processed
    await config.utils.asyncTimeout(SOLANA_TX_TIMEOUT);
}

async function setupTesters() {
    console.log('\n============================= setupTesters =============================\n');

    const eth_chainIdRequest = await fetch(process.env.EVM_NODE, {
        method: 'POST',
        body: JSON.stringify({"method":"eth_chainId","params":[],"id":1,"jsonrpc":"2.0"}),
        headers: { 'Content-Type': 'application/json' }
    });
    const chainId = (await eth_chainIdRequest.json()).result;
    console.log(chainId, 'chainId');

    // airdrop NEONs to evmUsers
    await config.utils.airdropNEON(owner.address);
    await config.utils.airdropNEON(user1.address);
    await config.utils.airdropNEON(user2.address);
    await config.utils.airdropNEON(user3.address);

    // airdrop SOLs to svmUsers
    await config.utils.airdropSOL(solanaUser1);
    await config.utils.airdropSOL(solanaUser2);
    await config.utils.airdropSOL(solanaUser3);
    await config.utils.airdropSOL(solanaUser4);

    // send NEONs to evmUsers
    const keypairTokenAta = await getAssociatedTokenAddress(
        new web3.PublicKey(config.DATA.ADDRESSES.ERC20ForSplTokenMint),
        solanaUser4.publicKey,
        false
    );
    approverATAWithTokens = keypairTokenAta.toBase58();
    console.log(approverATAWithTokens, 'approverATAWithTokens');

    if ((await getAccount(connection, keypairTokenAta)).delegate == null) {
        console.error('No approval granted to transfers tokens from Solana to Neon EVM.');
        process.exit();
    }

    let tx = await ERC20ForSPL.connect(owner).claim(
        config.utils.publicKeyToBytes32(approverATAWithTokens),
        ethers.parseUnits('100', TOKEN_MINT_DECIMALS)
    );
    await tx.wait(RECEIPTS_COUNT);
    console.log('Sent NEONs to', owner.address);

    // send tokens to user 1 & 2
    tx = await ERC20ForSPL.transfer(user1.address, ethers.parseUnits('10', TOKEN_MINT_DECIMALS));
    await tx.wait(RECEIPTS_COUNT);
    console.log('Sent NEONs to', user1.address);

    tx = await ERC20ForSPL.transfer(user2.address, ethers.parseUnits('10', TOKEN_MINT_DECIMALS));
    await tx.wait(RECEIPTS_COUNT);
    console.log('Sent NEONs to', user2.address);
}