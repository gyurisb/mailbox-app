function FetchProcess(store, fs, events, lock, EmailConnection, ServerCommands) {
    var conn = new EmailConnection();
    var account;
    var serverCommands = new ServerCommands(conn, store, events);
    var loginTasks = [];
    var extraTasks = [];
    var fetchCanceled = false;
    var fetchInProgress = true;
    var restartFetch = false;

    function fetch() {
        fetchInProgress = true;
        restartFetch = false;
        executeTasks([new InitTask(), new FinishTask()], function() { return fetchCanceled; }, function(){
            fetchInProgress = false;
            fetchCanceled = false;
            if (restartFetch) {
                fetch();
            }
        }, function(err){
            executeTasks([new FinishTask(err)], function() { return false; }, function(){}, function(){});
        });
    }

    function executeTasks(tasks, cancel, success, error) {
        var task = tasks.splice(0, 1)[0];
        if (!task) {
            success();
        } else {
            task.status.type = "progress";
            events.accountUpdate(task.status);
            lock.startLock(function(){
                if (!cancel()){
                    var preparing = task.preparing ||  function(success) { success(); };
                    preparing(function(prepResult){
                        lock.endLock();
                        if (!cancel()) {
                            var operation = task.operation || function(arg, success) { success(); };
                            operation(prepResult, function(opResult){
                                lock.startLock(function(){
                                    if (task.forbidCancellation || !cancel()) {
                                        var processing = task.processing ||  function(arg, success) { success(); };
                                        processing(opResult, function(newTasks){
                                            lock.endLock();
                                            if (task.afterExec) {
                                                task.afterExec();
                                            }
                                            tasks = tasks.filter(function(t) { return !t.finishTask }).concat(newTasks || []).concat(tasks.filter(function(t){ return t.finishTask }));
                                            executeTasks(tasks, cancel, success, error);
                                        }, error);
                                    } else {
                                        lock.endLock();
                                        success();
                                    }
                                });
                            }, error);
                        } else {
                            success();
                        }
                    }, error);
                } else {
                    lock.endLock();
                    success();
                }
            });
        }
    }

    function InitTask() {
        return {
            processing: function(args, success, error) {
                store.folders.list(account, function(folders){
                    var syncRequired = folders.length == 0 || folders.some(function(folder) { return !folder.syncDate || folder.syncDate.valueOf() < Date.now() - 5*60*1000; } );
                    store.queue.list(account, function(queue){
                        var commandTasks = queue.map(CommandTask);
                        var folderTasks = syncRequired ? [new FoldersSynchronizationTask()] : [];
                        var tasks = loginTasks.concat(commandTasks).concat(folderTasks).concat(extraTasks);
                        success(tasks);
                    });
                });
            },
            status: { phase: "init", progress: -1 }
        }
    }

    function LoginTask(credentials, firstLogin) {
        return {
            operation: function(args, success, error) {
                conn.login(credentials, function() {
                    events.accountUpdate({ type: "account", email: credentials.username });
                    if (firstLogin) {
                        events.loginFinish({});
                    }
                    success();
                }, function(err){
                    if (firstLogin) {
                        events.loginFinish({ error: err });
                    }
                    error(err);
                });
            },
            processing: function(args, success, error) {
                if (firstLogin) {
                    store.accounts.create(credentials, success);
                } else {
                    success();
                }
            },
            getAccount: function() {
                return credentials.username;
            },
            status: { phase: "login", progress: -1 },
            forbidCancellation: true
        }
    }

    function CommandTask(queueRow) {
        var base = serverCommands[queueRow.command](queueRow.args);
        return {
            operation: base.operation,
            processing: function(arg, success, error) {
                var processing = base.processing || function(arg, success) { success(); };
                processing(arg, function(){
                    store.queue.delete(queueRow.id, function(){
                        success();
                    });
                }, error);
            },
            status: { phase: "commands", command: queueRow.command, progress: -1 },
            forbidCancellation: true
        };
    }

    function FoldersSynchronizationTask() {
        return {
            operation: function(args, success, error) {
                conn.getFolders(success, error);
            },
            processing: function(root, success, error) {
                store.folders.createAll(account, root, function(changed) {
                    if (changed) {
                        events.mailboxUpdate();
                    }
                    store.folders.list(account, function(savedFolders){
                        var outOfDateFolders = savedFolders.filter(function(folder) { return !folder.lastSynced || new Date(folder.lastSynced).valueOf() < Date.now() - 5*60*1000; });
                        success(outOfDateFolders.map(function(folder, i) {
                            var progress = i*100 / outOfDateFolders.length;
                            return folder.lastSynced ? new NewEmailsSynchronizationTask(folder, progress) : new AllEmailsSynchronizationTask(folder, 20, null, progress);
                        }));
                    });
                });
            },
            status: { phase: "folders", progress: -1 }
        }
    }

    function NewEmailsSynchronizationTask(folder, progress) {
        return {
            operation: function(args, success, error) {
                conn.getNewEmails(folder.path, new Date(folder.lastSynced), success, error);
            },
            processing: function(emails, success, error) {
                store.folders.sync(folder.id, function() {
                    store.emails.createAll(emails, folder.id, function(){
                        if (emails.length > 0) {
                            events.folderUpdate(folder);
                            events.mailboxUpdate();
                        }
                        success();
                    });
                });
            },
            status: { phase: "emails", progress: progress }
        }
    }

    function AllEmailsSynchronizationTask(folder, count, lastDate, progress) {
        return {
            operation: function(args, success, error) {
                conn.getLastEmails(folder.path, count, lastDate, success, error);
            },
            processing: function(result, success, error) {
                if (!lastDate) {
                    store.folders.sync(folder.id, afterSync);
                } else {
                    afterSync();
                }
                function afterSync() {
                    store.folders.setTotalSynced(folder.id, !result.hasMore, function(){
                        store.emails.createAll(result.messages, folder.id, function(savedEmailsCount){
                            if (savedEmailsCount > 0) {
                                events.folderUpdate(folder);
                                events.mailboxUpdate();
                            }
                            success();
                            events.accountUpdate({ type: "folderProgress", folder: folder.id, progress: false });
                        });
                    });
                }
            },
            status: { phase: "emails", progress: progress }
        }
    }

    function AttachmentDownloadingTask(emailId, part, destFileName) {
        return {
            preparing: function(success, error) {
                store.emails.get(emailId, function(email){
                    if (email) {
                        store.folders.get(email.folderId, function(folder){
                            email.folder = folder;
                            success(email);
                        });
                    } else {
                        success();
                    }
                });
            },
            operation: function(email, success, error) {
                if (email) {
                    conn.getEmailAttachment(email.folder.path, email.uid, part, function(content){
                        fs.writeFile(destFileName, content, 'base64', function(err){
                            events.downloadFinish({ emailId: emailId, error: err });
                            if (!err) {
                                success();
                            } else {
                                error(err);
                            }
                        });
                    }, function(err){
                        events.downloadFinish({ emailId: emailId, error: err });
                        error(err);
                    });
                } else {
                    success();
                }
            },
            status: { phase: "attachments", progress: -1 }
        }
    }

    function OldEmailsSynchronizationTask(folderId) {
        var base;
        return {
            preparing: function(success, error) {
                store.folders.get(folderId, function(folder) {
                    store.folders.getOldestDate(folder.id, function(oldestDate){
                         base = new AllEmailsSynchronizationTask(folder, 21, oldestDate, -1);
                         success();
                    });
                });
            },
            operation: function(args, success, error) {
                base.operation(args, success, error);
            },
            processing: function(args, success, error) {
                base.processing(args, success, error);
            },
            status: { phase: "emails", progress: -1 }
        }
    }

    function FinishTask(err) {
        return {
            processing: function(args, success, error) {
                store.folders.getSyncDate(function(syncDate){
                    events.accountUpdate({ type: "progress", phase: !err ? "done" : "error", syncDate: syncDate, error: err });
                    success();
                });
            },
            finishTask: true,
            status: { phase: "done" }
        }
    }

    return {
        start: function() {
            fetch();
        },
        restart: function() {
            if (fetchInProgress) {
                fetchCanceled = true;
                restartFetch = true;
            } else {
                fetch();
            }
        },
        setLoginTask: function(loginTask) {
            loginTasks = [loginTask];
            account = loginTask.getAccount();
            loginTask.afterExec = function() {
                loginTasks = [];
            }
        },
        addTask: function(task) {
            extraTasks.push(task);
            task.afterExec = function() {
                extraTasks.splice(extraTasks.indexOf(task), 1);
            }
        },
        getAccount: function() {
            return account;
        },
        LoginTask: LoginTask,
        OldEmailsSynchronizationTask: OldEmailsSynchronizationTask,
        AttachmentDownloadingTask: AttachmentDownloadingTask
    }
}

module.exports = FetchProcess;