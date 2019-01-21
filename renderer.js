const { ipcRenderer } = require('electron');
const prettySize = require('prettysize');
let appClosing = false;

function strip(text) {
   var tmp = document.createElement("div");
   tmp.innerHTML = text;
   return tmp.textContent || tmp.innerText || "";
}

function hideAllScreens() {
    if (!appClosing) {
        var screens = document.getElementsByClassName("screen");
        for (var i = 0; i < screens.length; i++) {
            screens[i].style.display = "none";
        }
    }
}

function startPurposeSelector() {
    if (!appClosing) {
        hideAllScreens();
        document.getElementById("purpose").style.display = "block";
    }
}

function startSender() {
    if (!appClosing) {
        hideAllScreens();
        document.getElementById("sender").style.display = "block";
        document.getElementById("yourpeerid").focus();
    }
}

function startFileDropper() {
    if (!appClosing) {
        hideAllScreens();
        document.getElementById("dragdrop").style.display = "block";
    }
}

function startReceiver() {
    if (!appClosing) {
        hideAllScreens();
        document.getElementById("receiver").style.display = "block";
        document.getElementById("senderpeerid").focus();
    }
}

function showLoadingScreen(indeterminatable) {
    if (!appClosing) {
        hideAllScreens();
        if (indeterminatable) {
            document.getElementById("loading-progress").style.display = "none";
        }
        else {
            document.getElementById("loading-progress").style.display = "block";
        }
        document.getElementById("loading").style.display = "block";
    }
}

function setLoadingStatus(text) {
    if (!appClosing) {
        document.getElementById("loading-status").innerHTML = text;
    }
}

function setLoadingDetails(text) {
    if (!appClosing) {
        document.getElementById("loading-details").innerHTML = text;
    }
}

function setLoadingProgress(progress, max) {
    if (!appClosing) {
        /*
        document.getElementById("loading-progress").max = max;
        document.getElementById("loading-progress").value = progress;
        if (progress != max) {
            document.getElementById("loading-progress").innerHTML = ((progress / max) * 100).toFixed(1) + "%";
        }
        else {
            document.getElementById("loading-progress").innerHTML = "100%";
        }
        */
        let progressPerc = ((progress / max) * 100).toFixed(1);
        document.getElementById("loading-progress-inner").style.width = progressPerc + "%";
        let textBar = document.getElementById("loading-details").getElementsByClassName("loading-details-progress");
        if (textBar.length > 0) {
            textBar[0].innerHTML = progressPerc + "% (" + prettySize(progress, true, false, 2) + " / " + prettySize(max, true, false, 2) + ")";
        }
        ipcRenderer.send('progress-update', true, progress / max, {
            mode: "normal"
        });
    }
}

function resetLoadingProgress() {
    /*
    document.getElementById("loading-progress").max = 100;
    document.getElementById("loading-progress").value = 0;
    document.getElementById("loading-progress").innerHTML = "0.0%";
    */
    document.getElementById("loading-progress-inner").style.width = "0%";
    let textBar = document.getElementById("loading-details").getElementsByClassName("loading-details-progress");
    if (textBar.length > 0) {
        textBar[0].innerHTML = "0%";
    }
    ipcRenderer.send('progress-update', false);
}

// for both
ipcRenderer.on('websocket-connected', function(event, data) {
    console.log("Websocket connected!");
    clearTimeout(loadingTimeout);
    loadingTimeout = null;
    startPurposeSelector();
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
    resetLoadingProgress();
    setLoadingStatus("Closing Assembl Desktop...");
    setLoadingDetails("Please wait...");
    showLoadingScreen(true);
    appClosing = true;
});

// for sender
let receiverName = "";
ipcRenderer.on('receiver-connected', function(event, name) {
    console.log("A receiver connected");
    receiverName = name;
    alert('Connection established with ' + receiverName + '! You can now select a file to transfer.');
    startFileDropper();
});

// for receiver
let rTotalSize = 0;
let rProgressSize = 0;
ipcRenderer.on('data-initialized', function(event, data) {
    console.log("Getting ready for file transmission...");
    setLoadingStatus("Getting ready for file transmission...");
    rTotalSize = parseInt(data[0]);
    setLoadingDetails(data[1] + " &bull; " + prettySize(rTotalSize, true, false, 2) + ' &bull; <span class="loading-details-progress">0%</span>');
    resetLoadingProgress();
    showLoadingScreen(false);
    setLoadingProgress(0, parseInt(data[0]));
    ipcRenderer.send('progress-update', true, 0, {
        mode: "indeterminate"
    });
});

// for receiver
ipcRenderer.on('receiving-chunk', function(event, data) {
    // console.log("Receiving a chunk...");
    setLoadingStatus("Receiving file...");
});

// for receiver
ipcRenderer.on('received-chunk', function(event, progressIncrease) {
    console.log("Received a chunk of " + progressIncrease + " bytes");
    rProgressSize += progressIncrease;
    // setLoadingStatus("Receiving file...");
    setLoadingProgress(rProgressSize, rTotalSize);
});

// for receiver
ipcRenderer.on('received-file', function(event, data) {
    console.log("File has been fully received!");
    setLoadingStatus("File has been received successfully!");
    setLoadingProgress(rTotalSize, rTotalSize);
    showLoadingScreen(false);
});

// for receiver
ipcRenderer.on('saved-file', function(event, data) {
    console.log("File has been saved");
    setLoadingStatus("Waiting for sender...");
    setLoadingDetails("");
    resetLoadingProgress();
    showLoadingScreen(true);
    ipcRenderer.send('progress-update', true, 0, {
        mode: "indeterminate"
    });
});

// for sender
ipcRenderer.on('receiver-saved-file', function(event, data) {
    console.log("File has been saved by the receiver");
    resetLoadingProgress();
    startFileDropper();
});

let loadingTimeout = null;
function domReady() {
    loadingTimeout = setTimeout(function() {
        var extraLoading = document.getElementById("extra-loading");
        extraLoading.style.height = "150px";
        extraLoading.style.marginTop = "72px";
        // start connecting to the main server here
    }, 3000);

    document.getElementById("receiver-input-form").addEventListener("submit", function(event) {
        ipcRenderer.send('peerid-entered', {
            senderPeerId: document.getElementById('senderpeerid').value,
            receiverName: document.getElementById('yourname').value
        });
        setLoadingStatus("Waiting for sender...");
        resetLoadingProgress();
        showLoadingScreen(true);
        ipcRenderer.send('progress-update', true, 0, {
            mode: "indeterminate"
        });
        return false;
    });

    var drop = document.getElementById("fileChooser");
    drop.addEventListener("dragenter", change, false);
    drop.addEventListener("dragleave", change_back, false);
    
    var bg = document.getElementById("itemdropbox");
    var txt = document.getElementById("itemdrop");
    var originaltxt = document.getElementById("itemdrop").innerHTML;

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
}

// for sender
// once data is ready to be sent, execute this
// (data is ready to be sent once the file info has been confirmed received)
ipcRenderer.on('data-ready-to-send', function(event, data) {
    let i, j;
    for (i = 0, j = fileAB.byteLength; i<j; i+=chunkSize) {
        chunks.push(fileAB.slice(i,i+chunkSize));
    }
    setLoadingStatus("Transmitting file to " + strip(receiverName) + "...");
    setLoadingProgress(0, totalSize);
    showLoadingScreen(false);
    sendChunk();
});

// run this function when the sender states the next chunk is ready to be sent
ipcRenderer.on('next-chunk-ready-to-send', function(event, data) {
    sendChunk();
});

/* for sender */
let chunks = [];
let chunkSize = 1048576;    // 1MB in bytes
let totalSize = 0;
let currentChunk = 0;
let fileAB = null;
function sendChunk() {
    if (currentChunk < chunks.length) {
        console.log("Transmitting chunk " + (currentChunk+1) + " of " + chunks.length);
        console.log("Total progress: " + (currentChunk * chunkSize) + " bytes sent (out of " + totalSize + " total bytes)");
        setLoadingProgress(currentChunk * chunkSize, totalSize);
        convertedChunk = new Uint8Array(chunks[currentChunk]);
        ipcRenderer.send('chunk-ready-for-transfer', convertedChunk);
        currentChunk += 1;
    }
    else {
        setLoadingStatus("Waiting for " + receiverName + " to save the file...");
        resetLoadingProgress();
        ipcRenderer.send('progress-update', true, 1, {
            mode: "indeterminate"
        });
        showLoadingScreen(true);
        ipcRenderer.send('data-transfer-complete', null);
        chunks = [];
        currentChunk = 0;
        totalSize = 0;
    }
}
function readFile(file) {
    console.log("File changed!");

    // reset chunks
    chunks = [];
    currentChunk = 0;
    totalSize = 0;

    // set loadingscreen
    setLoadingStatus("Preparing file for exchange...");
    setLoadingDetails(file.name);
    resetLoadingProgress();
    showLoadingScreen(false);

    // create filereader instance
    var reader = new FileReader();

    // function to run when we're done reading the file
    reader.addEventListener("load", function(event) {
        console.log("Filereader loaded!");

        // update loading screen
        setLoadingStatus("Getting ready...");
        resetLoadingProgress();
        showLoadingScreen(true);
        ipcRenderer.send('progress-update', true, 0, {
            mode: "indeterminate"
        });
        // console.log(reader.result);

        // retrieve file contents in bytes
        fileAB = reader.result;
        totalSize = fileAB.byteLength;

        // update loading screen once more
        setLoadingDetails(file.name + " &bull; " + prettySize(totalSize, true, false, 2) + ' &bull; <span class="loading-details-progress">0%</span>');

        // send data initialized event to receiver
        ipcRenderer.send('data-initialized', [
            totalSize.toString(),
            file.name,
            file.type
        ]);
    });
    reader.addEventListener("progress", function(data) {
        if (data.lengthComputable) {
            // update progress bar upon file reading
            setLoadingProgress(data.loaded, data.total);
        }
    });

    // start reading the file
    reader.readAsArrayBuffer(file);
}