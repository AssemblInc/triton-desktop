const { app, BrowserWindow, ipcMain, dialog } = require('electron');
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

let mainWindow = null;
let mainWindowMayClose = false;
let node = null;

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
    pgpHandler.hasOldValidKeys()
        .then(function(hasOldValidKeys) {
            if (hasOldValidKeys) {
                pgpHandler.importOldKeys(newName, null)
                    .then(function(pubKey) {
                        mainWindow.webContents.send('pgp-keys-generated', pubKey);
                    })
                    .catch(function(reason) {
                        mainWindow.webContents.send('pgp-keys-generation-error', reason);
                    });
            }
            else {
                pgpHandler.createKeys(newName, null)
                    .then(function(pubKey) {
                        mainWindow.webContents.send('pgp-keys-generated', pubKey);
                    })
                    .catch(function(reason) {
                        mainWindow.webContents.send('pgp-keys-generation-error', reason);
                    });
            }
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

app.on('ready', createWindow);