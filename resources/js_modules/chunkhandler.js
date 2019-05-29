const { app, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const mv = require('mv');
const chunkPath = path.join(app.getPath('userData'), 'temp', 'chunks');
let receivedFilename, tempFile, startTimestamp, writer, chunkAmount, receivedByteAmount, processedChunkAmount, finalChunkAmount;
let chunkMergInterval;

// function to initialize chunks
// call this once the data transfer is about to begin, not when opening the program,
// as a timestamp is included in the temporary files
exports.initChunks = function() {
    receivedFilename = null;
    chunkAmount = 0;
    processedChunkAmount = 0;
    finalChunkAmount = 0;
    receivedByteAmount = 0;
    startTimestamp = Date.now();
    if (!fs.existsSync(chunkPath)) {
        fs.mkdirSync(chunkPath);
    }
    console.log("Chunks initialized");
    tempFile = path.join(app.getPath('userData'), 'temp', 'filetransfer-'+Date.now()+'.assembltemp');
    writer = fs.createWriteStream(tempFile, { encoding: 'utf8', flags: 'a', autoClose: false });
    console.log("Temporary file created at " + tempFile);
    writer.on('error', function(err) {
        console.warn("An error occured within the fs writestream!");
        console.error(err);
        writer.end();
    });
};

// same function, but with a different name
// can be used to reset the received chunks more clearly
exports.resetChunks = module.exports.initChunks;

// handle filename set
exports.setFileName = function(name) {
    receivedFilename = name;
    return receivedFilename;
};

// retrieve filename
exports.getFileName = function() {
    return receivedFilename;
};

// increase chunk amount (according to the receiver)
exports.increaseChunkAmount = function() {
    chunkAmount += 1;
    return chunkAmount;
};

// set final chunk amount (according to the sender)
exports.setFinalChunkAmount = function(amount) {
    finalChunkAmount = amount;
    return finalChunkAmount;
}

// handle a received chunk
// chunk should be an arraybuffer
exports.handleChunk = function(chunk, isUint8Array, number) {
    /*
    if (writer.writable) {
        if (!isUint8Array) {
            writer.write(new Uint8Array(chunk));
        }
        else {
            writer.write(chunk);
        }
    }
    */
    
    // write chunk data to a temporary chunk file using a writestream
    let tempChunkFile = path.join(chunkPath, 'filetransfer-'+startTimestamp+'-'+number+'.assemblchunk');
    let chunkWriter = fs.createWriteStream(tempChunkFile, { encoding: 'utf8', flags: 'a', autoClose: false });
    chunkWriter.on('error', function(err) {
        console.warn("An error occured within the fs writestream!");
        console.error(err);
        chunkWriter.end();
    });
    if (!isUint8Array) {
        // if the chunk is not in Uint8Array format, produce an Uint8Array out of the chunk, then write it to the chunk file
        let tempChunk = new Uint8Array(chunk);
        receivedByteAmount += tempChunk.byteLength;
        chunkWriter.write(tempChunk);
    }
    else {
        receivedByteAmount += chunk.byteLength;
        chunkWriter.write(chunk);
    }
    chunkWriter.end();

    processedChunkAmount += 1;

    console.log("Chunk progress: "+number+" progressed, "+processedChunkAmount+" total progressed, "+finalChunkAmount+" total sent (according to sender)");
};

// check if file can be saved yet
exports.fileReady = function() {
    return (finalChunkAmount > 0 && finalChunkAmount == processedChunkAmount && chunkAmount == processedChunkAmount);
};

// finish the file and end the writestream
exports.finish = function(win) {
    return new Promise(function(resolve, reject) {
        let chunkFile = null;
        let mergedChunks = 0;
        let f = 0;
        chunkMergInterval = setInterval(function() {
            // if not all chunks are finalized (added to final file) run this code
            if (f < finalChunkAmount) {
                // locate the required chunk file
                chunkFile = path.join(chunkPath, "filetransfer-"+startTimestamp+"-"+f+".assemblchunk");
                if (fs.existsSync(chunkFile)) {
                    console.log("Appending chunk " + f + "...");
                    let tempChunk = fs.readFileSync(chunkFile);
                    // write chunk to temporary final file
                    writer.write(tempChunk);
                    mergedChunks += 1;
                    if (mergedChunks % 5 == 0) {
                        // every 5 merged chunks send the progress of merging to the user interface
                        win.webContents.send('chunks-merged', mergedChunks, finalChunkAmount);
                    }
                }
                else {
                    console.warn("Chunk not found: chunk number" + f);
                    reject("Chunk " + f + " not found");
                }
                f++;
            }
            else {
                // otherwise the final file is done and can be moved (saved)!
                win.webContents.send('chunks-merged', finalChunkAmount, finalChunkAmount);
                clearInterval(chunkMergInterval);
                chunkMergInterval = null;
                writer.end();
                resolve();
            }
        }, 20);
    });
};

// get total (received) file size in bytes
exports.getFileSize = function() {
   return receivedByteAmount;
};

// delete temporary files
exports.deleteTempFiles = function() {
    return new Promise(function(resolve, reject) {
        console.log("Deleting temporary final file if it exists...");
        if (writer != null && writer.writable) {
            writer.end();
        }
        if (fs.existsSync(tempFile)) {
            // remove temporary transfer file
            fs.unlinkSync(tempFile);
        }
        if (fs.existsSync(chunkPath)) {
            console.log("Reading files in transfer folder...");
            fs.readdir(chunkPath, function(err, files) {
                if (err) {
                    console.error(err);
                    reject(err);
                }
                else {
                    console.log("Deleting temporary files in the transfer folder...");
                    for (const file of files) {
                        fs.unlink(path.join(chunkPath, file), function(err) {
                            if (err) {
                                console.error(err);
                            }
                        });
                    }
                    resolve();
                }
            });
        }
        else {
            console.log("Transfer folder does not exist. Nothing to read and delete there.");
            resolve();
        }
    });
};

// save the file to a location chosen by the user
exports.saveFile = function() {
    // get the default downloads folder on the filesystem (used for the save dialog later)
    let defaultPath = path.join(app.getPath('downloads'), receivedFilename);
    let extension = receivedFilename.split('.').pop();
    if (extension == null || extension == undefined) {
        // if no extension is set, don't ask for a default extension in the save dialog. Just use no extension filter
        // used for LICENSE files and some Linux scripts, for example.
        extension = "";
    }
    return new Promise(function(resolve, reject) {
        dialog.showSaveDialog({
            defaultPath: defaultPath,
            filters: [{ name: extension.toUpperCase(), extensions: [ extension ] }]
        }, function(savePath) {
            if (savePath != undefined && savePath != null && savePath != "") {
                // if the user didn't press cancel, move file to right location
                mv(tempFile, savePath, function(err) {
                    if (err) {
                        console.log(err);
                        // an error has occured. return a promise rejection
                        reject(err.message);
                        return;
                    }
                    console.log("The file has been saved!");
                    tempFile = null;
                    resolve();
                });
            }
            else {
                // otherwise, delete the temporary files from the disk
                module.exports.deleteTempFiles();
                reject("user pressed cancel on the save dialog");
            }
        });
    });
};