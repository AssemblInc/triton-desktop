const kbpgp = require('kbpgp');
const PGP = kbpgp["const"].openpgp;

let opts;
let keys = {
    private: null,
    public: null
};

exports.getPrivateKey = function() {
    return keys.private;
};

exports.getPublicKey = function() {
    return keys.public;
};

exports.createKeys = function(displayName, userId) {
    if (userId == null) {
        userId = Math.random().toString(36).substring(11);
    }
    opts = {
        userid: displayName + " <" + userId + "@users.assembl.science>",
        primary: {
            nbits: 4096,
            flags: PGP.certify_keys | PGP.sign_data | PGP.auth | PGP.encrypt_comm | PGP.encrypt_storage,
            expire_in: 86400 * 42       // 42 days
        },
        subkeys: [
            {
                nbits: 2048,
                flags: PGP.sign_data,
                expire_in: 86400 * 21   // 21 days
            }, 
            {
                nbits: 2048,
                flags: PGP.encrypt_storage,
                expire_in: 86400 * 21   // 21 days
            }
        ]
    };

    return new Promise(
        function(resolve, reject) {
            let checkForKeys = setInterval(function() {
                if (keys.private != null && keys.public != null) {
                    console.log("Keypair has been generated!");
                    clearInterval(checkForKeys);
                    resolve(keys.public);
                }
                else {
                    console.log("Keypair has not been generated yet.");
                }
            }, 500);
            kbpgp.KeyManager.generate(opts, function(err, sender) {
                if (!err) {
                    // sign subkeys
                    sender.sign({}, function(err) {
                        if (err) {
                            console.warn("Could not sign subkeys");
                            console.error(err);
                            clearInterval(checkForKeys);
                            reject("Could not sign subkeys");
                            return;
                        }
                        sender.export_pgp_private (
                            {
                                passphrase: ''
                            },
                            function(err, pgp_private) {
                                if (err) {
                                    console.warn("Could not export private key");
                                    console.error(err);
                                    clearInterval(checkForKeys);
                                    reject("Could not export private key");
                                    return;
                                }
                                console.log("Private key exported");
                                keys.private = pgp_private;
                            }
                        );
                        sender.export_pgp_public(
                            {

                            },
                            function(err, pgp_public) {
                                if (err) {
                                    console.warn("Could not export public key");
                                    console.error(err);
                                    clearInterval(checkForKeys);
                                    reject("Could not export public key");
                                    return;
                                }
                                console.log("Public key exported");
                                keys.public = pgp_public;
                            }
                        );
                    });
                }
                else {
                    console.warn("An error occured while generating a PGP keypair.");
                    console.error(err);
                    clearInterval(checkForKeys);
                    reject("Could not generate a PGP keypair");
                }
            });
        }
    );
};