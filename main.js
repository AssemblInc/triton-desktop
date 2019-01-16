const { app, BrowserWindow, ipcMain } = require('electron');
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
        console.log("Quitting application...");
        app.quit();
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

        node.handle("/assembl/1.0.0", function(protocol, conn) {
            console.log("Handling assembl protocol connection");
            pull(
                pull.values(['hello']),
                conn,
                pull.collect(function(error, _values) {
                    if (error) {
                        console.log(error);
                    }
                    else {
                        console.log(_values);
                    }
                })
            )
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

            mainWindow.webContents.executeJavaScript(`
                document.getElementById('yourpeerid').value = '`+node.peerInfo.id._idB58String+`';
            `);
        });
    });
}

ipcMain.on('peerid-entered', function(event, peerId) {
    console.log(peerId);
    peerId = PeerId.createFromB58String(peerId);
    const peerInfo = new PeerInfo(peerId);
    peerInfo.multiaddrs.add(multiaddr("/ip4/***REMOVED_ASSEMBL_SERVER_IP***/tcp/9090/ws/p2p-websocket-star/ipfs/"+peerInfo.id._idB58String));
    console.log("Dialing peer:");
    console.log(peerInfo);
    node.dialProtocol(peerInfo, "/assembl/1.0.0", function(error, connection) {
        if (error) {
            throw error;
        }
        else {
            pull(
                pull.values(['hello from the other side']),
                connection,
                pull.collect(function(error, _values) {
                    if (error) {
                        console.log(error);
                    }
                    else {
                        console.log(_values);
                    }
                })
            );
        }
    });
    /*
    node.dialFSM(peerInfo, '/assembl/1.0.0', function(error, connectionFSM) {
        if (error) {
            event.sender.send('peer-connect-error', error);
        }
        else {
            connectionFSM.once('connection', function(connection) {
                console.log("A connection has been made. Sending a text");
                pull(
                    pull.values(['hello from the other side']),
                    connection,
                    pull.map(function(s) {
                        s.toString();
                    }),
                    pull.log()
                )
            });
            connectionFSM.once('error', function() {
                console.log("An error occured");
            });
            connectionFSM.once('close', function() {
                console.log("The connection has been closed");
            });
            // connectionFSM.close(); 
            event.sender.send('peer-connected', connectionFSM);
        }
    });
    */
});

app.on('ready', createWindow);