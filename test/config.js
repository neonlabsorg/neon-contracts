const web3 = require("@solana/web3.js");

const config = {
    utils: {
        publicKeyToBytes32: function(pubkey) {
            return ethers.zeroPadValue(ethers.toBeHex(ethers.decodeBase58(pubkey)), 32);
        },
        addressToBytes32: function(address) {
            return ethers.zeroPadValue(ethers.toBeHex(address), 32);
        },
        calculatePdaAccount: function (prefix, tokenEvmAddress, userEvmAddress, neonEvmProgram) {
            const neonAccountAddressBytes = Buffer.concat([Buffer.alloc(12), Buffer.from(config.utils.isValidHex(userEvmAddress) ? userEvmAddress.substring(2) : userEvmAddress, 'hex')]);
            const seed = [
                new Uint8Array([0x03]),
                new Uint8Array(Buffer.from(prefix, 'utf-8')),
                Buffer.from(tokenEvmAddress.substring(2), 'hex'),
                Buffer.from(neonAccountAddressBytes, 'hex')
            ];
        
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