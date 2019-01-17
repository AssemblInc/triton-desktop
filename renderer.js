const { ipcRenderer } = require('electron');
const prettySize = require('prettysize');

function strip(text) {
   var tmp = document.createElement("div");
   tmp.innerHTML = text;
   return tmp.textContent || tmp.innerText || "";
}

function hideAllScreens() {
    var screens = document.getElementsByClassName("screen");
    for (var i = 0; i < screens.length; i++) {
        screens[i].style.display = "none";
    }
}

function startPurposeSelector() {
    hideAllScreens();
    document.getElementById("purpose").style.display = "block";
}

function startSender() {
    hideAllScreens();
    document.getElementById("sender").style.display = "block";
}

function startFileDropper() {
    hideAllScreens();
    document.getElementById("dragdrop").style.display = "block";
}

function startReceiver() {
    hideAllScreens();
    document.getElementById("receiver").style.display = "block";
}

function showLoadingScreen(indeterminatable) {
    hideAllScreens();
    if (indeterminatable) {
        document.getElementById("loading-progress").style.display = "none";
    }
    else {
        document.getElementById("loading-progress").style.display = "block";
    }
    document.getElementById("loading").style.display = "block";
}

function setLoadingStatus(text) {
    document.getElementById("loading-status").innerHTML = text;
}

function setLoadingDetails(text) {
    document.getElementById("loading-details").innerHTML = text;
}

function setLoadingProgress(progress, max) {
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
}

ipcRenderer.on('peer-connect-error', function(event, error) {
    console.log(error);
});

ipcRenderer.on('peer-connected', function(event, connectionFSM) {
    console.log(connectionFSM);
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
    setLoadingDetails(data[1] + " &bull; " + prettySize(rTotalSize, true, false, 2));
    resetLoadingProgress();
    showLoadingScreen(false);
    setLoadingProgress(0, parseInt(data[0]));
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

let loadingTimeout = null;
function domReady() {
    loadingTimeout = setTimeout(function() {
        var extraLoading = document.getElementById("extra-loading");
        extraLoading.style.height = "150px";
        extraLoading.style.marginTop = "72px";
        // start connecting to the main server here
    }, 3000);

    setTimeout(startPurposeSelector, 5000);

    document.getElementById("connect-btn").addEventListener("click", function(event) {
        ipcRenderer.send('peerid-entered', {
            senderPeerId: document.getElementById('senderpeerid').value,
            receiverName: document.getElementById('yourname').value
        });
        setLoadingStatus("Waiting for sender...");
        resetLoadingProgress();
        showLoadingScreen(true);
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

/* for sender */
let chunks = [];
let chunkSize = 1048576;    // 1MB in bytes
let totalSize = 0;
let currentChunk = 0;
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
        setLoadingStatus("File has been transmitted successfully!");
        setLoadingProgress(totalSize, totalSize);
        showLoadingScreen(false);
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
        // console.log(reader.result);

        // once data is ready to be send, execute this
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

        // retrieve file contents in bytes
        var fileAB = reader.result;
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