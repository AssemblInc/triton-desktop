let net = require('net');

let netHandler = {
    server: null,
    client: null,
    publicIp: null,
    internalIp: null,
    port: 27626,

    startServer: function() {
        netHandler.server = net.createServer(function(socket) {
            socket.write("Henlo");
            socket.on('data', function(data) {
                console.log("Received data from socket: ", data);
            });
        }).listen(netHandler.port, '127.0.0.1');
    },

    startClient: function(port, ip) {
        netHandler.client = new net.Socket();
        netHandler.client.connect(port, ip, function() {
            console.log("Client connected");
            netHandler.client.write('Hi server!');
        });
        netHandler.client.on('data', function(data) {
            console.log("Received data from server: ", data);
        });
        netHandler.client.on('close', function() {
            console.log("Connection closed");
        });
    }
};