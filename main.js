const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const libp2p = require('libp2p');
const PeerId = require('peer-id');
const PeerInfo = require('peer-info');
const multiaddr = require('multiaddr');
const pullStream = require('pull-stream');
const WSStar = require('libp2p-websocket-star');

let mainWindow = null;
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
            devTools: false,
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

    // load the user interface
    mainWindow.loadFile('ui.html');

    // create p2p connector
    PeerId.create(function(error, id) {
        if (error) {
            throw error;
        }

        const peerInfo = new PeerInfo(id);
        peerInfo.multiaddrs.add(multiaddr("/dns4/ws-star.discovery.libp2p.io/tcp/443/wss/p2p-websocket-star/"));
        console.log(peerInfo);

        // TODO -> review why the ID can not be passed by the .listen call
        // the id is required for the crypto challenge
        const ws = new WSStar({ id: id });

        const modules = {
            transport: [
                ws
            ],
            discovery: [
                ws.discovery
            ]
        };

        const node = new libp2p(modules, peerInfo);

        node.handle("/test/1.0.0", function(protocol, connection) {
            pullStream(
                pullStream.values(['hello']),
                connection,
                pullStream.map(function(s) {
                    s.toString();
                }),
                pullStream.log()
            );
        });

        node.start(function(error) {
            if (error) {
                throw error;
            }

            node.dial(peerInfo, "/test/1.0.0", function(error, pullStream) {
                if (error) {
                    throw error;
                }

                pullStream(
                    pullStream.values(['hello from the other side']),
                    pullStream,
                    pullStream.map((s) => s.toString()),
                    pullStream.log()
                );
            });
        });
    });
}

app.on('ready', createWindow);