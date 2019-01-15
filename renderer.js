function hideAllScreens() {
    var screens = document.getElementsByClassName("screen");
    for (var i = 0; i < screens.length; i++) {
        screens[i].style.display = "none";
    }
}

function startPurposeSelector() {
    hideAllScreens();
    document.getElementById("purpose").style.display = "block";
}

function startSender() {
    hideAllScreens();
    document.getElementById("dragdrop").style.display = "block";
}

function startReceiver() {
    hideAllScreens();
    document.getElementById("receiver").style.display = "block";
}

let loadingTimeout = null;
function checkLoading() {
    loadingTimeout = setTimeout(function() {
        var extraLoading = document.getElementById("extra-loading");
        extraLoading.style.height = "150px";
        extraLoading.style.marginTop = "72px";
        // start connecting to the main server here
    }, 3000);  
    setTimeout(startPurposeSelector, 5000);
}