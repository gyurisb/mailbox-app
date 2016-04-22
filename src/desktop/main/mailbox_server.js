const EmailConnection = require('./email.js');
const Mailbox = require('./mailbox.js');
const electron = require('electron');
const ipcMain = electron.ipcMain;

var mailbox = new Mailbox();

ipcMain.on('loginAsync', function(event, arg) {
    mailbox.login(arg, function() {
        event.sender.send('loginReply', true);
    }, function(err){
        event.sender.send('loginError', err);
    });
});

ipcMain.on('getFoldersAsync', function(event, arg){
    mailbox.getFolders(function(mailboxes) {
        event.sender.send('getFoldersReply', mailboxes);
    }, function(err){
        event.sender.send('getFoldersError', err);
    });
});

ipcMain.on('getEmailsAsync', function(event, path){
    mailbox.getEmails(path, function(messages) {
        event.sender.send('getEmailsReply', messages);
    }, function(err){
        event.sender.send('getEmailsError', err);
    });
});

ipcMain.on('getEmailBodyAsync', function(event, arg) {
    mailbox.getEmailBody(arg.uid, function(body) {
        event.sender.send('getEmailBodyReply', body);
    }, function(err){
        event.sender.send('getEmailBodyError', err);
    });
});

ipcMain.on('sendEmailAsync', function(event, arg) {
    mailbox.sendEmail(arg, function() {
        event.sender.send('sendEmailReply', true);
    }, function(err){
        event.sender.send('sendEmailError', err);
    });
});

ipcMain.on('contactsAsync', function(event, key) {
    mailbox.contacts(key, function(contacts) {
        event.sender.send('contactsReply', contacts);
    });
});

module.exports = {};