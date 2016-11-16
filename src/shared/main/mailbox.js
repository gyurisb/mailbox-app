function Mailbox(SQLiteSubsystem, FileSubsystem, EmailConnection, EmailStore) {
    var mailbox;
    var db = new SQLiteSubsystem('mailbox.db');
    var fs = new FileSubsystem();
    var mainStore = new EmailStore(db);
    var store;
    var connections = [];
    var conn;
    var folderUpdateCallback = function(){};
    var mailboxUpdateCallback = function(){};
    var accountUpdateCallback = function(){};
    var fetchCanceled = false;
    var fetchInProgress = true;
    var restartFetch = false;
    var awaitFetchMonitor = [];
    var awaitConnectionMonitor = [];
    var taskProcessingInProgress = false;
    var awaitTaskProcessingMonitor = [];
    
    var serverCommands = {
        setEmailRead: function(args, success, error) {
            conn.setEmailRead(args.path, args.uid, success, error);
        },
        sendEmail: function(args, success, error) {
            conn.sendEmail(args, success, function(err){
                if (err.type == "rejectedAddresses") {
                    success();
                    accountUpdateCallback({ type: "rejectedAddresses", failedRecipients: err.failedRecipients });
                } else {
                    error(err);
                }
            });
        },
        deleteEmail: function(args, success, error) {
            conn.deleteEmail(args.path, args.uid, success, error);
        },
        moveEmail: function(args, success, error) {
            moveEmail();
            function moveEmail() {
                conn.getLastEmails(args.path, -1, new Date(args.email.date), function(result){
                    var email = EmailStore.searchEmail(args.email, result.messages);
                    if (email) {
                        conn.moveEmail(args.path, email.uid, args.targetPath, checkTarget, error);
                    } else {
                        checkTarget();
                    }
                    function checkTarget() {
                        conn.getLastEmails(args.targetPath, -1, new Date(args.email.date), function(result){
                            var checkEmail = EmailStore.searchEmail(args.email, result.messages);
                            if (checkEmail) {
                                if (args.email.uid != null) {
                                    store.setUids(args.email.uid, checkEmail.uid, function(){
                                        success();
                                    });
                                } else {
                                    success();
                                }
                            } else {
                                if (!email) {
                                    error({ type: "emailLost", message: "Email lost while being moved." });
                                } else {
                                    moveEmail();
                                }
                            }
                        }, error);
                    }
                }, error);
            }
        },
        createFolder: function(args, success, error) {
            conn.createFolder(args.path, success, error);
        },
        deleteFolder: function(args, success, error) {
            conn.deleteFolder(args.path, success, error);
        },
        movefolder: function(args, success, error) {
            conn.moveFolder(args.path, args.newPath, success, error);
        }
    }

    return mailbox = {
        login: function(credentials, success, error) {
            login(credentials, function() {
                accountUpdateCallback({ type: "account", email: credentials.username });
                mainStore.saveAccount(credentials, success);
                fetch();
            }, error);
        },
        restore: function(success, error) {
            mainStore.open(function(){
                mainStore.createDatabase(function(){
                    mainStore.getAccounts(function(accounts) {
                        accounts = accounts || [];
                        if (accounts.length == 0) {
                            accountUpdateCallback({ type: "account" });
                        } else {
                            var account = accounts[0];
                            store = new mainStore.Account(account.username);
                            accountUpdateCallback({ type: "account", email: account.username });
                            accountUpdateCallback({ type: "progress", phase: "login", progress: -1 });
                            login(account, function(){
                                fetch();
                            }, function(err){
                                error(err);
                                accountError(err);
                                conn = null;
                            });
                        }
                        success();
                    });
                });
            });
        },
        getFolders: function(success, error) {
            store.getFolders(function(cachedFolders) {
                success(EmailStore.createFolderTree(cachedFolders));
            });
        },
        createFolder: function(parentId, name, success, error) {
            cancelFetchProcess(function(){
                store.createFolder(parentId, name, function(folder){
                    if (folder) {
                        success();
                        mailboxUpdateCallback();
                        store.pushCommand('createFolder', { path: folder.path }, restartFetchProcess);
                    } else {
                        error({ type: "folderDuplicate", message: "Folder with the given name already exists." });
                    }
                });
            });
        },
        moveFolder: function(id, targetId, success, error) {
            store.getFolder(id, function(folder){
                store.getFolder(targetId, function(targetFolder){
                    if (id != targetId && folder.parentId != targetId && (!targetFolder || targetFolder.path.indexOf(folder.path + folder.delimiter) != 0)) {
                        cancelFetchProcess(function(){
                            store.moveFolder(folder.id, targetId, function(newFolder){
                                if (newFolder) {
                                    success();
                                    mailboxUpdateCallback();
                                    folderUpdateCallback({ id: folder.id });
                                    store.pushCommand('movefolder', { path: folder.path, newPath: newFolder.path }, restartFetchProcess);
                                } else {
                                    error({ type: "folderDuplicate", message: "Folder with the given name already exists." });
                                    restartFetchProcess();
                                }
                            });
                        });
                    } else {
                        error({ type: "invalidTargetFolder", message: "The folder cannot be moved to the selected folder." });
                    }
                });
            });
        },
        renameFolder: function(id, name, success, error) {
            cancelFetchProcess(function(){
                store.getFolder(id, function(folder){
                    store.renameFolder(folder.id, name, function(newFolder){
                        if (newFolder) {
                            success();
                            mailboxUpdateCallback();
                            folderUpdateCallback({ id: folder.id });
                            store.pushCommand('movefolder', { path: folder.path, newPath: newFolder.path }, restartFetchProcess);
                        } else {
                            error({ type: "folderDuplicate", message: "Folder with the given name already exists." });
                            restartFetchProcess();
                        }
                    });
                });
            });
        },
        deleteFolder: function(id, success, error) {
            cancelFetchProcess(function(){
                store.getFolder(id, function(folder){
                    store.deleteFolder(folder.id, function(){
                        success();
                        mailboxUpdateCallback();
                    });
                    store.pushCommand('deleteFolder', { path: folder.path }, restartFetchProcess);
                });
            });
        },
        getEmails: function(folderId, offset, count, success, error) {
            store.getEmails(folderId, offset, count, function(cachedEmails) {
                success(cachedEmails);
                if (cachedEmails.length < count) {
                    store.getFolder(folderId, function(folder) {
                        if (folder && !folder.totalSynced) {
                            accountUpdateCallback({ type: "folderProgress", folder: folderId, progress: true });
                            cancelFetchProcess(function(){
                                store.setSyncAll(folderId, restartFetchProcess);
                            });
                        }
                    });
                }
            });
        },
        getEmailBody: function(emailId, success, error) {
            store.getEmail(emailId, function(email){
                store.getEmailBody(email.id, function(body){
                    success(body);
                });
                if (!email.seen) {
                    cancelFetchProcess(function(){
                        store.seeEmail(email.id, function(){
                            mailboxUpdateCallback();
                            folderUpdateCallback({ id: email.folderId });
                        });
                        store.getFolder(email.folderId, function(folder){
                            store.pushCommand('setEmailRead', { path: folder.path, uid: email.uid }, restartFetchProcess);
                        });
                    });
                }
            });
        },
        getEmailAttachment: function(emailId, part, destFileName, success, error) {
            store.getEmail(emailId, function(email){
                store.getFolder(email.folderId, function(folder){
                    email.folder = folder;
                    if (email.uid >= 0) {
                        awaitConnection(function(){
                            conn.getEmailAttachment(email.folder.path, email.uid, part, function(content){
                                fs.writeFile(destFileName, content, 'base64', function(err){
                                    if (!err) {
                                        success();
                                    } else {
                                        error(err);
                                    }
                                });
                            }, error);
                        }, error);
                    } else {
                        error({ type: "emailModifyInProgress", message: "An operation is pending on the selected email." });
                    }
                });
            });
        },
        deleteEmail: function(emailId, success, error) {
            cancelFetchProcess(function(){
                store.getEmail(emailId, function(email){
                    store.getFolder(email.folderId, function(sourceFolder){
                        email.folder = sourceFolder;
                        store.getTrashFolder(function(trashFolder){
                            if (email.folderId != trashFolder.id) {
                                mailbox.moveEmail(email.id, trashFolder.id, success, error);
                            } else {
                                store.deleteEmail(email.id, function(){
                                    folderUpdateCallback({ id: email.folder.id });
                                    success();
                                });
                                store.pushCommand('deleteEmail', { path: email.folder.path, uid: email.uid }, restartFetchProcess);
                            }
                        })
                    });
                });
            });
        },
        moveEmail: function(emailId, targetFolderId, success, error) {
            store.getEmail(emailId, function(email){
                if (email.folderId != targetFolderId) {
                    cancelFetchProcess(function(){
                        store.getFolder(email.folderId, function(sourceFolder){
                            email.folder = sourceFolder;
                            store.getFolder(targetFolderId, function(targetFolder){
                                store.getOldestDate(targetFolder.id, function(targetOldestDate){
                                    if (targetFolder.totalSynced || targetOldestDate < new Date(email.date)) {
                                        store.moveEmail(email.id, targetFolder.id, function(newUid){
                                            email.uid = newUid;
                                            success();
                                            folderUpdateCallback({ id: email.folder.id });
                                            folderUpdateCallback({ id: targetFolder.id });
                                            mailboxUpdateCallback();
                                            store.pushCommand('moveEmail', { path: email.folder.path, targetPath: targetFolder.path, email: email, uid: newUid }, restartFetchProcess);
                                        });
                                    } else {
                                        store.deleteEmail(email.id, success);
                                        email.uid = null;
                                        store.pushCommand('moveEmail', { path: email.folder.path, targetPath: targetFolder.path, email: email }, restartFetchProcess);
                                    }
                                });
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
                store.getEmail(message.replyToId, function(email){
                    store.getFolder(email.folderId, function(folder){
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
                cancelFetchProcess(function(){
                    store.pushCommand('sendEmail', message, restartFetchProcess);
                    success();
                });
            }
        },
        contacts: function(key, success, error) {
            mainStore.getContacts(key, success);
        },
        onAccountUpdate: function(callback) {
            accountUpdateCallback = callback;
        },
        onMailboxUpdate: function(callback) {
            mailboxUpdateCallback = callback;
        },
        onFolderUpdate: function(callback) {
            folderUpdateCallback = callback;
        }
    };

    function fetch() {
        fetchInProgress = true;
        restartFetch = false;
        executeCommands(function(){
            store.getFolders(function(folders){
                if (folders.length == 0 || folders.some(function(folder) { return folder.syncAll || !folder.syncDate || folder.syncDate.valueOf() < Date.now() - 5*60*1000; } )) {
                    executeSynchronization([synchronizeFolders()], function() { return fetchCanceled; }, fetchEnd, accountError);
                } else {
                    fetchEnd();
                }
                function fetchEnd() {
                    accountDone();
                    fetchInProgress = false;
                    fetchCanceled = false;
                    if (restartFetch) {
                        fetch();
                    } else {
                        awaitFetchMonitor.splice(0).forEach(function(callback){ callback(); });
                    }
                }
            });
        }, accountError);
    }

    function executeCommands(success, error) {
        accountUpdateCallback({ type: "progress", phase: "commands", progress: 0 });
        store.getCommandQueue(function(queue){
            executeAllCommand(0);
            function executeAllCommand(i) {
                if (i >= queue.length) {
                    success();
                } else {
                    var current = queue[i];
                    accountUpdateCallback({ type: "progress", phase: "commands", command: current.command, progress: i * 100 / queue.length });
                    serverCommands[current.command](current.args, function(){
                        store.popCommand(current.id, function(){
                            executeAllCommand(i + 1);
                        });
                    }, error);
                }
            }
        });
    }

    function executeSynchronization(tasks, cancel, success, error) {
        var task = tasks.splice(0, 1)[0];
        if (!task) {
            success();
        } else {
            if (!cancel()) {
                accountUpdateCallback({ type: "progress", phase: task.status.phase, progress: task.status.progress });
                task.operation(function(result){
                    if (!cancel()) {
                        taskProcessingInProgress = true;
                        task.processing(result, function(newTasks){
                            taskProcessingInProgress = false;
                            awaitTaskProcessingMonitor.splice(0).forEach(function(callback){ callback(); });
                            executeSynchronization(tasks.concat(newTasks || []), cancel, success, error);
                        }, error);
                    } else {
                        success();
                    }
                }, error);
            } else {
                success();
            }
        }
    }

    function synchronizeFolders() {
        return {
            operation: function(success, error) {
                conn.getFolders(success, error);
            },
            processing: function(root, success, error) {
                store.saveFolders(root, function(changed) {
                    if (changed) {
                        mailboxUpdateCallback();
                    }
                    store.getFolders(function(savedFolders){
                        var outOfDateFolders = savedFolders.filter(function(folder) { return !folder.lastSynced || new Date(folder.lastSynced).valueOf() < Date.now() - 5*60*1000; });
                        var syncAllFolders = savedFolders.filter(function(folder){ return folder.syncAll != null; });
                        success(syncAllFolders.map(function(folder, i){
                            var progress = i*100 / (syncAllFolders.length + outOfDateFolders.length);
                            return syncronizeAllEmails(folder, 21, new Date(folder.syncAll), progress);
                        }).concat(outOfDateFolders.map(function(folder, i) {
                            var progress = (i + syncAllFolders.length)*100 / (syncAllFolders.length + outOfDateFolders.length);
                            return folder.lastSynced ? syncronizeNewEmails(folder, progress) : syncronizeAllEmails(folder, 20, null, progress);
                        })));
                    });
                });
            },
            status: { phase: "folders", progress: -1 }
        }
    }

    function syncronizeNewEmails(folder, progress) {
        return {
            operation: function(success, error) {
                var firstDate = new Date(folder.lastSynced);
                conn.getNewEmails(folder.path, firstDate, success, error);
            },
            processing: function(emails, success, error) {
                store.syncFolder(folder.id, function() {
                    store.saveEmails(emails, folder.id, function(){
                        if (emails.length > 0) {
                            folderUpdateCallback(folder);
                            mailboxUpdateCallback();
                        }
                        success();
                    });
                });
            },
            status: { phase: "emails", progress: progress }
        }
    }

    function syncronizeAllEmails(folder, count, lastDate, progress) {
        return {
            operation: function(success, error) {
                conn.getLastEmails(folder.path, count, lastDate, success, error);
            },
            processing: function(result, success, error) {
                if (!lastDate) {
                    store.syncFolder(folder.id, afterSync);
                } else {
                    afterSync();
                }
                function afterSync() {
                    store.setTotalSynced(folder.id, !result.hasMore, function(){
                        store.saveEmails(result.messages, folder.id, function(savedEmailsCount){
                            if (savedEmailsCount > 0) {
                                folderUpdateCallback(folder);
                                mailboxUpdateCallback();
                            }
                            store.resetSyncAll(folder.id, function(){
                                success();
                                accountUpdateCallback({ type: "folderProgress", folder: folder.id, progress: false });
                            });
                        });
                    });
                }
            },
            status: { phase: "emails", progress: progress }
        }
    }
    
    function login(credentials, success, error) {
        var newConn = new EmailConnection();
        newConn.login(credentials, function() {
            store = new mainStore.Account(credentials.username);
            conn = newConn;
            connections.push(newConn);
            success();
            awaitConnectionMonitor.splice(0).forEach(function(callback){ callback(); });
        }, error);
    }

    function accountDone() {
        store.getSyncDate(function(syncDate){
            accountUpdateCallback({ type: "progress", phase: "done", syncDate: syncDate });
        });
    }
    
    function accountError(err) {
        store.getSyncDate(function(syncDate){
            accountUpdateCallback({ type: "progress", phase: "error", error: err, syncDate: syncDate });
        });
    }

    function restartFetchProcess() {
        if (!fetchInProgress) {
            fetch();
        } else {
            restartFetch = true;
        }
    }

    function cancelFetchProcess(success) {
        if (!fetchInProgress) {
            success();
        } else {
            fetchCanceled = true;
            awaitTaskProcessing(success);
        }
    }

    function awaitConnection(success, error) {
        if (conn === null) {
            error("server unavailable");
        } else {
            if (conn) {
                success();
            } else {
                awaitConnectionMonitor.push(success);
            }
        }
    }

    function awaitFetch(success, priority) {
        if (!fetchInProgress) {
            success();
        } else {
            awaitFetchMonitor.push(success);
        }
    }

    function awaitTaskProcessing(success) {
        if (!taskProcessingInProgress) {
            success();
        } else {
            awaitTaskProcessingMonitor.push(success);
        }
    }
}

module.exports = Mailbox;