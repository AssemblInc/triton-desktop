
let appClosing = false;
let publicKey = null;
let sender = {};
let receiver = {};
let fileName = "";

function linkify(text) {
    var urlRegex =/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    return text.replace(urlRegex, function(url) {
        return '<a target="_blank" href="' + url + '" title="Click to open link in web browser" onclick="event.preventDefault(); shell.openExternal(this.href);">' + url + '</a>';
    });
}

function strip(text) {
   var tmp = document.createElement("div");
   tmp.innerHTML = text;
   return tmp.textContent || tmp.innerText || "";
}

/* from https://stackoverflow.com/questions/2090551/parse-query-string-in-javascript */
function parseQuery(queryString) {
    var query = {};
    var pairs = (queryString[0] === '?' ? queryString.substr(1) : queryString).split('&');
    for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i].split('=');
        query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
    }
    return query;
}
/* end from */

/* from https://stackoverflow.com/questions/3387427/remove-element-by-id */
Element.prototype.remove = function() {
    this.parentElement.removeChild(this);
}
NodeList.prototype.remove = HTMLCollection.prototype.remove = function() {
    for(var i = this.length - 1; i >= 0; i--) {
        if(this[i] && this[i].parentElement) {
            this[i].parentElement.removeChild(this[i]);
        }
    }
}
/* end from */

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
    screens.loading.setStatus("Receiving file from " + strip(sender.name) + "...");
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
    screens.loading.setStatus("Waiting for " + strip(sender.name) + "...");
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

function showVerification(displayName, orcidId, asSender) {
    if (asSender) {
        wsHandler.sendEvent("connection_established");
    }
    document.getElementById("verif").style.display = "block";
    document.getElementById("verif-name").innerHTML = strip(displayName);
    if (orcidId != null) {
        document.getElementById("verif-orcid").setAttribute("href", "https://orcid.org/"+orcidId);
    }
    else {
        document.getElementById("verif-orcid").style.display = "none";
    }
    ipcRenderer.send('connection-p2p-established');
    alert("A connection with " + displayName + " has been established.");
}

function nameSubmit(event) {
    if (event != null) {
        event.preventDefault();
    }
    // start generating a pgp keypair with the name
    screens.loading.setStatus("Generating a PGP keypair...");
    screens.loading.setDetails("This might take a while. Please wait...");
    screens.loading.resetProgress();
    ipcRenderer.send('user-name-changed', document.getElementById('yourname').value);
    screens.showLoadingScreen(true);
    return false;
}

function confirmSend(event) {
    event.preventDefault();
    fileHandler.transferInfo.file.description = document.getElementById("fileconfirm-description").value;
    fileHandler.prepareTransfer();
    return false;
}

let loadingTimeout = null;
function domReady() {
    checkAndShowAnnouncement();

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

function checkAndShowAnnouncement() {
    let xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
        if (this.readyState == 2) {      // headers received
            let contentType = xhr.getResponseHeader("Content-Type");
            if (contentType != "application/json") {
                console.warn("Announcement Content-Type was not application/json but " + contentType + "! Aborting...");
                xhr.abort();
            }
        }
        else if (this.readyState == 4 && this.status == 200) {      // done
            let announcement = JSON.parse(this.responseText);
            console.log(announcement);
            if (announcement.message != null && announcement.message != undefined && announcement.message.length > 0) {
                let announcementElem = document.createElement("div");
                switch (announcement.type) {
                    case "error":
                        announcementElem.className = "announcement error";
                        break;
                    case "warning":
                        announcementElem.className = "announcement warning";
                        break;
                    case "info":
                    default:
                        announcementElem.className = "announcement info";
                        break;
                }
                announcementElem.innerHTML = linkify(strip(announcement.message));
                let announcePlaces = document.getElementsByClassName("announcement-ready");
                for (let i = 0; i < announcePlaces.length; i++) {
                    console.log("Added announcement to " + (i+1) + " screens");
                    announcePlaces[i].insertBefore(announcementElem.cloneNode(true), announcePlaces[i].firstChild);
                }
            }
        }
    };
    xhr.open('GET', 'https://assembl.science/api/desktop-announcement.json', true);
    xhr.setRequestHeader("Accept", "application/json")
    xhr.send();
}

let bonjourInstances = {};

ipcRenderer.on('bonjour-assembl-instance-up', function(event, instanceDetails) {
    instanceDetails = JSON.parse(instanceDetails);
    if (instanceDetails['assemblid'] != ipcRenderer.sendSync('assemblid-request')) {
        bonjourInstances[instanceDetails['assemblid']] = instanceDetails;
        let bonjourOption = document.createElement("option");
        bonjourOption.setAttribute("value", instanceDetails['assemblid']);
        bonjourOption.innerHTML = strip(instanceDetails['displayname'] + " (on " + instanceDetails['hostname'] + ")");
        document.getElementById("bonjour-finder-selector").appendChild(bonjourOption);
        let instanceAmount = Object.keys(bonjourInstances).length;
        if (instanceAmount > 0) {
            document.getElementById("bonjour-finder-preset").innerHTML = "Found "+instanceAmount+" connections on LAN";
            document.getElementById("bonjour-finder").style.display = "block";
        }
    }
});

ipcRenderer.on('bonjour-assembl-instance-down', function(event, instanceDetails) {
    instanceDetails = JSON.parse(instanceDetails);
    if (instanceDetails['assemblid'] != ipcRenderer.sendSync('assemblid-request')) {
        delete bonjourInstances[instanceDetails['assemblid']];
        document.querySelectorAll('option[value="'+instanceDetails['assemblid']+'"]')[0].remove();
        let instanceAmount = Object.keys(bonjourInstances).length;
        if (instanceAmount <= 0) {
            document.getElementById("bonjour-finder-preset").innerHTML = "Found "+instanceAmount+" connections on LAN";
            document.getElementById("bonjour-finder").style.display = "none";
        }
    }
});