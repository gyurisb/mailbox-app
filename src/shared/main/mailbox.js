function Mailbox(LockObject, SQLiteSubsystem, FileSubsystem, EmailConnection, FetchProcess, ServerCommands, EmailStore, AccountsTable, ContactsTable, EmailsTable, FoldersTable, QueueTable) {
    var mailbox;
    var lock = new LockObject();
    var fs = new FileSubsystem();
    var store = new EmailStore(SQLiteSubsystem, AccountsTable, ContactsTable, EmailsTable, FoldersTable, QueueTable);
    var fetchProcess;
    var account;
    var events = {
        folderUpdate: function(){},
        mailboxUpdate: function(){},
        accountUpdate: function(){},
        downloadFinish: function(){},
        loginFinish: function(){}
    }

    mailbox = {
        login: function(credentials, success, error) {
            fetchProcess = new FetchProcess(store, fs, events, lock, credentials.username, EmailConnection, ServerCommands);
            fetchProcess.setLoginTask(new fetchProcess.LoginTask(credentials, true));
            fetchProcess.start();
            success();
        },
        restore: function(success, error) {
            store.open(function(){
                store.createDatabase(function(){
                    store.accounts.list(function(accounts) {
                        accounts = accounts || [];
                        if (accounts.length == 0) {
                            events.accountUpdate({ type: "account" });
                        } else {
                            events.accountUpdate({ type: "account", email: accounts[0].username });
                            fetchProcess = new FetchProcess(store, fs, events, lock, accounts[0].username, EmailConnection, ServerCommands);
                            fetchProcess.setLoginTask(new fetchProcess.LoginTask(accounts[0]));
                            fetchProcess.start();
                        }
                        success();
                    });
                });
            });
        },
        getFolders: function(success, error) {
            store.folders.getTree(success);
        },
        createFolder: function(parentId, name, success, error) {
            store.folders.create(account, parentId, name, function(folder){
                if (folder) {
                    events.mailboxUpdate();
                    store.queue.create('createFolder', account, { path: folder.path }, function(){
                        fetchProcess.restart();
                        success();
                    });
                } else {
                    error({ type: "folderDuplicate", message: "Folder with the given name already exists." });
                }
            });
        },
        moveFolder: function(id, targetId, success, error) {
            store.folders.get(id, function(folder){
                store.folders.get(targetId, function(targetFolder){
                    if (id != targetId && folder.parentId != targetId && (!targetFolder || targetFolder.path.indexOf(folder.path + folder.delimiter) != 0)) {
                        store.folders.move(folder.id, targetId, function(newFolder){
                            if (newFolder) {
                                events.mailboxUpdate();
                                events.folderUpdate({ id: folder.id });
                                store.queue.create('moveFolder', folder.account, { path: folder.path, newPath: newFolder.path }, function(){
                                    fetchProcess.restart();
                                    success();
                                });
                            } else {
                                error({ type: "folderDuplicate", message: "Folder with the given name already exists." });
                            }
                        });
                    } else {
                        error({ type: "invalidTargetFolder", message: "The folder cannot be moved to the selected folder." });
                    }
                });
            });
        },
        renameFolder: function(id, name, success, error) {
            store.folders.get(id, function(folder){
                store.folders.rename(folder.id, name, function(newFolder){
                    if (newFolder) {
                        events.mailboxUpdate();
                        events.folderUpdate({ id: folder.id });
                        store.queue.create('moveFolder', folder.account, { path: folder.path, newPath: newFolder.path }, function(){
                            fetchProcess.restart();
                            success();
                        });
                    } else {
                        error({ type: "folderDuplicate", message: "Folder with the given name already exists." });
                    }
                });
            });
        },
        deleteFolder: function(id, success, error) {
            store.folders.get(id, function(folder){
                store.folders.delete(folder.id, function(){
                    events.mailboxUpdate();
                    store.queue.create('deleteFolder', folder.account, { path: folder.path }, function(){
                        fetchProcess.restart();
                        success();
                    });
                });
            });
        },
        getEmails: function(folderId, offset, count, success, error) {
            store.emails.list(folderId, offset, count, function(cachedEmails) {
                store.folders.get(folderId, function(folder) {
                    if (cachedEmails.length < count && !folder.totalSynced) {
                        events.accountUpdate({ type: "folderProgress", folder: folderId, progress: true });
                        fetchProcess.addTask(new fetchProcess.OldEmailsSynchronizationTask(folder.id));
                        fetchProcess.restart();
                    }
                    success(cachedEmails);
                });
            });
        },
        getEmailBody: function(emailId, success, error) {
            store.emails.get(emailId, function(email){
                store.folders.get(email.folderId, function(folder){
                    email.folder = folder;
                    store.emails.getBody(email.id, function(body){
                        if (!email.seen) {
                            store.emails.see(email.id, function(){
                                events.mailboxUpdate();
                                events.folderUpdate({ id: email.folderId });
                                store.queue.create('setEmailRead', email.folder.account, { path: email.folder.path, uid: email.uid }, function(){
                                    fetchProcess.restart();
                                    success(body);
                                });
                            });
                        } else {
                            success(body);
                        }
                    });
                });
            });
        },
        getEmailAttachment: function(emailId, part, destFileName, success, error) {
            fetchProcess.addTask(new fetchProcess.AttachmentDownloadingTask(emailId, part, destFileName));
            fetchProcess.restart();
            success();
        },
        deleteEmail: function(emailId, success, error) {
            store.emails.get(emailId, function(email){
                store.folders.get(email.folderId, function(sourceFolder){
                    email.folder = sourceFolder;
                    store.folders.getTrash(email.folder.account, function(trashFolder){
                        if (email.folderId != trashFolder.id) {
                            mailbox.moveEmail(email.id, trashFolder.id, success, error);
                        } else {
                            store.emails.delete(email.id, function(){
                                events.folderUpdate({ id: email.folder.id });
                                store.queue.create('deleteEmail', email.folder.account, { path: email.folder.path, uid: email.uid }, function(){
                                    fetchProcess.restart();
                                    success();
                                });
                            });
                        }
                    })
                });
            });
        },
        moveEmail: function(emailId, targetFolderId, success, error) {
            store.emails.get(emailId, function(email){
                if (email.folderId != targetFolderId) {
                    store.folders.get(email.folderId, function(sourceFolder){
                        email.folder = sourceFolder;
                        store.folders.get(targetFolderId, function(targetFolder){
                            store.folders.getOldestDate(targetFolder.id, function(targetOldestDate){
                                if (targetFolder.totalSynced || targetOldestDate < new Date(email.date)) {
                                    store.emails.move(email.id, targetFolder.id, function(newUid){
                                        email.uid = newUid;
                                        afterExec();
                                    });
                                } else {
                                    store.emails.delete(email.id, function(){
                                        email.uid = null;
                                        afterExec();
                                    });
                                }
                                function afterExec() {
                                    events.folderUpdate({ id: email.folder.id });
                                    if (email.uid != null) {
                                        events.folderUpdate({ id: targetFolder.id });
                                    }
                                    events.mailboxUpdate();
                                    store.queue.create('moveEmail', email.folder.account, { path: email.folder.path, targetPath: targetFolder.path, email: email, uid: email.uid }, function(){
                                        fetchProcess.restart();
                                        success();
                                    });
                                }
                            });
                        });
                    });
                } else {
                    error({ type: "invalidTargetFolder" });
                }
            });
        },
        sendEmail: function(message, success, error) {
            if (message.replyToId != null) {
                store.emails.get(message.replyToId, function(email){
                    store.folders.get(email.folderId, function(folder){
                        finishSendEmail(email.uid, folder.path);
                    });
                });
            } else {
                finishSendEmail(null, null);
            }
            function finishSendEmail(uid, path) {
                message.attachments.forEach(function(attachment){
                    if (attachment.type == "file") {
                        var bitmap = fs.readFileSync(attachment.path);
                        attachment.data = Buffer(bitmap).toString('base64');
                    }
                });
                message.uid = uid;
                message.path = path;
                store.queue.create('sendEmail', account, message, function(){
                    fetchProcess.restart();
                    success();
                });
            }
        },
        contacts: function(key, success, error) {
            store.contacts.search(key, success);
        },
        onAccountUpdate: function(callback) {
            events.accountUpdate = callback;
        },
        onMailboxUpdate: function(callback) {
            events.mailboxUpdate = callback;
        },
        onFolderUpdate: function(callback) {
            events.folderUpdate = callback;
        },
        onDownloadFinish: function(callback) {
            events.downloadFinish = callback;
        },
        onLoginFinish: function(callback) {
            events.loginFinish = callback;
        }
    };
    return lock.createLockedObject(mailbox);
}

module.exports = Mailbox;