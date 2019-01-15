const { app, BrowserWindow } = require('electron');
const fs = require('fs');

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
}

app.on('ready', createWindow);