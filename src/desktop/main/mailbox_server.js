const Mailbox = require('./mailbox.js');
const electron = require('electron');
const ipcMain = electron.ipcMain;
const SQLite3Subsystem = require('./sqlite.subsys.js');
const EmailConnection = require('./email_conn.js');
const EmailStore = require('./email_store.js');

var mailbox = new Mailbox(new SQLite3Subsystem('mailbox.db'), EmailConnection, EmailStore);

ipcMain.on('loginAsync', function(event, arg) {
    mailbox.login(arg, function() {
        event.sender.send('loginReply', true);
    }, function(err){
        event.sender.send('loginError', err);
    });
});

ipcMain.on('restoreAsync', function(event, arg) {
    mailbox.restore(function(email) {
        event.sender.send('restoreReply', email);
    }, function(err){
        event.sender.send('restoreError', err);
    });
});

ipcMain.on('getFoldersAsync', function(event, arg){
    mailbox.getFolders(function(mailboxes) {
        event.sender.send('getFoldersReply', mailboxes);
    }, function(err){
        event.sender.send('getFoldersError', err);
    });
});

ipcMain.on('getEmailsAsync', function(event, arg){
    mailbox.getEmails(arg, function(messages) {
        event.sender.send('getEmailsReply', messages);
    }, function(err){
        event.sender.send('getEmailsError', err);
    });
});

ipcMain.on('getEmailBodyAsync', function(event, arg) {
    mailbox.getEmailBody(arg, function(body) {
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

ipcMain.on('onFolderUpdateAsync', function(event, arg) {
    mailbox.onFolderUpdate(function(eventArgs) {
        event.sender.send('onFolderUpdateReply', eventArgs);
    });
});

ipcMain.on('onMailboxUpdateAsync', function(event, arg) {
    mailbox.onMailboxUpdate(function(eventArgs) {
        event.sender.send('onMailboxUpdateReply', eventArgs);
    });
});

ipcMain.on('onAccountUpdateAsync', function(event, arg) {
    mailbox.onAccountUpdate(function(eventArgs) {
        event.sender.send('onAccountUpdateReply', eventArgs);
    });
});

module.exports = {};