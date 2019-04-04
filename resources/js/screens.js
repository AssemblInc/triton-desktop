let screens = {
    hideAll: function() {
        if (!appClosing) {
            var screens = document.getElementsByClassName("screen");
            for (var i = 0; i < screens.length; i++) {
                screens[i].style.display = "none";
            }
        }
    },

    startPasswordInputter: function(err) {
        if (!appClosing) {
            screens.hideAll();
            document.getElementById("passwordinputter").style.display = "block";
            if (err) {
                document.getElementById("password-error").innerHTML = strip(err);
            }
            else {
                document.getElementById("password-error").innerHTML = "";
            }
        }
    },

    startFreshStarter: function() {
        if (!appClosing) {
            screens.hideAll();
            document.getElementById("freshstarter").style.display = "block";
        }
    },

    startNameInputter: function() {
        if (!appClosing) {
            screens.hideAll();
            document.getElementById("nameinputter").style.display = "block";
            var curUserName = ipcRenderer.sendSync('username-request');
            if (curUserName != null && curUserName.length > 0) {
                document.getElementById("yourname").value = curUserName;
            }
        }
    },

    startPurposeSelector: function() {
        if (!appClosing) {
            screens.hideAll();
            document.getElementById("purpose").style.display = "block";
        }
    },

    startSender: function() {
        if (!appClosing) {
            screens.hideAll();
            document.getElementById("sender").style.display = "block";
            document.getElementById("peeridfinder").style.display = "none";
            document.getElementById("protocolselector").style.display = "block";
            document.getElementById("protocol").value = "unset";
            document.getElementById("yourpeerid").value = ipcRenderer.sendSync('assemblid-request');
        }
    },

    startFileDropper: function() {
        if (!appClosing) {
            screens.hideAll();
            document.getElementById("dragdrop").style.display = "block";
        }
    },

    startReceiver: function() {
        if (!appClosing) {
            screens.hideAll();
            document.getElementById("receiver").style.display = "block";
            document.getElementById("senderpeerid").focus();
        }
    },

    showLoadingScreen: function(indeterminatable) {
        if (!appClosing) {
            screens.hideAll();
            if (indeterminatable) {
                document.getElementById("loading-progress").style.display = "none";
            }
            else {
                document.getElementById("loading-progress").style.display = "block";
            }
            document.getElementById("loading").style.display = "block";
        }
    },

    loading: {
        setStatus: function(text) {
            if (!appClosing) {
                document.getElementById("loading-status").innerHTML = text;
            }
        },

        setDetails: function(text) {
            if (!appClosing) {
                document.getElementById("loading-details").innerHTML = text;
            }
        },

        setProgressWithFileSize: function(progress, max) {
            if (!appClosing) {
                let progressPerc = ((progress / max) * 100).toFixed(1);
                document.getElementById("loading-progress-inner").style.width = progressPerc + "%";
                let textBar = document.getElementById("loading-details").getElementsByClassName("loading-details-progress");
                if (textBar.length > 0) {
                    textBar[0].innerHTML = strip(progressPerc + "% (" + prettySize(progress, true, false, 2) + " / " + prettySize(max, true, false, 2) + ")");
                }
                ipcRenderer.send('progress-update', true, progress / max, {
                    mode: "normal"
                });
            }
        },

        setProgress: function(progress, max) {
            if (!appClosing) {
                let progressPerc = ((progress / max) * 100).toFixed(1);
                document.getElementById("loading-progress-inner").style.width = progressPerc + "%";
                let textBar = document.getElementById("loading-details").getElementsByClassName("loading-details-progress");
                if (textBar.length > 0) {
                    textBar[0].innerHTML = progressPerc + "% (" + progress + " / " + max + ")";
                }
                ipcRenderer.send('progress-update', true, progress / max, {
                    mode: "normal"
                });
            }
        },

        resetProgress: function() {
            document.getElementById("loading-progress-inner").style.width = "0%";
            let textBar = document.getElementById("loading-details").getElementsByClassName("loading-details-progress");
            if (textBar.length > 0) {
                textBar[0].innerHTML = "0%";
            }
            ipcRenderer.send('progress-update', false);
        }
    }
};