let os = require('os');
let bonjour = null;
let service = null;
let browser = null;
let webWindow = null;
let browserRefresher = null;

exports.init = function(webContents) {
    webWindow = webContents;
    bonjour = require('bonjour')();
    browser = bonjour.find({ type: 'assembl' });
    browser.on('up', function(s) {
        console.log("Found an Assembl Triton instance: " + s.name + JSON.stringify(s.txt));
        webWindow.send('bonjour-assembl-instance-up', JSON.stringify(s.txt));
    });
    browser.on('down', function(s) {
        console.log("Lost an Assembl Triton instance: " + s.name + JSON.stringify(s.txt));
        webWindow.send('bonjour-assembl-instance-down', JSON.stringify(s.txt));
    });
    browser.start();
    browserRefresher = setInterval(function() {
        browser.update();
    }, 1000);
};

exports.startBroadcast = function(displayName, assemblId, orgAffiliation) {
    service = bonjour.publish({
        name: 'Assembl Triton on ' + os.hostname(),
        type: 'assembl',
        port: 27625,
        txt: {
            displayname: displayName,
            assemblid: assemblId,
            orgAffiliation: orgAffiliation,
            hostname: os.hostname()
        }
    });
};

exports.stopBroadcast = function(callback) {
    if (module.exports.isRunning()) {
        if (service != null) {
            service.stop(function() {
                service = null;
                if (typeof callback == "function") {
                    callback();
                }
            });
        }
    }
};

exports.isRunning = function() {
    if (service != null) {
        return service.published;
    }
    if (browser != null) {
        return true;
    }
    return false;
};

exports.stop = function(callback) {
    if (module.exports.isRunning()) {
        if (browser != null) {
            clearInterval(browserRefresher);
            browserRefresher = null;
            browser.stop();
            browser = null;
        }
        if (typeof callback == "function") {
            bonjour.unpublishAll(function() {
                service = null;
                bonjour.destroy();
                if (typeof callback == "function") {
                    callback();
                }
            });
        }
        else {
            bonjour.unpublishAll(function() {
                service = null;
                bonjour.destroy();
                if (typeof callback == "function") {
                    callback();
                }
            });
        }
    }
    else if (typeof callback == "function") {
        callback();
    }
};