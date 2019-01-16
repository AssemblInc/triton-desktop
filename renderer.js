const { ipcRenderer } = require('electron');

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

function setLoadingProgress(progress, max) {
    document.getElementById("loading-progress").max = max;
    document.getElementById("loading-progress").value = progress;
    if (progress != max) {
        document.getElementById("loading-progress").innerHTML = ((progress / max) * 100).toFixed(1) + "%";
    }
    else {
        document.getElementById("loading-progress").innerHTML = "100%";
    }
}

function resetLoadingProgress() {
    document.getElementById("loading-progress").max = 100;
    document.getElementById("loading-progress").value = 0;
    document.getElementById("loading-progress").innerHTML = "0.0%";
}

ipcRenderer.on('peer-connect-error', function(event, error) {
    console.log(error);
});

ipcRenderer.on('peer-connected', function(event, connectionFSM) {
    console.log(connectionFSM);
});

let receiverName = "";
ipcRenderer.on('receiver-connected', function(event, name) {
    console.log("A receiver connected");
    receiverName = name;
    alert('Connection established with ' + receiverName + '! You can now select a file to transfer.');
    startFileDropper();
});

ipcRenderer.on('receiving-file', function(event, data) {
    console.log("Receiving a file...");
    setLoadingStatus("Receiving file...");
});

ipcRenderer.on('received-file', function(event, data) {
    console.log("File has been received...");
    setLoadingStatus("Waiting for sender...");
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

function sendFile(file) {
    console.log("File changed!");
    setLoadingStatus("Preparing file for exchange...");
    resetLoadingProgress();
    showLoadingScreen();
    var reader = new FileReader();
    reader.addEventListener("load", function(event) {
        console.log("Filereader loaded!");
        setLoadingStatus("Getting ready...");
        resetLoadingProgress();
        showLoadingScreen(true);
        // console.log(reader.result);
        var fileAB = reader.result;
        ipcRenderer.send('data-ready-for-transfer', new Uint8Array(fileAB));
        setLoadingStatus("Sending data to " + strip(receiverName) + "...");
    });
    reader.addEventListener("progress", function(data) {
        if (data.lengthComputable) {
            setLoadingProgress(data.loaded, data.total);
        }
    });
    reader.readAsArrayBuffer(file);
}