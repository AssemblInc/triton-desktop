let fs = require('fs');
const readerVersion = 1;

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
    document.getElementById("not-main").innerHTML = "Drag and drop a validation file here<br/><small style='color: #CCC6C6;'>validation files should always have the extension <i>astv</i></small>";
    document.getElementById("main").style.display = "none";
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
    if (extension == undefined || extension == null || extension != "astv") {
        console.warn("Invalid extension " + extension);
        alert("Invalid file type. The Assembl Transfer Validation File Reader can only open astv files.");
        setUnloaded();
    }
    else {
        fs.readFile(validationFile, function(err, data) {
            if (err) {
                console.error(err);
                alert("An error occurred. Cannot read file.");
                setUnloaded();
            }
            else {
                let fileContents = data.toString();
                try {
                    let validation = JSON.parse(fileContents);
                    try {
                        console.log(validation);
                        if (validation.version > readerVersion) {
                            alert("This validation file was saved in a newer version than this version of Assembl Desktop can manage. Please download & install the latest update to be able to view the full validation file.");
                        }
                        renderFullValidationFile(validation, fileContents);
                    }
                    catch(err) {
                        console.error(err);
                        alert("An internal error occurred: " + err.message);
                        setUnloaded();
                    }
                }
                catch(err) {
                    console.error(err);
                    alert("The validation file appears to be damaged and cannot be read.");
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
    renderValue(validation.version, "general-version", validation.version, 1);
    renderValue(validation.currentTime, "general-currenttime", validation.version, 1, "timestamp");

    renderValue(validation.file.size, "file-size", validation.version, 1, "filesize");
    renderValue(validation.file.path, "file-path", validation.version, 1);
    renderValue(validation.file.name, "file-name", validation.version, 1);
    renderValue(validation.file.lastModified, "file-lastmodified", validation.version, 1, "timestamp");
    renderValue(validation.file.license, "file-license", validation.version, 1, "license");
    renderValue(validation.file.description, "file-description", validation.version, 1);
    renderValue(validation.file.hash, "file-hash", validation.version, 1);

    renderValue(validation.sender.name, "sender-name", validation.version, 1);
    renderValue(validation.sender.assemblId, "sender-assemblid", validation.version, 1);
    renderValue(validation.sender.orcidId, "sender-orcidid", validation.version, 1);

    renderValue(validation.receiver.name, "receiver-name", validation.version, 1);
    renderValue(validation.receiver.assemblId, "receiver-assemblid", validation.version, 1);
    renderValue(validation.receiver.orcidId, "receiver-orcidid", validation.version, 1);
    
    document.getElementById("json").innerHTML = strip(fileContents);

    document.getElementById("not-main").style.display = "none";
    document.getElementById("main").style.display = "block";
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