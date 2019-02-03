const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const libp2p = require('libp2p');
const PeerId = require('peer-id');
const PeerInfo = require('peer-info');
const multiaddr = require('multiaddr');
const WSStar = require('libp2p-websocket-star');
const defaultsDeep = require('@nodeutils/defaults-deep');
const pull = require('pull-stream');
const keccak256 = require('js-sha3').keccak256;
const pgpHandler = require('./resources/js_modules/pgphandler.js');
const chunkHandler = require('./resources/js_modules/chunkhandler.js');
require('electron-context-menu')({
    showCopyImageAddress: false,
    showSaveImageAs: false,
    showInspectElement: false,
    shouldShowMenu: function(event, params) {
        return params.isEditable || params.editFlags.canCopy;
    }
});

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
let mainWindowMayClose = false;
let node = null;
let nodeStopped = false;
let receivedChunks = [];
let receivedFilename = null;
let waitForCompletion = null;
let userName = "Sebastien Mellen";
let otherName = "Freek Bes";

function reallyClosingNow() {
    chunkHandler.deleteTempFile(true);
    if (node != null) {
        console.log("Closing websocket connections...");
        node.stop(function(error) {
            if (error) {
                console.log(error);
            }
            else {
                console.log("Successfully closed websocket connections.");
            }
            console.log("Quitting application...");
            mainWindowMayClose = true;
            app.quit();
        });
    }
    else {
        console.log("Quitting application...");
        mainWindowMayClose = true;
        app.quit();
    }
}

function fullyCloseApp() {
    console.log("Fully closing app...");
    if (!mainWindow.isDestroyed) {
        mainWindow.webContents.send('app-closing', null);
    }
    if (!nodeStopped) {
        if (receiverPeerInfo != null) {
            node.dialProtocol(receiverPeerInfo, "/assemblclosed/1.0.0", function(error, connection) {
                if (error) {
                    console.log(error);
                    reallyClosingNow();
                }
                else {
                    pull(
                        pull.once('closing'),
                        connection,
                        pull.onEnd(function() {
                            console.log("Really closing now!");
                            reallyClosingNow();
                        })
                    );
                }
            });
        }
        else if (senderPeerInfo != null) {
            node.dialProtocol(senderPeerInfo, "/assemblclosed/1.0.0", function(error, connection) {
                if (error) {
                    console.log(error);
                    reallyClosingNow();
                }
                else {
                    pull(
                        pull.once('closing'),
                        connection,
                        pull.onEnd(function() {
                            console.log("Really closing now!");
                            reallyClosingNow();
                        })
                    );
                }
            });
        }
        else {
            reallyClosingNow();
        }
    }
    else {
        reallyClosingNow();
    }
}

function createWindow() {
    console.log('App is ready!');
    console.log('Node v' + process.versions.node);
    console.log('Electron v' + process.versions.electron);
    console.log('Chrome v' + process.versions.chrome);
    console.log('Assembl Desktop v' + app.getVersion());

    console.log("Creating main window...");
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        backgroundColor: '#193864',
        show: false,
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
    mainWindow.on('close', function(event) {
        if (!mainWindowMayClose) {
            event.preventDefault();
            event.returnValue = false;
            fullyCloseApp();
            return false;
        }
    });
    mainWindow.once('ready-to-show', function() {
        mainWindow.show();
         // disable menu bar and maximize window
        mainWindow.setMenu(null);
        mainWindow.maximize();
        mainWindow.webContents.openDevTools();
    });

    // load the user interface
    mainWindow.loadFile('ui.html');
}

// for both
ipcMain.on('progress-update', function(event, active, progress, options) {
    if (active === true) {
        // console.log(progress);
        // console.log(options);
        mainWindow.setProgressBar(progress, options);
    }
    else {
        mainWindow.setProgressBar(-1);
    }
});

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
            console.log(error);
            dialog.showMessageBox(mainWindow, {type: "error", message: "An error occured and Assembl Desktop will now quit."});
            fullyCloseApp();
        }
        else {
            console.log(senderPeerInfo);
            pull(
                pull.values([node.peerInfo.id._idB58String, options.receiverName, pgpHandler.getPublicKey()]),
                connection,
                pull.collect(function(error, _values) {
                    otherName = _values.toString();
                    mainWindow.webContents.send('other-name-received', otherName);
                    console.log("Connected to " + otherName);
                })
            );
        }
    });
});

// for sender
ipcMain.on('data-initialized', function(event, data) {
    if (receiverPeerInfo != null) {
        node.dialProtocol(receiverPeerInfo, "/assemblfileinfo/1.0.0", function(error, connection) {
            if (error) {
                console.log(error);
                dialog.showMessageBox(mainWindow, {type: "error", message: "An error occured and Assembl Desktop will now quit."});
                fullyCloseApp();
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
ipcMain.on('chunk-ready-for-transfer', function(event, chunk) {
    if (receiverPeerInfo != null) {
        console.log(chunk);
        // encrypt the chunk
        pgpHandler.encryptChunk(chunk)
            .then(function(encryptedMsg) {
                node.dialProtocol(receiverPeerInfo, "/assemblfile/1.0.0", function(error, connection) {
                    if (error) {
                        console.log(error);
                        dialog.showMessageBox(mainWindow, {type: "error", message: "An error occured and Assembl Desktop will now quit."});
                        fullyCloseApp();
                    }
                    else {
                        pull(
                            pull.once(encryptedMsg),
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
            })
            .catch(function(err) {
                console.error(err);
                dialog.showMessageBox(mainWindow, {type: "error", message: "An error occured and Assembl Desktop will now quit."});
                fullyCloseApp();
            });
    }
    else {
        console.log("receiverPeerInfo equals null");
    }
});

// for sender
ipcMain.on('data-transfer-complete', function(event, amountOfChunks) {
    console.log("File transfer is complete! No next chunk to send.");
    if (receiverPeerInfo != null) {
        node.dialProtocol(receiverPeerInfo, "/assemblfilecomplete/1.0.0", function(error, connection) {
            if (error) {
                console.log(error);
                dialog.showMessageBox(mainWindow, {type: "error", message: "An error occured and Assembl Desktop will now quit."});
                fullyCloseApp();
            }
            else {
                pull(
                    pull.once(amountOfChunks.toString()),
                    connection
                );
            }
        });
    }
    else {
        console.log("receiverPeerInfo equals null");
    }
});

// for sender to receiver
ipcMain.on('webrtc-offervalue-ready', function(event, offerValue) {
    if (receiverPeerInfo != null) {
        node.dialProtocol(receiverPeerInfo, "/assemblrtcoffer/1.0.0", function(error, connection) {
            if (error) {
                console.log(error);
                dialog.showMessageBox(mainWindow, {type: "error", message: "An error occured and Assembl Desktop will now quit."});
                fullyCloseApp();
            }
            else {
                pull(
                    pull.once(offerValue),
                    connection
                );
            }
        });
    }
    else {
        console.log("receiverPeerInfo equals null");
    }
});

// for receiver to sender
ipcMain.on('webrtc-answervalue-ready', function(event, answerValue) {
    if (senderPeerInfo != null) {
        node.dialProtocol(senderPeerInfo, "/assemblrtcanswer/1.0.0", function(error, connection) {
            if (error) {
                console.log(error);
                dialog.showMessageBox(mainWindow, {type: "error", message: "An error occured and Assembl Desktop will now quit."});
                fullyCloseApp();
            }
            else {
                pull(
                    pull.once(answerValue),
                    connection
                );
            }
        });
    }
    else {
        console.log("senderPeerInfo equals null");
    }
});

// for receiver
ipcMain.on('webrtc-received-chunk', function(event, encryptedChunk) {
    if (encryptedChunk != undefined && encryptedChunk != null) {
        mainWindow.webContents.send('receiving-chunk', null);
        chunkHandler.increaseChunkAmount();
        // receivedChunks.push(chunk);
        pgpHandler.decryptChunk(encryptedChunk)
            .then(function(chunk) {
                chunkHandler.handleChunk(chunk);
                console.log(chunk);
                mainWindow.webContents.send('received-chunk', chunk.byteLength);
            })
            .catch(function(err) {
                console.log(err);
                dialog.showMessageBox(mainWindow, {type: "error", message: "An error occured and Assembl Desktop will now quit."});
                fullyCloseApp();
            });
    }
});

// for both ends
ipcMain.on('app-should-close', function(event) {
    fullyCloseApp();
});

// for both ends
ipcMain.on('user-name-changed', function(event, newName) {
    userName = newName;
    pgpHandler.createKeys(newName, null)
        .then(function(pubKey) {
            mainWindow.webContents.send('pgp-keys-generated', pubKey);
        })
        .catch(function(reason) {
            mainWindow.webContents.send('pgp-keys-generation-error', reason);
        });
});

// for sender
ipcMain.on('pgp-encrypt-chunk', function(event, chunk) {
    pgpHandler.encryptChunk(chunk)
        .then(function(encryptedMsg) {
            mainWindow.webContents.send('pgp-chunk-encrypted', encryptedMsg);
        })
        .catch(function(err) {
            mainWindow.webContents.send('pgp-chunk-encryption-error', err);
        });
});

// for both ends
ipcMain.on('can-connect-to-server', function(event) {
    // create p2p connector
    PeerId.create({
        bits: 1028
    }, function(error, id) {
        if (error) {
            console.log(error);
            dialog.showMessageBox(mainWindow, {type: "error", message: "An error occured and Assembl Desktop will now quit."});
            fullyCloseApp();
        }

        const peerInfo = new PeerInfo(id);
        peerInfo.multiaddrs.add(multiaddr("/ip4/***REMOVED_ASSEMBL_SERVER_IP***/tcp/9090/ws/p2p-websocket-star"));

        // the id is required for the crypto challenge
        const ws = new WSStar({ id: id });

        console.log(peerInfo);
        node = new Node(ws, { peerInfo: peerInfo });

        node.on('start', function() {
            console.log('libp2p node started');
            mainWindow.webContents.send('websocket-connected', null);
        });

        node.on('error', function(error) {
            console.log(error);
            mainWindow.webContents.send('websocket-connection-error', null);
        });

        node.on('stop', function() {
            console.log("libp2p node stopped");
            nodeStopped = true;
        })

        // for both
        node.handle("/assemblclosed/1.0.0", function(protocol, conn) {
            console.log("Handling assemblclosed protocol connection");
            pull(
                pull.empty(),
                conn,
                pull.collect(function(error, _values) {
                    dialog.showMessageBox(mainWindow, {
                        type: "warning",
                        title: "Connection was lost",
                        message: "The connection was lost due to the other party closing Assembl Desktop. Assembl Desktop will now quit."
                    });
                    reallyClosingNow();
                })
            );
        });

        // for sender
        node.handle("/assemblhi/1.0.0", function(protocol, conn) {
            console.log("Handling assemblhi protocol connection");
            console.log(conn);
            pull(
                pull.once(userName),
                conn,
                pull.collect(function(error, _values) {
                    if (error) {
                        console.log(error);
                        dialog.showMessageBox(mainWindow, {type: "error", message: "An error occured and Assembl Desktop will now quit."});
                        fullyCloseApp();
                    }
                    else {
                        console.log(_values);
                        peerId = PeerId.createFromB58String(_values[0]);
                        const peerInfo = new PeerInfo(peerId);
                        peerInfo.multiaddrs.add(multiaddr("/ip4/***REMOVED_ASSEMBL_SERVER_IP***/tcp/9090/ws/p2p-websocket-star/ipfs/"+peerInfo.id._idB58String));
                        receiverPeerInfo = peerInfo;
                        otherName = _values[1];
                        console.log("Connected to " + otherName);
                        pgpHandler.setOtherKeys(_values[2]);
                        mainWindow.webContents.send('receiver-connected', _values[1]);
                        mainWindow.webContents.send('webrtc-offervalue-please');
                    }
                })
            );
        });

        // for sender
        node.handle("/assemblsaved/1.0.0", function(protocol, conn) {
            console.log("Handling assemblsaved protocol connection");
            pull(
                pull.empty(),
                conn,
                pull.collect(function(error, _values) {
                    if (error) {
                        console.log(error);
                        dialog.showMessageBox(mainWindow, {type: "error", message: "An error occured and Assembl Desktop will now quit."});
                        fullyCloseApp();
                    }
                    else {
                        console.log(_values);
                        var callbackStr = _values.toString();
                        if (callbackStr == "ready") {
                            console.log("Receiver has saved the file. Next file ready for transmission.");
                            mainWindow.webContents.send('receiver-saved-file', null);
                        }
                        else {
                            console.log(callbackStr);
                            console.log("Not starting next data transmission because assemblsaved didn't equal 'ready'");
                        }
                    }
                })
            );
        });

        // for receiver
        node.handle("/assemblfile/1.0.0", function(protocol, conn) {
            console.log("Handling assemblfile protocol connection");
            chunkHandler.increaseChunkAmount();
            mainWindow.webContents.send('receiving-chunk', null);
            pull(
                pull.once('ready'),
                conn,
                pull.collect(function(error, _values) {
                    if (error) {
                        console.log(error);
                        dialog.showMessageBox(mainWindow, {type: "error", message: "An error occured and Assembl Desktop will now quit."});
                        fullyCloseApp();
                    }
                    else {
                        if (_values[0] != undefined) {
                            // receivedChunks.push(_values[0]);
                            // decrypt chunk
                            pgpHandler.decryptChunk(_values[0].toString())
                                .then(function(chunk) {
                                    console.log(chunk);
                                    chunkHandler.handleChunk(chunk);
                                    mainWindow.webContents.send('received-chunk', chunk.byteLength);
                                })
                                .catch(function(err) {
                                    console.log(err);
                                    dialog.showMessageBox(mainWindow, {type: "error", message: "An error occured and Assembl Desktop will now quit."});
                                    fullyCloseApp();
                                });
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
                        dialog.showMessageBox(mainWindow, {type: "error", message: "An error occured and Assembl Desktop will now quit."});
                        fullyCloseApp();
                    }
                    else {
                        let info = _values.toString().split(",");
                        receivedFilename = info[1];
                        mainWindow.webContents.send('data-initialized', info);
                        chunkHandler.initChunks();
                        chunkHandler.setFileName(receivedFilename);
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
                        dialog.showMessageBox(mainWindow, {type: "error", message: "An error occured and Assembl Desktop will now quit."});
                        fullyCloseApp();
                    }
                    else {
                        console.log("Data transmission has been completed!");
                        chunkHandler.setFinalChunkAmount(parseInt(_values[0]));
                        mainWindow.webContents.send('received-file', null);
                        waitForCompletion = setInterval(function() {
                            if (chunkHandler.fileReady()) {
                                clearInterval(waitForCompletion);
                                chunkHandler.finish();
                                chunkHandler.saveFile()
                                    .then(function() {
                                        console.log("Save successful");
                                    })
                                    .catch(function(err) {
                                        console.error(err);
                                    }).
                                    finally(function() {
                                        mainWindow.webContents.send('saved-file', null);
                                        if (senderPeerInfo != null) {
                                            node.dialProtocol(senderPeerInfo, "/assemblsaved/1.0.0", function(error, connection) {
                                                if (error) {
                                                    console.log(error);
                                                    dialog.showMessageBox(mainWindow, {type: "error", message: "An error occured and Assembl Desktop will now quit."});
                                                    fullyCloseApp();
                                                }
                                                else {
                                                    pull(
                                                        pull.once('ready'),
                                                        connection
                                                    );
                                                }
                                            });
                                        }
                                    });
                                }
                        }, 1000);
                    }
                })
            );
        });

        // for sender
        node.handle("/assemblrtcanswer/1.0.0", function(protocol, conn) {
            console.log("Handling assemblrtcanswer protocol connection");
            console.log(conn);
            pull(
                pull.empty(),
                conn,
                pull.collect(function(error, _values) {
                    if (error) {
                        console.log(error);
                        dialog.showMessageBox(mainWindow, {type: "error", message: "An error occured and Assembl Desktop will now quit."});
                        fullyCloseApp();
                    }
                    else {
                        console.log(_values);
                        mainWindow.webContents.send('webrtc-answervalue-received', _values[0]);
                    }
                })
            );
        });

        // for receiver
        node.handle("/assemblrtcoffer/1.0.0", function(protocol, conn) {
            console.log("Handling assemblrtcoffer protocol connection");
            console.log(conn);
            pull(
                pull.empty(),
                conn,
                pull.collect(function(error, _values) {
                    if (error) {
                        console.log(error);
                        dialog.showMessageBox(mainWindow, {type: "error", message: "An error occured and Assembl Desktop will now quit."});
                        fullyCloseApp();
                    }
                    else {
                        console.log(_values);
                        mainWindow.webContents.send('webrtc-offervalue-received', _values[0]);
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
                console.log(error);
                dialog.showMessageBox(mainWindow, {type: "error", message: "An error occured and Assembl Desktop will now quit."});
                fullyCloseApp();
            }
            else {
                mainWindow.webContents.executeJavaScript(`
                    document.getElementById('yourpeerid').value = '`+node.peerInfo.id._idB58String+`';
                `);
            }
        });
    });
});

app.on('ready', createWindow);