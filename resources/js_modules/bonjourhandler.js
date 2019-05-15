let os = require('os');
let bonjour = null;
let service = null;

exports.init = function(displayName, assemblId, orcidId) {
    bonjour = require('bonjour')();
    service = bonjour.publish({
        name: 'Assembl Desktop on ' + os.hostname(),
        type: 'assembl',
        port: 27625,
        txt: {
            displayName: displayName,
            assemblId: assemblId,
            orcidId: orcidId,
            hostName: os.hostname()
        }
    });
    bonjour.find({
        type: 'assembl'
    }, function(service) {
        console.log("Found an Assembl Desktop instance: " + service.name + JSON.stringify(service.txt));
    });
};

exports.isRunning = function() {
    if (service != null) {
        return service.published;
    }
    return false;
};

exports.stop = function(callback) {
    if (module.exports.isRunning()) {
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