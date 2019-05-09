var wsHandler = {
    socket: null,
    isOpen: false,
    ioStream: null,

    init: function() {
        screens.loading.setStatus("Establishing connection...");
        screens.loading.setDetails("");
        screens.loading.resetProgress();
        screens.showLoadingScreen(true);
        wsHandler.socket = io('https://socket.assembl.science:2998');
        wsHandler.socket.on('connect', function() {
            console.log("Websocket connected: " + wsHandler.socket.id);
            setTimeout(function() {
                screens.startNameInputter();
            }, 1000);
            wsHandler.isOpen = true;
        });
        wsHandler.socket.on('disconnect', function() {
            console.warn("Websocket disconnected");
            wsHandler.isOpen = false;
        });
        wsHandler.socket.on('reconnect_attempt', function(attemptNumber) {
            console.log("Attempting to reconnect to websocket ("+attemptNumber+")...");
        });
        wsHandler.socket.on('reconnect', function() {
            console.log("Reconnected to the websocket");
        });
        wsHandler.socket.on('error', function(err) {
            console.error(err);
        });
        wsHandler.socket.on('connect_error', function(timeout) {
            console.warn("Websocket connection attempt timed out");
            screens.showErrorScreen('0x2001');
        });

        wsHandler.socket.on('as_error', function(err, errDesc) {
            console.error("as_error " + err + ": " + errDesc);
            switch(err) {
                case "client_not_connected":
                    alert("Could not establish a connection: " + errDesc);
                    screens.startReceiver();
                    screens.loading.resetProgress();
                    break;
                case "invalid_assembl_id":
                    alert("Could not establish a connection: " + errDesc);
                    screens.startReceiver();
                    screens.loading.resetProgress();
                    break;
            }
        });
        wsHandler.socket.on('as_success', function(succ, succDesc) {
            console.log("as_success " + succ + ": " + succDesc);
        });

        wsHandler.socket.on('as_welcome', function(welcomeMsg) {
            console.log("as_welcome: " + welcomeMsg);
            wsHandler.socket.emit("as_my_data", {
                assembl_id: ipcRenderer.sendSync('assemblid-request'),
                user_name: ipcRenderer.sendSync('username-request'),
                orcid_id: ipcRenderer.sendSync('orcid-request')
            });
        });

        wsHandler.socket.on('as_chunk_for_receiver', function(chunk, number) {
            ipcRenderer.send('renderer-received-chunk', chunk, number);
        });

        wsHandler.socket.on('as_unencrypted_chunk_for_receiver', function(chunk, number) {
            ipcRenderer.send('renderer-received-unencrypted-chunk', new Uint8Array(Object.values(chunk)), number);
        });

        ss(wsHandler.socket).on('as_stream_for_receiver', function(stream) {
            console.log("Received stream!");
            console.log(stream);
            stream.on('data', function(data) {
                console.log(data);
            });
            stream.on('error', function(err) {
                console.error(err);
            });
            stream.on('end', function() {
                console.log("Stream ended!");
            });
            stream.on('finish', function() {
                console.log("Stream finished");
            });
            wsHandler.ioStream = stream;
        });

        wsHandler.socket.on('as_event_for_receiver', function(eventName, data) {
            console.log("as_event_for_receiver " + eventName + ": ", data);
            switch(eventName) {
                case "data_initialized":
                    ipcRenderer.send('renderer-transferinfo', data);
                    wsHandler.sendEventToSender("data_initialized_received", null);
                    break;
                case "data_transfer_complete":
                    ipcRenderer.send('renderer-filecomplete', data);
                    break;
                case "transfer_info_complete":
                    ipcRenderer.send('transferinfo-finalized', data);
                    break;
                case "public_key":
                    ipcRenderer.send('other-public-key-received', data);
                    break;
                case "webrtc_offer_ready":
                    rtcHandler.createAnswer(data)
                        .then(function(answer) {
                            wsHandler.sendEventToSender("webrtc_answer_ready", answer);
                        })
                        .catch(function(err) {
                            console.error(err);
                            // error screens are handled within createAnswer itself
                        });
                    break;
                default:
                    console.warn("Unimplemented event " + eventName);
                    break;
            }
        });

        wsHandler.socket.on('as_event_for_sender', function(eventName, data) {
            console.log("as_event_for_sender " + eventName + ": ", data);
            switch(eventName) {
                case "chunk_received":
                    // fileHandler.prepareChunk(fileHandler.offset);
                    break;
                case "file_saved":
                    console.log("File has been saved by the receiver");
                    screens.loading.resetProgress();
                    screens.startFileDropper();
                    break;
                case "data_initialized_received":
                    fileHandler.startTransfer();
                    break;
                case "public_key":
                    ipcRenderer.send('other-public-key-received', data);
                    break;
                case "webrtc_answer_ready":
                    rtcHandler.connectAnswer(data)
                        .then(function() {
                            alert("A connection with " + receiverName + " has been established.");
                            screens.startFileDropper();
                        })
                        .catch(function(err) {
                            console.error(err);
                            // error screens are handled within connectAnswer itself
                        });
                    break;
                default:
                    console.warn("Unimplemented event " + eventName);
                    break;
            }
        });

        // for sender
        wsHandler.socket.on('as_connection_made', function(assemblID, userName, orcidID) {
            console.log("Incoming connection: " + assemblID + " " + userName + "("+orcidID+")");
            receiverName = userName;
            document.getElementById("fileconfirm-recipient").innerHTML = strip(receiverName);
            wsHandler.sendEvent("public_key", ipcRenderer.sendSync('publickey-request'));
            switch(fileHandler.protocolToUse) {
                case "websocket": {
                    alert("A connection with " + receiverName + " has been established.");
                    screens.startFileDropper();
                    break;
                }
                case "webrtc": {
                    screens.loading.setStatus("Establishing connection with " + strip(receiverName) + "...");
                    screens.loading.setDetails("Sending WebRTC offer...");
                    screens.showLoadingScreen(true);
                    rtcHandler.createOffer()
                        .then(function(offer) {
                            wsHandler.sendEvent("webrtc_offer_ready", offer);
                        })
                        .catch(function(err) {
                            console.error(err);
                            screens.showErrorScreen("0x2003");
                        });
                    break;
                }
                default: {
                    screens.showErrorScreen("0x2002");
                    break;
                }
            }
        });

        // for receiver
        wsHandler.socket.on('as_connected_to', function(assemblID, userName, orcidID) {
            console.log("Outgoing connection: " + assemblID + " " + userName + "("+orcidID+")");
            wsHandler.sendEventToSender("public_key", ipcRenderer.sendSync('publickey-request'));
            alert("A connection with " + userName + " has been established.");
            otherName = userName;      // otherName is set in renderer.js
            screens.loading.setStatus("Waiting for " + strip(otherName) + "...");
            screens.loading.setDetails("");
            screens.showLoadingScreen(true);
        });
    },

    connectTo: function(assemblID) {
        if (wsHandler.isOpen) {
            wsHandler.socket.emit("as_connect_to", assemblID);
        }
        else {
            console.warn("Tried connecting over websocket while the connection has not been established yet.");
        }
    },

    sendEventToSender: function(eventName, data) {
        if (wsHandler.isOpen) {
            wsHandler.socket.emit("as_send_event_to_sender", eventName, data);
        }
        else {
            console.warn("Tried sending event to sender over websocket while the connection has not been established yet.");
        }
    },

    sendEvent: function(eventName, data) {
        if (wsHandler.isOpen) {
            wsHandler.socket.emit("as_send_event", eventName, data);
        }
        else {
            console.warn("Tried sending event over websocket while the connection has not been established yet.");
        }
    },

    sendChunk: function(chunk, isEncrypted, number) {
        if (wsHandler.isOpen) {
            if (isEncrypted) {
                wsHandler.socket.emit("as_send_chunk", chunk, number);
            }
            else {
                ipcRenderer.send('pgp-encrypt-chunk', chunk, number);
            }
        }
        else {
            console.warn("Tried sending chunk over websocket while the connection has not been established yet.");
        }
    },

    sendUnencryptedChunk: function(chunk, number) {
        if (wsHandler.isOpen) {
            wsHandler.socket.emit("as_send_unencrypted_chunk", chunk, number);
        }
        else {
            console.warn("Tried sending unencrypted chunk over websocket while the connection has not been established yet.");
        }
    },

    openStream: function() {
        if (wsHandler.isOpen) {
            let stream = ss.createStream();
            ss(wsHandler.socket).emit('as_send_stream', stream);
            return stream;
        }
        else {
            console.warn("Tried opening a stream for websocket while the connection has not been established yet.");
        }
    }
};