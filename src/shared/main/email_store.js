function EmailStore(db) {
    var mainStore;
    var accountTable =  "CREATE TABLE IF NOT EXISTS accounts \
                        (  \
                            username TEXT PRIMARY KEY, \
                            password TEXT NOT NULL, \
                            imapHost TEXT NOT NULL, \
                            imapPort INTEGER NOT NULL, \
                            smtpHost TEXT NOT NULL, \
                            smtpPort INTEGER NOT NULL \
                        )"
    var contactTable =  "CREATE TABLE IF NOT EXISTS contacts \
                        ( \
                            name TEXT, \
                            email TEXT NOT NULL UNIQUE \
                        )"
    var folderTable =   "CREATE TABLE IF NOT EXISTS folders \
                        ( \
                            id INTEGER PRIMARY KEY, \
                            parentId INTEGER, \
                            account TEXT NOT NULL, \
                            name TEXT NOT NULL, \
                            unseen INTEGER NOT NULL, \
                            delimiter TEXT NOT NULL, \
                            lastSynced TEXT, \
                            totalSynced INTEGER NOT NULL, \
                            syncAll TEXT \
                        )"
    var folderIndex =   "CREATE UNIQUE INDEX IF NOT EXISTS folder_unique ON folders (parentId, name)"
    var emailTable =    "CREATE TABLE IF NOT EXISTS emails \
                        (\
                            id INTEGER PRIMARY KEY AUTOINCREMENT, \
                            uid INTEGER NOT NULL, \
                            folderId TEXT NOT NULL, \
                            subject TEXT, \
                            senderName TEXT, \
                            senderEmail TEXT, \
                            recipientName TEXT, \
                            recipientEmail TEXT, \
                            ccRecipientNames TEXT, \
                            ccRecipientEmails TEXT, \
                            date TEXT, \
                            text TEXT, \
                            contentType TEXT, \
                            messageId TEXT, \
                            refs TEXT, \
                            attachmentsJSON TEXT, \
                            seen INTEGER NOT NULL \
                        )";
    var emailIndex =    "CREATE UNIQUE INDEX IF NOT EXISTS email_unique ON emails (folderId, uid)"
    var queueTable =    "CREATE TABLE IF NOT EXISTS queue \
                        (\
                            id INTEGER PRIMARY KEY AUTOINCREMENT, \
                            command TEXT NOT NULL, \
                            args TEXT NOT NULL, \
                            account TEXT NOT NULL, \
                            path TEXT, \
                            uid INTEGER \
                        )"
    return mainStore = {
        open: db.open,
        getAccounts: function(success) {
            db.all("SELECT * FROM accounts", [], success);
        },
        createDatabase: function(success) {
            var tableCreateStatements = [accountTable, contactTable, folderTable, emailTable, queueTable].map(function(stmt) { return { text: stmt }; });
            var indexCreateStatements = [folderIndex, emailIndex].map(function(stmt) { return { text: stmt }; });
            runAll(tableCreateStatements, function(){
                runAll(indexCreateStatements, success);
            });
        },
        saveAccount: function(args, success) {
            db.run("INSERT INTO accounts (username, password, imapHost, imapPort, smtpHost, smtpPort) VALUES (?, ?, ?, ?, ?, ?)", [args.username, args.password, args.imapHost, args.imapPort, args.smtpHost, args.smtpPort], success);
        },
        getContacts: function(key, success) {
            key = '%' + escape(key) + '%';
            db.all("SELECT * FROM contacts WHERE name LIKE ? ESCAPE '^' OR email LIKE ? ESCAPE '^'", [key, key], success);
        },
        UnsafeAccount: EmailStoreAccount,
        Account: LockedEmailStoreAccount
    };
    function EmailStoreAccount(account) {
        var store;
        var delimiter;
        return store = {
            account: account,
            getFolders: function(success) {
                db.all("SELECT * FROM folders WHERE account = ?", [account], function(folders){
                    if (folders[0]) {
                        delimiter = folders[0].delimiter;
                    }
                    var defaultMailboxes = ['Inbox', 'Deleted', 'Sent', 'Drafts', 'Junk', 'Archive', 'Notes', 'Outbox'];
                    folders.sort(function(folder1, folder2){
                        var folder1Index = defaultMailboxes.indexOf(folder1.name);
                        var folder2Index = defaultMailboxes.indexOf(folder2.name);
                        if (folder1Index > -1 && folder2Index > -1)
                            return folder1Index - folder2Index;
                        if (folder1Index == -1 && folder2Index == -1)
                            return folder1.name.localeCompare(folder2.name); 
                        return folder2Index - folder1Index;
                    });
                    folders.forEach(function(folder){
                        var curFolder = folder;
                        while (curFolder != null) {
                            folder.path = folder.path ? curFolder.name + folder.delimiter + folder.path : curFolder.name;
                            curFolder = folders.filter(function(f) { return f.id == curFolder.parentId })[0];
                        }
                    });
                    success(folders);
                });
            },
            getFolder: function(id, success) {
                store.getFolders(function(folders){
                    var folder = folders.filter(function(f) { return f.id == id; })[0];
                    success(folder);
                });
            },
            getTrashFolder: function(success) {
                store.getFolders(function(folders){
                    success(folders.filter(function(f) { return f.path == "Deleted"; })[0]);
                });
            },
            saveFolders: function(root, success) {
                db.all("SELECT MAX(id) as maxId FROM folders", [], function(result){
                    var nextId = result[0] ? result[0].maxId + 1 : 1;
                    var foldersList = EmailStore.flattenFolders(root, account, { value: nextId });
                    store.getFolders(function(oldFoldersResult){
                        var oldFolders = oldFoldersResult.map(function(folder) { return folder.path; });
                        var newFolders = foldersList.map(function(obj) { return obj.path; });
                        var stmts = [];
                        var bgStmts = [];
                        foldersList.filter(function(obj) { return oldFolders.indexOf(obj.path) == -1; }).forEach(function(obj){
                            stmts.push(insertInto("folders", obj.folder));
                        });
                        oldFoldersResult.filter(function(f) { return newFolders.indexOf(f.path) == -1; }).forEach(function(folder){
                            stmts.push({ text: "DELETE FROM folders WHERE id = ?", params: [folder.id] });
                            bgStmts.push({ text: "DELETE FROM emails WHERE folderId = ?", params: [folder.id] });
                        });
                        runAll(stmts, function(){
                            success(stmts.length > 0);
                        });
                        runAll(bgStmts, function(){});
                    });
                });
            },
            createFolder: function(parentId, name, success) {
                db.all("SELECT MAX(id) as maxId FROM folders", [], function(result){
                    db.run("INSERT INTO folders (id, parentId, account, name, delimiter, unseen, totalSynced, lastSynced) VALUES (?, ?, ?, ?, ?, 0, 1, ?)", 
                            [result[0] ? result[0].maxId + 1 : 1, parentId, account, name, delimiter, new Date().toISOString()],
                            function(err){
                        if (!err) {
                            store.getFolders(function(folders){
                                success(folders.filter(function(f) { return f.parentId == parentId && f.name == name })[0])
                            });
                        } else {
                            success();
                        }
                    });
                });
            },
            deleteFolder: function(id, success) {
                var stmts = [
                    { text: "DELETE FROM folders WHERE id = ?", params: [id] },
                    { text: "DELETE FROM emails WHERE folderId = ?", params: [id] }
                ];
                runAll(stmts, function(){
                    db.all("SELECT id FROM folders WHERE parentId = ?", [id], function(folders){
                        if (folders.length == 0) {
                            success();
                        } else {
                            var successCount = 0;
                            folders.forEach(function(folder){
                                store.deleteFolder(folder.id, function(){
                                    successCount++;
                                    if (successCount == folders.length) {
                                        success();
                                    }
                                });
                            });
                        }
                    })
                });
            },
            moveFolder: function(id, targetId, success) {
                db.run("UPDATE folders SET parentId = ? WHERE id = ?", [targetId, id], function(err){
                    if (!err) {
                        store.getFolder(id, success);
                    } else {
                        success();
                    }
                });
            },
            renameFolder: function(id, name, success) {
                db.run("UPDATE folders SET name = ? WHERE id = ?", [name, id], function(err){
                    if (!err) {
                        store.getFolder(id, success);
                    } else {
                        success();
                    }
                });
            },
            getEmail: function(id, success) {
                db.all("SELECT " + getColumns(emailTable).filter(function(col) { return col != "text" }).join(',') + " FROM emails WHERE id = ?", [id], function(result){
                    success(result[0]);
                });
            },
            getEmails: function(folderId, offset, size, success) {
                db.all("SELECT " + getColumns(emailTable).filter(function(col) { return col != "text" }).join(',') + " FROM emails WHERE folderId = ? ORDER BY date DESC LIMIT ? OFFSET ?", [folderId, size, offset], function(emails){
                    emails.forEach(function(email){
                        email.attachments = JSON.parse(email.attachmentsJSON);
                        email.ccRecipients = [];
                        if (email.ccRecipientEmails) {
                            var emails = email.ccRecipientEmails.split('\n');
                            var names = email.ccRecipientNames.split('\n');
                            for (var i = 0; i < emails.length; i++) {
                                email.ccRecipients.push({ name: names[i], email: emails[i] });
                            }
                        }
                        delete email.attachmentsJSON;
                        delete email.ccRecipientEmails;
                        delete email.ccRecipientNames;
                    });
                    success(emails);
                });
            },
            getEmailBody: function(emailId, success) {
                db.all("SELECT text FROM emails WHERE id = ?", [emailId], function(result){
                    success(result[0].text);
                });
            },
            saveEmails: function(emails, folderId, success) {
                var reverseEmails = [].concat(emails);
                reverseEmails.reverse();
                var stmts = [];
                reverseEmails.forEach(function(email){
                    stmts.push(insertInto("contacts", { name: email.envelope.from[0].name, email: email.envelope.from[0].address }));
                    stmts.push(insertInto("emails", EmailStore.convertEmail(email, folderId)));
                    if (email.flags.indexOf("\\Seen") == -1) {
                        stmts[stmts.length - 1].after = { text: "UPDATE folders SET unseen = unseen + 1 WHERE id = ?", params: [folderId] };
                    }
                });
                runAll(stmts, success);
            },
            deleteEmail: function(id, success) {
                db.run("DELETE FROM emails WHERE id = ?", [id], success);
            },
            moveEmail: function(id, targetFolderId, success) {
                db.all("SELECT MIN(uid) AS minUid FROM emails", [], function(result1){
                    db.all("SELECT MIN(uid) AS minUid FROM queue", [], function(result2){
                        var nextUid = Math.min.apply(null, result1.concat(result2).map(function(x) { return x.minUid; }).concat([-1]));
                        db.run("UPDATE emails SET uid = ?, folderId = ? WHERE id = ?",  [nextUid, targetFolderId, id], function(){
                            success(nextUid);
                        });
                    });
                });
            },
            setUids: function(uid, targetUid, success) {
                var stmts = [ 
                    { text: "UPDATE emails SET uid = ? WHERE uid = ?", params: [targetUid, uid] }, 
                    { text: "UPDATE queue SET uid = ? WHERE uid = ?", params: [targetUid, uid] }
                ];
                runAll(stmts, success);
            },
            getOldestDate: function(folderId, success) {
                db.all("SELECT MIN(date) AS minDate FROM emails WHERE folderId = ?", [folderId], function(result){
                    success(result[0] ? new Date(result[0].minDate) : null);
                });
            },
            seeEmail: function(id, success) {
                db.all("SELECT * FROM emails WHERE id = ?", [id], function(result){
                    if (!result[0].seen) {
                        var stmts = [
                            { text: "UPDATE emails SET seen = 1 WHERE id = ?", params: [id] },
                            { text: "UPDATE folders SET unseen = unseen - 1 WHERE id = ?", params: [result[0].folderId] }
                        ];
                        runAll(stmts, success || function(){});
                    }
                });
            },
            syncFolder: function(id, success) {
                db.run("UPDATE folders SET lastSynced = ? WHERE id = ?", [new Date().toISOString(), id], success);
            },
            setTotalSynced: function(id, value, success) {
                db.run("UPDATE folders SET totalSynced = ? WHERE id = ?", [value ? 1 : 0, id], success);
            },
            setSyncAll: function(id, success) {
                db.all("SELECT MIN(date) AS minDate FROM emails WHERE folderId = ?", [id], function(result){
                    db.run("UPDATE folders SET syncAll = ? WHERE id = ?", [result[0] && result[0].minDate ? result[0].minDate : new Date().toISOString(), id], success);
                });
            },
            resetSyncAll: function(id, success) {
                db.run("UPDATE folders SET syncAll = NULL WHERE id = ?", [id], success);
            },
            getSyncDate: function(success) {
                db.all("SELECT lastSynced FROM folders WHERE account = ?", [account], function(result){
                    result = result.map(function(row) { return row.lastSynced; });
                    if (result.length == 0 || result.indexOf(null) >= 0) {
                        success(null);
                    } else {
                        result.sort();
                        success(new Date(result[0]));
                    }
                });
            },
            getCommandQueue: function(success) {
                db.all("SELECT * FROM queue WHERE account = ? ORDER BY id", [account], function(result){
                    result.forEach(function(row){
                        row.args = JSON.parse(row.args);
                        if (row.uid != null)
                            row.args.uid = row.uid;
                        if (row.path != null)
                            row.args.path = row.path;
                    });
                    success(result);
                });
            },
            pushCommand: function(command, args, success) {
                var path, uid;
                if (typeof args == "object") {
                    var path = args.path;
                    var uid = args.uid;
                    delete args.path;
                    delete args.uid;
                }
                db.run("INSERT INTO queue (command, args, account, path, uid) VALUES (?, ?, ?, ?, ?)", [command, JSON.stringify(args), account, path, uid], success);
            },
            popCommand: function(id, success) {
                db.all("DELETE FROM queue WHERE id = ?", [id], success);
            }
        };
    }
    function LockedEmailStoreAccount(account) {
        var isLocked;
        var lockMonitor = [];
        function lockObject(obj) {
            var newObj = {};
            Object.keys(obj).forEach(function(key){
                if (typeof obj[key] == 'function') {
                    var fun = obj[key];
                    newObj[key] = function() {
                        var args = Array.prototype.slice.call(arguments);
                        startLock(function(){
                            fun.apply(this, args.slice(0, -1).concat([function(){
                                endLock();
                                args.slice(-1)[0].apply(obj, arguments);
                            }]));
                        });
                    }
                } else {
                    newObj[key] = obj[key];
                }
            });
            return newObj;
        }
        function startLock(success) {
            if (isLocked) {
                lockMonitor.push(success);
            } else {
                isLocked = true;
                success();
            }
        }
        function endLock() {
            if (lockMonitor.length) {
                lockMonitor.splice(0, 1)[0]();
            } else {
                isLocked = false;
            }
        }
        
        return lockObject(EmailStoreAccount(account));
    }

    function insertInto(table, object) {
        var keys = Object.keys(object);
        return {
            text: "INSERT INTO " + table + " (" + keys.join(',') + ") VALUES (" + keys.map(function(){return '?'}).join(',') + ")",
            params: keys.map(function(key){ return object[key]; })
        };
    }

    function getColumns(table) {
        return table.replace(/[\r\n]/g, '').match(/\(.*\)/)[0].slice(1, -1).split(',').map(function(r){return r.split(' ').filter(function(str){return str})[0]})
    }
    
    function runAll(statements, success) {
        var remainingStatements = statements.length;
        var successfulStatements = 0;
        if (remainingStatements == 0) {
            success(0);
        } else {
            statements.forEach(run);
            function run(statement) {
                db.run(statement.text, statement.params, function(err){
                    if (err == undefined || err == null) {
                        successfulStatements++;
                        if (statement.after) {
                            remainingStatements++;
                            run(statement.after);
                        }
                    }
                    remainingStatements--;
                    if (remainingStatements == 0) {
                        success(successfulStatements);
                    }
                });
            }
        }
    }
}
EmailStore.convertEmail = function(email, folderId) {
    if (!email.envelope.to) {
        email.envelope.to = [];
    }
    if (email.envelope.to.length == 0) {
        email.envelope.to.push({ name: null, address: null })
    }
    if (!email.envelope.from) {
        email.envelope.from = [];
    }
    if (email.envelope.from.length == 0) {
        email.envelope.from.push({ name: null, address: null })
    }
    return {
        uid: email.uid, 
        folderId: folderId, 
        subject: email.envelope.subject, 
        senderName: email.envelope.from[0].name, 
        senderEmail: email.envelope.from[0].address, 
        recipientName: email.envelope.to[0].name,
        recipientEmail: email.envelope.to[0].address,
        ccRecipientNames: email.envelope.to.slice(1).map(function(to){ return to.name }).join('\n'),
        ccRecipientEmails: email.envelope.to.slice(1).map(function(to){ return to.address }).join('\n'),
        date: new Date(email.envelope.date).toISOString(), 
        text: email.text,
        contentType: email.contentType,
        messageId: email.envelope['message-id'],
        refs: (email['body[header]'].split("\r\n").filter(function(line){return line.slice(0, 10) == "References"})[0] || "").split(' ').slice(1).join(' '),
        attachmentsJSON: JSON.stringify((email.bodystructure.childNodes || [])
            .filter(function(n) { return n.disposition == "attachment"; })
            .map(function(n) { return { name: n.parameters ? n.parameters.name : n.dispositionParameters.filename, size: n.size, contentType: n.type, part: n.part }; })
        ),
        seen: email.flags.indexOf("\\Seen") != -1
    };
}
EmailStore.emailCompareProperties = ['subject', 'senderEmail', 'recipientEmail', 'ccRecipientEmails', 'date'];
EmailStore.searchEmail = function(targetEmail, emails) {
    return emails.map(EmailStore.convertEmail).filter(function(email){ return EmailStore.emailCompareProperties.every(function(prop){ return email[prop] == targetEmail[prop] }) })[0];
}
EmailStore.flattenFolders = function(folder, account, nextId, parentFolderId) {
    var res = [];
    var currentId = null;
    if (folder.path !== undefined) {
        res.push({
            path: folder.path,
            folder: {
                id: currentId = nextId.value++,
                parentId: parentFolderId,
                account: account, 
                name: folder.name, 
                delimiter: folder.delimiter, 
                unseen: 0, 
                totalSynced: 0
            }
        });
    }
    if (folder.children !== undefined) {
        folder.children.forEach(function(child, i){
            EmailStore.flattenFolders(child, account, nextId, currentId).forEach(function(v){
                res.push(v);
            });
        });
    }
    return res;
}
EmailStore.createFolderTree = function(folders) {
    var root = { children: [], id: null };
    folders.forEach(function(folder){
        if (folder.parentId == null) {
            root.children.push(folder);
        } else {
            var parent = folders.filter(function(f) { return f.id == folder.parentId })[0];
            parent.children = parent.children || [];
            parent.children.push(folder);
        }
    });
    return root;
}


module.exports = EmailStore;