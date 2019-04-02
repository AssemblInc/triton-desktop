
let appClosing = false;
let protocolToUse = null;
let publicKey = null;
let otherName = "";

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
    alert("Could not establish a connection. Assembl Desktop will now quit.");
    ipcRenderer.send('app-should-close');
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
    screens.loading.setStatus("Receiving file from " + strip(otherName) + "...");
});

// for receiver
ipcRenderer.on('received-chunk', function(event, progressIncrease) {
    // console.log("Received a chunk of " + progressIncrease + " bytes");
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
    screens.loading.setDetails(document.getElementById('senderpeerid').value);
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

    screens.startPasswordInputter();
}

// for sender
// once data is ready to be sent, execute this
// (data is ready to be sent once the file info has been confirmed received)
ipcRenderer.on('data-ready-to-send', function(event, data) {
    fileHandler.startTransfer();
});

// for receiver
ipcRenderer.on('other-name-received', function(event, other) {
    otherName = other;
    screens.loading.setStatus("Waiting for " + strip(otherName) + "...");
    screens.loading.setDetails("");
});

// for both
ipcRenderer.on('pgp-keys-generated', function(event, pubKey) {
    publicKey = pubKey;
    screens.startPurposeSelector();
});

// for both
ipcRenderer.on('pgp-keys-generation-error', function(event, error) {
    alert("An error occured while generating a PGP key. Assembl Desktop will now quit. Details: \n" + error);
    ipcRenderer.send('app-should-close');
});

// run this function when the sender states the next chunk is ready to be sent
ipcRenderer.on('next-chunk-ready-to-send', function(event, data) {
    // only used by websocket
    // webrtc uses its own received event in rtc.js
    fileHandler.sendChunk(fileHandler.offset);
});