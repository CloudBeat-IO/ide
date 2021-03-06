/*
 * Recorder.
 */ 
 
var http = require('http');
var https = require('https');
var fs = require('fs');
var path = require('path');
var dns = require('dns');

(function() {
    module.exports = Recorder;
 
    const PORT_HTTP = 7778;
    const PORT_HTTPS = 8889;
    const RECORDER_DIR = 'recorder/';
    
    var scripts = ['tools.js', 'htmlutils.js', 'selenium-browserbot.js',
                   'locatorBuilders.js', 'recorder.js', 'wgxpath.install.js'];
 
    /*
     * Section: Construction and Destruction
     */

    function Recorder() {
        // bundle files
        this.bundle = '';
        for (var script of scripts){
            this.bundle += fs.readFileSync(path.resolve(__dirname, RECORDER_DIR + script)); 
        }

        this.httpSrv = http.createServer(onRequest);
        this.httpSrv.on('error', (err) => {console.log("Unable to bind recorder's HTTP listener. " + err)});

        var options = {
            key: fs.readFileSync(path.resolve(__dirname, RECORDER_DIR + 'cloudbeat-key.pem')),
            cert: fs.readFileSync(path.resolve(__dirname, RECORDER_DIR + 'cloudbeat-cert.pem')),
            requestCert: false,
            rejectUnauthorized: false
        };
        this.httpsSrv = https.createServer(options, onRequest);
        this.httpSrv.on('error', (err) => {console.log("Unable to bind recorder's HTTPS listener " + err)});

        // here be horrors...
        // 'localhost' might be unavailable in certain situations
        // TODO: figure out a proper solution for this since this doesn't support IPv6
        //       and we can't just bind on 0.0.0.0 for security reasons
        //       and... browser extensions use 'localhost' to connect
        dns.lookup('localhost', (err, addr, family) => {
            var hostname;
            if (!err) { // not resolvable - use IPv4 loopback
                hostname = '127.0.0.1';
            } else if (family == 4 && addr !== '127.0.0.1') { // resolves to something other than 127.0.0.1
                hostname = '127.0.0.1';
            } else {
                hostname = 'localhost';
            }
            this.httpSrv.listen(PORT_HTTP, hostname, function(){ });
            this.httpsSrv.listen(PORT_HTTPS, hostname, function(){ });
        });

        var self = this;
        function onRequest(request, response) {
            response.setHeader('Access-Control-Allow-Origin', '*');
            // disable keep-alive. 
            // otherwise connection pooling might prevent the recorder stopping in a timely manner.
            response.setHeader('Connection', 'close');

            if (request.method === 'GET') {
                if (request.url === '/res') {
                    response.write(self.bundle);
                } else {
                    response.statusCode = 404;
                    response.statusMessage = 'Not found';
                } 
                response.end();
            } else if (request.method === 'POST') {
                var body = '';
                request.on('data', function (data) {
                    body += data;
                });
                
                request.on('end', function () {
                    if (request.url === '/lastwin_store') {
                        if (!self.lastWin) {
                            self.lastWin = body;
                        }
                    } else if (request.url === '/lastwin_update') {
                        var tmpLastWin = self.lastWin;
                        self.lastWin = body;
                        response.write(tmpLastWin ? tmpLastWin : 'False');
                    } else {
                        self.print(JSON.parse(body));
                    }
                    response.end();
                });      
            } else {
                response.statusCode = 404;
                response.statusMessage = 'Not found';
                response.end();
            }
        }
    }
    
    Recorder.prototype.stop = function() {
        this.httpSrv.close();
        this.httpsSrv.close();
    };
    
    Recorder.prototype.print = function(op) {
        if (op.targetLocators) {
            var pad = '                ';
            for (var loc of op.targetLocators) {
                var locType = (pad + loc[1]).slice(-pad.length);
                editor.appendText('// ' + locType + ': ' + loc[0].replace(/'/g, "\\'") + '\n');
            }
        }

        // target
        var args = "'" + op.target.replace(/'/g, "\\'") + "'";

        // value
        if (op.value) {
            if (/\r|\n/.exec(op.value)) {   // multiline text should be wrapped within backticks
                args += ', `' + op.value + '`';
            } else {
                if (op.value.toFixed) { // don't enclose in quotes if number
                    args += ', ' + op.value; 
                } else {
                    args += ", '" + op.value.replace(/'/g, "\\'") + "'"; 
                }
            }
        }

        editor.appendText('web.' + op.cmd + '(' + args + ');\n');
        // onchange is not triggered for some reason when appending, so we enable it manually
        toolbar.btnSave.enable();
    };
}).call(this);