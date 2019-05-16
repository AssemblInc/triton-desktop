let http = require('http');
let qs = require('querystring');

let httpHandler = {
    server: null,

    startServer: function() {
        server = http.createServer(function(req, res) {
            if (req.method == 'POST') {
                let body = '';
                req.on('data', function(data) {
                    body += data;
                    if (body.length > 1e6) {
                        // too much post data, kill connection
                        response.writeHead(413, {'Content-Type': 'text/plain'}).end();
                        req.connection.destroy();
                    }
                });
                req.on('end', function() {
                    let post = qs.parse(body);
                });
            }
            else {
                response.writeHead(405, {'Content-Type': 'text/plain'});
                response.end();
            }
        }).listen(27626);
    },

    stopServer: function() {
        server.close();
    }
};