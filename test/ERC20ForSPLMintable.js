const { ethers } = require("hardhat");
const { expect, assert } = require("chai");
const web3 = require("@solana/web3.js");
const {
    createAssociatedTokenAccountInstruction,
    getAssociatedTokenAddress,
    createApproveInstruction,
    getAccount
} = require("@solana/spl-token");
const { config } = require('./config');
require("dotenv").config();

async function asyncTimeout(timeout) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(), timeout);
    })
}

async function delegateSolana(params) {
    // Get NeonEVM program Id
    const neon_getEvmParams = await fetch(process.env.CURVESTAND, {
        method: 'POST',
        body: JSON.stringify({"method":"neon_getEvmParams","params":[],"id":1,"jsonrpc":"2.0"}),
        headers: { 'Content-Type': 'application/json' }
    });
    const neonEVMProgramId = (await neon_getEvmParams.json()).result.neonEvmProgramId;

    // Calculate delegate Ext Authority
    const delegateAuthorityPublicKey = config.utils.calculatePdaAccount(
        'AUTH',
        params.ERC20ForSPLContractAddress,
        params.delegateEVMAddress,
        new web3.PublicKey(neonEVMProgramId)
    )[0];
    const solanaTx = new web3.Transaction();
    solanaTx.add(
        createApproveInstruction(
            params.solanaApproverATA, // token account to be delegated
            delegateAuthorityPublicKey, // delegate
            params.solanaApprover.publicKey, // owner of token account to be delegated
            params.amount // amount to be delegated
        )
    );
    // let res = await web3.sendAndConfirmTransaction(connection, solanaTx, [payer, solanaApprover]);
    // console.log(res)
    web3.sendAndConfirmTransaction(params.connection, solanaTx, [params.solanaApprover]);
    return delegateAuthorityPublicKey;
}

describe('Test init',  function () {
    const SOLANA_NODE = process.env.CURVESTAND_SOL;
    const connection = new web3.Connection(SOLANA_NODE, "processed");

    const NAME = "TestERC20ForSPLMintable";
    const SYMBOL = "tERC204SPL";
    const DECIMALS = 9;
    const ZERO_AMOUNT = ethers.toBigInt('0');
    const ONE_AMOUNT = ethers.toBigInt('1')
    const AMOUNT =  ethers.parseUnits('1', DECIMALS);
    const DOUBLE_AMOUNT =  ethers.parseUnits('2', DECIMALS);
    const LARGE_AMOUNT =  ethers.parseUnits('1000', DECIMALS);
    const UINT64_MAX_AMOUNT =  ethers.toBigInt('18446744073709551615'); // 2**64 - 1
    const ZERO_ADDRESS = ethers.getAddress('0x0000000000000000000000000000000000000000');
    const RECEIPTS_COUNT = 10;
    const TIMEOUT = 10000;
    const other  = ethers.Wallet.createRandom()
    const other2 = ethers.Wallet.createRandom();

    let owner, user1, user2, user3
    let ownerSolanaPublicKey;
    let user1SolanaPublicKey, user1ExtAuthorityPublicKey;
    let user2SolanaPublicKey;
    let user3SolanaPublicKey;
    let grantedTestersWithBalance;
    let solanaApprover, solanaApproverInBytes, solanaApproverATAInBytes, solanaApproverATA;
    let ERC20ForSPLFactory;
    let ERC20ForSPLMintable;
    let ERC20ForSPLFactoryAddress = '0xC16fbe59074595E56A4DB17f1350fCF83814D560';
    let ERC20ForSPLMintableAddress = '';
    let tokenMint;
    let tx, solanaTx;

    before(async function() {

        // ============================= DEPLOY CONTRACTS ====================================

        [owner, user1, user2, user3] = await ethers.getSigners();


        const ERC20ForSPLMintableContractFactory = await ethers.getContractFactory(
            'contracts/token/ERC20ForSpl/erc20_for_spl.sol:ERC20ForSplMintable'
        );
        const ERC20ForSPLFactoryContractFactory = await ethers.getContractFactory(
            'contracts/token/ERC20ForSpl/erc20_for_spl_factory.sol:ERC20ForSplFactory'
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
            // deploy ERC20ForSPLFactory
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
            ERC20ForSPLMintable = await ethers.deployContract(
                'contracts/token/ERC20ForSpl/erc20_for_spl.sol:ERC20ForSplMintable',
                [
                    NAME,
                    SYMBOL,
                    DECIMALS,
                    owner.address
                ]
            );
            await ERC20ForSPLMintable.waitForDeployment();
            ERC20ForSPLMintableAddress = ERC20ForSPLMintable.target;
            console.log(
                '\nCreating instance of just now deployed ERC20ForSPLMintable contract on Neon EVM with address',
                "\x1b[33m",
                ERC20ForSPLMintableAddress,
                "\x1b[0m",
                '\n'
            );
        }
        tokenMint = await ERC20ForSPLMintable.findMintAccount();
        console.log('\nToken mint - ',  ethers.encodeBase58(tokenMint));

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
    });

    describe('ERC20ForSPLMintable tests',  function() {

        it('Empty storage slots', async function () {
            for (let i = 0; i < 10; ++i) {
                expect(await ethers.provider.getStorage(ERC20ForSPLMintable.target, i)).to.eq(
                    '0x0000000000000000000000000000000000000000000000000000000000000000'
                );
            }
        });

        describe('ERC20ForSplBackbone tests',  function() {
            before(async function() {

                // ==================== CREATE SOLANA APPROVER ACCOUNT, INITIALIZE ATA AND DELEGATE ====================

                solanaApprover = web3.Keypair.fromSecretKey(
                    Buffer.from(ethers.decodeBase58(process.env.PRIVATE_KEY_SOLANA).toString(16), 'hex')
                );
                solanaApproverInBytes = '0x' + ethers.decodeBase58(solanaApprover.publicKey.toBase58()).toString(16);

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
                // let res = await web3.sendAndConfirmTransaction(connection, solanaTx, [payer, solanaApprover]);
                // console.log(res)
                web3.sendAndConfirmTransaction(connection, solanaTx, [solanaApprover]);
                await asyncTimeout(TIMEOUT);

                console.log('\nSolana approver addresses:');
                console.log('Solana system account -', solanaApprover.publicKey.toBase58());
                console.log('Solana data account -', solanaApproverATA.toBase58());

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
/*
            it('getAccountDelegateData return value', async function () {
                // Delegate user2 token account to user3
                await ERC20ForSPLMintable.connect(user2).approveSolana(
                    await ERC20ForSPLMintable.solanaAccount(user3.address),
                    AMOUNT
                );
                let accountDelegateData = await ERC20ForSPLMintable.getAccountDelegateData(user3.address)
                // console.log(accountDelegateData)
                let accountDelegateData2 = await ERC20ForSPLMintable.getAccountDelegateData(user2.address)
                // console.log(accountDelegateData2)
                // DOES IT WORK ?
                expect(accountDelegateData[0]).to.eq(
                    await ERC20ForSPLMintable.solanaAccount(user3.address)
                );
                expect(accountDelegateData[1]).to.eq(AMOUNT);
            });
*/
            it('solanaAccount return value', async function () {
                // Calculate PDA off chain
                const neon_getEvmParamsRequest = await fetch(process.env.CURVESTAND, {
                    method: 'POST',
                    body: JSON.stringify({"method":"neon_getEvmParams","params":[],"id":1,"jsonrpc":"2.0"}),
                    headers: { 'Content-Type': 'application/json' }
                });
                const neon_getEvmParams = await neon_getEvmParamsRequest.json();
                const offChainPDAAccount = config.utils.calculatePdaAccount(
                    'ContractData',
                    ERC20ForSPLMintable.target,
                    user1.address,
                    new web3.PublicKey(neon_getEvmParams.result.neonEvmProgramId)
                )[0].toBase58();

                expect(ethers.encodeBase58(await ERC20ForSPLMintable.solanaAccount(user1.address))).to.eq(offChainPDAAccount)
            });

            /*
            it('findMintAccount return value', async function () {
                expect(await ERC20ForSPLMintable.findMintAccount()).to.eq(
                    // Figure out how to derive mint account
                    "0xe79ad500832caf8f03e5d91a6f8ef45c71479e2b632a282e6fa2477162d664e4"
                );
            });
            */

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
                let delegateAuthorityPublicKey = await delegateSolana({
                    connection,
                    ERC20ForSPLContractAddress: ERC20ForSPLMintableAddress,
                    delegateEVMAddress: user1.address,
                    solanaApproverATA,
                    solanaApprover,
                    amount: AMOUNT
                });
                await asyncTimeout(TIMEOUT);

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
                let delegateAuthorityPublicKey = await delegateSolana({
                    connection,
                    ERC20ForSPLContractAddress: ERC20ForSPLMintableAddress,
                    delegateEVMAddress: user1.address,
                    solanaApproverATA,
                    solanaApprover,
                    amount: AMOUNT
                });
                await asyncTimeout(TIMEOUT);

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
                let delegateAuthorityPublicKey = await delegateSolana({
                    connection,
                    ERC20ForSPLContractAddress: ERC20ForSPLMintableAddress,
                    delegateEVMAddress: user1.address,
                    solanaApproverATA,
                    solanaApprover,
                    amount: AMOUNT
                });
                await asyncTimeout(TIMEOUT);

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
                // Transfer AMOUNT to approver's ATA
                await ERC20ForSPLMintable.connect(owner).transferSolana(solanaApproverATAInBytes, AMOUNT);
                await tx.wait(RECEIPTS_COUNT);

                // Save initial approver and recipient balances
                let initialApproverBalance = ethers.toBigInt(parseInt((
                    await connection.getTokenAccountBalance(solanaApproverATA)
                ).value.amount));
                let initialRecipientBalance = await ERC20ForSPLMintable.balanceOf(user2.address);

                // Set claimAmount to be greater than initialApproverBalance
                const claimAmount =  ethers.toBigInt(initialApproverBalance) + AMOUNT;

                // Approve caller's Ext Authority to claim claimAmount
                let delegateAuthorityPublicKey = await delegateSolana({
                    connection,
                    ERC20ForSPLContractAddress: ERC20ForSPLMintableAddress,
                    delegateEVMAddress: user1.address,
                    solanaApproverATA,
                    solanaApprover,
                    amount: claimAmount
                });
                await asyncTimeout(TIMEOUT);

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
                let delegateAuthorityPublicKey = await delegateSolana({
                    connection,
                    ERC20ForSPLContractAddress: ERC20ForSPLMintableAddress,
                    delegateEVMAddress: user1.address,
                    solanaApproverATA,
                    solanaApprover,
                    amount: AMOUNT
                });
                await asyncTimeout(TIMEOUT);

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
                    await ERC20ForSPLMintable.connect(owner).transferSolana(
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
                    const initialBalance = await ERC20ForSPLMintable.balanceOf(user1.address);
                    const initialSupply = await ERC20ForSPLMintable.totalSupply();
                    tx = await ERC20ForSPLMintable.connect(user1).burn(AMOUNT);
                    await tx.wait(RECEIPTS_COUNT);
                    expect(await ERC20ForSPLMintable.balanceOf(user1.address)).to.equal(initialBalance - AMOUNT);
                    expect(await ERC20ForSPLMintable.totalSupply()).to.equal(initialSupply - AMOUNT);
                } else {
                    this.skip();
                }
            });

            it('transfer', async function () {
                if (grantedTestersWithBalance) {
                    const initialSenderBalance = await ERC20ForSPLMintable.balanceOf(user1.address);
                    const initialRecipientBalance = await ERC20ForSPLMintable.balanceOf(user2.address);
                    tx = await ERC20ForSPLMintable.connect(user1).transfer(user2.address, AMOUNT);
                    await tx.wait(RECEIPTS_COUNT);
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

            it('transferSolana', async function () {
                if (grantedTestersWithBalance) {
                    const initialSenderBalance = await ERC20ForSPLMintable.balanceOf(user1.address);
                    const initialRecipientBalance = await ERC20ForSPLMintable.balanceOf(user2.address);
                    tx = await ERC20ForSPLMintable.connect(user1).transferSolana(
                        await ERC20ForSPLMintable.solanaAccount(user2.address),
                        AMOUNT
                    );
                    await tx.wait(RECEIPTS_COUNT);
                    expect(await ERC20ForSPLMintable.balanceOf(user1.address)).to.eq(initialSenderBalance - AMOUNT);
                    expect(await ERC20ForSPLMintable.balanceOf(user2.address)).to.eq(
                        initialRecipientBalance + AMOUNT
                    );
                } else {
                    this.skip();
                }
            });

            it('approve', async function () {
                const initialAllowance = await ERC20ForSPLMintable.allowance(user2.address, user1.address);
                tx = await ERC20ForSPLMintable.connect(user2).approve(user1.address, AMOUNT);
                await tx.wait(RECEIPTS_COUNT);
                expect(await ERC20ForSPLMintable.allowance(user2.address, user1.address)).to.eq(
                    initialAllowance + AMOUNT
                );
            });

            it('transferFrom', async function () {
                if (grantedTestersWithBalance) {
                    tx = await ERC20ForSPLMintable.connect(user2).approve(user1.address, AMOUNT);
                    await tx.wait(RECEIPTS_COUNT);
                    const initialAllowance = await ERC20ForSPLMintable.allowance(user2.address, user1.address);
                    const initialSenderBalance = await ERC20ForSPLMintable.balanceOf(user2.address);
                    const initialRecipientBalance = await ERC20ForSPLMintable.balanceOf(user1.address);
                    tx = await ERC20ForSPLMintable.connect(user1).transferFrom(user2.address, user1.address, AMOUNT);
                    await tx.wait(RECEIPTS_COUNT);
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

            it('approveSolana: approve different accounts then revoke approval ', async function () {
                tx = await ERC20ForSPLMintable.connect(owner).approveSolana(
                    await ERC20ForSPLMintable.solanaAccount(user1.address),
                    AMOUNT
                );
                await tx.wait(RECEIPTS_COUNT);
                let accountDelegateData = await ERC20ForSPLMintable.getAccountDelegateData(owner.address);
                expect(accountDelegateData[0]).to.eq(await ERC20ForSPLMintable.solanaAccount(user1.address));
                expect(accountDelegateData[1]).to.eq(AMOUNT);

                // Approve different account
                tx = await ERC20ForSPLMintable.connect(owner).approveSolana(
                    await ERC20ForSPLMintable.solanaAccount(user2.address),
                    DOUBLE_AMOUNT
                );
                await tx.wait(RECEIPTS_COUNT);
                accountDelegateData = await ERC20ForSPLMintable.getAccountDelegateData(owner.address);
                expect(accountDelegateData[0]).to.eq(await ERC20ForSPLMintable.solanaAccount(user2.address));
                expect(accountDelegateData[1]).to.eq(DOUBLE_AMOUNT);

                // Revoke approval
                tx = await ERC20ForSPLMintable.connect(owner).approveSolana(
                    await ERC20ForSPLMintable.solanaAccount(user3.address),
                    ZERO_AMOUNT
                );
                await tx.wait(RECEIPTS_COUNT);
                accountDelegateData = await ERC20ForSPLMintable.getAccountDelegateData(owner.address);
                expect(accountDelegateData[0]).to.eq(
                    '0x0000000000000000000000000000000000000000000000000000000000000000'
                );
                expect(accountDelegateData[1]).to.eq(0);
            });

            it('Malicious transfer: reverts with AmountExceedsBalance custom error', async function () {
                // User3 has no balance
                await expect(
                    ERC20ForSPLMintable.connect(user3).transfer(user1.address, AMOUNT)
                ).to.be.revertedWithCustomError(
                    ERC20ForSPLMintable,
                    'AmountExceedsBalance'
                );
            });

            it('Malicious transferFrom: reverts with InvalidAllowance custom error', async function () {
                // User3 has no allowance
                await expect(
                    ERC20ForSPLMintable.connect(user3).transferFrom(user2.address, user3.address, AMOUNT)
                ).to.be.revertedWithCustomError(
                    ERC20ForSPLMintable,
                    'InvalidAllowance'
                );
            });

            it('Malicious burn: reverts with AmountExceedsBalance custom error', async function () {
                // User3 has no balance
                await expect(ERC20ForSPLMintable.connect(user3).burn(AMOUNT)).to.be.revertedWithCustomError(
                    ERC20ForSPLMintable,
                    'AmountExceedsBalance'
                );
            });

            it('Transfer amount > type(uint64).max: reverts with AmountExceedsUint64 custom error', async function () {
                await expect(
                    ERC20ForSPLMintable.connect(user1).transfer(user2.address, UINT64_MAX_AMOUNT + ONE_AMOUNT)
                ).to.be.revertedWithCustomError(
                    ERC20ForSPLMintable,
                    'AmountExceedsUint64'
                );
            });

            it('Burn amount > type(uint64).max: reverts with AmountExceedsUint64 custom error', async function () {
                await expect(
                    ERC20ForSPLMintable.connect(user1).burn(UINT64_MAX_AMOUNT + ONE_AMOUNT)
                ).to.be.revertedWithCustomError(
                    ERC20ForSPLMintable,
                    'AmountExceedsUint64'
                );
            });


        })

        it('mint: malicious mint reverts with InvalidOwner custom error', async function () {
            await expect(ERC20ForSPLMintable.connect(user1).mint(user1.address, AMOUNT)).to.be.revertedWithCustomError(
                ERC20ForSPLMintable,
                'InvalidOwner'
            );
        });

        it('mint: mint to address(0) reverts with EmptyAddress custom error', async function () {
            await expect(ERC20ForSPLMintable.connect(owner).mint(ZERO_ADDRESS, AMOUNT)).to.be.revertedWithCustomError(
                ERC20ForSPLMintable,
                'EmptyAddress'
            );
        });

        it('mint: mint amount too large reverts with AmountExceedsUint64 custom error', async function () {
            let totalSupply = await ERC20ForSPLMintable.totalSupply();
            let amountLeftToMint = UINT64_MAX_AMOUNT - totalSupply
            await expect(ERC20ForSPLMintable.connect(owner).mint(
                user1.address,
                amountLeftToMint + ONE_AMOUNT)
            ).to.be.revertedWithCustomError(ERC20ForSPLMintable, 'AmountExceedsUint64');
        });

        it('mint: mint to new address (non-initialized token account)', async function () {
            let initialSupply = await ERC20ForSPLMintable.totalSupply();
            let initialBalance = await ERC20ForSPLMintable.balanceOf(other.address);
            tx = await ERC20ForSPLMintable.connect(owner).mint(other.address, AMOUNT);
            await tx.wait(RECEIPTS_COUNT);
            let finalSupply = await ERC20ForSPLMintable.totalSupply();
            let finalBalance = await ERC20ForSPLMintable.balanceOf(other.address);
            expect(finalSupply - initialSupply).to.eq(AMOUNT);
            expect(finalBalance - initialBalance).to.eq(AMOUNT);
        });

        it('mint: mint to address with balance (already initialized token account)', async function () {
            tx = await ERC20ForSPLMintable.connect(owner).mint(user1.address, AMOUNT);
            await tx.wait(RECEIPTS_COUNT);
            let initialSupply = await ERC20ForSPLMintable.totalSupply();
            let initialBalance = await ERC20ForSPLMintable.balanceOf(user1.address);
            tx = await ERC20ForSPLMintable.connect(owner).mint(user1.address, AMOUNT);
            await tx.wait(RECEIPTS_COUNT);
            let finalSupply = await ERC20ForSPLMintable.totalSupply();
            let finalBalance = await ERC20ForSPLMintable.balanceOf(user1.address);
            expect(finalSupply - initialSupply).to.eq(AMOUNT);
            expect(finalBalance - initialBalance).to.eq(AMOUNT);
        });
    });
});