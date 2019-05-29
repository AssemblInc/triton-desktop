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

    data: {
        size: 0,
        amountLeft: 0,
        chunkNumber: 0,
        encrypted: false,
        content: Buffer.from("")
    },
    resetChunkData: function() {
        netHandler.data.size = 0;
        netHandler.data.amountLeft = 0;
        netHandler.data.chunkNumber = 0;
        netHandler.data.encrypted = false;
        netHandler.data.content = Buffer.from("");
    },
    setChunkData: function(params) {
        if (params != null) {
            netHandler.data.size = parseInt(params[3]);
            netHandler.data.amountLeft = netHandler.data.size;
            netHandler.data.chunkNumber = parseInt(params[2]);
            if (parseInt(params[1]) > 0) {
                netHandler.data.encrypted = true;
            }
            else {
                netHandler.data.encrypted = false;
            }
        }
    },
    handleChunk: function(params, chunk) {
        if (params != null) {
            netHandler.data.size = parseInt(params[3]);
            netHandler.data.chunkNumber = parseInt(params[2]);
            if (parseInt(params[1]) > 0) {
                netHandler.data.encrypted = true;
            }
            else {
                netHandler.data.encrypted = false;
            }
        }
        netHandler.data.content = Buffer.concat([netHandler.data.content, chunk]);
        if (netHandler.data.size == netHandler.data.content.byteLength) {
            if (netHandler.data.encrypted) {
                ipcRenderer.send('renderer-received-chunk', netHandler.data.content.toString(), netHandler.data.chunkNumber);
            }
            else {
                // console.log(netHandler.data.content);
                // console.log(new Uint8Array(netHandler.data.content));
                ipcRenderer.send('renderer-received-unencrypted-chunk', new Uint8Array(netHandler.data.content), netHandler.data.chunkNumber);
            }
            netHandler.resetChunkData();
        }
        else {
            netHandler.data.amountLeft = netHandler.data.size - netHandler.data.content.byteLength;
        }
    },

    tempData: Buffer.from(""),
    handleData: function(data) {
        if (netHandler.data.amountLeft == 0) {
            if (netHandler.tempData.byteLength > 0) {
                data = Buffer.concat([netHandler.tempData, data]);
                netHandler.tempData = Buffer.from("");
            }
            let lio = data.lastIndexOf(";");
            let params = data.slice(0, lio).toString().split(";");
            if (params.length < 4) {
                // if params are cut off by TCP, store them temporarily until the next packet arrives
                // then load it back into the new packet to process the data
                netHandler.tempData = data;
                return;
            }
            netHandler.setChunkData(params);
            netHandler.handleData(data.slice(lio+1));
        }
        else {
            if (data.byteLength < netHandler.data.amountLeft) {
                netHandler.handleChunk(null, data);
            }
            else {
                netHandler.handleChunk(null, data.slice(0, netHandler.data.amountLeft));
                netHandler.handleData(data.slice(netHandler.data.amountLeft));
            }
        }
    },

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
                                // console.log("Received data from NET socket: ", data);
                                if (netHandler.socketAuthorized) {
                                    netHandler.handleData(data);
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
            // console.log("Received data from NET server: ", data);
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
                // console.log("Packet size: ", chunk.byteLength);
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
            // console.log("Packet size: ", chunk.byteLength);
            netHandler.client.write("chunk;0;" + number + ";" + chunk.byteLength + ";" + chunk);
        }
        else {
            console.warn("Tried sending data over NET while the client was not set up yet.");
        }
    }
};