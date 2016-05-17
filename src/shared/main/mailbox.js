function Mailbox(db, EmailConnection, EmailStore) {
    var mainStore = new EmailStore(db);
    var store;
    var connections = [];
    var conn;
    var folderUpdateCallback = function(){};
    var mailboxUpdateCallback = function(){};
    
    return {
        login: function(credentials, success, error) {
            login(credentials, function() {
                //TODO értesíteni a főablakot hogy bejelentkezés történt
                success();
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
                        store = new mainStore.Account(account.username);
                        login(account, function(){
                            fetch();
                        }, error);
                    });
                    if (accounts.length == 0) {
                        success();
                    } else {
                        success(accounts[0].username);
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
            args.page = args.page || 0;
            store.getEmails(args.path, args.page*9, 9, function(cachedEmails) {
                success(cachedEmails.map(deserializeEmail));
                if (cachedEmails.length < 9) {
                    fetchAll({ path: args.path, progress: -1 }, args.page*9, 50, function(){});
                }
            });
        },
        getEmailBody: function(args, success, error) {
            if (conn !== undefined) {
                conn.getEmailBody(args.uid, args.path, success, error);
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
        }
    };
    
    function fetch() {
        conn.getFolders(function(root) {
            var folders = flattenFolders(root);
            store.saveFolders(folders, function(changed) {
                if (changed) {
                    mailboxUpdateCallback();
                }
                //TODO: fölösleges újratöltés művelet, ha nincs módosítás
                store.getFolders(function(savedFolders){
                    fetchFolders(savedFolders);
                });
            });
        }, function(){});
    }
    
    function fetchFolders(folders, i) {
        i = i || 0;
        if (i >= folders.length)
            return;
        var folder = folders[i];
        folder.progress = (i + 1)*100 / folders.length;
        store.getLastUid(folder.path, function(lastUid){
            if (lastUid === undefined || lastUid === null) {
                fetchAll(folder, 0, 100, function(){
                    fetchFolders(folders, i + 1);
                });
            } else {
                fetchNew(folder, lastUid, function(){
                    fetchFolders(folders, i + 1);
                });
            }
        });
    }
    
    function fetchAll(folder, offset, count, success) {
        conn.getEmails(folder.path, offset, count, function(emails){
            success();
            store.saveEmails(emails, folder.path, function(savedEmailsCount){
                folderUpdateCallback({folder: folder, changed: savedEmailsCount > 0 });
            });
        });
    }
    
    function fetchNew(folder, lastUid, success) {
        conn.getEmailsAfterUid(folder.path, lastUid, function(emails) {
            success();
            store.saveEmails(emails, folder.path, function(){
                folderUpdateCallback({folder: folder, changed: emails.length > 0 });
            });
        }, function(){});
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
            var folder = { children: [], path: child.path, name: child.name };
            root.children.push(folder);
            deserializeFolders(folders, folder, depth + 1);
        });
        return root;
    }
    
    function deserializeEmail(email) {
        return {
            uid: email.uid,
            envelope: {
                date: email.date,
                subject: email.subject,
                from: [{
                    name: email.senderName,
                    address: email.senderEmail
                }]
            }
        };
    }
}

module.exports = Mailbox;