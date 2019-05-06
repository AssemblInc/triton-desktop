let SFTPClient = require('ssh2-sftp-client');
let SFTPServer = require('node-sftp-server');

/*
let sftp = new sftpClient();
console.log(sftp);
sftp.connect({
    host: 'socket.assembl.science',
    port: '22',
    username: 'assembl',
    password: 'aawewe'
}).then(function() {
    return sftp.list('/var/assembl-wsserver');
}).then(function(data) {
    console.log(data);
}).catch(function(err) {
    console.error(err);
});
*/

let sftpHandler = {
    client: null,
    server: null,

    startServer: function() {
        return new Promise(function(resolve, reject) {
            sftpHandler.server = new SFTPServer({
                privateKeyFile: undefined,
                debug: true
            }).listen(2773);
            sftpHandler.server.on('connect', function(auth, info) {
                if (auth.username === "assembl" && auth.password === "testpassword") {
                    return auth.accept(function(session) {
                        // TODO: add more session events
                        // CHECK https://www.npmjs.com/package/node-sftp-server
                        // AND https://github.com/validityhq/node-sftp-server/blob/master/server_example.js
                        session.on("realpath", function(path, callback) {
                            callback("/");
                        });
                        session.on("stat", function(path, statkind, statresponder) {
    
                        });
                        session.on("readdir", function(path, responder) {
                            return responder.end();
                        });
    
                    });
                }
            });
            resolve();
        });
    },

    connectToServer: function(host, port, username, password) {
        sftpHandler.client = new SFTPClient();
        return new Promise(function(resolve, reject) {
            sftpHandler.client.connect({
                host: host,
                port: port,
                username: username,
                password: password
            }).then(function() {
                console.log("A connection has been made!");
                resolve();
            }).catch(function(err) {
                console.error(err);
                reject(err);
            });
        });
    }
};