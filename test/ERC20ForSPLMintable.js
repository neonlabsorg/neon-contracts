const { ethers } = require("hardhat");
const { expect, assert } = require("chai");
const web3 = require("@solana/web3.js");
const {
    createAssociatedTokenAccountInstruction,
    getAssociatedTokenAddress,
    getAccount, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
} = require("@solana/spl-token");
const { config } = require('./config');
const bs58 = require("bs58");
require("dotenv").config();

describe('Test init',  function () {
    const connection = new web3.Connection(
        process.env.SVM_NODE,
        "processed", //  See: https://solana-labs.github.io/solana-web3.js/v1.x/types/Commitment.html
        { confirmTransactionInitialTimeout: 0 } // See: https://solana-labs.github.io/solana-web3.js/v1.x/types/ConnectionConfig.html
    );
    const NAME = "TestERC20ForSPLMintable";
    const SYMBOL = "tERC20xSPL";
    const DECIMALS = 9;
    const ZERO_AMOUNT = ethers.toBigInt('0');
    const ONE_AMOUNT = ethers.toBigInt('1')
    const AMOUNT =  ethers.parseUnits('1', DECIMALS);
    const DOUBLE_AMOUNT =  ethers.parseUnits('2', DECIMALS);
    const LARGE_AMOUNT =  ethers.parseUnits('1000', DECIMALS);
    const UINT64_MAX_AMOUNT =  ethers.toBigInt('18446744073709551615'); // 2**64 - 1
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
    const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';
    const RECEIPTS_COUNT = 3;
    const TIMEOUT = 3000;
    const other  = ethers.Wallet.createRandom()
    const other2 = ethers.Wallet.createRandom();
    let owner, user1, user2, user3;
    let solanaUser1, solanaUser1ATA, solanaUser1PDA, solanaUser1NeonEVMAddress;
    let solanaUser2, solanaUser2PDA, solanaUser2NeonEVMAddress;
    let solanaUser3, solanaUser3ATA, solanaUser3PDA, solanaUser3NeonEVMAddress;
    let ownerSolanaPublicKey;
    let user1SolanaPublicKey;
    let user2SolanaPublicKey;
    let user3SolanaPublicKey;
    let grantedTestersWithBalance;
    let solanaApprover, solanaApproverATAInBytes, solanaApproverATA;
    let ERC20ForSPLFactory;
    let ERC20ForSPLMintable;
    let MockVault;
    let ERC20ForSPLFactoryAddress = '';
    let ERC20ForSPLMintableAddress = '';
    let MockVaultAddress = '';
    let tokenMint;
    let neonEVMParams
    let tx, solanaTx;

    before(async function() {

        // ============================= DEPLOY CONTRACTS ====================================

        [owner, user1, user2, user3] = await ethers.getSigners();

        await config.utils.airdropNEON(owner.address);
        await config.utils.airdropNEON(user1.address);
        await config.utils.airdropNEON(user2.address);
        await config.utils.airdropNEON(user3.address);

        solanaUser1 = web3.Keypair.generate()
        solanaUser2 = web3.Keypair.generate()
        solanaUser3 = web3.Keypair.generate()

        await config.utils.airdropSOL(solanaUser1);
        await config.utils.airdropSOL(solanaUser2);
        await config.utils.airdropSOL(solanaUser3);

        const ERC20ForSPLFactoryContractFactory = await ethers.getContractFactory(
            'contracts/token/ERC20ForSpl/erc20_for_spl_factory.sol:ERC20ForSplFactory'
        );
        const ERC20ForSPLMintableContractFactory = await ethers.getContractFactory(
            'contracts/token/ERC20ForSpl/erc20_for_spl.sol:ERC20ForSplMintable'
        );
        const MockVaultContractFactory = await ethers.getContractFactory(
            'contracts/mocks//MockVault.sol:MockVault'
        );

        if (ethers.isAddress(ERC20ForSPLFactoryAddress)) {
            console.log(
                '\nCreating instance of already deployed ERC20ForSPLFactory contract on Neon EVM with address',
                "\x1b[33m",
                ERC20ForSPLFactoryAddress,
                "\x1b[0m",
                '\n'
            );
            ERC20ForSPLFactory = ERC20ForSPLFactoryContractFactory.attach(ERC20ForSPLFactoryAddress);
        } else {
            ERC20ForSPLFactory = await ethers.deployContract(
                'contracts/token/ERC20ForSpl/erc20_for_spl_factory.sol:ERC20ForSplFactory'
            );
            await ERC20ForSPLFactory.waitForDeployment();
            ERC20ForSPLFactoryAddress = ERC20ForSPLFactory.target;
            console.log(
                '\nCreating instance of just now deployed ERC20ForSplFactory contract on Neon EVM with address',
                "\x1b[33m",
                ERC20ForSPLFactoryAddress,
                "\x1b[0m",
                '\n'
            );
        }

        if (ethers.isAddress(ERC20ForSPLMintableAddress)) {
            console.log(
                '\nCreating instance of already deployed ERC20ForSPLMintable contract on Neon EVM with address',
                "\x1b[33m",
                ERC20ForSPLMintableAddress,
                "\x1b[0m",
                '\n'
            );
            ERC20ForSPLMintable = ERC20ForSPLMintableContractFactory.attach(ERC20ForSPLMintableAddress);
        } else {
            tx = await ERC20ForSPLFactory.createErc20ForSplMintable(
                NAME,
                SYMBOL,
                DECIMALS,
                owner.address
            )
            await tx.wait(RECEIPTS_COUNT);
            ERC20ForSPLMintableAddress = await ERC20ForSPLFactory.allErc20ForSpl(
                parseInt((await ERC20ForSPLFactory.allErc20ForSplLength()).toString()) - 1
            )
            ERC20ForSPLMintable = ERC20ForSPLMintableContractFactory.attach(ERC20ForSPLMintableAddress);
            console.log(
                '\nCreating instance of just now deployed ERC20ForSPLMintable contract on Neon EVM with address',
                "\x1b[33m",
                ERC20ForSPLMintableAddress,
                "\x1b[0m",
                '\n'
            );
        }
        tokenMint = await ERC20ForSPLMintable.findMintAccount();
        console.log('Token mint - ',  ethers.encodeBase58(tokenMint), '\n');

        if (ethers.isAddress(MockVaultAddress)) {
            console.log('\nCreating instance of already deployed MockVault contract on Neon EVM with address',
                "\x1b[33m", MockVaultAddress,
                "\x1b[0m",
                '\n'
            );
            MockVault = MockVaultContractFactory.attach(MockVaultAddress);
        } else {
            MockVault = await ethers.deployContract('contracts/mocks/MockVault.sol:MockVault', [
                ERC20ForSPLMintable.target
            ]);
            await MockVault.waitForDeployment();
            MockVaultAddress = MockVault.target
            console.log('\nCreating instance of just now deployed MockVault contract on Neon EVM with address',
                "\x1b[33m",
                MockVaultAddress,
                "\x1b[0m",
                '\n'
            );
        }

        // ============================= GET USERS EVM ADDRESSES AND SOLANA ACCOUNTS ====================================

        ownerSolanaPublicKey = ethers.encodeBase58(await ERC20ForSPLMintable.solanaAccount(owner.address));
        user1SolanaPublicKey = ethers.encodeBase58(await ERC20ForSPLMintable.solanaAccount(user1.address));
        user2SolanaPublicKey = ethers.encodeBase58(await ERC20ForSPLMintable.solanaAccount(user2.address));
        user3SolanaPublicKey = ethers.encodeBase58(await ERC20ForSPLMintable.solanaAccount(user3.address));

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

        // ============================= GET SOLANA USERS ASSOCIATED TOKEN ACCOUNTS ====================================

        console.log('\nSolana user1 address -', solanaUser1.publicKey.toBase58());
        solanaUser1ATA = await getAssociatedTokenAddress(
            new web3.PublicKey(ethers.encodeBase58(tokenMint)),
            solanaUser1.publicKey,
            false
        );
        console.log('Solana user1 ATA -', solanaUser1ATA.toBase58());
        // Create solanaUser1ATA account if needed
        const solanaUser1ATAInfo = await connection.getAccountInfo(solanaUser1ATA);
        if (!solanaUser1ATAInfo || !solanaUser1ATAInfo.data) {
            const transaction = new web3.Transaction();
            transaction.add(
                createAssociatedTokenAccountInstruction(
                    solanaUser1.publicKey,
                    solanaUser1ATA,
                    solanaUser1.publicKey,
                    new web3.PublicKey(ethers.encodeBase58(tokenMint))
                )
            );
            transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
            transaction.sign(...[solanaUser1]);
            await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: false });
            await config.utils.asyncTimeout(TIMEOUT);
        }

        console.log('\nSolana user2 address -', solanaUser2.publicKey.toBase58());

        console.log('\nSolana user3 address -', solanaUser3.publicKey.toBase58());

        solanaUser3ATA = await getAssociatedTokenAddress(
            new web3.PublicKey(ethers.encodeBase58(tokenMint)),
            solanaUser3.publicKey,
            false
        );
        console.log('Solana user3 ATA -', solanaUser3ATA.toBase58(), '\n');
        // Create solanaUser2ATA account if needed
        const solanaUser3ATAInfo = await connection.getAccountInfo(solanaUser3ATA);
        if (!solanaUser3ATAInfo || !solanaUser3ATAInfo.data) {
            const transaction = new web3.Transaction();
            transaction.add(
                createAssociatedTokenAccountInstruction(
                    solanaUser3.publicKey,
                    solanaUser3ATA,
                    solanaUser3.publicKey,
                    new web3.PublicKey(ethers.encodeBase58(tokenMint))
                )
            );
            transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
            transaction.sign(...[solanaUser3]);
            await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: false });
            await config.utils.asyncTimeout(TIMEOUT);
        }

        const neon_getEvmParamsRequest = await fetch(process.env.EVM_NODE, {
            method: 'POST',
            body: JSON.stringify({"method":"neon_getEvmParams","params":[],"id":1,"jsonrpc":"2.0"}),
            headers: { 'Content-Type': 'application/json' }
        });
        neonEVMParams = await neon_getEvmParamsRequest.json();
    });

    describe('ERC20ForSPLMintable tests',  function() {

        it('Empty storage slots', async function () {
            for (let i = 0; i < 100; ++i) {
                expect(await ethers.provider.getStorage(ERC20ForSPLMintable.target, i)).to.eq(
                    '0x0000000000000000000000000000000000000000000000000000000000000000'
                );
            }
        });

        describe('ERC20ForSplBackbone tests',  function() {
            before(async function() {

                // ==================== CREATE SOLANA APPROVER ACCOUNT, INITIALIZE ATA AND DELEGATE ====================

                solanaApprover = web3.Keypair.generate()
                await config.utils.airdropSOL(solanaApprover);

                solanaApproverATA = await getAssociatedTokenAddress(
                    new web3.PublicKey(ethers.encodeBase58(tokenMint)),
                    solanaApprover.publicKey,
                    false
                );
                solanaApproverATAInBytes = '0x' + ethers.decodeBase58(solanaApproverATA.toBase58()).toString(16);

                solanaTx = new web3.Transaction();
                solanaTx.add(
                   createAssociatedTokenAccountInstruction(
                        solanaApprover.publicKey,
                        solanaApproverATA,
                        solanaApprover.publicKey,
                        new web3.PublicKey(ethers.encodeBase58(tokenMint))
                    )
                )

                web3.sendAndConfirmTransaction(connection, solanaTx, [solanaApprover]);
                await config.utils.asyncTimeout(TIMEOUT);

                console.log('\nSolana approver address -', solanaApprover.publicKey.toBase58());
                console.log('Solana approver ATA -', solanaApproverATA.toBase58(), '\n');

                // ==================== MINT TO USERS AND TRANSFER TOKENS TO SOLANA APPROVER ATA =======================

                tx = await ERC20ForSPLMintable.connect(owner).mint(owner.address, LARGE_AMOUNT);
                await tx.wait(RECEIPTS_COUNT);
                tx = await ERC20ForSPLMintable.connect(owner).mint(user1.address, LARGE_AMOUNT);
                await tx.wait(RECEIPTS_COUNT);
                tx = await ERC20ForSPLMintable.connect(owner).mint(user2.address, LARGE_AMOUNT);
                await tx.wait(RECEIPTS_COUNT);

                grantedTestersWithBalance = (await ERC20ForSPLMintable.balanceOf(owner.address)) >= LARGE_AMOUNT &&
                    (await ERC20ForSPLMintable.balanceOf(user1.address)) >= LARGE_AMOUNT &&
                    (await ERC20ForSPLMintable.balanceOf(user2.address)) >= LARGE_AMOUNT;
            })

            it('Static ERC20 getter functions return values', async function () {
                expect(await ERC20ForSPLMintable.name()).to.eq(NAME);
                expect(await ERC20ForSPLMintable.symbol()).to.eq(SYMBOL);
                expect(await ERC20ForSPLMintable.decimals()).to.eq(DECIMALS.toString());
            });

            it('Other ERC20 getter functions return values', async function () {
                const expectedSupply = (await ERC20ForSPLMintable.balanceOf(owner.address)) +
                    (await ERC20ForSPLMintable.balanceOf(user1.address)) +
                    (await ERC20ForSPLMintable.balanceOf(user2.address)) +
                    (await ERC20ForSPLMintable.balanceOf(user3.address)) +
                    (await ERC20ForSPLMintable.balanceOf(other.address)) +
                    (await ERC20ForSPLMintable.balanceOf(other2.address)) +
                    ethers.toBigInt((await connection.getTokenAccountBalance(solanaApproverATA)).value.amount);
                expect(await ERC20ForSPLMintable.totalSupply()).to.eq(expectedSupply);
                expect(await ERC20ForSPLMintable.balanceOf(user2.address)).to.eq(LARGE_AMOUNT);
                expect(await ERC20ForSPLMintable.balanceOf(user3.address)).to.eq(ZERO_AMOUNT);
                expect(await ERC20ForSPLMintable.allowance(user2.address, user1.address)).to.eq(ZERO_AMOUNT);
            });

            it('getAccountDelegateData return value', async function () {
                // Check initial return value
                let accountDelegateData = await ERC20ForSPLMintable.getAccountDelegateData(user2.address)
                expect(accountDelegateData[0]).to.eq(ZERO_BYTES32);
                expect(accountDelegateData[1]).to.eq(ZERO_AMOUNT);

                // Delegate token account to other
                tx = await ERC20ForSPLMintable.connect(user2).approveSolana(
                    await ERC20ForSPLMintable.solanaAccount(other.address),
                    AMOUNT
                );
                await tx.wait(RECEIPTS_COUNT);

                accountDelegateData = await ERC20ForSPLMintable.getAccountDelegateData(user2.address)
                expect(accountDelegateData[0]).to.eq(
                    await ERC20ForSPLMintable.solanaAccount(other.address)
                );
                expect(accountDelegateData[1]).to.eq(AMOUNT);
            });

            it('getTokenMintATA return value', async function () {
                // Create random test account
                let testAccountKeyPair = web3.Keypair.generate();

                // Calculate test account ATA
                let testAccountATA = await getAssociatedTokenAddress(
                    new web3.PublicKey(ethers.encodeBase58(tokenMint)),
                    testAccountKeyPair.publicKey,
                    false
                );
                let testAccountATAInBytes = '0x' + ethers.decodeBase58(testAccountATA.toBase58()).toString(16);

                // Get test account ATA from ERC20ForSPLMintable contract
                let testAccountATAInBytesFromContract = await ERC20ForSPLMintable.getTokenMintATA(
                    '0x' + ethers.decodeBase58(testAccountKeyPair.publicKey.toBase58()).toString(16)
                )

                // Check that both values are equal
                expect(testAccountATAInBytesFromContract).to.eq(testAccountATAInBytes);
            });

            it('solanaAccount return value', async function () {
                // Calculate PDA off chain
                const offChainPDAAccount = config.utils.calculatePdaAccount(
                    'ContractData',
                    ERC20ForSPLMintable.target,
                    user1.address,
                    new web3.PublicKey(neonEVMParams.result.neonEvmProgramId)
                )[0].toBase58();

                expect(ethers.encodeBase58(await ERC20ForSPLMintable.solanaAccount(user1.address))).to.eq(offChainPDAAccount)
            });

            it('claim', async function () {
                // Transfer AMOUNT to approver's ATA
                tx = await ERC20ForSPLMintable.connect(owner).transferSolana(solanaApproverATAInBytes, AMOUNT);
                await tx.wait(RECEIPTS_COUNT);

                // Save initial approver and recipient balances
                let initialApproverBalance = ethers.toBigInt(parseInt((
                    await connection.getTokenAccountBalance(solanaApproverATA)
                ).value.amount));
                let initialRecipientBalance = await ERC20ForSPLMintable.balanceOf(user1.address);

                // Approve recipient Ext Authority to claim AMOUNT
                let delegateAuthorityPublicKey;
                while(
                    (await getAccount(connection, solanaApproverATA)).delegatedAmount === 0n
                    || !delegateAuthorityPublicKey
                ) {
                    delegateAuthorityPublicKey = await config.utils.delegateSolana({
                        curvestand: process.env.EVM_NODE,
                        web3,
                        connection,
                        ERC20ForSPLContractAddress: ERC20ForSPLMintableAddress,
                        delegateEVMAddress: user1.address,
                        solanaApproverATA,
                        solanaApprover,
                        amount: AMOUNT
                    });
                    await config.utils.asyncTimeout(TIMEOUT);
                }

                // Check approver's delegatedAmount and delegate
                expect((await getAccount(connection, solanaApproverATA)).delegatedAmount).to.equal(AMOUNT);
                expect((await getAccount(connection, solanaApproverATA)).delegate.toBase58()).to.equal(
                    delegateAuthorityPublicKey.toBase58()
                );

                // Claim
                tx = await ERC20ForSPLMintable.connect(user1).claim(
                    solanaApproverATAInBytes,
                    AMOUNT
                );
                await tx.wait(RECEIPTS_COUNT);

                // Check balances after claim
                expect(await ERC20ForSPLMintable.balanceOf(user1.address)).to.equal(
                   initialRecipientBalance + AMOUNT
                );
                expect((await connection.getTokenAccountBalance(solanaApproverATA)).value.amount).to.equal(
                    initialApproverBalance - AMOUNT
                );

                // Check approver's delegatedAmount and delegate after claim
                expect((await getAccount(connection, solanaApproverATA)).delegatedAmount).to.equal(ZERO_AMOUNT);
                expect((await getAccount(connection, solanaApproverATA)).delegate).to.be.null;
            });

            it('claimTo: recipient with balance (already initialized token account)', async function () {
                // Transfer AMOUNT to approver's ATA
                tx = await ERC20ForSPLMintable.connect(owner).transferSolana(solanaApproverATAInBytes, AMOUNT);
                await tx.wait(RECEIPTS_COUNT);

                // Save initial approver and recipient balances
                let initialApproverBalance = ethers.toBigInt(parseInt((
                    await connection.getTokenAccountBalance(solanaApproverATA)
                ).value.amount));
                let initialRecipientBalance = await ERC20ForSPLMintable.balanceOf(user2.address);

                // Approve caller's Ext Authority to claim AMOUNT
                let delegateAuthorityPublicKey;
                while(
                    (await getAccount(connection, solanaApproverATA)).delegatedAmount === 0n
                    || !delegateAuthorityPublicKey
                ) {
                    delegateAuthorityPublicKey = await config.utils.delegateSolana({
                        curvestand: process.env.EVM_NODE,
                        web3,
                        connection,
                        ERC20ForSPLContractAddress: ERC20ForSPLMintableAddress,
                        delegateEVMAddress: user1.address,
                        solanaApproverATA,
                        solanaApprover,
                        amount: AMOUNT
                    });
                    await config.utils.asyncTimeout(TIMEOUT);
                }

                // Check approver's delegatedAmount and delegate
                expect((await getAccount(connection, solanaApproverATA)).delegatedAmount).to.equal(AMOUNT);
                expect((await getAccount(connection, solanaApproverATA)).delegate.toBase58()).to.equal(
                    delegateAuthorityPublicKey.toBase58()
                );

                // Claim
                tx = await ERC20ForSPLMintable.connect(user1).claimTo(
                    solanaApproverATAInBytes,
                    user2.address,
                    AMOUNT
                );
                await tx.wait(RECEIPTS_COUNT);

                // Check balances after claim
                expect(await ERC20ForSPLMintable.balanceOf(user2.address)).to.equal(
                    initialRecipientBalance + AMOUNT
                );
                expect((await connection.getTokenAccountBalance(solanaApproverATA)).value.amount).to.equal(
                    initialApproverBalance - AMOUNT
                );

                // Check approver's delegatedAmount and delegate after claim
                expect((await getAccount(connection, solanaApproverATA)).delegatedAmount).to.equal(ZERO_AMOUNT);
                expect((await getAccount(connection, solanaApproverATA)).delegate).to.be.null;
            });

            it('claimTo: new recipient (non-initialized token account)', async function () {
                // Transfer AMOUNT to approver's ATA
                tx = await ERC20ForSPLMintable.connect(owner).transferSolana(solanaApproverATAInBytes, AMOUNT);
                await tx.wait(RECEIPTS_COUNT);

                // Save initial approver and recipient balances
                let initialApproverBalance = ethers.toBigInt(parseInt((
                    await connection.getTokenAccountBalance(solanaApproverATA)
                ).value.amount));
                let initialRecipientBalance = await ERC20ForSPLMintable.balanceOf(other2.address);

                // Approve caller's Ext Authority to claim AMOUNT
                let delegateAuthorityPublicKey;
                while(
                    (await getAccount(connection, solanaApproverATA)).delegatedAmount === 0n
                    || !delegateAuthorityPublicKey
                ) {
                    delegateAuthorityPublicKey = await config.utils.delegateSolana({
                        curvestand: process.env.EVM_NODE,
                        web3,
                        connection,
                        ERC20ForSPLContractAddress: ERC20ForSPLMintableAddress,
                        delegateEVMAddress: user1.address,
                        solanaApproverATA,
                        solanaApprover,
                        amount: AMOUNT
                    });
                    await config.utils.asyncTimeout(TIMEOUT);
                }

                // Check approver's delegatedAmount and delegate
                expect((await getAccount(connection, solanaApproverATA)).delegatedAmount).to.equal(AMOUNT);
                expect((await getAccount(connection, solanaApproverATA)).delegate.toBase58()).to.equal(
                    delegateAuthorityPublicKey.toBase58()
                );

                // Claim
                tx = await ERC20ForSPLMintable.connect(user1).claimTo(
                    solanaApproverATAInBytes,
                    other2.address,
                    AMOUNT
                );
                await tx.wait(RECEIPTS_COUNT);

                // Check balances after claim
                expect(await ERC20ForSPLMintable.balanceOf(other2.address)).to.equal(
                    initialRecipientBalance + AMOUNT
                );
                expect((await connection.getTokenAccountBalance(solanaApproverATA)).value.amount).to.equal(
                    initialApproverBalance - AMOUNT
                );

                // Check approver's delegatedAmount and delegate after claim
                expect((await getAccount(connection, solanaApproverATA)).delegatedAmount).to.equal(ZERO_AMOUNT);
                expect((await getAccount(connection, solanaApproverATA)).delegate).to.be.null;
            });

            it('Malicious claimTo (insufficient owner balance): reverts with error message', async function () {
                // Save initial approver and recipient balances
                let initialApproverBalance = ethers.toBigInt(parseInt((
                    await connection.getTokenAccountBalance(solanaApproverATA)
                ).value.amount));
                let initialRecipientBalance = await ERC20ForSPLMintable.balanceOf(user2.address);

                // Set claimAmount to be greater than initialApproverBalance
                const claimAmount =  ethers.toBigInt(initialApproverBalance) + AMOUNT;

                // Approve caller's Ext Authority to claim claimAmount
                let delegateAuthorityPublicKey;
                while(
                    (await getAccount(connection, solanaApproverATA)).delegatedAmount === 0n
                    || !delegateAuthorityPublicKey
                ) {
                    delegateAuthorityPublicKey = await config.utils.delegateSolana({
                        curvestand: process.env.EVM_NODE,
                        web3,
                        connection,
                        ERC20ForSPLContractAddress: ERC20ForSPLMintableAddress,
                        delegateEVMAddress: user1.address,
                        solanaApproverATA,
                        solanaApprover,
                        amount: claimAmount
                    });
                    await config.utils.asyncTimeout(TIMEOUT);
                }

                // Check approver's delegatedAmount and delegate
                const delegatedAmount = (await getAccount(connection, solanaApproverATA)).delegatedAmount;
                expect(delegatedAmount).to.equal(claimAmount);
                expect((await getAccount(connection, solanaApproverATA)).delegate.toBase58()).to.equal(
                    delegateAuthorityPublicKey.toBase58()
                );

                // Check that claim amount is greater than initialApproverBalance
                expect(claimAmount).to.be.greaterThan(initialApproverBalance);
                // Check that claim amount equals delegatedAmount
                expect(claimAmount).to.eq(delegatedAmount);

                // Claim
                await expect(ERC20ForSPLMintable.connect(user1).claimTo(
                    solanaApproverATAInBytes,
                    user2.address,
                    claimAmount
                )).to.be.revertedWith('External call fails TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: Error processing Instruction 0: custom program error: 0x1');

                // Check balances after claim
                expect(await ERC20ForSPLMintable.balanceOf(user2.address)).to.equal(
                    initialRecipientBalance
                );
                expect((await connection.getTokenAccountBalance(solanaApproverATA)).value.amount).to.equal(
                    initialApproverBalance
                );

                // Check approver's delegatedAmount and delegate after claim
                expect((await getAccount(connection, solanaApproverATA)).delegatedAmount).to.equal(delegatedAmount);
                expect((await getAccount(connection, solanaApproverATA)).delegate.toBase58()).to.equal(
                    delegateAuthorityPublicKey.toBase58()
                );
            });

            it('Malicious claimTo (insufficient allowance): reverts with error message', async function () {
                // Approve caller's Ext Authority to claim AMOUNT
                let delegateAuthorityPublicKey;
                while(
                    (await getAccount(connection, solanaApproverATA)).delegatedAmount === 0n
                    || !delegateAuthorityPublicKey
                ) {
                    delegateAuthorityPublicKey = await config.utils.delegateSolana({
                        curvestand: process.env.EVM_NODE,
                        web3,
                        connection,
                        ERC20ForSPLContractAddress: ERC20ForSPLMintableAddress,
                        delegateEVMAddress: user1.address,
                        solanaApproverATA,
                        solanaApprover,
                        amount: AMOUNT
                    });
                    await config.utils.asyncTimeout(TIMEOUT);
                }

                // Check approver's delegatedAmount and delegate
                const delegatedAmount = (await getAccount(connection, solanaApproverATA)).delegatedAmount;
                expect(delegatedAmount).to.equal(AMOUNT);
                expect((await getAccount(connection, solanaApproverATA)).delegate.toBase58()).to.equal(
                    delegateAuthorityPublicKey.toBase58()
                );

                // Set claimAmount to be greater than delegated amount
                const claimAmount = delegatedAmount + AMOUNT;

                // Transfer tokens to approver so that approver balance equals claimAmount
                let initialApproverBalance = ethers.toBigInt(parseInt(
                    (await connection.getTokenAccountBalance(solanaApproverATA)).value.amount
                ));
                if(initialApproverBalance < claimAmount) {
                    tx = await ERC20ForSPLMintable.connect(owner).transferSolana(
                        solanaApproverATAInBytes,
                        claimAmount - initialApproverBalance
                    );
                    await tx.wait(RECEIPTS_COUNT);
                }
                // Save initial approver and recipient balances
                initialApproverBalance = ethers.toBigInt(parseInt(
                    (await connection.getTokenAccountBalance(solanaApproverATA)).value.amount
                ));
                let initialRecipientBalance = await ERC20ForSPLMintable.balanceOf(user2.address);

                // Check that claim amount is less than or equals approverBalance
                expect(claimAmount).to.be.lessThanOrEqual(initialApproverBalance);
                // Check that claim amount is greater than delegatedAmount
                expect(claimAmount).to.be.greaterThan(delegatedAmount);

                // Claim
                await expect(ERC20ForSPLMintable.connect(user1).claimTo(
                    solanaApproverATAInBytes,
                    user2.address,
                    claimAmount
                )).to.be.revertedWith('External call fails TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA: Error processing Instruction 0: custom program error: 0x1');

                // Check balances after claim
                expect(await ERC20ForSPLMintable.balanceOf(user2.address)).to.equal(
                    initialRecipientBalance
                );
                expect((await connection.getTokenAccountBalance(solanaApproverATA)).value.amount).to.equal(
                    initialApproverBalance
                );

                // Check approver's delegatedAmount and delegate after claim
                expect((await getAccount(connection, solanaApproverATA)).delegatedAmount).to.equal(delegatedAmount);
                expect((await getAccount(connection, solanaApproverATA)).delegate.toBase58()).to.equal(
                    delegateAuthorityPublicKey.toBase58()
                );
            });

            it('burn', async function () {
                if (grantedTestersWithBalance) {
                    // Save initial caller balance and initial token supply
                    const initialBalance = await ERC20ForSPLMintable.balanceOf(user1.address);
                    const initialSupply = await ERC20ForSPLMintable.totalSupply();

                    // Call burn
                    tx = await ERC20ForSPLMintable.connect(user1).burn(AMOUNT);
                    await tx.wait(RECEIPTS_COUNT);

                    // Check caller's balance and token supply after burn
                    expect(await ERC20ForSPLMintable.balanceOf(user1.address)).to.equal(initialBalance - AMOUNT);
                    expect(await ERC20ForSPLMintable.totalSupply()).to.equal(initialSupply - AMOUNT);
                } else {
                    this.skip();
                }
            });

            it('burn: reverts with AmountExceedsUint64 custom error', async function () {
                // Call burn with amount > type(uint64).max
                await expect(
                    ERC20ForSPLMintable.connect(user1).burn(UINT64_MAX_AMOUNT + ONE_AMOUNT)
                ).to.be.revertedWithCustomError(
                    ERC20ForSPLMintable,
                    'AmountExceedsUint64'
                );
            });

            it('Malicious burn: reverts with AmountExceedsBalance custom error', async function () {
                // User3 has no balance
                expect(await ERC20ForSPLMintable.balanceOf(user3.address)).to.eq(ZERO_AMOUNT);
                // Call burn from user3
                await expect(ERC20ForSPLMintable.connect(user3).burn(AMOUNT)).to.be.revertedWithCustomError(
                    ERC20ForSPLMintable,
                    'AmountExceedsBalance'
                );
            });

            it('burnFrom', async function () {
                if (grantedTestersWithBalance) {
                    // Approve user2 to burn on behalf of user1
                    tx = await ERC20ForSPLMintable.connect(user1).approve(user2.address, AMOUNT);
                    await tx.wait(RECEIPTS_COUNT)

                    // Save initial balance and initial token supply
                    const initialBalance = await ERC20ForSPLMintable.balanceOf(user1.address);
                    const initialSupply = await ERC20ForSPLMintable.totalSupply();

                    // Call burnFrom
                    tx = await ERC20ForSPLMintable.connect(user2).burnFrom(user1.address, AMOUNT);
                    await tx.wait(RECEIPTS_COUNT);

                    // Check balance and token supply after burn
                    expect(await ERC20ForSPLMintable.balanceOf(user1.address)).to.equal(initialBalance - AMOUNT);
                    expect(await ERC20ForSPLMintable.totalSupply()).to.equal(initialSupply - AMOUNT);
                } else {
                    this.skip();
                }
            });

            it('burnFrom:  reverts with InvalidAllowance custom error when called with ZERO_ADDRESS', async function () {
                // Call burnFrom with ZERO_ADDRESS
                await expect(
                    ERC20ForSPLMintable.connect(user1).burnFrom(ZERO_ADDRESS, AMOUNT)
                ).to.be.revertedWithCustomError(
                    ERC20ForSPLMintable,
                    'InvalidAllowance'
                );
            });

            it('transfer', async function () {
                if (grantedTestersWithBalance) {
                    // Save initial sender and recipient balances
                    const initialSenderBalance = await ERC20ForSPLMintable.balanceOf(user1.address);
                    const initialRecipientBalance = await ERC20ForSPLMintable.balanceOf(user2.address);

                    // Call transfer
                    tx = await ERC20ForSPLMintable.connect(user1).transfer(user2.address, AMOUNT);
                    await tx.wait(RECEIPTS_COUNT);

                    // Check sender and recipient balances after transfer
                    expect(await ERC20ForSPLMintable.balanceOf(user1.address)).to.eq(
                        initialSenderBalance - AMOUNT
                    );
                    expect(await ERC20ForSPLMintable.balanceOf(user2.address)).to.eq(
                        initialRecipientBalance + AMOUNT
                    );
                } else {
                    this.skip();
                }
            });

            it('transfer: reverts with EmptyAddress custom error', async function () {
                // Call transfer from user1
                await expect(
                    ERC20ForSPLMintable.connect(user1).transfer(ZERO_ADDRESS, AMOUNT)
                ).to.be.revertedWithCustomError(
                    ERC20ForSPLMintable,
                    'EmptyAddress'
                );
            });

            it('Malicious transfer: reverts with AmountExceedsBalance custom error', async function () {
                // User3 has no balance
                expect(await ERC20ForSPLMintable.balanceOf(user3.address)).to.eq(ZERO_AMOUNT);
                // Call transfer from user3
                await expect(
                    ERC20ForSPLMintable.connect(user3).transfer(user1.address, AMOUNT)
                ).to.be.revertedWithCustomError(
                    ERC20ForSPLMintable,
                    'AmountExceedsBalance'
                );
            });

            it('transferSolana', async function () {
                if (grantedTestersWithBalance) {
                    // Save initial sender and recipient balances
                    const initialSenderBalance = await ERC20ForSPLMintable.balanceOf(user1.address);
                    const initialRecipientBalance = await ERC20ForSPLMintable.balanceOf(user2.address);

                    // Call transferSolana
                    tx = await ERC20ForSPLMintable.connect(user1).transferSolana(
                        await ERC20ForSPLMintable.solanaAccount(user2.address),
                        AMOUNT
                    );
                    await tx.wait(RECEIPTS_COUNT);

                    // Check sender and recipient balances after transferSolana
                    expect(await ERC20ForSPLMintable.balanceOf(user1.address)).to.eq(initialSenderBalance - AMOUNT);
                    expect(await ERC20ForSPLMintable.balanceOf(user2.address)).to.eq(
                        initialRecipientBalance + AMOUNT
                    );
                } else {
                    this.skip();
                }
            });

            it('Malicious transferSolana: reverts with AmountExceedsBalance custom error', async function () {
                // User3 has no balance
                expect(await ERC20ForSPLMintable.balanceOf(user3.address)).to.eq(ZERO_AMOUNT);
                // Call transferSolana from user3
                await expect(
                    ERC20ForSPLMintable.connect(user3).transferSolana(
                        await ERC20ForSPLMintable.solanaAccount(user2.address),
                        AMOUNT
                    )
                ).to.be.revertedWithCustomError(
                    ERC20ForSPLMintable,
                    'AmountExceedsBalance'
                );
            });

            it('approve', async function () {
                // Save initial allowance
                const initialAllowance = await ERC20ForSPLMintable.allowance(user2.address, user1.address);

                // Call approve
                tx = await ERC20ForSPLMintable.connect(user2).approve(user1.address, AMOUNT);
                await tx.wait(RECEIPTS_COUNT);

                // Check allowance after approve
                expect(await ERC20ForSPLMintable.allowance(user2.address, user1.address)).to.eq(
                    initialAllowance + AMOUNT
                );
            });

            it('approve: reverts with EmptyAddress custom error', async function () {
                // Call approve passing ZERO_ADDRESS as spender
                await expect(
                    ERC20ForSPLMintable.connect(user2).approve(ZERO_ADDRESS, AMOUNT)
                ).to.be.revertedWithCustomError(
                    ERC20ForSPLMintable,
                    'EmptyAddress'
                );
            });

            it('transferFrom', async function () {
                if (grantedTestersWithBalance) {
                    // Approve user1 to spend AMOUNT on behalf of user2
                    tx = await ERC20ForSPLMintable.connect(user2).approve(user1.address, AMOUNT);
                    await tx.wait(RECEIPTS_COUNT);

                    // Save initial allowance and initial sender and recipient balances
                    const initialAllowance = await ERC20ForSPLMintable.allowance(user2.address, user1.address);
                    const initialSenderBalance = await ERC20ForSPLMintable.balanceOf(user2.address);
                    const initialRecipientBalance = await ERC20ForSPLMintable.balanceOf(user1.address);

                    // Call transferFrom
                    tx = await ERC20ForSPLMintable.connect(user1).transferFrom(user2.address, user1.address, AMOUNT);
                    await tx.wait(RECEIPTS_COUNT);

                    // Check allowance and sender and recipient balances after transferFrom
                    expect(await ERC20ForSPLMintable.allowance(user2.address, user1.address)).to.eq(
                        initialAllowance - AMOUNT
                    );
                    expect(await ERC20ForSPLMintable.balanceOf(user1.address)).to.eq(
                        initialRecipientBalance + AMOUNT
                    );
                    expect(await ERC20ForSPLMintable.balanceOf(user2.address)).to.eq(initialSenderBalance - AMOUNT);
                } else {
                    this.skip();
                }
            });

            it('transferFrom to MockVault smart contract', async function () {
                if (grantedTestersWithBalance) {
                    // Approve user1 to spend AMOUNT on behalf of user2
                    tx = await ERC20ForSPLMintable.connect(user2).approve(MockVaultAddress, AMOUNT);
                    await tx.wait(RECEIPTS_COUNT);

                    // Save initial allowance and initial sender and recipient balances
                    const initialAllowance = await ERC20ForSPLMintable.allowance(user2.address, MockVaultAddress);
                    const initialSenderBalance = await ERC20ForSPLMintable.balanceOf(user2.address);
                    const initialRecipientBalance = await ERC20ForSPLMintable.balanceOf(MockVaultAddress);

                    // Call transferFrom
                    tx = await MockVault.connect(user2).deposit(AMOUNT);
                    await tx.wait(RECEIPTS_COUNT);

                    // Check allowance and sender and recipient balances after transferFrom
                    expect(await ERC20ForSPLMintable.allowance(user2.address, MockVaultAddress)).to.eq(
                        initialAllowance - AMOUNT
                    );
                    expect(await ERC20ForSPLMintable.balanceOf(MockVaultAddress)).to.eq(
                        initialRecipientBalance + AMOUNT
                    );
                    expect(await ERC20ForSPLMintable.balanceOf(user2.address)).to.eq(initialSenderBalance - AMOUNT);
                } else {
                    this.skip();
                }
            });

            it("Malicious transferFrom: reverts with EmptyAddress custom error", async function () {
                if (grantedTestersWithBalance) {
                    // Call transferFrom from user3
                    await expect(
                        ERC20ForSPLMintable.connect(user3).transferFrom(ZERO_ADDRESS, user3.address, AMOUNT)
                    ).to.be.revertedWithCustomError(
                        ERC20ForSPLMintable,
                        'EmptyAddress'
                    );
                } else {
                    this.skip();
                }
            });

            it('Malicious transferFrom: reverts with InvalidAllowance custom error', async function () {
                // User3 has no allowance
                expect(await ERC20ForSPLMintable.allowance(user2.address, user3.address)).to.eq(ZERO_AMOUNT);
                // Call transferFrom from user3
                await expect(
                    ERC20ForSPLMintable.connect(user3).transferFrom(user2.address, user3.address, AMOUNT)
                ).to.be.revertedWithCustomError(
                    ERC20ForSPLMintable,
                    'InvalidAllowance'
                );
            });

            it("Malicious transferFrom: reverts with AmountExceedsBalance custom error", async function () {
                if (grantedTestersWithBalance) {
                    // User3 has no balance
                    expect(await ERC20ForSPLMintable.balanceOf(user3.address)).to.eq(ZERO_AMOUNT);
                    // Approve user1 to spend AMOUNT on behalf of user3
                    tx = await ERC20ForSPLMintable.connect(user3).approve(user1.address, AMOUNT);
                    await tx.wait(RECEIPTS_COUNT);
                    expect(await ERC20ForSPLMintable.allowance(user3.address, user1.address)).to.eq(AMOUNT);
                    // Call transferFrom from user1
                    await expect(
                        ERC20ForSPLMintable.connect(user1).transferFrom(user3.address, user1.address, AMOUNT)
                    ).to.be.revertedWithCustomError(
                        ERC20ForSPLMintable,
                        'AmountExceedsBalance'
                    );
                } else {
                    this.skip();
                }
            });

            it("transferSolanaFrom to NeonEVM user's arbitrary token account on Solana", async function () {
                if (grantedTestersWithBalance) {
                    // Approve user1 to spend AMOUNT on behalf of user2
                    tx = await ERC20ForSPLMintable.connect(user2).approve(user1.address, AMOUNT);
                    await tx.wait(RECEIPTS_COUNT);

                    // Save initial allowance and initial sender and recipient balances
                    const initialAllowance = await ERC20ForSPLMintable.allowance(user2.address, user1.address);
                    const initialSenderBalance = await ERC20ForSPLMintable.balanceOf(user2.address);
                    const initialRecipientBalance = await ERC20ForSPLMintable.balanceOf(user1.address);

                    // Call transferSolanaFrom
                    const recipientSolanaAccount = await ERC20ForSPLMintable.solanaAccount(user1.address);
                    tx = await ERC20ForSPLMintable.connect(user1).transferSolanaFrom(user2.address, recipientSolanaAccount, AMOUNT);
                    await tx.wait(RECEIPTS_COUNT);

                    // Check allowance and sender and recipient balances after transferSolanaFrom
                    expect(await ERC20ForSPLMintable.allowance(user2.address, user1.address)).to.eq(
                        initialAllowance - AMOUNT
                    );
                    expect(await ERC20ForSPLMintable.balanceOf(user1.address)).to.eq(
                        initialRecipientBalance + AMOUNT
                    );
                    expect(await ERC20ForSPLMintable.balanceOf(user2.address)).to.eq(initialSenderBalance - AMOUNT);
                } else {
                    this.skip();
                }
            });

            it("transferSolanaFrom to Solana user's associated token account on Solana", async function () {
                if (grantedTestersWithBalance) {
                    // Get Solana user's ATA in bytes
                    const solanaUser1ATAInBytes = config.utils.publicKeyToBytes32(solanaUser1ATA.toBase58());

                    // Approve user1 to spend AMOUNT on behalf of user2
                    tx = await ERC20ForSPLMintable.connect(user2).approve(user1.address, AMOUNT);
                    await tx.wait(RECEIPTS_COUNT);

                    // Save initial allowance and initial sender and recipient balances
                    const initialAllowance = await ERC20ForSPLMintable.allowance(user2.address, user1.address);
                    const initialSenderBalance = await ERC20ForSPLMintable.balanceOf(user2.address);
                    // Get initial recipient balance from Solana (because balanceOf won't show user's ATA token balance
                    // until user has scheduled at least one NeonEVM transaction)
                    const initialRecipientBalance = (await getAccount(connection, solanaUser1ATA)).amount;

                    // Call transferSolanaFrom
                    tx = await ERC20ForSPLMintable.connect(user1).transferSolanaFrom(
                        user2.address,
                        solanaUser1ATAInBytes,
                        AMOUNT
                    );
                    await tx.wait(RECEIPTS_COUNT);

                    // Check allowance and sender and recipient balances after transferSolanaFrom
                    expect(await ERC20ForSPLMintable.allowance(user2.address, user1.address)).to.eq(
                        initialAllowance - AMOUNT
                    );

                    // Get final recipient balance from Solana (because balanceOf won't show user's ATA token balance
                    // until user has scheduled at least one NeonEVM transaction)
                    const finalRecipientBalance = (await getAccount(connection, solanaUser1ATA)).amount;

                    expect(finalRecipientBalance).to.eq(
                        initialRecipientBalance + AMOUNT
                    );
                    expect(await ERC20ForSPLMintable.balanceOf(user2.address)).to.eq(initialSenderBalance - AMOUNT);
                } else {
                    this.skip();
                }
            });

            it("transferSolanaFrom to Solana user's associated token account on Solana via MockVault smart contract", async function () {
                if (grantedTestersWithBalance) {
                    // Get Solana user's ATA in bytes
                    const solanaUser1ATAInBytes = config.utils.publicKeyToBytes32(solanaUser1ATA.toBase58());

                    // Approve MockVault to spend AMOUNT on behalf of user2
                    tx = await ERC20ForSPLMintable.connect(user2).approve(MockVaultAddress, AMOUNT);
                    await tx.wait(RECEIPTS_COUNT);

                    // Save initial allowance and initial sender and recipient balances
                    const initialAllowance = await ERC20ForSPLMintable.allowance(user2.address, MockVaultAddress);
                    const initialSenderBalance = await ERC20ForSPLMintable.balanceOf(user2.address);
                    // Get initial recipient balance from Solana (because balanceOf won't show user's ATA token balance
                    // until user has scheduled at least one NeonEVM transaction)
                    const initialRecipientBalance = (await getAccount(connection, solanaUser1ATA)).amount;

                    // Call transferSolanaFrom
                    tx = await MockVault.connect(user2).depositToSolana(AMOUNT, solanaUser1ATAInBytes);
                    await tx.wait(RECEIPTS_COUNT);

                    // Check allowance and sender and recipient balances after transferSolanaFrom
                    expect(await ERC20ForSPLMintable.allowance(user2.address,MockVaultAddress)).to.eq(
                        initialAllowance - AMOUNT
                    );

                    // Get final recipient balance from Solana (because balanceOf won't show user's ATA token balance
                    // until user has scheduled at least one NeonEVM transaction)
                    const finalRecipientBalance = (await getAccount(connection, solanaUser1ATA)).amount;

                    expect(finalRecipientBalance).to.eq(
                        initialRecipientBalance + AMOUNT
                    );
                    expect(await ERC20ForSPLMintable.balanceOf(user2.address)).to.eq(initialSenderBalance - AMOUNT);
                } else {
                    this.skip();
                }
            });

            it("Malicious transferSolanaFrom: reverts with EmptyAddress custom error", async function () {
                if (grantedTestersWithBalance) {
                    // Call transferSolanaFrom from user3
                    const recipientSolanaAccount = await ERC20ForSPLMintable.solanaAccount(user3.address);
                    await expect(
                        ERC20ForSPLMintable.connect(user3).transferSolanaFrom(ZERO_ADDRESS, recipientSolanaAccount, AMOUNT)
                    ).to.be.revertedWithCustomError(
                        ERC20ForSPLMintable,
                        'EmptyAddress'
                    );
                } else {
                    this.skip();
                }
            });

            it("Malicious transferSolanaFrom: reverts with InvalidAllowance custom error", async function () {
                if (grantedTestersWithBalance) {
                    // User3 has no allowance
                    expect(await ERC20ForSPLMintable.allowance(user2.address, user3.address)).to.eq(ZERO_AMOUNT);
                    // Call transferSolanaFrom from user3
                    const recipientSolanaAccount = await ERC20ForSPLMintable.solanaAccount(user3.address);
                    await expect(
                        ERC20ForSPLMintable.connect(user3).transferSolanaFrom(user2.address, recipientSolanaAccount, AMOUNT)
                    ).to.be.revertedWithCustomError(
                        ERC20ForSPLMintable,
                        'InvalidAllowance'
                    );
                } else {
                    this.skip();
                }
            });

            it("Malicious transferSolanaFrom: reverts with AmountExceedsBalance custom error", async function () {
                if (grantedTestersWithBalance) {
                    // User3 has no balance
                    expect(await ERC20ForSPLMintable.balanceOf(user3.address)).to.eq(ZERO_AMOUNT);
                    // Approve user1 to spend AMOUNT on behalf of user3
                    tx = await ERC20ForSPLMintable.connect(user3).approve(user1.address, AMOUNT);
                    await tx.wait(RECEIPTS_COUNT);
                    expect(await ERC20ForSPLMintable.allowance(user3.address, user1.address)).to.eq(AMOUNT);
                    // Call transferSolanaFrom from user1
                    const recipientSolanaAccount = await ERC20ForSPLMintable.solanaAccount(user1.address);
                    await expect(
                        ERC20ForSPLMintable.connect(user1).transferSolanaFrom(user3.address, recipientSolanaAccount, AMOUNT)
                    ).to.be.revertedWithCustomError(
                        ERC20ForSPLMintable,
                        'AmountExceedsBalance'
                    );
                } else {
                    this.skip();
                }
            });


            it('approveSolana: approve different accounts then revoke approval ', async function () {
                // Approve user1 to spend on behalf of owner
                tx = await ERC20ForSPLMintable.connect(owner).approveSolana(
                    await ERC20ForSPLMintable.solanaAccount(user1.address),
                    AMOUNT
                );
                await tx.wait(RECEIPTS_COUNT);

                // Check owner's accountDelegateData
                let accountDelegateData = await ERC20ForSPLMintable.getAccountDelegateData(owner.address);
                expect(accountDelegateData[0]).to.eq(await ERC20ForSPLMintable.solanaAccount(user1.address));
                expect(accountDelegateData[1]).to.eq(AMOUNT);

                // Approve user2 to spend on behalf of owner
                tx = await ERC20ForSPLMintable.connect(owner).approveSolana(
                    await ERC20ForSPLMintable.solanaAccount(user2.address),
                    DOUBLE_AMOUNT
                );
                await tx.wait(RECEIPTS_COUNT);

                // Check owner's accountDelegateData
                accountDelegateData = await ERC20ForSPLMintable.getAccountDelegateData(owner.address);
                expect(accountDelegateData[0]).to.eq(await ERC20ForSPLMintable.solanaAccount(user2.address));
                expect(accountDelegateData[1]).to.eq(DOUBLE_AMOUNT);

                // Revoke approval
                tx = await ERC20ForSPLMintable.connect(owner).approveSolana(
                    await ERC20ForSPLMintable.solanaAccount(ZERO_ADDRESS),
                    ZERO_AMOUNT
                );
                await tx.wait(RECEIPTS_COUNT);

                // Check owner's accountDelegateData
                accountDelegateData = await ERC20ForSPLMintable.getAccountDelegateData(owner.address);
                expect(accountDelegateData[0]).to.eq(
                    '0x0000000000000000000000000000000000000000000000000000000000000000'
                );
                expect(accountDelegateData[1]).to.eq(ZERO_AMOUNT);
            });

            it('Transfer amount > type(uint64).max: reverts with AmountExceedsUint64 custom error', async function () {
                // Call transfer with amount > type(uint64).max
                await expect(
                    ERC20ForSPLMintable.connect(user1).transfer(user2.address, UINT64_MAX_AMOUNT + ONE_AMOUNT)
                ).to.be.revertedWithCustomError(
                    ERC20ForSPLMintable,
                    'AmountExceedsUint64'
                );
            });

            it('Burn amount > type(uint64).max: reverts with AmountExceedsUint64 custom error', async function () {
                // Call burn with amount > type(uint64).max
                await expect(
                    ERC20ForSPLMintable.connect(user1).burn(UINT64_MAX_AMOUNT + ONE_AMOUNT)
                ).to.be.revertedWithCustomError(
                    ERC20ForSPLMintable,
                    'AmountExceedsUint64'
                );
            });

            describe('Solana native tests', function() {
                describe('Solana user with only associated token account', function() {
                    before('Schedule first NeonEVM transaction to register Solana user account', async function() {
                        // Once a first transaction has been scheduled on NeonEVM by a Solana account, a NeonEVM address is
                        // associated to that Solana account and the 32 bytes address of that Solana account is returned by the
                        // SOLANA_NATIVE.solanaAddress function when passing the associated NeonEVM address
                        await config.utils.SolanaNativeHelper.scheduleTransaction(
                            connection,
                            neonEVMParams,
                            solanaUser1,
                            ERC20ForSPLMintableAddress,
                            ERC20ForSPLMintable.interface.encodeFunctionData("approve", [MockVaultAddress, AMOUNT])
                        );
                        await config.utils.asyncTimeout(TIMEOUT);

                        // Calculate the NeonEVM address associated with solanaUser1 account
                        solanaUser1NeonEVMAddress = ethers.dataSlice(
                            ethers.keccak256(solanaUser1.publicKey.toBytes()),
                            12,
                            32
                        );

                        // Check that scheduled transaction was executed
                        expect(await ERC20ForSPLMintable.allowance(solanaUser1NeonEVMAddress, MockVaultAddress)).to.eq(AMOUNT);
                    })

                    it('receive to Solana associated token account', async function() {
                        // Save initial balance of solanaUser1's associated token account (ATA)
                        const initialRecipientBalance = (await getAccount(connection, solanaUser1ATA)).amount;

                        // Transfer tokens to the NeonEVM address associated to solanaUser1 account
                        tx = await ERC20ForSPLMintable.connect(user1).transfer(solanaUser1NeonEVMAddress, AMOUNT);
                        await tx.wait(RECEIPTS_COUNT);

                        // Check that tokens were sent to solanaUser1's ATA
                        const finalRecipientBalance = (await getAccount(connection, solanaUser1ATA)).amount;
                        expect(finalRecipientBalance).to.eq(initialRecipientBalance + AMOUNT);
                    })

                    it('balanceOf includes Solana ATA balance only after delegating to external authority', async function() {
                        // Transfer tokens to the NeonEVM address associated to solanaUser1 account
                        tx = await ERC20ForSPLMintable.connect(user1).transfer(solanaUser1NeonEVMAddress, AMOUNT);
                        await tx.wait(RECEIPTS_COUNT);

                        // Initially returned balance of solanaUser1 is zero
                        const initialReturnedBalance = await ERC20ForSPLMintable.balanceOf(solanaUser1NeonEVMAddress);
                        expect(initialReturnedBalance).to.eq(ZERO_AMOUNT);

                        // Delegate Solana ATA balance to external authority
                        let delegateAuthorityPublicKey;
                        while(
                            (await getAccount(connection, solanaUser1ATA)).delegatedAmount === 0n
                            || !delegateAuthorityPublicKey
                            ) {
                            delegateAuthorityPublicKey = await config.utils.delegateSolana({
                                curvestand: process.env.EVM_NODE,
                                web3,
                                connection,
                                ERC20ForSPLContractAddress: ERC20ForSPLMintableAddress,
                                delegateEVMAddress: solanaUser1NeonEVMAddress,
                                solanaApproverATA: solanaUser1ATA,
                                solanaApprover: solanaUser1,
                                amount: UINT64_MAX_AMOUNT
                            });
                            await config.utils.asyncTimeout(TIMEOUT);
                        }

                        // Check returned balance of solanaUser1's associated token account (ATA)
                        const finalReturnedBalance = await ERC20ForSPLMintable.balanceOf(solanaUser1NeonEVMAddress);
                        expect(finalReturnedBalance).to.be.greaterThan(ZERO_AMOUNT);
                    })

                    it('transfers from Solana ATA when arbitrary token account does not exist', async function() {
                        // Transfer tokens to the NeonEVM address associated to solanaUser1 account
                        tx = await ERC20ForSPLMintable.connect(user1).transfer(solanaUser1NeonEVMAddress, AMOUNT);
                        await tx.wait(RECEIPTS_COUNT);

                        // Get arbitrary token account attributed to solanaUser1 by NeonEVM
                        solanaUser1PDA = new web3.PublicKey(ethers.encodeBase58(
                            await ERC20ForSPLMintable.solanaAccount(solanaUser1NeonEVMAddress)
                        ));

                        // Check that solanaUser1's arbitrary token account does not exist
                        expect(await connection.getAccountInfo(solanaUser1PDA)).to.be.null;

                        // Save initial sender and recipient balances
                        const initialSenderBalance = await ERC20ForSPLMintable.balanceOf(solanaUser1NeonEVMAddress);
                        const initialRecipientBalance = await ERC20ForSPLMintable.balanceOf(user1.address);

                        // Save initial balance of solanaUser1's ATA
                        const initialSenderATABalance = (await getAccount(connection, solanaUser1ATA)).amount;

                        // Transfer from solanaUser1 by scheduling a NeonEVM transaction on Solana
                        await config.utils.SolanaNativeHelper.scheduleTransaction(
                            connection,
                            neonEVMParams,
                            solanaUser1,
                            ERC20ForSPLMintableAddress,
                            ERC20ForSPLMintable.interface.encodeFunctionData("transfer", [user1.address, AMOUNT])
                        );
                        await config.utils.asyncTimeout(TIMEOUT);

                        // Check that scheduled transaction was executed
                        expect(await ERC20ForSPLMintable.balanceOf(solanaUser1NeonEVMAddress)).to.eq(initialSenderBalance - AMOUNT);
                        expect(await ERC20ForSPLMintable.balanceOf(user1.address)).to.eq(initialRecipientBalance + AMOUNT);

                        // Check solanaUser1's ATA balance
                        expect((await getAccount(connection, solanaUser1ATA)).amount).to.eq(initialSenderATABalance - AMOUNT);
                    })
                })

                describe("Solana user with only arbitrary token account", function() {
                    it("transfer to unregistered Solana user's NeonEVM address to create arbitrary token account", async function() {
                        // Calculate the NeonEVM address associated with solanaUser2 account
                        solanaUser2NeonEVMAddress = ethers.dataSlice(
                            ethers.keccak256(solanaUser2.publicKey.toBytes()),
                            12,
                            32
                        );

                        // Get arbitrary token account attributed to solanaUser2 by NeonEVM
                        solanaUser2PDA = new web3.PublicKey(ethers.encodeBase58(
                            await ERC20ForSPLMintable.solanaAccount(solanaUser2NeonEVMAddress)
                        ));

                        // Check that solanaUser2 balance is initially zero
                        expect(await ERC20ForSPLMintable.balanceOf(solanaUser2NeonEVMAddress)).to.eq(ZERO_AMOUNT);

                        // Check that solanaUser2's arbitrary token account does not exist yet
                        expect(await connection.getAccountInfo(solanaUser2PDA)).to.be.null;

                        // Transfer to the NeonEVM address associated to solanaUser2 account
                        tx = await ERC20ForSPLMintable.connect(user1).transfer(solanaUser2NeonEVMAddress, AMOUNT);
                        await tx.wait(RECEIPTS_COUNT);

                        // Check that solanaUser2's arbitrary token account has been initialized
                        expect(await connection.getAccountInfo(solanaUser2PDA)).not.to.be.null;

                        // Check that solanaUser2's arbitrary token account has received tokens
                        expect((await getAccount(connection, solanaUser2PDA)).amount).to.eq(AMOUNT);

                        // Check that balanceOf includes arbitrary token account balance
                        expect(await ERC20ForSPLMintable.balanceOf(solanaUser2NeonEVMAddress)).to.eq(AMOUNT);
                    })

                    it('transfer from arbitrary token account',async function() {
                        // Save initial sender and recipient balances
                        const initialSenderBalance = await ERC20ForSPLMintable.balanceOf(solanaUser2NeonEVMAddress);
                        const initialRecipientBalance = await ERC20ForSPLMintable.balanceOf(user1.address);

                        // Save initial balance of solanaUser2's arbitrary token account
                        const initialSenderPDABalance = (await getAccount(connection, solanaUser2PDA)).amount;

                        // Transfer from solanaUser2 by scheduling a NeonEVM transaction on Solana
                        await config.utils.SolanaNativeHelper.scheduleTransaction(
                            connection,
                            neonEVMParams,
                            solanaUser2,
                            ERC20ForSPLMintableAddress,
                            ERC20ForSPLMintable.interface.encodeFunctionData("transfer", [user1.address, AMOUNT])
                        );
                        await config.utils.asyncTimeout(TIMEOUT);

                        // Check that scheduled transaction was executed
                        expect(await ERC20ForSPLMintable.balanceOf(solanaUser2NeonEVMAddress)).to.eq(initialSenderBalance - AMOUNT);
                        expect(await ERC20ForSPLMintable.balanceOf(user1.address)).to.eq(initialRecipientBalance + AMOUNT);

                        // Check solanaUser2's arbitrary token account balance
                        expect((await getAccount(connection, solanaUser2PDA)).amount).to.eq(initialSenderPDABalance - AMOUNT);
                    })
                })

                describe("Solana user with both associated token account and arbitrary token account", function() {
                    before("Transfer to unregistered Solana user's NeonEVM address to create arbitrary token account", async function() {
                        // Calculate the NeonEVM address associated with solanaUser3 account
                        solanaUser3NeonEVMAddress = ethers.dataSlice(
                            ethers.keccak256(solanaUser3.publicKey.toBytes()),
                            12,
                            32
                        );

                        // Get arbitrary token account attributed to solanaUser3 by NeonEVM
                        solanaUser3PDA = new web3.PublicKey(ethers.encodeBase58(
                            await ERC20ForSPLMintable.solanaAccount(solanaUser3NeonEVMAddress)
                        ));

                        // Check that solanaUser3 balance is initially zero
                        expect(await ERC20ForSPLMintable.balanceOf(solanaUser3NeonEVMAddress)).to.eq(ZERO_AMOUNT);

                        // Check that solanaUser3's arbitrary token account does not exist yet
                        expect(await connection.getAccountInfo(solanaUser3PDA)).to.be.null;

                        // Transfer to the NeonEVM address associated to solanaUser3 account
                        tx = await ERC20ForSPLMintable.connect(user1).transfer(solanaUser3NeonEVMAddress, DOUBLE_AMOUNT);
                        await tx.wait(RECEIPTS_COUNT);

                        // Wait for solanaUser3's arbitrary token account to be created
                        while(!(await connection.getAccountInfo(solanaUser3PDA))) {
                            console.log('wait...')
                            console.log(await connection.getAccountInfo(solanaUser3PDA))
                            await config.utils.asyncTimeout(TIMEOUT);
                        }

                        // Check that solanaUser3's arbitrary token account has received tokens
                        expect((await getAccount(connection, solanaUser3PDA)).amount).to.eq(DOUBLE_AMOUNT);

                        // Check that balanceOf includes arbitrary token account balance
                        expect(await ERC20ForSPLMintable.balanceOf(solanaUser3NeonEVMAddress)).to.eq(DOUBLE_AMOUNT);
                    })

                    before('Schedule first NeonEVM transaction to register Solana user account', async function() {
                        // Once a first transaction has been scheduled on NeonEVM by a Solana account, a NeonEVM address is
                        // associated to that Solana account and the 32 bytes address of that Solana account is returned by the
                        // SOLANA_NATIVE.solanaAddress function when passing the associated NeonEVM address
                        await config.utils.SolanaNativeHelper.scheduleTransaction(
                            connection,
                            neonEVMParams,
                            solanaUser3,
                            ERC20ForSPLMintableAddress,
                            ERC20ForSPLMintable.interface.encodeFunctionData("approve", [MockVaultAddress, AMOUNT])
                        );
                        await config.utils.asyncTimeout(TIMEOUT);

                        // Calculate the NeonEVM address associated with solanaUser3 account
                        solanaUser3NeonEVMAddress = ethers.dataSlice(
                            ethers.keccak256(solanaUser3.publicKey.toBytes()),
                            12,
                            32
                        );

                        // Check that scheduled transaction was executed
                        expect(await ERC20ForSPLMintable.allowance(solanaUser3NeonEVMAddress, MockVaultAddress)).to.eq(AMOUNT);
                    })

                    it('receive to Solana associated token account', async function() {
                        // Save initial balance of solanaUser1's associated token account (ATA)
                        const initialRecipientBalance = (await getAccount(connection, solanaUser3ATA)).amount;

                        // Transfer tokens to the NeonEVM address associated to solanaUser1 account
                        tx = await ERC20ForSPLMintable.connect(user1).transfer(solanaUser3NeonEVMAddress, DOUBLE_AMOUNT);
                        await tx.wait(RECEIPTS_COUNT);

                        // Check that tokens were sent to solanaUser3's ATA
                        const finalRecipientBalance = (await getAccount(connection, solanaUser3ATA)).amount;
                        expect(finalRecipientBalance).to.eq(initialRecipientBalance + DOUBLE_AMOUNT);
                    })

                    it('balanceOf includes Solana ATA balance only after delegating to external authority', async function() {
                        // Get balance of solanaUser3 arbitrary token account
                        const solanaUser3PDABalance = (await getAccount(connection, solanaUser3PDA)).amount;

                        // Transfer tokens to the NeonEVM address associated to solanaUser3 account
                        tx = await ERC20ForSPLMintable.connect(user1).transfer(solanaUser3NeonEVMAddress, AMOUNT);
                        await tx.wait(RECEIPTS_COUNT);

                        // Initially returned balance of solanaUser3 equals balance of solanaUser3 arbitrary token account
                        const initialReturnedBalance = await ERC20ForSPLMintable.balanceOf(solanaUser3NeonEVMAddress);
                        expect(initialReturnedBalance).to.eq(solanaUser3PDABalance);

                        // Delegate Solana ATA balance to external authority
                        let delegateAuthorityPublicKey;
                        while(
                            (await getAccount(connection, solanaUser3ATA)).delegatedAmount === 0n
                            || !delegateAuthorityPublicKey
                            ) {
                            delegateAuthorityPublicKey = await config.utils.delegateSolana({
                                curvestand: process.env.EVM_NODE,
                                web3,
                                connection,
                                ERC20ForSPLContractAddress: ERC20ForSPLMintableAddress,
                                delegateEVMAddress: solanaUser3NeonEVMAddress,
                                solanaApproverATA: solanaUser3ATA,
                                solanaApprover: solanaUser3,
                                amount: UINT64_MAX_AMOUNT
                            });
                            await config.utils.asyncTimeout(TIMEOUT);
                        }

                        // Check returned balance of solanaUser3's associated token account (ATA)
                        const finalReturnedBalance = await ERC20ForSPLMintable.balanceOf(solanaUser3NeonEVMAddress);
                        expect(finalReturnedBalance).to.be.greaterThan(solanaUser3PDABalance);
                    })

                    it('transfer from arbitrary token account in priority', async function(){
                        // Save initial recipient balance
                        const initialRecipientBalance = await ERC20ForSPLMintable.balanceOf(user1.address);
                        // Save initial sender balance
                        const initialSenderBalance = await ERC20ForSPLMintable.balanceOf(solanaUser3NeonEVMAddress);
                        // Save initial balance of solanaUser3's arbitrary token account
                        const initialSolanaUser3PDABalance = (await getAccount(connection, solanaUser3PDA)).amount;
                        // Save initial balance of solanaUser3's ATA
                        const initialSolanaUser3ATABalance = (await getAccount(connection, solanaUser3ATA)).amount;

                        // Transfer from solanaUser3 by scheduling a NeonEVM transaction on Solana
                        await config.utils.SolanaNativeHelper.scheduleTransaction(
                            connection,
                            neonEVMParams,
                            solanaUser3,
                            ERC20ForSPLMintableAddress,
                            ERC20ForSPLMintable.interface.encodeFunctionData("transfer", [user1.address, AMOUNT])
                        );
                        await config.utils.asyncTimeout(TIMEOUT);

                        // Check that scheduled transaction was executed
                        expect(await ERC20ForSPLMintable.balanceOf(solanaUser3NeonEVMAddress)).to.eq(initialSenderBalance - AMOUNT);
                        expect(await ERC20ForSPLMintable.balanceOf(user1.address)).to.eq(initialRecipientBalance + AMOUNT);

                        // Check that solanaUser3's arbitrary token account balance decreased by AMOUNT
                        expect((await getAccount(connection, solanaUser3PDA)).amount).to.eq(initialSolanaUser3PDABalance - AMOUNT);

                        // Check that solanaUser3's ATA balance did not change
                        expect((await getAccount(connection, solanaUser3ATA)).amount).to.eq(initialSolanaUser3ATABalance);
                    })

                    it('transfer from both arbitrary token account and associated token account', async function(){
                        // Save initial recipient balance
                        const initialRecipientBalance = await ERC20ForSPLMintable.balanceOf(user1.address);
                        // Save initial sender balance
                        const initialSenderBalance = await ERC20ForSPLMintable.balanceOf(solanaUser3NeonEVMAddress);
                        // Save initial balance of solanaUser3's arbitrary token account
                        const initialSolanaUser3PDABalance = (await getAccount(connection, solanaUser3PDA)).amount;
                        // Save initial balance of solanaUser3's ATA
                        const initialSolanaUser3ATABalance = (await getAccount(connection, solanaUser3ATA)).amount;

                        // Transfer from solanaUser3 by scheduling a NeonEVM transaction on Solana
                        await config.utils.SolanaNativeHelper.scheduleTransaction(
                            connection,
                            neonEVMParams,
                            solanaUser3,
                            ERC20ForSPLMintableAddress,
                            ERC20ForSPLMintable.interface.encodeFunctionData("transfer", [user1.address, DOUBLE_AMOUNT])
                        );
                        await config.utils.asyncTimeout(TIMEOUT);

                        // Check that scheduled transaction was executed
                        expect(await ERC20ForSPLMintable.balanceOf(solanaUser3NeonEVMAddress)).to.eq(initialSenderBalance - DOUBLE_AMOUNT);
                        expect(await ERC20ForSPLMintable.balanceOf(user1.address)).to.eq(initialRecipientBalance + DOUBLE_AMOUNT);

                        // Check that solanaUser3's arbitrary token account balance decreased by AMOUNT
                        expect((await getAccount(connection, solanaUser3PDA)).amount).to.eq(initialSolanaUser3PDABalance - AMOUNT);

                        // Check that solanaUser3's arbitrary token account balance is now zero
                        expect((await getAccount(connection, solanaUser3PDA)).amount).to.eq(ZERO_AMOUNT);

                        // Check that solanaUser3's associated token account balance decreased by AMOUNT
                        expect((await getAccount(connection, solanaUser3ATA)).amount).to.eq(initialSolanaUser3ATABalance - AMOUNT);
                    })

                    it('transfer from associated token account when arbitrary token account balance is zero', async function(){
                        // Save initial recipient balance
                        const initialRecipientBalance = await ERC20ForSPLMintable.balanceOf(user1.address);
                        // Save initial sender balance
                        const initialSenderBalance = await ERC20ForSPLMintable.balanceOf(solanaUser3NeonEVMAddress);
                        // Save initial balance of solanaUser3's ATA
                        const initialSolanaUser3ATABalance = (await getAccount(connection, solanaUser3ATA)).amount;

                        // Check that balance of solanaUser3's arbitrary token account is zero
                        expect((await getAccount(connection, solanaUser3PDA)).amount).to.eq(ZERO_AMOUNT);

                        // Transfer from solanaUser3 by scheduling a NeonEVM transaction on Solana
                        await config.utils.SolanaNativeHelper.scheduleTransaction(
                            connection,
                            neonEVMParams,
                            solanaUser3,
                            ERC20ForSPLMintableAddress,
                            ERC20ForSPLMintable.interface.encodeFunctionData("transfer", [user1.address, AMOUNT])
                        );
                        await config.utils.asyncTimeout(TIMEOUT);

                        // Check that scheduled transaction was executed
                        expect(await ERC20ForSPLMintable.balanceOf(solanaUser3NeonEVMAddress)).to.eq(initialSenderBalance - AMOUNT);
                        expect(await ERC20ForSPLMintable.balanceOf(user1.address)).to.eq(initialRecipientBalance + AMOUNT);

                        // Check that solanaUser3's arbitrary token account balance is still zero
                        expect((await getAccount(connection, solanaUser3PDA)).amount).to.eq(ZERO_AMOUNT);

                        // Check that solanaUser3's ATA balance decreased by AMOUNT
                        expect((await getAccount(connection, solanaUser3ATA)).amount).to.eq(initialSolanaUser3ATABalance - AMOUNT);
                    })
                })
            })
        })

        it('mint: malicious mint reverts with InvalidOwner custom error', async function () {
            // Call mint from user1 (not owner)
            await expect(ERC20ForSPLMintable.connect(user1).mint(user1.address, AMOUNT)).to.be.revertedWithCustomError(
                ERC20ForSPLMintable,
                'InvalidOwner'
            );
        });

        it('mint: mint to address(0) reverts with EmptyAddress custom error', async function () {
            // Call mint to ZERO_ADDRESS
            await expect(ERC20ForSPLMintable.connect(owner).mint(ZERO_ADDRESS, AMOUNT)).to.be.revertedWithCustomError(
                ERC20ForSPLMintable,
                'EmptyAddress'
            );
        });

        it('mint: mint amount too large reverts with AmountExceedsUint64 custom error', async function () {
            let totalSupply = await ERC20ForSPLMintable.totalSupply();
            let amountLeftToMint = UINT64_MAX_AMOUNT - totalSupply
            // Call mint with amount value such that amount + totalSupply > type(uint64).max
            await expect(ERC20ForSPLMintable.connect(owner).mint(
                user1.address,
                amountLeftToMint + ONE_AMOUNT)
            ).to.be.revertedWithCustomError(ERC20ForSPLMintable, 'AmountExceedsUint64');
        });

        it('mint: mint to new address (non-initialized token account)', async function () {
            // Save initial token supply and initial recipient balance
            let initialSupply = await ERC20ForSPLMintable.totalSupply();
            let initialRecipientBalance = await ERC20ForSPLMintable.balanceOf(other.address);

            // Call mint
            tx = await ERC20ForSPLMintable.connect(owner).mint(other.address, AMOUNT);
            await tx.wait(RECEIPTS_COUNT);

            // Check token supply and recipient balance after mint
            expect(await ERC20ForSPLMintable.totalSupply()).to.eq(initialSupply + AMOUNT);
            expect(await ERC20ForSPLMintable.balanceOf(other.address)).to.eq(initialRecipientBalance + AMOUNT);
        });

        it('mint: mint to address with balance (already initialized token account)', async function () {
            // Save initial token supply and initial recipient balance
            let initialSupply = await ERC20ForSPLMintable.totalSupply();
            let initialRecipientBalance = await ERC20ForSPLMintable.balanceOf(user1.address);

            // Call mint
            tx = await ERC20ForSPLMintable.connect(owner).mint(user1.address, AMOUNT);
            await tx.wait(RECEIPTS_COUNT);

            // Check token supply and recipient balance after mint
            expect(await ERC20ForSPLMintable.totalSupply()).to.eq(initialSupply + AMOUNT);
            expect(await ERC20ForSPLMintable.balanceOf(user1.address)).to.eq(initialRecipientBalance + AMOUNT);
        });
    })
});
