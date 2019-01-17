const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const libp2p = require('libp2p');
const PeerId = require('peer-id');
const PeerInfo = require('peer-info');
const multiaddr = require('multiaddr');
const WSStar = require('libp2p-websocket-star');
const defaultsDeep = require('@nodeutils/defaults-deep');
const pull = require('pull-stream');

class Node extends libp2p {
    constructor (_ws, _options) {
        const peerInfo = _options.peerInfo;
        const defaults = {
            modules: {
                transport: [
                    _ws
                ],
                peerDiscovery: [
                    _ws.discovery
                ]
            }
        };

        super(defaultsDeep(_options, defaults))
    }
}

let mainWindow = null;
let node = null;
let statInterval = null;
function createWindow() {
    console.log("Creating main window...");
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        backgroundColor: '#19383C',
        show: true,
        center: true,
        fullscreenable: false,
        title: "Assembl Desktop Demo",
        webPreferences: {
            devTools: true,
            defaultFontFamily: 'sansSerif',
            defaultFontSize: 17,
            nativeWindowOpen: false,             // do not support native window.open JS function
            experimentalFeatures: true          // use experimental chromium features
        },
        icon: __dirname + "/build/icon.ico"
    });

    // add event listeners
    mainWindow.on('page-title-updated', function(event, title) {
        mainWindow.title = title;
    });
    mainWindow.webContents.on('context-menu', function(event, params) {
        // disable context menu
        event.preventDefault();
        return false;
    });
    mainWindow.on('closed', function(event) {
        clearInterval(statInterval);
        statInterval = null;
        console.log("Closing websocket connections...");
        node.stop(function(error) {
            if (error) {
                console.log(error);
            }
            else {
                console.log("Successfully closed websocket connections.");
            }
            console.log("Quitting application...");
            app.quit();
        });
    });

    // disable menu bar and maximize window
    mainWindow.setMenu(null);
    mainWindow.maximize();
    mainWindow.webContents.openDevTools();

    // load the user interface
    mainWindow.loadFile('ui.html');

    // create p2p connector
    PeerId.create({
            bits: 1028
        }, function(error, id) {
        if (error) {
            throw error;
        }

        const peerInfo = new PeerInfo(id);
        peerInfo.multiaddrs.add(multiaddr("/ip4/***REMOVED_ASSEMBL_SERVER_IP***/tcp/9090/ws/p2p-websocket-star"));

        // the id is required for the crypto challenge
        const ws = new WSStar({ id: id });
        
        console.log(peerInfo);
        node = new Node(ws, { peerInfo: peerInfo });

        node.on('start', function() {
            console.log('libp2p node started');
        });

        node.on('error', function(error) {
            console.log(error);
        });

        // for sender
        node.handle("/assemblhi/1.0.0", function(protocol, conn) {
            console.log("Handling assemblhi protocol connection");
            console.log(conn);
            pull(
                pull.empty(),
                conn,
                pull.collect(function(error, _values) {
                    if (error) {
                        console.log(error);
                    }
                    else {
                        console.log(_values);
                        peerId = PeerId.createFromB58String(_values[0]);
                        const peerInfo = new PeerInfo(peerId);
                        peerInfo.multiaddrs.add(multiaddr("/ip4/***REMOVED_ASSEMBL_SERVER_IP***/tcp/9090/ws/p2p-websocket-star/ipfs/"+peerInfo.id._idB58String));
                        receiverPeerInfo = peerInfo;
                        mainWindow.webContents.send('receiver-connected', _values[1]);
                    }
                })
            );
        });

        // for receiver
        let receivedChunks = [];
        let receivedFilename = null;
        node.handle("/assemblfile/1.0.0", function(protocol, conn) {
            console.log("Handling assemblfile protocol connection");
            mainWindow.webContents.send('receiving-chunk', null);
            pull(
                pull.once('ready'),
                conn,
                pull.collect(function(error, _values) {
                    if (error) {
                        console.log(error);
                    }
                    else {
                        console.log(_values);
                        receivedChunks.push(_values[0]);
                        if (_values[0] != undefined) {
                            mainWindow.webContents.send('received-chunk', _values[0].byteLength);
                        }
                    }
                })
            );
        });

        // for receiver
        node.handle("/assemblfileinfo/1.0.0", function(protocol, conn) {
            console.log("Handling assemblfileinfo protocol connection");
            pull(
                pull.once('ready'),
                conn,
                pull.collect(function(error, _values) {
                    if (error) {
                        console.log(error);
                    }
                    else {
                        let info = _values.toString().split(",");
                        receivedFilename = info[1];
                        mainWindow.webContents.send('data-initialized', info);
                    }
                })
            );
        });

        // for receiver
        node.handle("/assemblfilecomplete/1.0.0", function(protocol, conn) {
            console.log("Handling assemblfilecomplete protocol connection");
            pull(
                pull.empty(),
                conn,
                pull.collect(function(error, _values) {
                    if (error) {
                        console.log(error);
                    }
                    else {
                        console.log("Data transmission has been completed!");
                        mainWindow.webContents.send('received-file', null);
                        let totalBytes = 0;
                        for (let i = 0, j = receivedChunks.length; i < j; i++) {
                            totalBytes += receivedChunks[i].byteLength;
                        }
                        let tmp = new Uint8Array(totalBytes);
                        let processedBytes = 0;
                        for (let i = 0, j = receivedChunks.length; i < j; i++) {
                            tmp.set(new Uint8Array(receivedChunks[i]), processedBytes);
                            processedBytes += receivedChunks[i].byteLength;
                        }
                        let defaultPath = app.getPath('downloads') + '\\' + receivedFilename;
                        let extension = receivedFilename.split('.').pop();
                        if (extension == null || extension == undefined) {
                            extension = "";
                        }
                        console.log(defaultPath);
                        dialog.showSaveDialog({
                            defaultPath: defaultPath,
                            filters: [{ name: extension.toUpperCase(), extensions: [ extension ] }]
                        }, function(savePath) {
                            if (savePath != undefined && savePath != null && savePath != "") {
                                fs.writeFile(savePath, tmp, function(error) {
                                    if (error) {
                                        throw error;
                                    }
                                    console.log("The file has been saved!");
                                });
                            }
                        });
                    }
                })
            );
        });

        node.on('peer:discovery', function(peer) {
            // console.log("A peer has been discovered!");
            // console.log(peer);
        });

        node.on('peer:connect', function(peer) {
            console.log("A peer connected!");
            console.log(peer);
        });

        node.on('peer:disconnect', function(peer) {
            console.log("A peer disconnected!");
            console.log(peer);
        });

        node.start(function(error) {
            if (error) {
                throw error;
            }
            else {
                mainWindow.webContents.executeJavaScript(`
                    document.getElementById('yourpeerid').value = '`+node.peerInfo.id._idB58String+`';
                `);
            }
        });

        /*
        statInterval = setInterval(function() {
            let statsProtocols = node.stats.protocols();
            for (let i = 0; i < statsProtocols.length; i++) {
                console.log(node.stats.forProtocol(statsProtocols[i]).snapshot);
            }
        }, 1000);
        */
    });
}

let senderPeerInfo = null;
let receiverPeerInfo = null;
// for receiver
ipcMain.on('peerid-entered', function(event, options) {
    console.log(options);
    peerId = PeerId.createFromB58String(options.senderPeerId);
    const peerInfo = new PeerInfo(peerId);
    peerInfo.multiaddrs.add(multiaddr("/ip4/***REMOVED_ASSEMBL_SERVER_IP***/tcp/9090/ws/p2p-websocket-star/ipfs/"+peerInfo.id._idB58String));
    senderPeerInfo = peerInfo;
    console.log("Dialing peer:");
    console.log(senderPeerInfo);
    node.dialProtocol(senderPeerInfo, "/assemblhi/1.0.0", function(error, connection) {
        if (error) {
            throw error;
        }
        else {
            console.log(senderPeerInfo);
            pull(
                pull.values([node.peerInfo.id._idB58String, options.receiverName]),
                connection
            );
        }
    });
});

// for sender
ipcMain.on('data-initialized', function(event, data) {
    if (receiverPeerInfo != null) {
        node.dialProtocol(receiverPeerInfo, "/assemblfileinfo/1.0.0", function(error, connection) {
            if (error) {
                throw error;
            }
            else {
                console.log(data);
                pull(
                    pull.values(data),
                    connection,
                    pull.collect(function(error, _values) {
                        var callbackStr = _values.toString();
                        if (callbackStr == "ready") {
                            console.log("Data is ready to be sent!");
                            mainWindow.webContents.send('data-ready-to-send', null);
                        }
                        else {
                            console.log(callbackStr);
                            console.log("Not starting data transmission because data-initialized callback didn't equal 'ready'");
                        }
                    })
                );

            }
        });
    }
    else {
        console.log("receiverPeerInfo equals null");
    }
});

// for sender
ipcMain.on('chunk-ready-for-transfer', function(event, data) {
    if (receiverPeerInfo != null) {
        node.dialProtocol(receiverPeerInfo, "/assemblfile/1.0.0", function(error, connection) {
            if (error) {
                throw error;
            }
            else {
                console.log(data);
                pull(
                    pull.once(data),
                    connection,
                    pull.collect(function(error, _values) {
                        var callbackStr = _values.toString();
                        if (callbackStr == "ready") {
                            console.log("Next chunk is ready to be sent!");
                            mainWindow.webContents.send('next-chunk-ready-to-send', null);
                        }
                        else {
                            console.log(callbackStr);
                            console.log("Not starting next data chunk transmission because chunk-ready-for-transfer callback didn't equal 'ready'");
                        }
                    })
                );
            }
        });
    }
    else {
        console.log("receiverPeerInfo equals null");
    }
});

// for sender
ipcMain.on('data-transfer-complete', function(event, data) {
    console.log("File transfer is complete! No next chunk to send.");
    if (receiverPeerInfo != null) {
        node.dialProtocol(receiverPeerInfo, "/assemblfilecomplete/1.0.0", function(error, connection) {
            if (error) {
                throw error;
            }
            else {
                pull(
                    pull.once('done'),
                    connection
                );
            }
        });
    }
    else {
        console.log("receiverPeerInfo equals null");
    }
});

app.on('ready', createWindow);