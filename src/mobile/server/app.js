const http         = require('http'),
      fs           = require('fs'),
      path         = require('path'),
      contentTypes = require('./utils/content-types'),
      sysInfo      = require('./utils/sys-info'),
      env          = process.env;
const express = require('express');
const bodyParser = require('body-parser');
const semaphore = require('semaphore');
const EmailConnection = require('./email_conn.js');

var sessions = {};
var accounts = {};

var app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/health', function(req, res) {
	res.writeHead(200);
	res.end();
});
app.post('/login', function (req, res) {
    var conn = new EmailConnection();
    var username = req.body.username;
    conn.login(req.body[0], function(){
        if (accounts[username] !== undefined) {
            var oldToken = accounts[username];
            sessions[oldToken].conn.close();
            delete sessions[oldToken];
        }
        var token = createToken();
        sessions[token] = { conn: conn, lock: semaphore(1) };
        accounts[username] = token;
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(token));
    }, function(error){
        res.writeHead(500, {'Content-Type': 'application/json'}); 
        res.end(JSON.stringify(error));
    });
});
Object.keys(new EmailConnection()).filter(a => a != "login").forEach(function(action){
    app.post('/' + action, function(req, res){
        var session = sessions[req.get('Authorization')];
        if (session) {
            session.lock.take(function(){
                session.conn[action].apply(session.conn, req.body.concat([function(result){
                    session.lock.leave();
                    res.writeHead(200, {'Content-Type': 'application/json'}); 
                    res.end(JSON.stringify(result));
                }, function(error){
                    res.writeHead(500, {'Content-Type': 'application/json'}); 
                    res.end(JSON.stringify(error));
                }]));
            });
        } else {
            res.writeHead(401, {'Content-Type': 'application/json'});
            res.end();
        }
    });
});

var server = app.listen(env.NODE_PORT || 80, env.NODE_IP || '0.0.0.0', function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log("Email app listening at http://%s:%s", host, port);
});

function randomString(length, chars) {
	chars = chars || '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var result = '';
    for (var i = length; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
    return result;
}
function createToken() {
    var token = randomString(40);
    while (sessions[token] !== undefined)
        token = randomString(40);
    return token;
}