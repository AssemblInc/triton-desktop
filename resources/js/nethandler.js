let net = require('net');

let netHandler = {
    publicIp: null,
    localIp: null,
    server: null,
    client: null,
    publicIp: null,
    internalIp: null,
    requiredAuth: "assembl",
    port: 27627,

    startServer: function() {
        return new Promise(function(resolve, reject) {
            externalIp.v4().then(function(publicIp) {
                netHandler.publicIp = publicIp;
                internalIp.v4().then(function(localIp) {
                    netHandler.localIp = localIp;
                    netHandler.server = net.createServer(function(socket) {
                        console.log("NET socket connected!");
                        socket.on('data', function(data) {
                            console.log("Received data from NET socket: ", data);
                        });
                        socket.on('end', function() {
                            console.log("NET socket disconnected");
                        });
                    });
                    netHandler.server.listen(netHandler.port);
                    resolve();
                });
            });
        });
    },

    startClient: function(port, ip) {
        netHandler.client = new net.Socket();
        netHandler.client.connect(port, ip, function() {
            console.log("Client connected");
        });
        netHandler.client.on('data', function(data) {
            console.log("Received data from NET server: ", data);
        });
        netHandler.client.on('close', function() {
            console.log("Connection closed");
        });
    },

    sendChunk: function(chunk, isEncrypted, number) {
        if (netHandler.client != null) {
            if (isEncrypted) {
                netHandler.client.write("chunk;1;" + number + ";" + chunk);
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
            netHandler.client.write("chunk;0;" + number + ";" + chunk);
        }
        else {
            console.warn("Tried sending data over NET while the client was not set up yet.");
        }
    }
};