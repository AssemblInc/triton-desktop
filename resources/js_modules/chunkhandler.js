const { app, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const mv = require('mv');
const chunkPath = path.join(app.getPath('userData'), 'temp', 'chunks');
let receivedFilename, tempFile, startTimestamp, writer, chunkAmount, receivedByteAmount, processedChunkAmount, finalChunkAmount;

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
    
    let tempChunkFile = path.join(chunkPath, 'filetransfer-'+startTimestamp+'-'+number+'.assemblchunk');
    chunkWriter = fs.createWriteStream(tempChunkFile, { encoding: 'utf8', flags: 'a', autoClose: false });
    chunkWriter.on('error', function(err) {
        console.warn("An error occured within the fs writestream!");
        console.error(err);
        chunkWriter.end();
    });
    if (!isUint8Array) {
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

    console.log("Chunk progress: "+processedChunkAmount+" progressed, "+finalChunkAmount+" total (according to sender)");
};

// check if file can be saved yet
exports.fileReady = function() {
    return (finalChunkAmount > 0 && finalChunkAmount == processedChunkAmount && chunkAmount == processedChunkAmount);
};

// finish the file and end the writestream
exports.finish = function(win) {
    return new Promise(function(resolve, reject) {
        let chunkFile = null;
        for (let f = 0; f < finalChunkAmount; f++) {
            chunkFile = path.join(chunkPath, "filetransfer-"+startTimestamp+"-"+f+".assemblchunk");
            if (fs.existsSync(chunkFile)) {
                console.log("Appending chunk " + f + "...");
                let tempChunk = fs.readFileSync(chunkFile);
                writer.write(tempChunk);
                win.webContents.send('chunks-merged', mergedChunks, finalChunkAmount);
            }
            else {
                console.warn("Chunk not found: chunk number" + f);
                reject("Chunk " + f + " not found");
            }
        }
        writer.end();
        resolve();
        /*
        console.log("Reading files in transfer folder...");
        fs.readdir(chunkPath, function(err, files) {
            if (err) {
                console.error(err);
                reject(err);
            }
            else {
                files.sort(function(a, b) {
                    console.log(parseInt(a.split(".")[0].split("-").pop()));
                    console.log(parseInt(b.split(".")[0].split("-").pop()));
                    return parseInt(a.split(".")[0].split("-").pop()) - parseInt(b.split(".")[0].split("-").pop());
                });
                let mergedChunks = 0;
                let filesLength = files.length;
                for (let f = 0; f < filesLength; f++) {
                    if (files[f].split(".").pop() == "assemblchunk") {
                        console.log("Appending chunk " + files[f] + "...");
                        let tempChunk = fs.readFileSync(path.join(chunkPath, files[f]));
                        writer.write(tempChunk);
                        win.webContents.send('chunks-merged', mergedChunks, finalChunkAmount);
                    }
                    else {
                        console.warn("Unknown file found in transfer folder: " + files[f]);
                    }
                }
                writer.end();
                resolve();
            }
        });
        */
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
            fs.unlinkSync(tempFile);
        }
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