// FROM https://medium.com/@brandonstilson/lets-encrypt-files-with-node-85037bea8c0e

const { app } = require('electron');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const zlib = require('zlib');
const stream = require('stream');
const keccak256 = require('js-sha3').keccak256;
const AppendInitVect = require('./appendInitVect');

const file = path.join(app.getPath('userData'), 'userdata.assemblsec');
console.log(file);
console.log("Available ciphers:");
console.log(crypto.getCiphers());
let initialized = false;
let savedData = null;
let pw = null;

function getCipherKey(password) {
    return crypto.createHash('sha256').update(password).digest();
}

exports.isInitialized = function() {
    return initialized;
};

exports.init = function(password, reset) {
    return new Promise(function(resolve, reject) {
        const hashedPassword = keccak256(password);
        if (initialized !== true) {
            if (fs.existsSync(file) && reset !== true) {
                console.log("Loading UserData...");
                const readInitVect = fs.createReadStream(file, { end: 15 });
    
                let initVect;
                readInitVect.on('data', function(chunk) {
                    console.log("readInitVect data", chunk);
                    initVect = chunk;
                });
    
                readInitVect.on('close', function() {
                    console.log("readInitVect closed");
                    const cipherKey = getCipherKey(hashedPassword);
                    const readStream = fs.createReadStream(file, { start: 16 });
                    const decipher = crypto.createDecipheriv('AES-256-CTR', cipherKey, initVect);
                    const unzip = zlib.createUnzip();
                    let tempData = "";
                    unzip.on('error', function(err) {
                        console.log(err);
                        console.log("If the above error equals an -- incorrect header check -- , that means the password was incorrect. Don't worry about it");
                        reject("incorrect_password");
                    });
                    unzip.on('data', function(chunk) {
                        console.log("unzip data", chunk);
                        let part = chunk.toString();
                        tempData += part;
                    });
                    unzip.on('end', function() {
                        try {
                            console.log("UserData loaded");
                            pw = hashedPassword;
                            savedData = JSON.parse(tempData);
                            initialized = true;
                            resolve();
                        }
                        catch(err) {
                            reject("corrupted_data");
                        }
                    });
                    
                    readStream
                        .pipe(decipher)
                        .pipe(unzip);
                });
            }
            else {
                console.log("UserData created");
                savedData = {};
                pw = hashedPassword;
                initialized = true;
                resolve();
            }
        }
        else {
            reject("already_initialized");
        }
    });
};

exports.saveData = function(key, data) {
    savedData[key] = data;
};

exports.loadData = function(key) {
    return savedData[key];  
};

exports.hasData = function(key) {
    return Object.keys(savedData).indexOf(key) > -1;
};

exports.resetSave = function() {
    savedData = {};
};

exports.finalize = function() {
    const initVect = crypto.randomBytes(16);

    console.log(pw);
    const CIPHER_KEY = getCipherKey(pw);
    const readStream = new stream.Readable;
    readStream.push(JSON.stringify(savedData));
    readStream.push(null);      // specify end of stream
    const gzip = zlib.createGzip();
    const cipher = crypto.createCipheriv('AES-256-CTR', CIPHER_KEY, initVect);
    const appendInitVect = new AppendInitVect(initVect);
    const writeStream = fs.createWriteStream(file);

    readStream
        .pipe(gzip)
        .pipe(cipher)
        .pipe(appendInitVect)
        .pipe(writeStream);
};