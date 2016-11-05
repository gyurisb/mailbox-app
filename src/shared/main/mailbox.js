function Mailbox(db, EmailConnection, EmailStore) {
    var mainStore = new EmailStore(db);
    var store;
    var connections = [];
    var conn;
    var folderUpdateCallback = function(){};
    var mailboxUpdateCallback = function(){};
    var accountUpdateCallback = function(){};
    
    return {
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
                    accounts.forEach(function(account){
                        accountUpdateCallback({ type: "progress", phase: "login", progress: -1 });
                        store = new mainStore.Account(account.username);
                        login(account, function(){
                            fetch();
                        }, function(err){
                            error(err);
                            accountUpdateCallback({ type: "progress", phase: "error", error: err });
                        });
                    });
                    if (accounts.length == 0) {
                        success();
                        accountUpdateCallback({ type: "account" });
                    } else {
                        success();
                        accountUpdateCallback({ type: "account", email: accounts[0].username });
                    }
                });
            });
        },
        fetch: function() {
            fetch();
        },
        getFolders: function(success, error) {
            store.getFolders(function(cachedFolders) {
                success(deserializeFolders(cachedFolders));
            });
        },
        getEmails: function(args, success, error) {
            args = args || {};
            args.path = args.path || 'Inbox';
            store.getEmails(args.path, args.offset, args.count, function(cachedEmails) {
                success(cachedEmails);
                if (cachedEmails.length < args.count) {
                    store.getFolder(args.path, function(folder) {
                        if (folder && !folder.totalSynced) {
                            store.getOldestDate(args.path, function(oldestDate){
                                accountUpdateCallback({ type: "folderProgress", folder: args.path, progress: true });
                                fetchAll({ path: args.path }, 21, oldestDate, function(){
                                    accountUpdateCallback({ type: "folderProgress", folder: args.path, progress: false });
                                }); 
                            });
                        }
                    });
                }
            });
        },
        getEmailBody: function(args, success, error) {
            store.getEmailBody(args.path, args.uid, function(body){
                success(body);
            });
            if (!args.seen) {
                store.seeEmail(args.path, args.uid, function(){
                    mailboxUpdateCallback();
                    folderUpdateCallback({ path: args.path });
                });
                conn.setEmailRead(args.path, args.uid, function(){}, accountError);
            }
        },
        sendEmail: function(args, success, error) {
            conn.sendEmail(args, success, error);
        },
        contacts: function(key, selector) {
            mainStore.getContacts(key, selector);
        },
        onFolderUpdate: function(callback) {
            folderUpdateCallback = callback;
        },
        onMailboxUpdate: function(callback) {
            mailboxUpdateCallback = callback;
        },
        onAccountUpdate: function(callback) {
            accountUpdateCallback = callback;
        }
    };

    function fetch() {
        accountUpdateCallback({ type: "progress", phase: "folders", progress: -1 });
        conn.getFolders(function(root) {
            var folders = flattenFolders(root);
            store.saveFolders(folders, function(changed) {
                if (changed) {
                    mailboxUpdateCallback();
                }
                //TODO: ha !changed akkor fölösleges getFolders művelet (mert savedFolders == folders)
                store.getFolders(function(savedFolders){
                    fetchFolders(savedFolders);
                });
            });
        }, accountError);
    }
    
    function fetchFolders(folders, i) {
        i = i || 0;
        if (i >= folders.length) {
            accountDone();
            return;
        }
        accountUpdateCallback({ type: "progress", phase: "emails", progress: i*100 / folders.length });
        var folder = folders[i];
        if (!folder.lastSynced) {
            fetchAll(folder, 20, null, function(){
                fetchFolders(folders, i + 1);
            });
        } else {
            fetchNew(folder, new Date(folder.lastSynced), function(){
                fetchFolders(folders, i + 1);
            });
        }
    }

    function fetchAll(folder, count, lastDate, success) {
        conn.getLastEmails(folder.path, count, lastDate, function(result){
            syncFolderIfRequired(function(){
                success();
                store.setTotalSynced(folder.path, !result.hasMore, function(){
                    store.saveEmails(result.messages, folder.path, function(savedEmailsCount){
                        if (savedEmailsCount > 0) {
                            folderUpdateCallback(folder);
                            mailboxUpdateCallback();
                        }
                    });
                });
            });
        }, accountError);
        function syncFolderIfRequired(success) {
            if (!lastDate) {
                store.syncFolder(folder.path, success);
            } else {
                success();
            }
        }
    }
    
    function fetchNew(folder, firstDate, success) {
        conn.getNewEmails(folder.path, firstDate, function(emails) {
            store.syncFolder(folder.path, function() {
                success();
                store.saveEmails(emails, folder.path, function(){
                    if (emails.length > 0) {
                        folderUpdateCallback(folder);
                        mailboxUpdateCallback();
                    }
                });
            });
        }, accountError);
    }
    
    function login(credentials, success, error) {
        var newConn = new EmailConnection();
        newConn.login(credentials, function() {
            store = new mainStore.Account(credentials.username);
            conn = newConn;
            connections.push(newConn);
            success();
        }, error);
    }

    function accountDone() {
        store.getSyncDate(function(syncDate){
            accountUpdateCallback({ type: "progress", phase: "done", syncDate: syncDate });
        });
    }
    
    function accountError(err) {
        accountUpdateCallback({ type: "progress", phase: "error", error: err });
    }
    
    function flattenFolders(folder) {
        var res = [];
        if (folder.path !== undefined) {
            res.push([store.account + '/' + folder.path, folder.path, store.account, folder.name]);
        }
        if (folder.children !== undefined) {
            folder.children.forEach(function(child){
               flattenFolders(child).forEach(function(v){
                   res.push(v);
               });
            });
        }
        return res;
    }
    
    function deserializeFolders(folders, root, depth) {
        root = root || { children: [], path: "" };
        depth = depth || 0;
        var children = folders.filter(function(f) { return f.path.indexOf(root.path) == 0 && (f.path.match(/\//g)||[]).length == depth; });
        children.forEach(function(child){
            var folder = { children: [], path: child.path, name: child.name, unseen: child.unseen };
            root.children.push(folder);
            deserializeFolders(folders, folder, depth + 1);
        });
        return root;
    }

    // function serializeEmails(emails) {

    // }
    // function deserializeEmails(emails) {

    // }
}

module.exports = Mailbox;