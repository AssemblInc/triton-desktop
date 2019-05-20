let net = require('net');

let netHandler = {
    publicIp: null,
    localIp: null,
    server: null,
    socketAuthorized: false,
    client: null,
    publicIp: null,
    internalIp: null,
    requiredAuth: Math.random().toString(24).substring(2)+":"+Math.random().toString(36).substring(2)+Math.random().toString(36).substring(2)+Math.random().toString(36).substring(2),
    port: 27627,

    startServer: function() {
        return new Promise(function(resolve, reject) {
            externalIp.v4().then(function(publicIp) {
                netHandler.publicIp = publicIp;
                internalIp.v4().then(function(localIp) {
                    netHandler.localIp = localIp;
                    netHandler.server = net.createServer(function(socket) {
                        if (!netHandler.socketAuthorized) {
                            console.log("NET socket connected!");
                            socket.on('error', function(err) {
                                console.error("NET socket error: ", err);
                            });
                            socket.on('data', function(data) {
                                console.log("Received data from NET socket: ", data);
                                if (netHandler.socketAuthorized) {
                                    let lio = data.lastIndexOf(";");
                                    let params = data.slice(0, lio).toString().split(";");
                                    switch(params[0]) {
                                        case "chunk": {
                                            if (parseInt(params[1]) > 0) {
                                                ipcRenderer.send('renderer-received-chunk', data.slice(lio+1).toString(), parseInt(params[2]));
                                            }
                                            else {
                                                ipcRenderer.send('renderer-received-unencrypted-chunk', new Uint8Array(data.slice(lio+1)), parseInt(params[2]));
                                            }
                                            break;
                                        }
                                        default: {
                                            console.warn("NET params[0] equals " + params[0] + ", no idea what to do now");
                                            break;
                                        }
                                    }
                                }
                                else {
                                    // authorization process
                                    if (data.toString() !== keccak256(netHandler.requiredAuth)) {
                                        socket.destroy("incorrect_authorization_code");
                                    }
                                    else {
                                        netHandler.socketAuthorized = true;
                                    }
                                }
                            });
                            socket.on('end', function() {
                                console.log("NET socket disconnected");
                                netHandler.socketAuthorized = false;
                            });
                        }
                        else {
                            console.warn("Someone tried connecting even though a connection had already been set-up!");
                        }
                    });
                    netHandler.server.listen(netHandler.port);
                    resolve();
                });
            });
        });
    },

    startClient: function(ip, port, auth) {
        netHandler.client = new net.Socket();
        netHandler.client.connect(port, ip, function() {
            console.log("Client connected. Sending authorization code...");
            netHandler.client.write(keccak256(auth));
        });
        netHandler.client.on('data', function(data) {
            console.log("Received data from NET server: ", data);
        });
        netHandler.client.on('error', function(err) {
            console.error("NET socket error: ", err);
        });
        netHandler.client.on('close', function() {
            console.log("Connection closed");
        });
    },

    sendChunk: function(chunk, isEncrypted, number) {
        if (netHandler.client != null) {
            if (isEncrypted) {
                chunk = Buffer.from(chunk);
                netHandler.client.write("chunk;1;" + number + ";" + chunk.byteLength + ";" + chunk);
            }
            else {
                ipcRenderer.send('pgp-encrypt-chunk', chunk, number);
            }
        }
        else {
            console.warn("Tried sending data over NET while the client was not set up yet.");
        } 
    },

    sendUnencryptedChunk: function(chunk, number) {
        if (netHandler.client != null) {
            netHandler.client.write("chunk;0;" + number + ";" + chunk.byteLength + ";" + chunk);
        }
        else {
            console.warn("Tried sending data over NET while the client was not set up yet.");
        }
    }
};