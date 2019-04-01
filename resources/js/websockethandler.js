var wsHandler = {
    socket: null,
    connections: [],

    init: function() {
        screens.loading.setStatus("Establishing connection...");
        screens.loading.setDetails("");
        screens.loading.resetProgress();
        screens.showLoadingScreen(true);
        wsHandler.socket = io('https://socket.assembl.science:2998');
        wsHandler.socket.on('connect', function() {
            console.log("Websocket connected");
            setTimeout(function() {
                screens.startNameInputter();
            }, 1000);
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
            alert("Could not establish a connection. Assembl Desktop will now quit.");
            ipcRenderer.send('app-should-close');
        });
        wsHandler.socket.on('welcome', function(welcomeMsg) {
            console.log(welcomeMsg);
        });
    }
};