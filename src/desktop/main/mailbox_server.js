const Mailbox = require('./mailbox.js');
const electron = require('electron');
const ipcMain = electron.ipcMain;
const SQLite3Subsystem = require('./sqlite.subsys.js');
const FileSubsystem = require('./file.subsys.js');
const EmailConnection = require('./email_conn.js');
const EmailStore = require('./email_store.js');

var mailbox = new Mailbox(SQLite3Subsystem, FileSubsystem, EmailConnection, EmailStore);

global.mailboxActions = Object.keys(mailbox);

Object.keys(mailbox).forEach(function(action){
    if (action.startsWith("on")) {
        var callbackEvent;
        ipcMain.on(action, function(event){
            callbackEvent = event;
        });
        mailbox[action](function(eventArgs) {
            callbackEvent.sender.send(action + 'Triggered', eventArgs);
        });
    } else {
        ipcMain.on(action + 'Async', function(event, request){
            mailbox[action].apply(mailbox, request.params.concat([
                function(result) {
                    event.sender.send(action + 'Reply', { id: request.id, result: result });
                }, 
                function(err){
                    event.sender.send(action + 'Error', { id: request.id, error: err});
                }
            ]));
        });
    }
});

module.exports = {};