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
    var emailUpdateCallback = function(){};
    var folderPathUpdateCallback = function(){};
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
                                    store.setUids(args.targetPath, args.email.uid, checkEmail.uid, function(){
                                        success();
                                        emailUpdateCallback({ oldPath: args.targetPath, oldUid: args.email.uid, newPath: args.targetPath, newUid: checkEmail.uid });
                                        folderUpdateCallback({ path: args.targetPath });
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
                success();
                accountUpdateCallback({ type: "account", email: credentials.username });
                mainStore.saveAccount(credentials);
                fetch();
            }, error);
        },
        restore: function(success, error) {
            mainStore.open(function(){
                mainStore.createDatabase();
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
        },
        getFolders: function(success, error) {
            store.getFolders(function(cachedFolders) {
                success(EmailStore.createFolderTree(cachedFolders));
            });
        },
        createFolder: function(parentFolder, name, success, error) {
            cancelFetchProcess(function(){
                var path = parentFolder ? parentFolder.path + parentFolder.delimiter + name : name;
                store.createFolder(path, name, function(err){
                    if (!err) {
                        success();
                        mailboxUpdateCallback();
                        store.pushCommand('createFolder', { path: path }, executeCommandsAsync);
                    } else {
                        error({ type: "folderDuplicate", message: "Folder with the given name already exists." });
                    }
                });
            });
        },
        moveFolder: function(folder, targetFolder, success, error) {
            cancelFetchProcess(function(){
                var targetRoute = targetFolder ? targetFolder.path.split(targetFolder.delimiter) : [];
                var folderId = folder.path.split(folder.delimiter).slice(-1);
                var newPath = targetRoute.concat(folderId).join(folder.delimiter);
                //TODO leállítani a FETCH folyamatot és újraindítani
                store.moveFolder(folder.path, newPath, folder.name, function(err){
                    if (!err) {
                        success();
                        mailboxUpdateCallback();
                        folderPathUpdateCallback({ oldPath: folder.path, newPath: newPath, delimiter: folder.delimiter });
                        store.pushCommand('movefolder', { path: folder.path, newPath: newPath }, executeCommandsAsync);
                    } else {
                        error({ type: "folderDuplicate", message: "Folder with the given name already exists." });
                    }
                });
            });
        },
        renameFolder: function(folder, name, success, error) {
            cancelFetchProcess(function(){
                var newPath = folder.path.split(folder.delimiter).slice(0, -1).concat([name]).join(folder.delimiter);
                store.moveFolder(folder.path, newPath, name, function(err){
                    if (!err) {
                        success();
                        mailboxUpdateCallback();
                        folderPathUpdateCallback({ oldPath: folder.path, newPath: newPath, delimiter: folder.delimiter });
                        store.pushCommand('movefolder', { path: folder.path, newPath: newPath }, executeCommandsAsync);
                    } else {
                        error({ type: "folderDuplicate", message: "Folder with the given name already exists." });
                    }
                });
            });
        },
        deleteFolder: function(folder, success, error) {
            cancelFetchProcess(function(){
                store.deleteFolder(folder.path, function(){
                    success();
                    mailboxUpdateCallback();
                    folderPathUpdateCallback({ oldPath: folder.path, delimiter: folder.delimiter });
                });
                store.pushCommand('deleteFolder', { path: folder.path }, executeCommandsAsync);
            });
        },
        getEmails: function(path, offset, count, success, error) {
            store.getEmails(path, offset, count, function(cachedEmails) {
                success(cachedEmails);
                if (cachedEmails.length < count) {
                    store.getFolder(path, function(folder) {
                        if (folder && !folder.totalSynced) {
                            accountUpdateCallback({ type: "folderProgress", folder: path, progress: true });
                            cancelFetchProcess(function(){
                                store.setSyncAll(path, executeCommandsAsync);
                            });
                        }
                    });
                }
            });
        },
        getEmailBody: function(path, uid, seen, success, error) {
            store.getEmailBody(path, uid, function(body){
                success(body);
            });
            if (!seen) {
                cancelFetchProcess(function(){
                    store.seeEmail(path, uid, function(){
                        mailboxUpdateCallback();
                        folderUpdateCallback({ path: path });
                    });
                    store.pushCommand('setEmailRead', { path: path, uid: uid }, executeCommandsAsync);
                });
            }
        },
        getEmailAttachment: function(path, uid, part, destFileName, success, error) {
            if (uid >= 0) {
                awaitConnection(function(){
                    conn.getEmailAttachment(path, uid, part, function(content){
                        fs.writeFile(destFileName, content, 'base64', function(err){
                            if (err) {
                                error(err);
                            } else {
                                success();
                            }
                        });
                    }, error);
                }, error);
            } else {
                error({ type: "emailModifyInProgress", message: "An operation is pending on the selected email." });
            }
        },
        deleteEmail: function(path, uid, success, error) {
            cancelFetchProcess(function(){
                if (path != "Deleted") {
                    mailbox.moveEmail(path, uid, "Deleted", success, error);
                } else {
                    store.deleteEmail(path, uid, function(){
                        folderUpdateCallback({ path: path });
                        success();
                    });
                    store.pushCommand('deleteEmail', { path: path, uid: uid }, executeCommandsAsync);
                }
            });
        },
        moveEmail: function(path, uid, targetPath, success, error) {
            cancelFetchProcess(function(){
                store.getFolder(targetPath, function(targetFolder){
                    store.getOldestDate(targetPath, function(targetOldestDate){
                        store.getEmailProperties(path, uid, function(email){
                            if (targetFolder.totalSynced || targetOldestDate < new Date(email.date)) {
                                store.moveEmail(path, uid, targetPath, function(newUid){
                                    email.uid = newUid;
                                    store.pushCommand('moveEmail', { path: path, targetPath: targetPath, email: email }, executeCommandsAsync);
                                    success();
                                    folderUpdateCallback({ path: path });
                                    folderUpdateCallback({ path: targetPath });
                                    emailUpdateCallback({ oldPath: path, oldUid: uid, newPath: targetPath, newUid: newUid });
                                    mailboxUpdateCallback();
                                });
                            } else {
                                store.deleteEmail(path, uid, success);
                                email.uid = null;
                                store.pushCommand('moveEmail', { path: path, targetPath: targetPath, email: email }, executeCommandsAsync);
                            }
                        });
                    });
                });
            });
        },
        sendEmail: function(message, success, error) {
            message.attachments.forEach(function(attachment){
                if (attachment.type == "file") {
                    var bitmap = fs.readFileSync(attachment.path);
                    attachment.data = Buffer(bitmap).toString('base64');
                }
            });
            cancelFetchProcess(function(){
                store.pushCommand('sendEmail', message, executeCommandsAsync);
                success();
            });
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
        },
        onEmailUpdate: function(callback) {
            emailUpdateCallback = callback;
        },
        onFolderPathUpdate: function(callback) {
            folderPathUpdateCallback = callback;
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
                store.syncFolder(folder.path, function() {
                    store.saveEmails(emails, folder.path, function(){
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
                    store.syncFolder(folder.path, afterSync);
                } else {
                    afterSync();
                }
                function afterSync() {
                    store.setTotalSynced(folder.path, !result.hasMore, function(){
                        store.saveEmails(result.messages, folder.path, function(savedEmailsCount){
                            if (savedEmailsCount > 0) {
                                folderUpdateCallback(folder);
                                mailboxUpdateCallback();
                            }
                            store.resetSyncAll(folder.path, function(){
                                success();
                                accountUpdateCallback({ type: "folderProgress", folder: folder.path, progress: false });
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

    function executeCommandsAsync() {
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