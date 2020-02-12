// NOTE: UNFINISHED

let http = require('http');
let qs = require('querystring');

let httpHandler = {
    server: null,
    publicIp: null,
    localIp: null,
    port: 27626,
    requiredAuth: Math.random().toString(24).substring(2)+":"+Math.random().toString(36).substring(2)+Math.random().toString(36).substring(2)+Math.random().toString(36).substring(2),
    sendTo: {
        initialized: false,
        url: null,
        auth: null
    },
    isMultiPart: false,

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
                                if (req.headers['content-type'] == 'multipart/form-data') {
                                    httpHandler.isMultiPart = true;
                                    req.on('data', function(chunk) {
                                        chunks.push(chunk);
                                        rProgressSize += chunk.byteLength;
                                        screens.loading.setProgressWithFileSize(rProgressSize, rTotalSize);
                                    });
                                }
                                else {
                                    req.on('data', function(chunk) {
                                        chunks.push(chunk);
                                    });
                                }
                                req.on('end', function() {
                                    let data = Buffer.concat(chunks);
                                    if (req.headers['content-type'] === 'application/assembl-chunk') {
                                        if (!('assembl-chunk-encrypted' in req.headers) || !('assembl-chunk-number' in req.headers)) {
                                            // information on chunk is missing in headers
                                            res.writeHead(400, {'Content-Type':'application/json'});
                                            res.end(JSON.stringify({
                                                'error': 'bad_request',
                                                'error_code': 400,
                                                'error_msg': 'missing header assembl-chunk-encrypted or assembl-chunk-number'
                                            }));
                                            console.warn("Someone tried to connect over HTTP not using POST method!");
                                        }
                                        else {
                                            console.log("Received data over HTTP: ", data);
                                            if (parseInt(req.headers['assembl-chunk-encrypted']) > 0) {
                                                ipcRenderer.send('renderer-received-chunk', data.toString(), parseInt(req.headers['assembl-chunk-number']));
                                            }
                                            else {
                                                ipcRenderer.send('renderer-received-unencrypted-chunk', new Uint8Array(data), parseInt(req.headers['assembl-chunk-number']));
                                            }
                                            res.writeHead(200, {'Content-Type':'application/json'});
                                            res.end(JSON.stringify({
                                                'chunkNumber': parseInt(req.headers['assembl-chunk-number']),
                                                'received': true
                                            }));
                                        }
                                    }
                                    else if (req.headers['content-type'].indexOf('multipart/form-data') > -1) {
                                        const boundary = req.headers['content-type'].split("boundary=").parts[1].split(";")[0];
                                        let reqBody = data.toString();
                                        reqBody.split(boundary);
                                        console.log(reqBody);
                                        res.writeHead(200, {'Content-Type':'application/json'});
                                        res.end(JSON.stringify({
                                            'received': true
                                        }));
                                    }
                                    else if (req.headers['content-type'] == 'application/x-www-form-urlencoded') {
                                        let post = parseQuery(data.toString());
                                        console.log("Received data over HTTP: ", post);
                                        if (parseInt(post['encrypted']) > 0) {
                                            ipcRenderer.send('renderer-received-chunk', post.chunk, parseInt(post.number));
                                        }
                                        else {
                                            ipcRenderer.send('renderer-received-unencrypted-chunk', new Uint8Array(post.chunk.split(",")), parseInt(post.number));
                                        }
                                        res.writeHead(200, {'Content-Type':'application/json'});
                                        res.end(JSON.stringify({
                                            'chunkNumber': parseInt(post.number),
                                            'received': true
                                        }));
                                    }
                                    else {
                                        // content-type is not supported
                                        res.writeHead(415, {'Content-Type':'application/json'});
                                        res.end(JSON.stringify({
                                            'error': 'unsupported_media_type',
                                            'error_code': 415,
                                            'error_msg': 'use content-type application/x-www-form-urlencoded or application/assembl-chunk to send data'
                                        }));
                                        console.warn("Someone tried to send data using an unsupported content-type!");
                                    }
                                });
                            }
                            else {
                                // method incorrect, should always be POST
                                res.writeHead(405, {'Content-Type':'application/json'});
                                res.end(JSON.stringify({
                                    'error': 'method_not_allowed',
                                    'error_code': 405,
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
                                'error_code': 401,
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
    },

    sendUnencryptedChunk: function(chunk, number) {
        if (httpHandler.sendTo.initialized) {
            let xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function() {
                if (this.readyState == 4) {
                    let response = JSON.parse(this.responseText);
                    console.log("HTTP response: ", response);
                }
            };
            // let params = 'encrypted=0&number='+parseInt(number)+'&chunk='+encodeURIComponent(Array.from(chunk).join(","));
            xhr.open('POST', httpHandler.sendTo.url, true);
            xhr.setRequestHeader("assembl-chunk-number", number.toString());
            xhr.setRequestHeader("assembl-chunk-encrypted", 0);
            xhr.setRequestHeader("authorization", "Basic "+btoa(httpHandler.sendTo.auth));
            xhr.setRequestHeader("content-type", "application/assembl-chunk");
            xhr.setRequestHeader("accept", "application/json");
            xhr.send(new Blob([chunk]));
        }
        else {
            console.warn("Tried sending data over HTTP while the connection details were not initialized yet.");
        }
    },

    sendUnencryptedFile: function(file) {
        if (httpHandler.sendTo.initialized) {
            let formData = new FormData();
            formData.append("file", file);
            let xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function() {
                if (this.readyState == 4) {
                    let response = JSON.parse(this.responseText);
                    console.log("HTTP response: ", response);
                }
            };
            xhr.open('POST', httpHandler.sendTo.url, true);
            xhr.upload.addEventListener('loadstart', function(event) {
                // upload started
            });
            xhr.upload.addEventListener('progress', function(event) {
                // upload in progress
                if (event.lengthComputable) {
                    screens.loading.setProgressWithFileSize(event.loaded, fileHandler.file.size);
                }
            });
            xhr.upload.addEventListener('abort', function(event) {
                // upload aborted
            });
            xhr.upload.addEventListener('error', function(event) {
                // upload error
            });
            xhr.upload.addEventListener('timeout', function(event) {
                // upload timed out
            });
            xhr.upload.addEventListener('load', function(event) {
                // upload complete
            });
            xhr.setRequestHeader("authorization", "Basic "+btoa(httpHandler.sendTo.auth));
            // xhr.setRequestHeader("content-type", "multipart/form-data");
            xhr.setRequestHeader("accept", "application/json");
            xhr.send(formData);
        }
        else {
            console.warn("Tried sending data over HTTP while the connection details were not initialized yet.");
        }
    }
};

// should the server be on the receiving side or on the sending side...?
// receiving would cause the sender to send the chunks like normal
// sending would cause the receiver to request each chunk seperately...