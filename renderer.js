
let appClosing = false;
let protocolToUse = null;

function strip(text) {
   var tmp = document.createElement("div");
   tmp.innerHTML = text;
   return tmp.textContent || tmp.innerText || "";
}

// for both
ipcRenderer.on('websocket-connected', function(event, data) {
    console.log("Websocket connected!");
    clearTimeout(loadingTimeout);
    loadingTimeout = null;
    screens.startPurposeSelector();
});

// for both
ipcRenderer.on('websocket-connection-error', function(event, data) {
    console.warn("Websocket connection error");
    clearTimeout(loadingTimeout);
    loadingTimeout = null;
    alert("Could not establish a connection.");
});

// for both
ipcRenderer.on('app-closing', function(event, data) {
    console.warn("App is closing!");
    screens.loading.resetProgress();
    screens.loading.setStatus("Closing Assembl Desktop...");
    screens.loading.setDetails("Please wait...");
    screens.showLoadingScreen(true);
    appClosing = true;
});

// for sender
let receiverName = "";
ipcRenderer.on('receiver-connected', function(event, name) {
    console.log("A receiver connected");
    receiverName = name;
    alert('Connection established with ' + receiverName + '! You can now select a file to transfer.');
    screens.startFileDropper();
});

// for receiver
let rTotalSize = 0;
let rProgressSize = 0;
ipcRenderer.on('data-initialized', function(event, data) {
    console.log("Getting ready for file transmission...");
    screens.loading.setStatus("Getting ready for file transmission...");
    rTotalSize = parseInt(data[0]);
    rProgressSize = 0;
    screens.loading.setDetails(data[1] + " &bull; " + prettySize(rTotalSize, true, false, 2) + ' &bull; <span class="loading-details-progress">0%</span>');
    screens.loading.resetProgress();
    screens.showLoadingScreen(false);
    screens.loading.setProgress(0, parseInt(data[0]));
    ipcRenderer.send('progress-update', true, 0, {
        mode: "indeterminate"
    });
});

// for receiver
ipcRenderer.on('receiving-chunk', function(event, data) {
    // console.log("Receiving a chunk...");
    screens.loading.setStatus("Receiving file...");
});

// for receiver
ipcRenderer.on('received-chunk', function(event, progressIncrease) {
    console.log("Received a chunk of " + progressIncrease + " bytes");
    rProgressSize += progressIncrease;
    // screens.loading.setStatus("Receiving file...");
    screens.loading.setProgress(rProgressSize, rTotalSize);
});

// for receiver
ipcRenderer.on('received-file', function(event, data) {
    console.log("File has been fully received!");
    screens.loading.setStatus("File has been received successfully!");
    screens.loading.setProgress(rTotalSize, rTotalSize);
    screens.showLoadingScreen(false);
});

// for receiver
ipcRenderer.on('saved-file', function(event, data) {
    console.log("File has been saved");
    screens.loading.setStatus("Waiting for sender...");
    screens.loading.setDetails("");
    screens.loading.resetProgress();
    screens.showLoadingScreen(true);
    ipcRenderer.send('progress-update', true, 0, {
        mode: "indeterminate"
    });
});

// for sender
ipcRenderer.on('receiver-saved-file', function(event, data) {
    console.log("File has been saved by the receiver");
    screens.loading.resetProgress();
    screens.startFileDropper();
});

function formSubmit(event) {
    event.preventDefault();
    ipcRenderer.send('peerid-entered', {
        senderPeerId: document.getElementById('senderpeerid').value,
        receiverName: document.getElementById('yourname').value
    });
    screens.loading.setStatus("Waiting for sender...");
    screens.loading.resetProgress();
    screens.showLoadingScreen(true);
    ipcRenderer.send('progress-update', true, 0, {
        mode: "indeterminate"
    });
    return false;
}

let loadingTimeout = null;
function domReady() {
    loadingTimeout = setTimeout(function() {
        var extraLoading = document.getElementById("extra-loading");
        extraLoading.style.height = "150px";
        extraLoading.style.marginTop = "72px";
        // start connecting to the main server here
    }, 3000);

    fileHandler.init();
}

// for sender
// once data is ready to be sent, execute this
// (data is ready to be sent once the file info has been confirmed received)
ipcRenderer.on('data-ready-to-send', function(event, data) {
    /*
    let i, j;
    for (i = 0, j = fileAB.byteLength; i<j; i+=chunkSize) {
        chunks.push(fileAB.slice(i,i+chunkSize));
    }
    screens.loading.setStatus("Transmitting file to " + strip(receiverName) + "...");
    screens.loading.setProgress(0, totalSize);
    screens.showLoadingScreen(false);
    sendChunk();
    */
    fileHandler.startTransfer();
});

// run this function when the sender states the next chunk is ready to be sent
ipcRenderer.on('next-chunk-ready-to-send', function(event, data) {
    sendChunk();
});

/* for sender */
let chunks = [];
let chunkSize = null;
let fileName = "";
let totalSize = 0;
let currentChunk = 0;
let fileAB = null;
let hash = null;
function sendChunk() {
    return;
    if (currentChunk < chunks.length) {
        console.log("Transmitting chunk " + (currentChunk+1) + " of " + chunks.length);
        console.log("Total progress: " + (currentChunk * chunkSize) + " bytes sent (out of " + totalSize + " total bytes)");
        screens.loading.setProgress(currentChunk * chunkSize, totalSize);
        convertedChunk = new Uint8Array(chunks[currentChunk]);
        switch(protocolToUse) {
            case "webrtc":
                sendRTC(convertedChunk);
                break;
            default:
                console.warn("No protocol selected. Using websockets");
                protocolToUse = "websocket";
            case "websocket":
                ipcRenderer.send('chunk-ready-for-transfer', convertedChunk);
                break;
        }
        currentChunk += 1;
    }
    else {
        screens.loading.setStatus("Waiting for " + receiverName + " to save the file...");
        screens.loading.setDetails(fileName + " &bull; " + prettySize(totalSize, true, false, 2));
        screens.loading.resetProgress();
        ipcRenderer.send('progress-update', true, 1, {
            mode: "indeterminate"
        });
        screens.showLoadingScreen(true);
        ipcRenderer.send('data-transfer-complete', null);
        chunks = [];
        currentChunk = 0;
        totalSize = 0;
    }
}
function readFile(file) {
    
}