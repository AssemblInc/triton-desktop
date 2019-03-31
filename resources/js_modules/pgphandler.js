const { app } = require('electron');
const path = require('path');
const kbpgp = require('kbpgp');
const PGP = kbpgp["const"].openpgp;
const fs = require('fs');

let keyFile = path.join(app.getPath('userData'), 'keys.assemblkey');
let opts;
let keyManagers = {
    me: null,
    other: null
};
let keys = {
    private: null,
    public: null
};
let otherKeys = {
    public: null
};

exports.getPrivateKey = function() {
    return keys.private;
};

exports.getPublicKey = function() {
    return keys.public;
};

exports.setOtherKeys = function(publicKey) {
    otherKeys.public = publicKey;
    kbpgp.KeyManager.import_from_armored_pgp({
        armored: publicKey
    }, function(err, keyManager) {
        if (!err) {
            keyManagers.other = keyManager;
            console.log("Other keyManager has been imported into Assembl Desktop. We can now encrypt data.");
        }
        else {
            console.warn("An error occured while importing the public key from the receiver into the KeyManager.");
            console.error(err);
        }
    });
};

function loadKeys(keyManager, newKeys) {
    return new Promise(
        function(resolve, reject) {
            console.log("Loading keypair...");
            let checkForKeys = setInterval(function() {
                if (keys.private != null && keys.public != null) {
                    console.log("Keypair has been loaded!");
                    clearInterval(checkForKeys);
                    if (newKeys) {
                        saveKeys()
                            .then(function() {
                                resolve(keys.public);
                            })
                            .catch(function(err) {
                                console.error(err);
                                reject(err);
                            });
                    }
                    else {
                        resolve(keys.public);
                    }
                }
                else {
                    console.log("Keypair has not been loaded yet.");
                }
            }, 500);

            keyManagers.me = keyManager;
            keyManager.export_pgp_private (
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
            keyManager.export_pgp_public(
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
        }
    );
}

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
            kbpgp.KeyManager.generate(opts, function(err, keyManager) {
                if (!err) {
                    // sign subkeys
                    console.log("Signing subkeys...");
                    keyManager.sign({}, function(err) {
                        if (err) {
                            console.warn("Could not sign subkeys");
                            console.error(err);
                            reject("Could not sign subkeys");
                        }
                        else {
                            loadKeys(keyManager, true)
                                .then(function(publicKey) {
                                    resolve(publicKey);
                                })
                                .catch(function(err) {
                                    reject(err);
                                });
                        }
                    });
                }
                else {
                    console.warn("An error occured while generating a PGP keypair.");
                    console.error(err);
                    reject("Could not generate a PGP keypair");
                }
            });
        }
    );
};

exports.importOldKeys = function(displayName, userId) {
    return new Promise(
        function(resolve, reject) {
            console.log("Importing old keys... Reading file...");
            fs.readFile(keyFile, { encoding: 'utf8' }, function(err, data) {
                if (err) {
                    reject(err);
                }
                else {
                    console.log("Splitting keys...");
                    let tempKeys = data.split("~~~");
                    if (tempKeys.length == 2) {
                        console.log("Importing old keys into kbpgp...");
                        kbpgp.KeyManager.import_from_armored_pgp({
                            armored: tempKeys[0]
                        }, function(err, keyManager) {
                            if (err) {
                                console.error(err);
                                reject(err);
                            }
                            else {
                                keyManager.merge_pgp_private({
                                    armored: tempKeys[1]
                                }, function(err) {
                                    if (err) {
                                        console.error(err);
                                        reject(err);
                                    }
                                    else {
                                        loadKeys(keyManager, false)
                                            .then(function(publicKey) {
                                                resolve(publicKey);
                                            })
                                            .catch(function(err) {
                                                reject(err);
                                            });
                                    }
                                });
                            }
                        });
                    }
                    else {
                        reject("key file is corrupt");
                    }
                }
            });
        }
    );
};

function saveKeys() {
    return new Promise(
        function(resolve, reject) {
            console.log("Writing keys to appdata (" + keyFile + ')...');
            fs.writeFile(keyFile, keys.public + "~~~" + keys.private, function(err) {
                if (err) {
                    console.error(err);
                    reject(err);
                }
                else {
                    console.log("Keys written to appdata");
                    resolve();
                }
            });
        }
    );
};

exports.hasOldValidKeys = function() {
    return new Promise(
        function(resolve, reject) {
            fs.exists(keyFile, function(exists) {
                if (exists) {
                    fs.stat(keyFile, function(err, stats) {
                        if (err) {
                            console.error(err);
                            reject(err);
                        }
                        else {
                            /*
                            *   There should be a better way to check if a key is still valid,
                            *   instead of using the last modified value of the file itself.
                            *   Keybase has a expire_in value (as seen as in the createKey function),
                            *   which might have a function to allow checking for expiration.
                            *   If there is anything like that, we should use this. However, the API
                            *   explanations of kbpgp are very, very bad, and don't include every function
                            *   on its own (they just give a few general examples and that's it)
                            *   so I haven't been able to find it yet.
                            */
                            if (stats.mtimeMs < Date.now() - 1814400000) {
                                console.log("Old keys are older than 21 days and should no longer be valid. Deleting them...");
                                fs.unlink(keyFile, function(err) {
                                    if (err) {
                                        console.error(err);
                                        reject(err);
                                    }
                                    else {
                                        console.log("Old invalid keys deleted.");
                                        resolve(false);
                                    }
                                });
                            }
                            else {
                                console.log("Old keys are still valid.");
                                resolve(true);
                            }
                        }
                    });
                }
                else {
                    console.log("No old valid keys found.");
                    resolve(false);
                }
            });
        }
    );
};

exports.encryptChunk = function(chunk) {
    let buffer = new Buffer.from(chunk);
    let params = {
        msg: buffer,
        encrypt_for: keyManagers.other,
        // sign_with: keyManagers.me
    };
    return new Promise(
        function(resolve, reject) {
            kbpgp.box(params, function(err, result_string, result_buffer) {
                if (err) {
                    reject(err.message);
                }
                else {
                    // send string through instead of buffer
                    resolve(result_string);
                }
            });
        }
    );
};

// in the following function, chunk is a PGP message and not a Buffer nor ArrayBuffer
exports.decryptChunk = function(pgp_msg) {
    return new Promise(
        function(resolve, reject) {
            let keyRing = new kbpgp.keyring.KeyRing();
            keyRing.add_key_manager(keyManagers.me);
            kbpgp.unbox({ keyfetch: keyRing, armored: pgp_msg }, function(err, literals) {
                if (err != null) {
                    console.error(err);
                    reject(err);
                }
                else {
                    // send buffer through instead of string
                    resolve(literals[0].toBuffer());
                }
            });
        }
    );
};