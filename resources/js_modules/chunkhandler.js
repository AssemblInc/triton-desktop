const { app, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const mv = require('mv');
let tempFile, receivedFilename, writer, chunkAmount, processedChunkAmount, finalChunkAmount;

// function to initialize chunks
// call this once the data transfer is about to begin, not when opening the program,
// as a timestamp is included in the temporary file
exports.initChunks = function(useFileSystem) {
    receivedFilename = null;
    chunkAmount = 0;
    processedChunkAmount = 0;
    finalChunkAmount = 0;
    tempFile = path.join(app.getPath('temp'), 'filetransfer-'+Date.now()+'.assembltemp');
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
exports.handleChunk = function(chunk) {
    if (writer.writable) {
        writer.write(new Uint8Array(chunk));
    }
    processedChunkAmount += 1;

    console.log("Chunk progress: "+processedChunkAmount+" progressed, "+finalChunkAmount+" total (according to sender)");
};

// check if file can be saved yet
exports.fileReady = function() {
    return (finalChunkAmount > 0 && finalChunkAmount == processedChunkAmount && chunkAmount == processedChunkAmount);
};

// finish the file and end the writestream
exports.finish = function() {
    writer.end();
};

// get total (received) file size in bytes
exports.getFileSize = function() {
    let stats = fs.statSync(tempFile);
    return stats["size"];
};

// delete temporary files
exports.deleteTempFile = function(sync) {
    console.warn("Deleting temporary files isn't supported as of yet.");
    return;
    if (tempFile != null) {
        if (!sync) {
            fs.unlink(tempFile, function(err) {
                if (err) {
                    console.log(err);
                }
                else {
                    console.log("Temporary file has been deleted");
                }
            });
        }
        else {
            fs.unlinkSync(tempFile, function(err) {
                if (err) {
                    console.log(err);
                }
                else {
                    console.log("Temporary file has been deleted");
                }
            });
        }
    }
    else {
        console.log("No temporary file to delete.");
    }
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
    return new Promise(
        function(resolve, reject) {
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
                    // otherwise, delete the temporary file from the disk
                    module.exports.deleteTempFile();
                    reject("user pressed cancel on the save dialog");
                }
            });
        }
    );
};