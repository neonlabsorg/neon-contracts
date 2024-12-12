const web3 = require("@solana/web3.js");
const {createApproveInstruction} = require("@solana/spl-token");

const config = {
    DATA: {
        ADDRESSES: {
            ERC20ForSplFactory: '0x40e33C96bd3ffcD4E3ee2c67b3A750D46282EF2E',
            ERC20ForSpl: '0x4914ddea410894Fe3789ACeb70Ac6b2c85117d86',
            ERC20ForSplTokenMint: 'Fq29HDC7MUAu8sUAqFdjPtdCcVVSitvK1wezy7gMpNE3'
        }
    },
    utils: {
        publicKeyToBytes32: function(pubkey) {
            return ethers.zeroPadValue(ethers.toBeHex(ethers.decodeBase58(pubkey)), 32);
        },
        addressToBytes32: function(address) {
            return ethers.zeroPadValue(ethers.toBeHex(address), 32);
        },
        calculatePdaAccount: function (prefix, tokenEvmAddress, salt, neonEvmProgram) {
            /// @param prefix:
                /// "ContractData" - for ERC20ForSpl PDA accounts
                    /// Parameter salt is the EVM user address.
                /// "AUTH" - for external authority in order to use claim & claimTo of ERC20ForSpl standard ( the same as method getExtAuthority in the 006 precompile )
                    /// Parameter salt is the EVM user address.
                /// "PAYER" - for getting payer which could be used in a composability request to Solana ( the same as method getPayer in the 006 precompile ).
                    /// The salt parameter is not passed when using "PAYER" prefix.
            const seed = [
                new Uint8Array([0x03]),
                new Uint8Array(Buffer.from(prefix, 'utf-8')),
                Buffer.from(tokenEvmAddress.substring(2), 'hex')
            ];

            if (salt != undefined) {
                seed.push(Buffer.from(Buffer.concat([Buffer.alloc(12), Buffer.from(config.utils.isValidHex(salt) ? salt.substring(2) : salt, 'hex')]), 'hex'));
            }
        
            return web3.PublicKey.findProgramAddressSync(seed, neonEvmProgram);
        },
        calculateATAAccount: function (prefix, tokenEvmAddress, salt, neonEvmProgram) {

        },
        isValidHex: function(hex) {
            const isHexStrict = /^(0x)?[0-9a-f]*$/i.test(hex.toString());
            if (!isHexStrict) {
                throw new Error(`Given value "${hex}" is not a valid hex string.`);
            } else {
                return isHexStrict;
            }
        },
        toFixed: function(num, fixed) {
            let re = new RegExp('^-?\\d+(?:\.\\d{0,' + (fixed || -1) + '})?');
            return num.toString().match(re)[0];
        },
        asyncTimeout: async function(timeout) {
            return new Promise((resolve) => {
                setTimeout(() => resolve(), timeout);
            })
        },
        delegateSolana: async function delegateSolana(params) {
            // Get NeonEVM program Id
            const neon_getEvmParams = await fetch(params.curvestand, {
                method: 'POST',
                body: JSON.stringify({"method":"neon_getEvmParams","params":[],"id":1,"jsonrpc":"2.0"}),
                headers: { 'Content-Type': 'application/json' }
            });
            const neonEVMProgramId = (await neon_getEvmParams.json()).result.neonEvmProgramId;

            // Calculate delegate's Ext Authority
            const delegateAuthorityPublicKey = this.calculatePdaAccount(
                'AUTH',
                params.ERC20ForSPLContractAddress,
                params.delegateEVMAddress,
                new params.web3.PublicKey(neonEVMProgramId)
            )[0];

            // Approve delegate
            const solanaTx = new params.web3.Transaction();
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
            params.web3.sendAndConfirmTransaction(params.connection, solanaTx, [params.solanaApprover]);
            return delegateAuthorityPublicKey;
        }
    },
};
module.exports = { config };