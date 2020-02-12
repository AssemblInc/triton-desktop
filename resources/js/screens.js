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
                    document.getElementById("error-try-again-btn").setAttribute("onclick", "toastr.error('Cannot try again without closing Assembl Triton. Please close the application and then try again.');");
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
                document.getElementById("loading-progress-text").style.display = "none";
            }
            else {
                document.getElementById("loading-progress").style.display = "block";
                document.getElementById("loading-progress-text").style.display = "block";
            }
            document.getElementById("loading").style.display = "block";
        }
    },

    loading: {
        timeStarted: 0,
        max: 0,
        progress: 0,
        isFileSize: false,
        timeRemStr: "estimating time remaining...",
        timeController: null,

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

        progressTimeRemaining: function() {
            let timeElapsed = Date.now() - screens.loading.timeStarted;
            if (screens.loading.progress != 0) {
                let speed = screens.loading.progress / (timeElapsed / 1000);
                if (speed != 0) {
                    let remainingProgress = screens.loading.max - screens.loading.progress;
                    if (remainingProgress != 0) {
                        let remainingTime = Math.floor(remainingProgress / speed);
                        screens.loading.timeRemStr = formatSeconds(remainingTime) + " remaining...";
                    }
                }
                else {
                    screens.loading.timeRemStr = "estimating time remaining...";
                }
            }
            else {
                screens.loading.timeRemStr = "estimating time remaining...";
            }

            let remainingTimeText = document.getElementById("loading-progress-text").getElementsByClassName("loading-progress-text-remaining");
            if (remainingTimeText.length > 0) {
                remainingTimeText[0].innerHTML = screens.loading.timeRemStr;
            }
        },

        setProgressWithFileSize: function(progress, max) {
            if (!appClosing) {
                screens.loading.isFileSize = true;
                screens.loading['progress'] = progress;
                screens.loading['max'] = max;
                let progressPerc = ((progress / max) * 100).toFixed(1);
                document.getElementById("loading-progress-inner").style.width = progressPerc + "%";
                document.getElementById("loading-progress-text").innerHTML = strip(progressPerc + "% &bull; " + prettySize(progress, true, false, 2) + " / " + prettySize(max, true, false, 2) + " &bull; <span class='loading-progress-text-remaining'>"+screens.loading.timeRemStr+"</span>");
                ipcRenderer.send('progress-update', true, progress / max, {
                    mode: "normal"
                });
            }
        },

        setProgress: function(progress, max) {
            if (!appClosing) {
                screens.loading.isFileSize = false;
                screens.loading['progress'] = progress;
                screens.loading['max'] = max;
                let progressPerc = ((progress / max) * 100).toFixed(1);
                document.getElementById("loading-progress-inner").style.width = progressPerc + "%";
                document.getElementById("loading-progress-text").innerHTML = progressPerc + "% &bull; " + progress + " / " + max + " &bull; <span class='loading-progress-text-remaining'>"+screens.loading.timeRemStr+"</span>";
                ipcRenderer.send('progress-update', true, progress / max, {
                    mode: "normal"
                });
            }
        },

        resetProgress: function() {
            screens.loading.timeStarted = Date.now();
            if (screens.loading.timeController != null) {
                clearTimeout(screens.loading.timeController);
            }
            screens.loading.timeController = null;
            screens.loading.timeController = setInterval(this.progressTimeRemaining, 1000);
            screens.loading.max = 0;
            screens.loading.progress = 0;
            screens.loading.isFileSize = false;
            screens.loading.timeRemStr = "estimating time remaining...";
            document.getElementById("loading-progress-inner").style.width = "0%";
            document.getElementById("loading-progress-text").innerHTML = "0% &bull; 0 / 0";
            ipcRenderer.send('progress-update', false);
        }
    }
};