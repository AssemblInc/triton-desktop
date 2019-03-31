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
let orcidData = null;

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

function appReady() {
    console.log('App is ready!');
    console.log('Node v' + process.versions.node);
    console.log('Electron v' + process.versions.electron);
    console.log('Chrome v' + process.versions.chrome);
    console.log('Assembl Desktop v' + app.getVersion());

    app.on('browser-window-created', function(e, window) {
        window.setMenu(null);
    });

    signIn();
}

function signIn() {
    console.log("Creating sign in window...");
    let signInWindow = new BrowserWindow({
        width: 500,
        height: 680,
        backgroundColor: '#193864',
        show: false,
        center: true,
        fullscreenable: false,
        title: "Loading...",
        webPreferences: {
            nodeIntegration: false,
            devTools: true,
            defaultFontFamily: 'sansSerif',
            defaultFontSize: 17,
            nativeWindowOpen: false,
            experimentalFeatures: false
        },
        icon: __dirname + "/build/icon.ico"
    });

    signInWindow.once('ready-to-show', function() {
        signInWindow.show();
    });
    signInWindow.on('page-title-updated', function(event, title) {
        event.preventDefault();
    });

    signInWindow.webContents.on('dom-ready', function(event) {
        let url = signInWindow.webContents.getURL();
        if (url.indexOf("code=") > -1) {
            signInWindow.webContents.executeJavaScript('document.body.innerText')
                .then(function(result) {
                    orcidData = JSON.parse(result);
                    console.log("ORCID iD data received:");
                    console.log(orcidData);
                    startApplication();
                    console.log("Closing sign in window...");
                    signInWindow.close();
                })
                .catch(function(err) {
                    dialog.showMessageBox(signInWindow, {
                        type: "warning",
                        title: "Could not sign in",
                        message: "Something went wrong. Details: could not retrieve document body"
                    });
                    app.close();
                });
        }

        if (url.indexOf('//orcid.org/') > -1) {
            signInWindow.setTitle('Sign in to Assembl with your ORCID iD');
        }
        else if (url.indexOf('//accounts.assembl.science/') > -1) {
            signInWindow.setTitle('Sign in to Assembl');
        }
        else {
            signInWindow.setTitle('Assembl Desktop');
        }
    });

    signInWindow.loadURL('https://accounts.assembl.science/signin/?json');
}

function startApplication() {
    console.log("Creating main window...");
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        backgroundColor: '#193864',
        show: false,
        center: true,
        fullscreenable: false,
        title: "Assembl Desktop",
        webPreferences: {
            nodeIntegration: true,
            devTools: true,
            defaultFontFamily: 'sansSerif',
            defaultFontSize: 17,
            nativeWindowOpen: false,            // do not support native window.open JS function
            experimentalFeatures: true          // use experimental chromium features
        },
        icon: __dirname + "/build/icon.ico"
    });

    // add event listeners
    mainWindow.on('page-title-updated', function(event, title) {
        // window title is always equal to page title unless event.preventDefault() is called here
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

app.on('ready', appReady);