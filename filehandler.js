let fileHandler = {
    file: null,             // JS File Web API
    reader: null,           // JS FileReader Web API
    hash: null,             // a hash from emn178's sha3 rep
    offset: null,           // the offset of the current chunk being read
    chunkSize: 16384,       // this chunksize can change depending on the transfer method!
    protocolToUse: null,    // the protocol to use (transfer method)

    init: function() {
        fileHandler.reader = new FileReader();
        fileHandler.reader.addEventListener("error", function(error) {
            console.error("Error reading file:", error);
        });
        fileHandler.reader.addEventListener("abort", function(event) {
            console.warn("File reading aborted");
        });
        fileHandler.reader.addEventListener("load", function(event) {
            // update the hash with the current chunk
            fileHandler.hash.update(event.target.result);
            // convert the chunk into an Uint8Array (for ipc transport to the main process)
            let convertedChunk = new Uint8Array(event.target.result);
            switch(fileHandler.protocolToUse) {
                case "webrtc":
                    sendRTC(convertedChunk);
                    break;
                default:
                    console.warn("No protocol selected. Using websockets");
                    fileHandler.protocolToUse = "websocket";
                case "websocket":
                    ipcRenderer.send('chunk-ready-for-transfer', convertedChunk);
                    break;
            }
            // add current size of the chunk to the offset
            fileHandler.offset += event.target.result.byteLength;
            // update loading progress
            screens.loading.setProgress(fileHandler.offset, fileHandler.file.size);
            // prepare and send the next chunk
            fileHandler.sendChunk(fileHandler.offset);
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

    readFile: function(f) {
        console.log("File changed!");
        if (f != null && f.size > 0) {
            fileHandler.file = f;
            fileHandler.hash = keccak256.create();
            fileHandler.offset = 0;

            // set loadingscreen
            screens.loading.setStatus("Preparing file for transfer...");
            screens.loading.setDetails(fileHandler.file.name + " &bull; " + prettySize(fileHandler.file.size, true, false, 2));
            screens.loading.resetProgress();
            screens.showLoadingScreen(false);

            // send data initialized event to receiver with file details
            ipcRenderer.send('data-initialized', [
                fileHandler.file.size.toString(),
                fileHandler.file.name,
                fileHandler.file.type
            ]);
        }
        else {
            alert("This file is empty and cannot be transferred.");
        }
    },

    sendChunk: function(o) {
        if (fileHandler.offset < fileHandler.file.size) {
            console.log("Sending chunk starting at", o);
            // create chunk from file
            let slice = fileHandler.file.slice(fileHandler.offset, o + fileHandler.chunkSize);
            // turn slice into an arraybuffer
            fileHandler.reader.readAsArrayBuffer(slice);
            // the sending part happens in the "onload" event of the FileReader
        }
        else {
            // retrieve the final hash
            console.log("Hash is ready:", fileHandler.hash.hex());
            screens.loading.setStatus("Waiting for " + strip(receiverName) + " to save the file...");
            screens.loading.setDetails(fileHandler.file.name + " &bull; " + prettySize(fileHandler.file.size, true, false, 2));
            screens.loading.resetProgress();
            ipcRenderer.send('progress-update', true, 1, {
                mode: "indeterminate"
            });
            screens.showLoadingScreen(true);
            ipcRenderer.send('data-transfer-complete', null);
            // reset the filechooser
            document.getElementById("fileChooser").value = "";
        }
    },

    startTransfer: function() {
        screens.loading.setStatus("Transmitting file to " + strip(receiverName) + "...");
        screens.loading.setDetails(fileHandler.file.name + " &bull; " + prettySize(fileHandler.file.size, true, false, 2) + ' &bull; <span class="loading-details-progress">0%</span>');
        // start sending the first chunk
        fileHandler.sendChunk(fileHandler.offset);
    }
};