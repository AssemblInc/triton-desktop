
let appClosing = false;
let protocolToUse = null;
let publicKey = null;
let otherName = "";
let receiverName = "";
let fileName = "";

function strip(text) {
   var tmp = document.createElement("div");
   tmp.innerHTML = text;
   return tmp.textContent || tmp.innerText || "";
}

// for both
ipcRenderer.on('error-occurred', function(event, errorCode) {
    console.warn("An error occurred in the main process!");
    screens.showErrorScreen(errorCode);
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

// for receiver
let rTotalSize = 0;
let rProgressSize = 0;
ipcRenderer.on('data-initialized', function(event, data) {
    console.log("Getting ready for file transmission...");
    screens.loading.setStatus("Getting ready for file transmission...");
    let parsedData = JSON.parse(data);
    console.log(parsedData);
    rTotalSize = parseInt(parsedData["file"]["size"]);
    rProgressSize = 0;
    fileName = parsedData["file"]["name"];
    screens.loading.setDetails(strip(fileName) + " &bull; " + prettySize(rTotalSize, true, false, 2) + ' &bull; <span class="loading-details-progress">0% ('+prettySize(0, true, false, 2)+' / '+prettySize(rTotalSize, true, false, 2)+')</span>');
    screens.loading.resetProgress();
    screens.showLoadingScreen(false);
    screens.loading.setProgressWithFileSize(0, parseInt(parsedData["file"]["size"]));
    ipcRenderer.send('progress-update', true, 0, {
        mode: "indeterminate"
    });
});

// for receiver
ipcRenderer.on('receiving-chunk', function(event, data) {
    // console.log("Receiving a chunk...");
    screens.loading.setStatus("Receiving file from " + strip(otherName) + "...");
});

// for receiver
ipcRenderer.on('received-chunk', function(event, progressIncrease) {
    console.log("Received a chunk of " + progressIncrease + " bytes");
    rProgressSize += progressIncrease;
    // screens.loading.setStatus("Receiving file...");
    screens.loading.setProgressWithFileSize(rProgressSize, rTotalSize);
    switch(fileHandler.protocolToUse) {
        case "webrtc":
            // send chunk over webrtc
            // rtcHandler.send("received", false, false);
            break;
        default:
            console.warn("No protocol selected. Using websockets");
            fileHandler.protocolToUse = "websocket";
        case "websocket":
            // send chunk over websocket
            // wsHandler.sendEventToSender("chunk_received", null);
            break;
    }
});

// for receiver
ipcRenderer.on('received-file', function(event, finalChunkAmount) {
    console.log("File has been fully received! Finalizing...");
    screens.loading.setStatus("Merging chunks...");
    screens.loading.setDetails(strip(fileName) + ' &bull; <span class="loading-details-progress">0% (0 / '+finalChunkAmount+'</span>');
    screens.loading.resetProgress();
    screens.loading.setProgress(0, finalChunkAmount);
    screens.showLoadingScreen(false);
});

// for receiver
ipcRenderer.on('chunks-merged', function(event, progress, total) {
    if (progress == total) {
        screens.loading.setStatus("Saving file...");
        screens.loading.setDetails(strip(fileName));
        screens.loading.resetProgress();
        screens.showLoadingScreen(true);
        ipcRenderer.send('progress-update', true, 0, {
            mode: "indeterminate"
        });
    }
    else {
        screens.loading.setProgress(progress, total);
    }
});

// for receiver
ipcRenderer.on('saved-file', function(event, data) {
    console.log("File has been saved");
    wsHandler.sendEventToSender('file_saved', null);
    screens.loading.setStatus("Waiting for " + strip(otherName) + "...");
    screens.loading.setDetails("");
    screens.loading.resetProgress();
    screens.showLoadingScreen(true);
    ipcRenderer.send('progress-update', true, 0, {
        mode: "indeterminate"
    });
});

function formSubmit(event) {
    event.preventDefault();
    screens.loading.setStatus("Establishing a peer to peer connection...");
    screens.loading.setDetails(strip(document.getElementById('senderpeerid').value));
    screens.loading.resetProgress();
    screens.showLoadingScreen(true);
    wsHandler.connectTo(document.getElementById('senderpeerid').value);
    ipcRenderer.send('progress-update', true, 0, {
        mode: "indeterminate"
    });
    return false;
}

function passwordSubmit(event) {
    event.preventDefault();
    screens.loading.setStatus("Loading your data...");
    screens.loading.setDetails("This might take a while. Please wait...");
    screens.loading.resetProgress();
    screens.showLoadingScreen(true);
    ipcRenderer.send('password-set', document.getElementById('password').value);
    return false;
}

function optionsSubmit(event) {
    event.preventDefault();
    screens.showPeerIdShowcaser();
    return false;
}

ipcRenderer.on('userdata-loaded', function(event) {
    screens.loading.setStatus("Loading...");
    screens.loading.setDetails("Please wait...");
    screens.loading.resetProgress();
    screens.showLoadingScreen(true);
});

ipcRenderer.on('userdata-loading-error', function(event, err) {
    screens.startPasswordInputter(err);
});

function freshPasswordSubmit(event) {
    event.preventDefault();
    screens.loading.setStatus("Creating your data...");
    screens.loading.setDetails("Please wait...");
    screens.loading.resetProgress();
    screens.showLoadingScreen(true);
    ipcRenderer.send('password-set-fresh', document.getElementById('freshpassword').value);
    return false;
}

ipcRenderer.on('userdata-created', function(event) {
    screens.loading.setStatus("Loading...");
    screens.loading.setDetails("Please wait...");
    screens.loading.resetProgress();
    screens.showLoadingScreen(true);
});

ipcRenderer.on('signed-in', function(event) {
    wsHandler.init();
});

function nameSubmit(event) {
    event.preventDefault();
    // start generating a pgp keypair with the name
    screens.loading.setStatus("Generating a PGP keypair...");
    screens.loading.setDetails("This might take a while. Please wait...");
    screens.loading.resetProgress();
    ipcRenderer.send('user-name-changed', document.getElementById('yourname').value);
    screens.showLoadingScreen(true);
    return false;
}

let loadingTimeout = null;
function domReady() {
    loadingTimeout = setTimeout(function() {
        var extraLoading = document.getElementById("extra-loading");
        extraLoading.style.height = "150px";
        extraLoading.style.marginTop = "72px";
    }, 3000);

    fileHandler.init();

    attachInformationBalloons();

    // screens.startPasswordInputter();
    if (ipcRenderer.sendSync('prevsession-exists') === true) {
        screens.startPasswordInputter();
    }
    else {
        screens.startFreshStarter();
    }
}

// for both
ipcRenderer.on('pgp-keys-generated', function(event, pubKey) {
    publicKey = pubKey;
    screens.startPurposeSelector();
});

// for both
ipcRenderer.on('pgp-keys-generation-error', function(event, error) {
    console.error(error);
    screens.showErrorScreen("0x3001");
});

// run this function when the sender states the next chunk is ready to be sent
ipcRenderer.on('next-chunk-ready-to-send', function(event, data) {
    // only used by websocket
    // webrtc uses its own received event in rtc.js
    fileHandler.prepareChunk(fileHandler.offset);
});

function attachInformationBalloons() {
    var infoButtons = document.getElementsByClassName("info-btn");
    console.log(infoButtons);
    var infoButtonsAmount = infoButtons.length;
    for (var ib = 0; ib < infoButtonsAmount; ib++) {
        infoButtons[ib].addEventListener("click", function(event) {
            alert(event.target.getAttribute("data-info"));
        });
    }
}

function tabIndexFix(event, funcToRun) {
    if (event.which == 13 || event.keyCode == 13) {
        // keycode 13 means ENTER
        funcToRun();
    }
}