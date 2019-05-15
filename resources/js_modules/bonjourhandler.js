let os = require('os');
let bonjour = null;
let service = null;
let browser = null;
let webWindow = null;

exports.init = function(webContents, displayName, assemblId, orcidId) {
    webWindow = webContents;
    bonjour = require('bonjour')();
    service = bonjour.publish({
        name: 'Assembl Desktop on ' + os.hostname(),
        type: 'assembl',
        port: 27625,
        txt: {
            displayname: displayName,
            assemblid: assemblId,
            orcidid: orcidId,
            hostname: os.hostname()
        }
    });
    browser = bonjour.find({
        type: 'assembl'
    }, function(service) {
        console.log("Found an Assembl Desktop instance: " + service.name + JSON.stringify(service.txt));
        webWindow.send('bonjour-assembl-instance-up', JSON.stringify(service.txt));
    });
    browser.on('down', function(service) {
        console.log("Lost an Assembl Desktop instance: " + service.name + JSON.stringify(service.txt));
        webWindow.send('bonjour-assembl-instance-down', JSON.stringify(service.txt));
    });
    browser.start();
};

exports.isRunning = function() {
    if (service != null) {
        return service.published;
    }
    return false;
};

exports.stop = function(callback) {
    if (module.exports.isRunning()) {
        if (browser != null) {
            browser.stop();
        }
        if (typeof callback == "function") {
            service.stop(callback);
        }
        else {
            service.stop();
        }
    }
    else if (typeof callback == "function") {
        callback();
    }
};