let http = require('http');
let qs = require('querystring');

let httpHandler = {
    server: null,

    startServer: function() {
        server = http.createServer(function(req, res) {
            if (req.method == 'POST') {
                let chunks = [];
                req.on('data', function(chunk) {
                    chunks.push(chunk);
                    // dont forget to implement stream-meter instead to fix memory attacks
                    /*
                    limitedStream = request.pipe(meter(1e7));
                    limitedStream.on('data', ...);
                    limitedStream.on('end', ...);
                    */
                });
                req.on('end', function() {
                    let data = Buffer.concat(chunks);
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