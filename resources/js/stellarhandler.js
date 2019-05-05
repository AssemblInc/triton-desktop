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
                stellarHandler.keypair = StellarSdk.Keypair.random();
                StellarSdk.Network.useTestNetwork();
            }
            else {
                console.warn("Using Stellar Horizon PUBLIC");
                stellarHandler.horizonServer = new StellarSdk.Server('https://horizon.stellar.org');
                stellarHandler.keypair = StellarSdk.Keypair.fromSecret("***REMOVED_PRIV_KEY_STELLAR_HORIZON_SOURCE_ACC***");
                StellarSdk.Network.usePublicNetwork();
                stellarHandler.account = await stellarHandler.horizonServer.loadAccount(stellarHandler.keypair.publicKey());
            }
            console.log("Public key:", stellarHandler.keypair.publicKey());
            console.log("Secret key:", stellarHandler.keypair.secret());
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

/*
let horizonServer = new StellarSdk.Server('https://horizon.stellar.org');
// let keypair = StellarSdk.Keypair.random();
let keypair = ;
console.log(keypair);
console.log("Public key:", keypair.publicKey());
console.log("Secret key:", keypair.secret());

StellarSdk.Network.usePublicNetwork();

async function hashMemo(key = null, hash = null) {
    if (hash == null) {
        return;
    }
    const account = await horizonServer.loadAccount(key || keypair.publicKey());
    const transaction = new StellarSdk.TransactionBuilder(account)
        .setTimeout(0)
        .addOperation(StellarSdk.Operation.bumpSequence({
            bumpTo: account.sequenceNumber() + 1,
        }))
        .addMemo(new StellarSdk.Memo(StellarSdk.MemoHash, hash))
        .build();
    transaction.sign(keypair);
    const r = await horizonServer.submitTransaction(transaction);
    console.log(r);
}

async function create() {
    StellarSdk.Network.useTestNetwork();
    // create an Account object using locally tracked sequence number
    const account = await horizonServer.loadAccount(keypair.publicKey());    
    var transaction = new StellarSdk.TransactionBuilder(account)
        .addOperation(StellarSdk.Operation.createAccount({
          destination: keypair.publicKey(),
          startingBalance: "10"  // in XLM
        }))
        .build();
    
    transaction.sign(keypair);
    // transaction.sign(keypair);
    // try {
    const r = await horizonServer.submitTransaction(transaction);
    console.log(r);
    const user = await horizonServer.loadAccount(keypair.publicKey());    
    var transaction = new StellarSdk.TransactionBuilder(user)
        .addOperation(StellarSdk.Operation.setOptions({
            signer: {
            ed25519PublicKey: publicKey,
            weight: 2
            }
        }))
        .addOperation(StellarSdk.Operation.setOptions({
            masterWeight: 1, // set master key weight
            lowThreshold: 1,
            medThreshold: 2, // a payment is medium threshold
            highThreshold: 2 // make sure to have enough weight to add up to the high threshold!
        }))
    .build();
    
    transaction.sign(keypair);
    try {
        const r2 = await horizonServer.submitTransaction(transaction);    
        console.log(r2);
    } catch (e) { 
        console.log(e);
        console.log(e.response.data.extras)
    }
};

// create();
*/