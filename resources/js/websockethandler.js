var wsHandler = {
    socket: null,
    isOpen: false,
    ioStream: null,
    accepting: false,

    init: function() {
        screens.loading.setStatus("Establishing connection...");
        screens.loading.setDetails("");
        screens.loading.resetProgress();
        screens.showLoadingScreen(true);
        wsHandler.socket = io('https://socket.assembl.ch:2998');
        wsHandler.socket.on('connect', function() {
            console.log("Websocket connected: " + wsHandler.socket.id);
            setTimeout(function() {
                screens.loading.setStatus("Generating a PGP keypair...");
                screens.loading.setDetails("This might take a while. Please wait...");
                screens.loading.resetProgress();
                ipcRenderer.send('websocket-connected');
                screens.showLoadingScreen(true);
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
                    toastr.error("Could not establish a connection: " + errDesc);
                    screens.startReceiver();
                    screens.loading.resetProgress();
                    break;
                case "invalid_assembl_id":
                    toastr.error("Could not establish a connection: " + errDesc);
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
                org_affiliation: ipcRenderer.sendSync('org-affiliation-request'),
                orcid_id: ipcRenderer.sendSync('orcidid-request'),
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
                case "connection_established":
                    showVerification(sender.assemblId, sender.name, sender.orgAffiliation, false);
                    screens.loading.setStatus("Waiting for " + strip(sender.name) + "...");
                    screens.loading.setDetails("");
                    screens.showLoadingScreen(true);
                    break;
                case "data_initialized":
                    ipcRenderer.send('renderer-transferinfo', data);
                    wsHandler.sendEventToSender("data_initialized_received", null);
                    break;
                case "data_transfer_complete":
                    ipcRenderer.send('renderer-filecomplete', data);
                    break;
                case "blockchain_info_complete":
                    ipcRenderer.send('blockchaininfo-finalized', data);
                    break;
                case "transfer_info_complete":
                    ipcRenderer.send('transferinfo-finalized', data);
                    break;
                case "public_key":
                    ipcRenderer.send('other-public-key-received', data);
                    break;
                case "http_server_data_request":
                    screens.loading.setDetails("Sending HTTP details...");
                    httpHandler.startServer().then(function() {
                        wsHandler.sendEventToSender("http_server_data_ready", JSON.stringify({
                            ip: httpHandler.publicIp,
                            localIp: httpHandler.localIp,
                            url: 'http://'+httpHandler.publicIp+':'+httpHandler.port+'/',
                            localUrl: 'http://'+httpHandler.localIp+':'+httpHandler.port+'/',
                            auth: httpHandler.requiredAuth
                        }));
                    });
                    break;
                case "net_server_data_request":
                    screens.loading.setDetails("Sending NET details...");
                    netHandler.startServer().then(function() {
                        wsHandler.sendEventToSender("net_server_data_ready", JSON.stringify({
                            ip: netHandler.publicIp,
                            localIp: netHandler.localIp,
                            port: netHandler.port,
                            auth: netHandler.requiredAuth
                        }));
                    });
                    break;
                case "webrtc_offer_ready":
                    screens.loading.setDetails("Sending WebRTC answer...");
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
                    if (fileHandler.useExperimental && !fileHandler.encryption.enabled) {
                        fileHandler.prepareHash(fileHandler.offset);
                    }
                    else {
                        fileHandler.startTransfer();
                    }
                    break;
                case "public_key":
                    ipcRenderer.send('other-public-key-received', data);
                    break;
                case "http_server_data_ready":
                    data = JSON.parse(data);
                    screens.loading.setDetails("Setting up the connection...");
                    externalIp.v4().then(function(publicIp) {
                        if (publicIp == data.ip) {
                            // receiver is on the same network!
                            // use local IP instead of public IP for faster speeds.
                            httpHandler.initSender(data.localUrl, data.auth);
                        }
                        else {
                            // receiver is not on the same network.
                            // use public IP for connection.
                            httpHandler.initSender(data.url, data.auth);
                        }
                        showVerification(receiver.assemblId, receiver.name, receiver.orgAffiliation, true);
                        screens.startFileDropper();
                    });
                    break;
                case "net_server_data_ready":
                    data = JSON.parse(data);
                    screens.loading.setDetails("Setting up the connection...");
                    externalIp.v4().then(function(publicIp) {
                        if (publicIp == data.ip) {
                            // receiver is on the same network!
                            // use local IP instead of public IP for faster speeds.
                            netHandler.startClient(data.localIp, data.port, data.auth);
                        }
                        else {
                            // receiver is not on the same network.
                            // use public IP for connection.
                            netHandler.startClient(data.publicIp, data.port, data.auth);
                        }
                        showVerification(receiver.assemblId, receiver.name, receiver.orgAffiliation, true);
                        screens.startFileDropper();
                    });
                    break;
                case "webrtc_answer_ready":
                    screens.loading.setDetails("Setting up the connection...");
                    rtcHandler.connectAnswer(data)
                        .then(function() {
                            showVerification(receiver.assemblId, receiver.name, receiver.orgAffiliation, true);
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
        wsHandler.socket.on("as_connection_request", function(assemblID, userName, orgAffiliation) {
            console.log("Incoming connection request: " + assemblID + " " + userName + "("+orgAffiliation+")");
            if (wsHandler.accepting) {
                wsHandler.socket.emit("as_connection_accepted", assemblID);
            }
            else {
                wsHandler.socket.emit("as_connection_rejected", assemblID);
            }
        }); 

        // for sender
        wsHandler.socket.on('as_connection_made', function(assemblID, userName, orgAffiliation, orcidId) {
            console.log("Connection made: " + assemblID + " " + userName + "("+orgAffiliation+", ORCID iD "+orcidId+")");
            receiver.name = userName;
            receiver.assemblId = assemblID;
            receiver.orgAffiliation = orgAffiliation;
            receiver.orcidId = orcidId;
            document.getElementById("fileconfirm-recipient").innerHTML = strip(receiver.name);
            wsHandler.sendEvent("public_key", ipcRenderer.sendSync('publickey-request'));
            switch(fileHandler.protocolToUse) {
                case "websocket": {
                    showVerification(receiver.assemblId, receiver.name, receiver.orgAffiliation, true);
                    screens.startFileDropper();
                    break;
                }
                case "http": {
                    screens.loading.setStatus("Establishing connection with " + strip(receiver.name) + "...");
                    screens.loading.setDetails("Requesting HTTP details...");
                    screens.showLoadingScreen(true);
                    wsHandler.sendEvent("http_server_data_request");
                    break;
                }
                case "net": {
                    screens.loading.setStatus("Establishing connection with " + strip(receiver.name) + "...");
                    screens.loading.setDetails("Requesting NET details...");
                    screens.showLoadingScreen(true);
                    wsHandler.sendEvent("net_server_data_request");
                    break;
                }
                case "webrtc": {
                    screens.loading.setStatus("Establishing connection with " + strip(receiver.name) + "...");
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
        wsHandler.socket.on('as_connected_to', function(assemblID, userName, orgAffiliation, orcidId) {
            console.log("Outgoing connection: " + assemblID + " " + userName + "("+orgAffiliation+", ORCID iD "+orcidId+")");
            wsHandler.sendEventToSender("public_key", ipcRenderer.sendSync('publickey-request'));
            sender.name = userName;
            sender.assemblId = assemblID;
            sender.orgAffiliation = orgAffiliation;
            sender.orcidId = orcidId;
            screens.loading.setStatus("Establishing connection with " + strip(sender.name) + "...");
            screens.loading.setDetails("");
            screens.showLoadingScreen(true);
        });

        // for receiver
        wsHandler.socket.on('as_connection_rejected', function(assemblID, userName, orgAffiliation, orcidId) {
            console.log("Connection rejected: " + assemblID + " " + userName + "("+orgAffiliation+", ORCID iD "+orcidId+")");
            toastr.error("Could not establish a connection: " + userName + " was not ready. Try again in a few moments.");
            screens.startReceiver();
            screens.loading.resetProgress();
        });

        // for both
        wsHandler.socket.on('as_disconnecting', function(assemblID, reason) {
            if (assemblID !== ipcRenderer.sendSync('assemblid-request')) {
                console.warn(assemblID + " is disconnecting: ", reason);
                if (assemblID === sender.assemblId) {
                    alert(sender.name + " disconnected. Assembl Desktop will now quit.");
                }
                else if (assemblID === receiver.assemblId) {
                    alert(receiver.name + " disconnected. Assembl Desktop will now quit.");
                }
                ipcRenderer.send('app-should-close');
            }
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