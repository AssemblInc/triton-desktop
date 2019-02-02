const { app, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const mv = require('mv');
let tempFile, receivedFilename, writer;

// function to initialize chunks
// call this once the data transfer is about to begin, not when opening the program,
// as a timestamp is included in the temporary file
exports.initChunks = function(useFileSystem) {
    receivedFilename = null;
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

// handle a received chunk
// chunk should be an arraybuffer
exports.handleChunk = function(chunk) {
    if (writer.writable) {
        writer.write(new Uint8Array(chunk));
    }
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
                        resolve();
                    });
                }
                else {
                    // otherwise, delete the temporary file from the disk
                    fs.unlink(tempFile, function(err) {
                        if (err) {
                            console.log(err);
                            // an error has occured. return a promise rejection
                            reject(err.message);
                            return;
                        }
                        reject("user cancelled the save dialog");
                    });
                }
            });
        }
    );
};