let fs = require('fs');
const readerVersion = 2;

function linkify(text) {
    var urlRegex =/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    return text.replace(urlRegex, function(url) {
        return '<a target="_blank" href="' + url + '" title="Click to open link in web browser" onclick="event.preventDefault(); shell.openExternal(this.href);">' + url + '</a>';
    });
}

function strip(text) {
   var tmp = document.createElement("div");
   tmp.innerHTML = text;
   return tmp.textContent || tmp.innerText || "";
}

function setUnloaded() {
    document.getElementById("not-main").innerHTML = "Drag and drop a validation file here<br/><small style='color: #CCC6C6;'>validation files should always have the extension <i>astv</i> or <i>asvv</i></small>";
    document.getElementById("validation-reader").style.display = "none";
    document.getElementById("verification-reader").style.display = "none";
    document.getElementById("not-main").style.display = "block";
}

function domReady() {
    let body = document.getElementsByTagName("body")[0];
    body.addEventListener("dragover", function(event) {
        event.preventDefault();
    });
    body.addEventListener("drop", function(event) {
        console.log(event.dataTransfer.files[0]);
        openValidationFile(event.dataTransfer.files[0]['path']);
    });
    setUnloaded();
    ipcRenderer.on('validation-file-path', function(event, path) {
        openValidationFile(path);
    });
    ipcRenderer.send('reader-ready');
}

function openValidationFile(validationFile) {
    document.getElementById("not-main").innerHTML = "Loading...";
    let extension = validationFile.split(".").pop();
    if (extension == undefined || extension == null || (extension != "astv" && extension != "asvv")) {
        console.warn("Invalid extension " + extension);
        alert("Invalid file type. The Assembl Transfer Validation File Reader can only open astv and asvv files.");
        setUnloaded();
    }
    else {
        let fileType = "validation";
        if (extension == "asvv") {
            fileType = "verification";
        }
        fs.readFile(validationFile, function(err, data) {
            if (err) {
                console.error(err);
                alert("An error occurred. Cannot read file.");
                setUnloaded();
            }
            else {
                let fileContents = data.toString();
                try {
                    let jsonContents = JSON.parse(fileContents);
                    try {
                        console.log(jsonContents);
                        if (jsonContents.version > readerVersion) {
                            alert("This "+fileType+" file was saved in a newer version than this version of Assembl Triton can manage. Please download & install the latest update to be able to view the full validation file.");
                        }

                        if (extension == "asvv") {
                            renderFullVerificationFile(jsonContents, fileContents);
                        }
                        else {
                            renderFullValidationFile(jsonContents, fileContents);
                        }
                    }
                    catch(err) {
                        console.error(err);
                        alert("An internal error occurred: " + err.message);
                        setUnloaded();
                    }
                }
                catch(err) {
                    console.error(err);
                    alert("The "+fileType+" file appears to be damaged and cannot be read.");
                    setUnloaded();
                }
            }
        });
    }
}

function renderValue(value, inField, validationVersion, startVersion, valueType) {
    console.log(value);
    if (value == undefined || value == null || value.length == 0) {
        renderMissingValue(validationVersion, inField, startVersion);
    }
    else {
        if (valueType == null) {
            console.log(inField);
            document.getElementById(inField).innerHTML = strip(value);
        }
        else {
            switch(valueType) {
                case "timestamp":
                    document.getElementById(inField).innerHTML = strip(new Date(parseInt(value)).toUTCString());
                    break;
                case "filesize":
                    document.getElementById(inField).innerHTML = strip(prettySize(parseInt(value)) + " ("+parseInt(value)+" bytes)");
                    break;
                case "boolean":
                    document.getElementById(inField).innerHTML = strip(value.toString());
                    break;
                default:
                    document.getElementById(inField).innerHTML = strip(value);
                    break;
            }
        }
    }
}

function renderMissingValue(validationVersion, inField, startVersion) {
    if (isNaN(parseInt(validationVersion))) {
        document.getElementById(inField).innerHTML = "<i class='missing'>value missing</i>";
    }
    else {
        if (validationVersion < startVersion) {
            document.getElementById(inField).innerHTML = "<i class='missing'>not present below validation version "+parseInt(startVersion)+"</i>";
        }
        else {
            document.getElementById(inField).innerHTML = "<i class='missing'>value missing</i>";
        }
    }
}

function renderFullValidationFile(validation, fileContents) {
    renderValue(validation.version, "val-general-version", validation.version, 1);
    renderValue(validation.currentTime, "val-general-currenttime", validation.version, 1, "timestamp");

    renderValue(validation.file.size, "val-file-size", validation.version, 1, "filesize");
    renderValue(validation.file.path, "val-file-path", validation.version, 1);
    renderValue(validation.file.name, "val-file-name", validation.version, 1);
    renderValue(validation.file.lastModified, "val-file-lastmodified", validation.version, 1, "timestamp");
    renderValue(validation.file.license, "val-file-license", validation.version, 1, "license");
    renderValue(validation.file.description, "val-file-description", validation.version, 1);
    renderValue(validation.file.hash, "val-file-hash", validation.version, 1);

    renderValue(validation.stellar.transactionId, "val-stellar-transactionid", validation.version, 2);
    renderValue(validation.stellar.time, "val-stellar-time", validation.version, 2, "timestamp");
    renderValue(validation.stellar.ledger, "val-stellar-ledger", validation.version, 2);

    renderValue(validation.transmission.encryptionEnabled, "val-transmission-encryption-enabled", validation.version, 1, "boolean");
    renderValue(validation.transmission.encryptionMethod, "val-transmission-encryption-method", validation.version, 1);
    renderValue(validation.transmission.encryptionLevel, "val-transmission-encryption-level", validation.version, 1);
    renderValue(validation.transmission.protocol, "val-transmission-protocol", validation.version, 1);

    renderValue(validation.sender.name, "val-sender-name", validation.version, 1);
    renderValue(validation.sender.assemblId, "val-sender-assemblid", validation.version, 1);
    renderValue(validation.sender.orcidId, "val-sender-orcidid", validation.version, 1);

    renderValue(validation.receiver.name, "val-receiver-name", validation.version, 1);
    renderValue(validation.receiver.assemblId, "val-receiver-assemblid", validation.version, 1);
    renderValue(validation.receiver.orcidId, "val-receiver-orcidid", validation.version, 1);
    
    document.getElementById("val-json").innerHTML = strip(fileContents);

    document.getElementById("not-main").style.display = "none";
    document.getElementById("verification-reader").style.display = "none";
    document.getElementById("validation-reader").style.display = "block";
}

function renderFullVerificationFile(verification, fileContents) {
    renderValue(verification.version, "ver-general-version", verification.version, 1);
    renderValue(verification.currentTime, "ver-general-currenttime", verification.version, 1, "timestamp");

    renderValue(verification.validation.path, "ver-validation-path", verification.version, 1);
    renderValue(verification.validation.name, "ver-validation-name", verification.version, 1);
    renderValue(verification.validation.hash, "ver-validation-hash", verification.version, 1);

    renderValue(verification.stellar.transactionId, "ver-stellar-transactionid", verification.version, 1);
    renderValue(verification.stellar.time, "ver-stellar-time", verification.version, 1, "timestamp");
    renderValue(verification.stellar.ledger, "ver-stellar-ledger", verification.version, 1);

    document.getElementById("ver-json").innerHTML = strip(fileContents);

    document.getElementById("not-main").style.display = "none";
    document.getElementById("validation-reader").style.display = "none";
    document.getElementById("verification-reader").style.display = "block";
}

function showHelp(forWhat) {
    alert(readerHelp[forWhat]);
}

function beforePrint() {
    let detailTags = document.getElementsByTagName("details");
    for (let i = 0; i < detailTags.length; i++) {
        detailTags[i].setAttribute("open", "");
    }
}

if (window.matchMedia) {
    var mediaQueryList = window.matchMedia('print');
    mediaQueryList.addListener(function(mql) {
        if (mql.matches) {
            beforePrint();
        } else {
            afterPrint();
        }
    });
}
window.onbeforeprint = beforePrint;