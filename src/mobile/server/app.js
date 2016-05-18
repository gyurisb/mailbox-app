const http         = require('http'),
      fs           = require('fs'),
      path         = require('path'),
      contentTypes = require('./utils/content-types'),
      sysInfo      = require('./utils/sys-info'),
      env          = process.env;
//  Module for email handling;
const EmailConnection = require('./email_conn.js');
// Modules for request handling
var express = require('express');
var bodyParser = require('body-parser');

var sessions = {};
var accounts = {};

var app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
// app.use('/', express.static('C:/Users/Bence/Documents/Diplomamunka/mailbox-app/dist/mobile/cordova/www'));

// IMPORTANT: Your application HAS to respond to GET /health with status 200
app.get('/health', function(req, res) {
	res.writeHead(200);
	res.end();
});
app.post('/login', function (req, res) {
    var conn = new EmailConnection();
    var username = req.body.username;
    conn.login(req.body, function(){
        res.writeHead(200, {'Content-Type': 'application/json'});
        if (accounts[username] !== undefined) {
            var oldToken = accounts[username];
            sessions[oldToken].close();
            sessions[oldToken] = undefined;
        }
        var token = createToken();
        sessions[token] = conn;
        accounts[username] = token;
        res.end(JSON.stringify(token));
    }, function(error){
        res.writeHead(500, {'Content-Type': 'application/json'}); 
        res.end(JSON.stringify(error));
    });
});
app.get('/folders', function (req, res) {
   var conn = sessions[req.get('Authorization')];
   conn.getFolders(function(folders){
		res.writeHead(200, {'Content-Type': 'application/json'}); 
		res.end(JSON.stringify(folders));
   }, function(error){
		res.writeHead(500, {'Content-Type': 'application/json'}); 
		res.end(JSON.stringify(error));
   });
});
app.get('/emails/:path', function (req, res) {
   var conn = sessions[req.get('Authorization')];
   if (req.query.afterUid !== undefined) {
        conn.getEmailsAfterUid(req.params.path, req.query.afterUid, onEmailsSuccess, onEmailsError);
   } else {
        conn.getEmails(req.params.path, req.query.offset, req.query.count, onEmailsSuccess, onEmailsError);
   }
   function onEmailsSuccess(emails) {
        res.writeHead(200, {'Content-Type': 'application/json'}); 
        res.end(JSON.stringify(emails));
   }
   function onEmailsError(error) {
		res.writeHead(500, {'Content-Type': 'application/json'}); 
		res.end(JSON.stringify(error));
   }
});
app.get('/emailbody/:path/:uid', function (req, res) {
   var conn = sessions[req.get('Authorization')];
   conn.getEmailBody(req.params.uid, req.params.uid.path, function(body){
		res.writeHead(200, {'Content-Type': 'application/json'}); 
		res.end(JSON.stringify(body));
   }, function(error){
		res.writeHead(500, {'Content-Type': 'application/json'}); 
		res.end(JSON.stringify(error));
   });
});
app.post('/send', function (req, res) {
   var conn = sessions[req.get('Authorization')];
   conn.sendEmail(req.body, function(){
		res.writeHead(200, {'Content-Type': 'application/json'}); 
		res.end("");
   }, function(error){
		res.writeHead(500, {'Content-Type': 'application/json'}); 
		res.end(JSON.stringify(error));
   });
});

var server = app.listen(env.NODE_PORT || 80, env.NODE_IP || 'localhost', function () {
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