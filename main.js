const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const userDataHandler = require('./resources/js_modules/userdatahandler.js');
const pgpHandler = require('./resources/js_modules/pgphandler.js');
pgpHandler.setUserDataHandler(userDataHandler);
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
let orcidData = null;
let waitForCompletion = null;

function reallyClosingNow() {
    console.log("Deleting temporary files...");
    chunkHandler.deleteTempFile(true);
    if (userDataHandler.isInitialized()) {
        console.log("Saving user data...");
        try {
            userDataHandler.finalize();
        }
        catch(err) {
            console.log("Could not save user data");
            console.log(err);
        }
    }
    console.log("Quitting application...");
    mainWindowMayClose = true;
    app.quit();
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

    startApplication();
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
        mainWindow.hide();
        signInWindow.show();
    });
    signInWindow.on('page-title-updated', function(event, title) {
        event.preventDefault();
    });
    signInWindow.on('closed', function() {
        console.log("Closed signIn window, so showing mainWindow.");
        mainWindow.show();
    });

    signInWindow.webContents.on('dom-ready', function(event) {
        let url = signInWindow.webContents.getURL();
        if (url.indexOf("code=") > -1) {
            signInWindow.webContents.executeJavaScript('document.body.innerText')
                .then(function(result) {
                    try {
                        orcidData = JSON.parse(result);
                        console.log("ORCID iD data received:");
                        console.log(orcidData);
                        userDataHandler.saveData("assembl_id", orcidData["assembl_id"]);
                        userDataHandler.saveData("orcid_id", orcidData["orcid"]);
                        console.log("Checking if username is there...");
                        if (orcidData.name != null && orcidData.name.length > 0) {
                            userDataHandler.saveData("username", orcidData.name);
                        }
                        else {
                            userDataHandler.saveData("username", "");
                        }
                        console.log("Closing sign in window...");
                        signInWindow.close();
                        mainWindow.webContents.send('signed-in');
                    }
                    catch(err) {
                        console.log(err);
                        dialog.showMessageBox(signInWindow, {type: "error", message: "An error occured and Assembl Desktop will now quit."});
                        fullyCloseApp();
                    }
                })
                .catch(function(err) {
                    console.log(err);
                    dialog.showMessageBox(signInWindow, {type: "error", message: "An error occured and Assembl Desktop will now quit."});
                    fullyCloseApp();
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

    let signInUrl = 'https://accounts.assembl.science/signin/?json';
    if (userDataHandler.hasData("orcid_id")) {
        signInUrl += '&orcid=' + userDataHandler.loadData("orcid_id");
    }

    signInWindow.loadURL(signInUrl);
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
        console.log("mainWindow close event");
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
ipcMain.on('password-set', function(event, password) {
    userDataHandler.init(password, false)
        .then(function() {
            console.log("Userdata loaded");
            mainWindow.webContents.send('userdata-loaded');
            signIn();
        })
        .catch(function(err) {
            console.log("Could not load UserData");
            console.log(err);
            mainWindow.webContents.send('userdata-loading-error', err);
        });
});

// for both
ipcMain.on('password-set-fresh', function(event, password) {
    userDataHandler.init(password, true)
        .then(function() {
            console.log("Userdata created");
            mainWindow.webContents.send('userdata-created');
            signIn();
        })
        .catch(function(err) {
            console.log("Could not create UserData");
            console.log(err);
        });
});

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

// for both
ipcMain.on('username-request', function(event) {
    event.returnValue = userDataHandler.loadData("username");
});

// for both
ipcMain.on('assemblid-request', function(event) {
    event.returnValue = orcidData["assembl_id"];
});

// for both
ipcMain.on('orcid-request', function(event) {
    event.returnValue = orcidData["orcid"];
});

// for both
ipcMain.on('publickey-request', function(event) {
    console.log(pgpHandler.getPublicKey());
    event.returnValue = pgpHandler.getPublicKey();
});

// for both
ipcMain.on('other-public-key-received', function(event, otherPublicKey) {
    pgpHandler.setOtherKeys(otherPublicKey);
});7

// for receiver
ipcMain.on('renderer-received-chunk', function(event, encryptedChunk) {
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

// for receiver
ipcMain.on('renderer-fileinfo', function(event, fileInfo) {
    mainWindow.webContents.send('data-initialized', fileInfo);
    chunkHandler.initChunks();
    chunkHandler.setFileName(fileInfo[1]);
});

// for receiver
ipcMain.on('renderer-filecomplete', function(event, finalChunkAmount) {
    chunkHandler.setFinalChunkAmount(parseInt(finalChunkAmount));
    mainWindow.webContents.send('received-file', null);
    waitForCompletion = setInterval(function() {
        if (chunkHandler.fileReady()) {
            clearInterval(waitForCompletion);
            chunkHandler.finish();
            chunkHandler.saveFile()
                .then(function() {
                    console.log("Save succesful");
                })
                .catch(function(err) {
                    console.error(err);
                })
                .finally(function() {
                    mainWindow.webContents.send('saved-file', null);
                });
        }
    }, 1000);
});

// for both ends
ipcMain.on('app-should-close', function(event) {
    fullyCloseApp();
});

function loadPGP() {
    pgpHandler.hasOldValidKeys()
        .then(function(hasOldValidKeys) {
            if (hasOldValidKeys) {
                pgpHandler.importOldKeys(userDataHandler.loadData("username"), null)
                    .then(function(pubKey) {
                        mainWindow.webContents.send('pgp-keys-generated', pubKey);
                    })
                    .catch(function(reason) {
                        mainWindow.webContents.send('pgp-keys-generation-error', reason);
                    });
            }
            else {
                pgpHandler.createKeys(userDataHandler.loadData("username"), null)
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
}

// for both ends
ipcMain.on('user-name-changed', function(event, newName) {
    userDataHandler.saveData("username", newName);
    loadPGP();
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