var rtcHandler = {
    iceServer: { urls: 'stun:stun.l.google.com:19302' },
    connection: null,
    fileChannel: null,
    isOpen: false,

    initFileChannel: function() {
        rtcHandler.fileChannel.onopen = function() {
            console.log("WebRTC fileChannel opened");
            rtcHandler.isOpen = true;
        };
        rtcHandler.fileChannel.onmessage = function(event) {
            // console.log("Received data from fileDC:", event.data);
            // console.log(event);
            if (event.data == "received") {
                fileHandler.sendChunk(fileHandler.offset);
            }
            else {
                rtcHandler.send("received", false, false);
                ipcRenderer.send('renderer-received-chunk', event.data);
            }
        };
        rtcHandler.fileChannel.onerror = function(err) {
            console.warn("An error occured within the WebRTC fileChannel");
            console.error(err);
        };
        rtcHandler.fileChannel.onclose = function() {
            console.warn("WebRTC fileChannel closed!");
            rtcHandler.isOpen = false;
        };
        rtcHandler.fileChannel.onbufferedamountlow = function(event) {
            console.warn("WebRTC fileChannel buffered amount is low");
        };
    },

    init: function() {
        rtcHandler.connection = new RTCPeerConnection({ iceServers: [ rtcHandler.iceServer ]});
        rtcHandler.connection.oniceconnectionstatechange = function(event) {
            console.log("New ICEConnectionState:", pc.iceConnectionState);
        };
        rtcHandler.connection.ondatachannel = function(event) {
            console.log("Datachannel received");
            rtcHandler.fileChannel = event.channel;
            rtcHandler.initFileChannel();
        };
        
        ipcRenderer.on('webrtc-offervalue-please', function(event) {
            if (fileHandler.protocolToUse == "webrtc") {
                console.log("Creating an offerValue...");
                rtcHandler.createOffer();
            }
            else {
                console.log("Not creating an offerValue, as the protocol to use is not set to 'webrtc'. It's been set to '" + fileHandler.protocolToUse + "' instead.");
            }
        });
        
        ipcRenderer.on('webrtc-offervalue-received', function(event, offerValue) {
            console.log("Received an offerValue", offerValue);
            rtcHandler.connectOffer(offerValue);
        });
        
        ipcRenderer.on('webrtc-answervalue-received', function(event, answerValue) {
            console.log("Received an answerValue", answerValue);
            rtcHandler.connectAnswer(answerValue);
        });
    },

    createOffer: function() {
        rtcHandler.fileChannel = rtcHandler.connection.createDataChannel("file");
        rtcHandler.initFileChannel();
        rtcHandler.connection.createOffer().then(function(d) {
            console.log(d);
            rtcHandler.connection.setLocalDescription(d).catch(function(reason) {
                console.error(reason);
            });
            rtcHandler.connection.onicecandidate = function(event) {
                if (event.candidate) {
                    return;
                }
                // the following is the offerValue
                console.log("offerValue:", rtcHandler.connection.localDescription.sdp);
                ipcRenderer.send('webrtc-offervalue-ready', rtcHandler.connection.localDescription.sdp);
            };
        });
    },

    connectOffer: function(offerValue) {
        if (rtcHandler.connection.signalingState != "stable") {
            console.warn("WebRTC connection signalingState doesn't equal stable (equals " +rtcHandler.connection.signalingState + " instead). Won't connect.");
            return;
        }

        let desc = new RTCSessionDescription({ type: "offer", sdp:offerValue });
        rtcHandler.connection.setRemoteDescription(desc)
            .then(function() {
                rtcHandler.connection.createAnswer().then(function(d) {
                    rtcHandler.connection.setLocalDescription(d);
                });
            })
            .catch(function(reason) {
                console.error(reason);
            });
            rtcHandler.connection.onicecandidate = function(event) {
            if (event.candidate) {
                return;
            }
            // the following is the answerValue
            console.log("answerValue:", rtcHandler.connection.localDescription.sdp);
            ipcRenderer.send('webrtc-answervalue-ready', rtcHandler.connection.localDescription.sdp);
        };
    },

    connectAnswer: function(answerValue) {
        if (rtcHandler.connection.signalingState != "have-local-offer") {
            console.warn("WebRTC connection signalingState doesn't equal have-local-offer (equals " + rtcHandler.connection.signalingState + " instead). Won't connect.");
            return;
        }
        var desc = new  RTCSessionDescription({ type: "answer", sdp:answerValue });
        rtcHandler.connection.setRemoteDescription(desc).catch(function(reason) {
            console.error(reason);
        });
    },

    send: function(something, isChunk, isEncrypted) {
        if (rtcHandler.isOpen) {
            if (!isChunk || isEncrypted) {
                rtcHandler.fileChannel.send(something);
            }
            else {
                ipcRenderer.send('pgp-encrypt-chunk', something);
            }
        }
        else {
            console.warn("Tried sending data over WebRTC while the connection has not been opened yet.");
        }
    }
};

rtcHandler.init();