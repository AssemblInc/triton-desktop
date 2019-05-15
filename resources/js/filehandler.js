let fileHandler = {
    file: null,                 // JS File Web API
    reader: null,               // JS FileReader Web API
    hash: null,                 // a hash from emn178's sha3 rep
    chunkAmount: null,          // amount of chunks that have been handled so far
    sentChunkAmount: null,      // amount of chunks that have been sent through so far
    offset: null,               // the offset of the current chunk being read
    protocolToUse: null,        // the protocol to use (transfer method)
    encryptionEnabled: false,   // whether or not encryption is enabled for the chunks that are transferred
    useStream: false,           // IN DEVELOPMENT: use streams instead of chunks. Only for websocket protocol
    license: null,              // license selected for the file to send
    transferInfo: {},           // transferInfo (JSON attachment for Stellar)

    getChunkSize: function() {
        if (fileHandler.protocolToUse == "webrtc" || true) {
            return 16384;           // 16KB
        }
        else {
            if (fileHandler.encryptionEnabled || true) {
                return 1048576;     // 1MB
            }
            else {
                return 5242880;     // 5MB
            }
        }
    },

    init: function() {
        fileHandler.reader = new FileReader();
        fileHandler.reader.addEventListener("error", function(error) {
            console.error("Error reading file:", error);
        });
        fileHandler.reader.addEventListener("abort", function(event) {
            console.warn("File reading aborted");
        });
        fileHandler.reader.addEventListener("load", function(event) {
            if ((fileHandler.useStream === false && fileHandler.protocolToUse == "websocket") || fileHandler.protocolToUse == "webrtc") {
                // update the hash with the current chunk
                fileHandler.hash.update(event.target.result);
                // add current size of the chunk to the offset
                fileHandler.offset += event.target.result.byteLength;
                // convert the chunk into an Uint8Array (for ipc transport to the main process)
                let convertedChunk = new Uint8Array(event.target.result);
                switch(fileHandler.protocolToUse) {
                    case "webrtc":
                        // send chunk over webrtc
                        if (fileHandler.encryptionEnabled) {
                            rtcHandler.sendChunk(convertedChunk, false, fileHandler.sentChunkAmount);
                        }
                        else {
                            rtcHandler.sendUnencryptedChunk(convertedChunk, fileHandler.sentChunkAmount);
                        }
                        break;
                    default:
                        console.warn("No protocol selected. Using websockets");
                        fileHandler.protocolToUse = "websocket";
                    case "websocket":
                        // send chunk over websocket
                        if (fileHandler.encryptionEnabled) {
                            wsHandler.sendChunk(convertedChunk, false, fileHandler.sentChunkAmount);
                        }
                        else {
                            wsHandler.sendUnencryptedChunk(convertedChunk, fileHandler.sentChunkAmount);
                        }
                        break;
                }
                // update loading progress
                screens.loading.setProgressWithFileSize(fileHandler.offset, fileHandler.file.size);
                // console.log("Progress in bytes: " + fileHandler.offset + " / " + fileHandler.file.size);
                fileHandler.sentChunkAmount += 1;
                setTimeout(function() {
                    // this function is run with a timeout instead of right away
                    // otherwise it seems like the server won't be able to process the amount of chunks
                    // and the receiving end will experience download stutters!
                    fileHandler.prepareChunk(fileHandler.offset);
                }, 64);
            }
            else {
                console.warn("fileHandler.useStream equals true. The FileReader is not outputting any data, since this is handled by the blobStream instead.");
            }
        });

        ipcRenderer.on('pgp-chunk-encrypted', function(event, encryptedChunk, number) {
            switch(fileHandler.protocolToUse) {
                case "webrtc":
                    // send chunk over webrtc
                    rtcHandler.sendChunk(encryptedChunk, true, number);
                    break;
                default:
                    console.warn("No protocol selected. Using websockets");
                    fileHandler.protocolToUse = "websocket";
                case "websocket":
                    // send chunk over websocket
                    wsHandler.sendChunk(encryptedChunk, true, number);
                    break;
            }
        });
        
        ipcRenderer.on('pgp-chunk-encryption-error', function(event, err) {
            console.error("An error occured encrypting the chunk", err);
            screens.showErrorScreen('0x3003');
        });

        let bg = document.getElementById("itemdropbox");
        let txt = document.getElementById("itemdrop");
        let originaltxt = document.getElementById("itemdrop").innerHTML;

        function change() {
            bg.style.background = '#193884';
            document.getElementById("filedropperdragbg").style.opacity = 1;
            document.getElementById("filedropperborder").className = "active";
            txt.innerHTML = "Drop the file here!";
        };

        function change_back() {
            bg.style.background = null;
            document.getElementById("filedropperdragbg").style.opacity = 0;
            document.getElementById("filedropperborder").className = null;
            txt.innerHTML = originaltxt;
        };

        let drop = document.getElementById("fileChooser");
        drop.addEventListener("dragenter", change, false);
        drop.addEventListener("dragleave", change_back, false);
        drop.addEventListener("change", change_back, false);
    },

    resetFile: function() {
        fileHandler.file = null;
        fileHandler.hash = null;
        fileHandler.offset = 0;
        fileHandler.chunkAmount = 0;
        fileHandler.transferInfo = {};
        document.getElementById("fileconfirm-name").innerHTML = "";
        document.getElementById("fileconfirm-size").innerHTML = "";
        document.getElementById("fileconfirm-description").value = "";
        document.getElementById("fileChooser").value = "";
    },

    readFile: function(f) {
        console.log("File changed!");
        console.log(f);
        if (f != null && f.size > 0) {
            fileHandler.file = f;
            fileHandler.hash = keccak256.create();
            // fileHandler.hash = crypto.createHash('sha256');
            fileHandler.offset = 0;
            fileHandler.chunkAmount = 0;

            // send data initialized event to receiver with file details
            /*
            wsHandler.sendEvent('data_initialized', [
                fileHandler.file.size.toString(),
                fileHandler.file.name,
                fileHandler.file.type
            ]);
            */
            fileHandler.transferInfo = {
                version: 1,
                currentTime: Date.now(),
                file: {
                    size: fileHandler.file.size,
                    path: fileHandler.file.path,
                    name: fileHandler.file.name,
                    type: fileHandler.file.type,
                    lastModified: fileHandler.file.lastModified,
                    license: fileHandler.license,
                    description: null,
                    hash: null
                },
                transmission: {
                    encryptionEnabled: fileHandler.encryptionEnabled,
                    encryptionLevel: 2048,
                    protocol: fileHandler.protocolToUse
                },
                sender: {
                    name: ipcRenderer.sendSync('username-request'),
                    assemblId: ipcRenderer.sendSync('assemblid-request'),
                    orcidId: ipcRenderer.sendSync('orcid-request')
                },
                receiver: {
                    name: receiver.name,
                    assemblId: receiver.assemblId,
                    orcidId: receiver.orcidId
                }
            };
            console.log(fileHandler.transferInfo);
            // fill in file confirmation forms
            document.getElementById("fileconfirm-name").innerHTML = strip(fileHandler.file.name);
            document.getElementById("fileconfirm-size").innerHTML = prettySize(fileHandler.file.size);
            screens.showFileConfirm();
        }
        else {
            alert("This file is empty and cannot be transferred.");
        }
    },

    prepareTransfer: function() {
        // set loadingscreen
        screens.loading.setStatus("Preparing file for transfer...");
        screens.loading.setDetails(strip(fileHandler.file.name) + " &bull; " + prettySize(fileHandler.file.size, true, false, 2));
        screens.loading.resetProgress();
        screens.showLoadingScreen(false);
        
        // send transfer info to recipient
        wsHandler.sendEvent('data_initialized', JSON.stringify(fileHandler.transferInfo));
    },

    prepareChunk: function(o) {
        if (o == 0 && fileHandler.protocolToUse == "websocket" && fileHandler.useStream === true) {
            // IN DEVELOPMENT
            // NO BLOCKCHAIN INTEGRATION. DO NOT USE
            let stream = wsHandler.openStream();
            let blobStream = ss.createBlobReadStream(fileHandler.file);
            blobStream.on('error', function(err) {
                console.error(err);
            });
            blobStream.on('end', function() {
                console.log("blobStream ended");

                console.log("Hash is ready:", fileHandler.hash.hex());
                // hashMemo(null, fileHandler.hash.hex());
                screens.loading.setStatus("Waiting for " + strip(receiver.name) + " to save the file...");
                screens.loading.setDetails(strip(fileHandler.file.name) + " &bull; " + prettySize(fileHandler.file.size, true, false, 2));
                screens.loading.resetProgress();
                ipcRenderer.send('progress-update', true, 1, {
                    mode: "indeterminate"
                });
                screens.showLoadingScreen(true);
                // wsHandler.sendEvent('data_transfer_complete', fileHandler.chunkAmount);
                // reset the filechooser
                document.getElementById("fileChooser").value = "";
            });
            blobStream.on('finish', function() {
                console.log("blobStream finished");
            });
            blobStream.on('data', function(chunk) {
                // update the hash with the current chunk
                fileHandler.hash.update(chunk);

                fileHandler.offset += chunk.length;
                screens.loading.setProgressWithFileSize(fileHandler.offset, fileHandler.file.size);
            });
            blobStream.pipe(stream);
            console.log(blobStream);
        }
        else {
            if (fileHandler.offset < fileHandler.file.size) {
                // console.log("Sending chunk starting at", o);
                // create chunk from file
                fileHandler.chunkAmount += 1;
                let slice = fileHandler.file.slice(fileHandler.offset, o + fileHandler.getChunkSize());
                // turn slice into an arraybuffer
                fileHandler.reader.readAsArrayBuffer(slice);
                // the sending part happens in the "onload" event of the FileReader
            }
            else {
                // retrieve the final hash
                let finalHash = fileHandler.hash.hex();
                console.log("Hash is ready:", finalHash);
                fileHandler.transferInfo.file.hash = finalHash;
                // set loading screen
                screens.loading.setStatus("Adding transfer to the blockchain...");
                screens.loading.setDetails(strip(fileHandler.file.name) + " &bull; " + prettySize(fileHandler.file.size, true, false, 2));
                screens.loading.resetProgress();
                ipcRenderer.send('progress-update', true, 1, {
                    mode: "indeterminate"
                });
                screens.showLoadingScreen(true);
                // process final transferinfo
                let transferInfoHash = keccak256.create();
                let transferInfoString = JSON.stringify(fileHandler.transferInfo);
                ipcRenderer.send('transferinfo-finalized', transferInfoString);
                wsHandler.sendEvent('transfer_info_complete', transferInfoString);
                // generate hash of fileinfo for blockchain
                transferInfoHash.update(transferInfoString);
                let memoHash = transferInfoHash.hex();
                // add hash to stellar blockchain
                stellarHandler.addHash(memoHash).then(function(stellarResults) {
                    console.log(stellarResults);
                    let transferInfoFolder = ipcRenderer.sendSync("transferinfo-folderrequest");
                    let transferInfoFileName = ipcRenderer.sendSync("transferinfo-namerequest", fileHandler.transferInfo.currentTime);
                    let stellarInfo = {
                        version: 1,
                        currentTime: fileHandler.transferInfo.currentTime,
                        validation: {
                            path: path.join(transferInfoFolder, transferInfoFileName),
                            name: transferInfoFileName,
                            hash: transferInfoHash
                        },
                        stellar: {
                            transactionId: stellarResults.hash,
                            time: Date.now(),
                            ledger: stellarResults.ledger
                        }
                    };
                    console.log(stellarInfo);
                    let stellarInfoString = JSON.stringify(stellarInfo);
                    ipcRenderer.send('blockchaininfo-finalized', stellarInfoString);
                    wsHandler.sendEvent('blockchain_info_complete', stellarInfoString);

                    screens.loading.setStatus("Waiting for " + strip(receiver.name) + " to save the file...");
                    wsHandler.sendEvent('data_transfer_complete', fileHandler.chunkAmount);
                    // reset the filechooser
                    document.getElementById("fileChooser").value = "";
                })
                .catch(function(err) {
                    console.error(err);
                    screens.showErrorScreen('0x6001');
                });
            }
        }
    },

    startTransfer: function() {
        fileHandler.sentChunkAmount = 0;
        screens.loading.setStatus("Transferring file to " + strip(receiver.name) + "...");
        screens.loading.setDetails(strip(fileHandler.file.name) + " &bull; " + prettySize(fileHandler.file.size, true, false, 2) + ' &bull; <span class="loading-details-progress">0%</span>');
        // start sending the first chunk
        fileHandler.prepareChunk(fileHandler.offset);
    },

    useEncryption(useIt) {
        fileHandler.encryptionEnabled = useIt;
    }
};