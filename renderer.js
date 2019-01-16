const { ipcRenderer } = require('electron');

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

ipcRenderer.on('peer-connect-error', function(event, error) {
    console.log(error);
});

ipcRenderer.on('peer-connected', function(event, connectionFSM) {
    console.log(connectionFSM);
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
        ipcRenderer.send('peerid-entered', document.getElementById('senderpeerid').value);
    });
}