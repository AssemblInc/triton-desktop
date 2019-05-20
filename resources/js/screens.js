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
                let passwordErr = err;
                switch(err) {
                    case "incorrect_password":
                        passwordErr = "Incorrect password. Forgot your password? <a href='javascript:screens.startFreshStarter();'>Start fresh</a>";
                        break;
                    case "corrupted_data":
                        passwordErr = "Your user data has been corrupted. You will have to <a href='javascript:screens.startFreshStarter();'>start fresh</a>.";
                        break;
                    case "already_initialized":
                        passwordErr = "Your user data has already been loaded.";
                        break;
                }
                document.getElementById("password-error").innerHTML = passwordErr;
            }
            else {
                document.getElementById("password-error").innerHTML = "";
            }
            document.getElementById("password").focus();
        }
    },

    startFreshStarter: function() {
        if (!appClosing) {
            screens.hideAll();
            document.getElementById("freshstarter").style.display = "block";
            document.getElementById("freshpassword").focus();
        }
    },

    startNameInputter: function() {
        if (!appClosing) {
            screens.hideAll();
            document.getElementById("nameinputter").style.display = "block";
            var curUserName = ipcRenderer.sendSync('username-request');
            if (curUserName != null && curUserName.length > 0) {
                document.getElementById("yourname").value = curUserName;
                nameSubmit();
            }
            else {
                document.getElementById("yourname").focus();
            }
        }
    },

    startPurposeSelector: function() {
        if (!appClosing) {
            screens.hideAll();
            document.getElementById("purpose").style.display = "block";
        }
    },

    startOptions: function() {
        if (!appClosing) {
            screens.hideAll();
            document.getElementById("options").style.display = "block";
            document.getElementById("protocol").focus();
            wsHandler.accepting = false;
            ipcRenderer.send('sender-setup-started');
        }
    },

    startFileDropper: function() {
        if (!appClosing) {
            screens.hideAll();
            document.getElementById("dragdrop").style.display = "block";
        }
    },

    showFileConfirm: function() {
        if (!appClosing) {
            screens.hideAll();
            document.getElementById("fileconfirm").style.display = "block";
            document.getElementById("fileconfirm-description").focus();
        }
    },

    startReceiver: function() {
        if (!appClosing) {
            screens.hideAll();
            document.getElementById("receiver").style.display = "block";
            document.getElementById("senderpeerid").focus();
        }
    },

    showPeerIdShowcaser: function() {
        if (!appClosing) {
            screens.hideAll();
            document.getElementById("yourpeerid").value = ipcRenderer.sendSync('assemblid-request');
            document.getElementById("peeridshowcase").style.display = "block";
            document.getElementById("yourpeerid").focus();
            wsHandler.accepting = true;
            ipcRenderer.send('sender-setup-done');
        }
    },

    showErrorScreen: function(errorCode) {
        if (!appClosing) {
            // errors is a global variable set in ui.html
            if (errorCode in errors) {
                screens.hideAll();
                screens.loading.resetProgress();
                ipcRenderer.send('progress-update', false);
                document.getElementById("errorscreen").style.display = "block";
                let error = errors[errorCode];
                document.getElementById("error-details").innerHTML = strip(error["details"]);
                document.getElementById("error-code").innerHTML = strip(errorCode);
                document.getElementById("error-fix").innerHTML = strip(error["fix"]);
                if (error["retry_cmd"] != undefined) {
                    console.log("Command for retrying available: " + error["retry_cmd"]);
                    document.getElementById("error-try-again-btn").setAttribute("onclick", error["retry_cmd"]);
                    document.getElementById("error-try-again-btn").style.display = "inline-block";
                }
                else {
                    console.log("No command for retrying available.");
                    document.getElementById("error-try-again-btn").setAttribute("onclick", "alert('Cannot try again without closing Assembl Desktop. Please close the application and then try again.');");
                    document.getElementById("error-try-again-btn").style.display = "none";
                }
            }
            else {
                screens.showErrorScreen('0x0000');
            }
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