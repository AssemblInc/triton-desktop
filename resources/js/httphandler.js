// UNFINISHED

let http = require('http');
let qs = require('querystring');

let httpHandler = {
    server: null,
    publicIp: null,
    internalIp: null,
    port: 27626,
    requiredAuth: Math.random().toString(24).substring(2)+":"+Math.random().toString(36).substring(2),
    sendTo: {
        initialized: false,
        url: null,
        auth: null
    },

    startServer: function() {
        return new Promise(function(resolve, reject) {
            externalIp.v4().then(function(publicIp) {
                httpHandler.publicIp = publicIp;
                internalIp.v4().then(function(localIp) {
                    httpHandler.localIp = localIp;
                    server = http.createServer(function(req, res) {
                        let header = req.headers['authorization'] || '';
                        let token = header.split(/\s+/).pop() || '';
                        let auth = new Buffer.from(token, 'base64').toString();
            
                        if (auth === httpHandler.requiredAuth) {
                            if (req.method == 'POST') {
                                let chunks = [];
                                req.on('data', function(chunk) {
                                    chunks.push(chunk);
                                });
                                req.on('end', function() {
                                    let data = Buffer.concat(chunks);
                                    res.writeHead(200, {'Content-Type':'application/json'});
                                    res.end(JSON.stringify({
                                        'chunkNumber': 0,
                                        'received': true
                                    }));
                                    let data = parseQuery(data.toString());
                                    console.log("Received data over HTTP: ", data);
                                    if (parseInt(data['encrypted']) > 0) {
                                        ipcRenderer.send('renderer-received-chunk', data.chunk, data.number);
                                    }
                                    else {
                                        ipcRenderer.send('renderer-received-unencrypted-chunk', new Uint8Array(data.chunk), data.number);
                                    }
                                });
                            }
                            else {
                                // method incorrect, should always be POST
                                res.writeHead(405, {'Content-Type':'application/json'});
                                res.end(JSON.stringify({
                                    'error': 'method_not_allowed',
                                    'error_msg': 'only POST is supported by this server'
                                }));
                                console.warn("Someone tried to connect over HTTP not using POST method!");
                            }
                        }
                        else {
                            // password or username incorrect
                            res.writeHead(401, {'Content-Type':'application/json'});
                            res.end(JSON.stringify({
                                'error': 'unauthorized',
                                'error_msg': 'wrong or no authorization credentials provided'
                            }));
                            console.warn("Someone tried to connect over HTTP with the wrong or no credentials!");
                        }
                    }).listen(httpHandler.port);
                    resolve();
                });
            });
        });
    },

    stopServer: function() {
        server.close();
    },

    initSender: function(url, authorization) {
        httpHandler.sendTo.initialized = true;
        httpHandler.sendTo.url = url;
        httpHandler.sendTo.auth = authorization;
    },

    sendChunk: function(chunk, isEncrypted, number) {
        if (httpHandler.sendTo.initialized) {
            if (isEncrypted) {
                let xhr = new XMLHttpRequest();
                xhr.onreadystatechange = function() {
                    if (this.readyState == 4) {
                        let response = JSON.parse(this.responseText);
                        console.log("HTTP response: ", response);
                    }
                };
                let params = 'encrypted=1&number='+parseInt(number)+'&chunk='+encodeURIComponent(chunk);
                xhr.open('POST', httpHandler.sendTo.url, true);
                xhr.setRequestHeader("Authorization", "Basic "+btoa(httpHandler.sendTo.auth));
                xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
                xhr.setRequestHeader("Accept", "application/json")
                xhr.send(params);
            }
            else {
                ipcRenderer.send('pgp-encrypt-chunk', chunk, number);
            }
        }
        else {
            console.warn("Tried sending data over HTTP while the connection details were not initialized yet.");
        }
    }
};

// should the server be on the receiving side or on the sending side...?
// receiving would cause the sender to send the chunks like normal
// sending would cause the receiver to request each chunk seperately...