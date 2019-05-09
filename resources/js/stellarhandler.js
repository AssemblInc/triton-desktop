// FOR A NEW ACCOUNT: use following url to get some stellar
// https://horizon-testnet.stellar.org/friendbot?addr=<PUBLICKEY>

const StellarSdk = require('stellar-sdk');

let stellarHandler = {
    initialized: false,
    horizonServer: null,
    keypair: null,
    account: null,

    init: async function(useTestNet) {
        if (!stellarHandler.initialized) {
            if (useTestNet) {
                console.warn("Using Stellar Horizon TESTNET");
                stellarHandler.horizonServer = new StellarSdk.Server('https://horizon-testnet.stellar.org');
                // generate a random keypair for new account on stellar testnet
                stellarHandler.keypair = StellarSdk.Keypair.random();
                StellarSdk.Network.useTestNetwork();
            }
            else {
                console.warn("Using Stellar Horizon PUBLIC");
                stellarHandler.horizonServer = new StellarSdk.Server('https://horizon.stellar.org');
                // retrieve public key from assembl stellar account based on private key
                stellarHandler.keypair = StellarSdk.Keypair.fromSecret("***REMOVED_PRIV_KEY_STELLAR_HORIZON_SOURCE_ACC***");
                StellarSdk.Network.usePublicNetwork();
                // load assembl stellar account
                stellarHandler.account = await stellarHandler.horizonServer.loadAccount(stellarHandler.keypair.publicKey());
            }
            console.log("Public key:", stellarHandler.keypair.publicKey());
            // console.log("Secret key:", stellarHandler.keypair.secret());
            if (useTestNet) {
                console.log("Loading source account...");
                let sourceKeypair = StellarSdk.Keypair.fromSecret("***REMOVED_PRIV_KEY_STELLAR_HORIZON_SOURCE_ACC_TESTNET***");
                let sourceAccount = await stellarHandler.horizonServer.loadAccount(sourceKeypair.publicKey());
                console.log("Creating new testnet account...");
                let accCreateTransaction = new StellarSdk.TransactionBuilder(sourceAccount)
                    .setTimeout(0)
                    .addOperation(StellarSdk.Operation.createAccount({
                        destination: stellarHandler.keypair.publicKey(),
                        startingBalance: "25"
                    }))
                    .build();
                accCreateTransaction.sign(stellarHandler.keypair);
                console.log("Sending account creation transaction...");
                let accCreate = await stellarHandler.horizonServer.submitTransaction(accCreateTransaction);
                console.log(accCreate);
                console.log("Loading account...");
                stellarHandler.account = await stellarHandler.horizonServer.loadAccount(stellarHandler.keypair.publicKey());
            }
        }
        else {
            console.warn("stellarHandler was already initialized!");
        }
    },

    addHash: function(hash) {
        if (hash == null) {
            console.warn("Hash equals null! Not commiting hash");
            return new Promise(function(resolve, reject) {
                reject("Hash equals null");
            });
        }

        if (stellarHandler.account == null) {
            console.warn("stellarHandler.account equals null! Not commiting hash");
            return new Promise(function(resolve, reject) {
                reject("No Stellar account");
            });
        }

        // add hash to stellar blockchain as a hashmemo
        // on a transaction of a few XLM to (currently) Sebastian Mellen
        const transaction = new StellarSdk.TransactionBuilder(stellarHandler.account)
            .setTimeout(0)
            .addOperation(StellarSdk.Operation.payment({
                destination: "GDUSGKXUPJFBITKGP3GKNCYM76JWQPOHOTQCPEFQCLECH73TLTZGJ4QF",
                asset: StellarSdk.Asset.native(),
                amount: '0.000001'
            }))
            .addMemo(new StellarSdk.Memo(StellarSdk.MemoHash, hash))
            .build();
        transaction.sign(stellarHandler.keypair);
        return stellarHandler.horizonServer.submitTransaction(transaction);
    }
};

stellarHandler.init(false);