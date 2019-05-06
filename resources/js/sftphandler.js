let ssh2 = require('ssh2');
let crypto = require('crypto');
let natUpnp = require('nat-upnp');

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
    uPnpClient: null,
    allowedUser: null,
    allowedPassword: null,

    initializeServer: function() {
        return new Promise(function(resolve, reject) {
            sshKeyGen.generateKeyPair()
                .then(function(keypair) {
                    console.log(keypair);
                    ipcRenderer.send("save-ssh-keys", keypair[0], keypair[1]);
                    resolve();
                })
                .catch(function(err) {
                    console.error(err);
                    screens.showErrorScreen("0x3004");
                    reject();
                });
        });
    },

    startServer: function(keyPath, allowedUser, allowedPassword) {
        keyPath = keyPath.replace("assembl_ssh_priv.key", "id_rsa");
        console.log(keyPath);
        sftpHandler.allowedUser = Buffer.from(allowedUser);
        sftpHandler.allowedPassword = Buffer.from(allowedPassword);
        sftpHandler.server = new ssh2.Server({
            hostKeys: [keyPath]
        }, function(client) {
            console.log("Client connected!");
            console.log(client);

            client.on('authentication', function(ctx) {
                let user = Buffer.from(ctx.username);
                if (user.length != sftpHandler.allowedUser.length || !crypto.timingSafeEqual(user, sftpHandler.allowedUser)) {
                    return ctx.reject();
                }
                switch (ctx.method) {
                    case 'password': {
                        let password = Buffer.from(ctx.password);
                        if(password.length != sftpHandler.allowedPassword.length || !crypto.timingSafeEqual(password, sftpHandler.allowedPassword)) {
                            return ctx.reject();
                        }
                        break;
                    }
                    default: {
                        return ctx.reject();
                    }
                }

                ctx.accept();
            });
            client.on('ready', function() {
                console.log("Client authenticated!");
                
                client.on('session', function(accept, reject) {
                    let session = accept();
                    session.on('sftp', function(accept, reject) {
                        console.log("Client SFTP session");
                        let openFiles = {};
                        let handleCount = 0;
                        // `sftpStream` is an `SFTPStream` instance in server mode
                        // see: https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md
                        let sftpStream = accept();
                        sftpStream.on('OPEN', function(reqid, filename, flags, attrs) {
                            if (filename != path.join(app.getPath("userData"), 'tmp', 'filetransfer-'+Date.now()+'.assembltemp') || !(flags & OPEN_MODE.WRITE)) {
                                return sftpStream.status(reqid, ssh2.STATUS_CODE.FAILURE);
                            }
                            // create a fake handle to return to the client, this could easily
                            // be a real file descriptor number for example if actually opening
                            // the file on the disk
                            var handle = new Buffer(4);
                            openFiles[handleCount] = true;
                            handle.writeUInt32BE(handleCount++, 0, true);
                            sftpStream.handle(reqid, handle);
                            console.log('Opening file for write');
                        });
                        sftpStream.on('WRITE', function(reqid, filename, flags, attrs) {
                            if (handle.length !== 4 || !openFiles[handle.readUInt32BE(0, true)]) {
                                return sftpStream.status(reqid, ssh2.STATUS_CODE.FAILURE);
                            }
                            // fake ok
                            sftpStream.status(reqid, ssh2.STATUS_CODE.OK);
                        });
                        sftpStream.on('CLOSE', function(reqid, handle) {
                            let fnum;
                            if (handle.length !== 4 || !openFiles[(fnum = handle.readUInt32BE(0, true))]) {
                                return sftpStream.status(reqid, ssh2.STATUS_CODE.FAILURE);
                            }
                            delete openFiles[fnum];
                            sftpStream.status(reqid, ssh2.STATUS_CODE.OK);
                        });
                    });
                });
            }).on('end', function() {
                console.log("Client disconnected");
            });
        }).listen(0, '127.0.0.1', function() {
            console.log('Listening on port ' + this.address().port);
        });
    },

    connectToServer: function(host, port, username, password) {
        
    }
};

ipcRenderer.on('ssh-keys-saved', function(event, keyPath) {
    sftpHandler.startServer(keyPath, "assembluser", "assemblpassword");
});