const web3 = require("@solana/web3.js");

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
        }
    },
};
module.exports = { config };