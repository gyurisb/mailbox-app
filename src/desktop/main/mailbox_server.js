const Mailbox = require('./mailbox.js');
const electron = require('electron');
const ipcMain = electron.ipcMain;
const SQLite3Subsystem = require('./sqlite.subsys.js');
const FileSubsystem = require('./file.subsys.js');
const EmailConnection = require('./email_conn.js');
const FetchProcess = require('./fetch_process.js');
const ServerCommands = require('./server_commands.js');
const EmailStore = require('./email_store.js');
const AccountsTable = require('./data/accounts_table.js');
const ContactsTable = require('./data/contacts_table.js');
const EmailsTable = require('./data/emails_table.js');
const FoldersTable = require('./data/folders_table.js');
const QueueTable = require('./data/queue_table.js');
const LockObject = require('./lock.js');

var mailbox = new Mailbox(LockObject, SQLite3Subsystem, FileSubsystem, EmailConnection, FetchProcess, ServerCommands, EmailStore, AccountsTable, ContactsTable, EmailsTable, FoldersTable, QueueTable);

global.mailboxActions = Object.keys(mailbox);

Object.keys(mailbox).forEach(function(action){
    if (action.startsWith("on")) {
        var listeners = [];
        ipcMain.on(action, function(event){
            listeners.push(event.sender);
        });
        mailbox[action](function(eventArgs) {
            listeners.forEach(function(listener){
                listener.send(action + 'Triggered', eventArgs);
            });
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