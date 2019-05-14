// FROM https://medium.com/@brandonstilson/lets-encrypt-files-with-node-85037bea8c0e

const { app } = require('electron');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const zlib = require('zlib');
const stream = require('stream');
const keccak256 = require('js-sha3').keccak256;

/* from https://gist.githubusercontent.com/bbstilson/e2617cf1375481a34c0b6d9ecf0879bf/raw/3f16210ec2ee04c3acd8d92b36dd00f7d170f619/appendInitVect.js */
const { Transform } = require('stream');
class AppendInitVect extends Transform {
  constructor(initVect, opts) {
    super(opts);
    this.initVect = initVect;
    this.appended = false;
  }

  _transform(chunk, encoding, cb) {
    if (!this.appended) {
      this.push(this.initVect);
      this.appended = true;
    }
    this.push(chunk);
    cb();
  }
};
/* end from */

const file = path.join(app.getPath('userData'), 'userdata.assemblsec');
const prevSessionExists = fs.existsSync(file);
console.log(file);
console.log("Available ciphers:");
console.log(crypto.getCiphers());
let initialized = false;
let savedData = null;
let pw = null;

function getCipherKey(password) {
    // retrieve a cipher key from password
    return crypto.createHash('sha256').update(password).digest();
}

exports.isInitialized = function() {
    return initialized;
};

exports.previousSessionExists = function() {
    return prevSessionExists;
};

exports.init = function(password, reset) {
    return new Promise(function(resolve, reject) {
        const hashedPassword = keccak256(password);
        if (initialized !== true) {
            // if no fresh start and a userdata file exists, try to open that file
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
                // otherwise create new userdata
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
    // return Object.keys(savedData).indexOf(key) > -1;
    return key in savedData;
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