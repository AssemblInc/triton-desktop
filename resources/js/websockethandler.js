var wsHandler = {
    socket: null,
    connections: [],

    init: function() {
        wsHandler.socket = io('https://socket.assembl.science:8080');
        wsHandler.socket.on('connect', function() {
            console.log("Websocket connected");
        });
        wsHandler.socket.on('disconnect', function() {
            console.warn("Websocket disconnected");
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
        });
        wsHandler.socket.on('welcome', function(welcomeMsg) {
            console.log(welcomeMsg);
        });
    }
};

wsHandler.init();