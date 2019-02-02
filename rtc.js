const server = { urls: 'stun:stun.l.google.com:19302' };

let pc = new RTCPeerConnection({ iceServers: [server] });
let fileDC;
function fileDCinit() {
    console.log("Adding event listeners to fileDC...");
    fileDC.onopen = function() {
        console.log("fileDC opened");
    };
    fileDC.onmessage = function(event) {
        // console.log("Received data from fileDC:", event.data);
        // console.log(event);
        if (event.data == "received") {
            fileHandler.sendChunk(fileHandler.offset);
        }
        else {
            sendRTC("received", false);
            ipcRenderer.send('webrtc-received-chunk', event.data);
        }
    }
    fileDC.onerror = function(err) {
        console.warn("An error occured within the fileDC");
        console.error(err);
    };
    fileDC.onclose = function() {
        console.warn("fileDC closed!");
    };
    fileDC.onbufferedamountlow = function(event) {
        console.warn("fileDC buffered amount is low");
    };
}
pc.oniceconnectionstatechange = function(event) {
    console.log("New ICEConnectionState:", pc.iceConnectionState);
};
pc.ondatachannel = function(event) {
    console.log("Datachannel received");
    fileDC = event.channel;
    fileDCinit();
};
// if the user is the sender, this function needs to be run
function createOffer() {
    fileDC = pc.createDataChannel("file");
    fileDCinit();
    pc.createOffer().then(function(d) {
        console.log(d);
        pc.setLocalDescription(d).catch(function(reason) {
            console.error(reason);
        });
        pc.onicecandidate = function(event) {
            if (event.candidate) {
                return;
            }
            // the following is the offerValue
            console.log("offerValue:", pc.localDescription.sdp);
            ipcRenderer.send('webrtc-offervalue-ready', pc.localDescription.sdp);
        };
    });
}

function connectOffer(offerValue) {
    if (pc.signalingState != "stable") {
        console.warn("pc signalingState doesn't equal stable (equals " + pc.signalingState + " instead). Won't connect.");
        return;
    }
    let desc = new RTCSessionDescription({ type: "offer", sdp:offerValue });
    pc.setRemoteDescription(desc)
        .then(function() {
            pc.createAnswer().then(function(d) {
                pc.setLocalDescription(d);
            });
        })
        .catch(function(reason) {
            console.error(reason);
        });
    pc.onicecandidate = function(event) {
        if (event.candidate) {
            return;
        }
        // the following is the answerValue
        console.log("answerValue:", pc.localDescription.sdp);
        ipcRenderer.send('webrtc-answervalue-ready', pc.localDescription.sdp);
    };
}

function connectAnswer(answerValue) {
    if (pc.signalingState != "have-local-offer") {
        console.warn("pc signalingState doesn't equal have-local-offer (equals " + pc.signalingState + " instead). Won't connect.");
        return;
    }
    var desc = new  RTCSessionDescription({ type: "answer", sdp:answerValue });
    pc.setRemoteDescription(desc).catch(function(reason) {
        console.error(reason);
    });
}

function sendRTC(something, isChunk) {
    if (!isChunk) {
        fileDC.send(something);
    }
    else {
        ipcRenderer.send('pgp-encrypt-chunk', something);
    }
    // console.log("Sent through fileDC:", something);
}

ipcRenderer.on('pgp-chunk-encrypted', function(event, encryptedMsg) {
    fileDC.send(encryptedMsg);
});

ipcRenderer.on('pgp-chunk-encryption-error', function(event, err) {
    console.error("An error occured encrypting the chunk", err);
});

ipcRenderer.on('webrtc-offervalue-please', function(event) {
    if (fileHandler.protocolToUse == "webrtc") {
        console.log("Creating an offerValue...");
        createOffer();
    }
    else {
        console.log("Not creating an offerValue, as the protocol to use is not set to 'webrtc'. It's been set to '" + fileHandler.protocolToUse + "' instead.");
    }
});

ipcRenderer.on('webrtc-offervalue-received', function(event, offerValue) {
    console.log("Received an offerValue", offerValue);
    connectOffer(offerValue);
});

ipcRenderer.on('webrtc-answervalue-received', function(event, answerValue) {
    console.log("Received an answerValue", answerValue);
    connectAnswer(answerValue);
});