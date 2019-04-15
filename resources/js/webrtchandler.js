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
            // console.log(event.data);
            try {
                let data = JSON.parse(event.data);
                switch(data.type) {
                    case "chunk": {
                        if (data.isEncrypted) {
                            ipcRenderer.send('renderer-received-chunk', data.chunk, data.number);
                        }
                        else {
                            ipcRenderer.send('renderer-received-unencrypted-chunk', new Uint8Array(data.chunk), data.number);
                        }
                        break;
                    }
                    default: {
                        console.warn("Unknown message type " + data.type);
                        break;
                    }
                }
            }
            catch(err) {
                console.error(err);
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
            console.log("New ICEConnectionState:", rtcHandler.connection.iceConnectionState);
        };
        rtcHandler.connection.ondatachannel = function(event) {
            console.log("Datachannel received");
            rtcHandler.fileChannel = event.channel;
            rtcHandler.initFileChannel();
        };
    },

    createOffer: function() {
        return new Promise(function(resolve, reject) {
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
                    resolve(rtcHandler.connection.localDescription.sdp);
                };
            });
        });
    },

    createAnswer: function(offerValue) {
        return new Promise(function(resolve, reject) {
            if (rtcHandler.connection.signalingState != "stable") {
                screens.showErrorScreen("0x2004");
                reject("WebRTC signalingState does not equal stable (equals " +rtcHandler.connection.signalingState + " instead)");
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
                    screens.showErrorScreen("0x2005");
                    reject(reason);
                });
                rtcHandler.connection.onicecandidate = function(event) {
                    console.log(event);
                    // the following is the answerValue
                    console.log("answerValue:", rtcHandler.connection.localDescription.sdp);
                    resolve(rtcHandler.connection.localDescription.sdp)
                };
        });
    },

    connectAnswer: function(answerValue) {
        return new Promise(function(resolve, reject) {
            if (rtcHandler.connection.signalingState != "have-local-offer") {
                screens.showErrorScreen("0x2006");
                reject("WebRTC connection signalingState doesn't equal have-local-offer (equals " + rtcHandler.connection.signalingState + " instead)");
            }
            else {
                var desc = new  RTCSessionDescription({ type: "answer", sdp:answerValue });
                rtcHandler.connection.setRemoteDescription(desc).catch(function(reason) {
                    screens.showErrorScreen("0x2005");
                    reject(reason);
                });
                resolve();
            }
        });
    },

    sendChunk: function(chunk, isEncrypted, number) {
        if (rtcHandler.isOpen) {
            if (isEncrypted) {
                rtcHandler.fileChannel.send(JSON.stringify({
                    type: "chunk",
                    chunk: chunk,
                    isEncrypted: isEncrypted,
                    number: number
                }));
            }
            else {
                ipcRenderer.send('pgp-encrypt-chunk', chunk, number);
            }
        }
        else {
            console.warn("Tried sending data over WebRTC while the connection has not been opened yet.");
        }
    },

    sendUnencryptedChunk: function(chunk, number) {
        if (rtcHandler.isOpen) {
            rtcHandler.fileChannel.send(JSON.stringify({
                type: "chunk",
                chunk: Array.from(chunk),
                isEncrypted: false,
                number: number
            }));
        }
        else {
            console.warn("Tried sending data over WebRTC while the connection has not been opened yet.");
        }
    }
};

rtcHandler.init();