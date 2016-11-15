function EmailStore(db) {
    var accountTable =  "CREATE TABLE IF NOT EXISTS accounts \
                        (  \
                            username TEXT NOT NULL PRIMARY KEY, \
                            password TEXT NOT NULL, \
                            imapHost TEXT NOT NULL, \
                            imapPort INT NOT NULL, \
                            smtpHost TEXT NOT NULL, \
                            smtpPort INT NOT NULL \
                        )"
    var contactTable =  "CREATE TABLE IF NOT EXISTS contacts \
                        ( \
                            name TEXT, \
                            email TEXT NOT NULL UNIQUE \
                        )"
    var folderTable =   "CREATE TABLE IF NOT EXISTS folders \
                        ( \
                            id TEXT NOT NULL UNIQUE, \
                            path TEXT NOT NULL, \
                            account TEXT NOT NULL, \
                            name TEXT NOT NULL, \
                            unseen INT NOT NULL, \
                            delimiter TEXT NOT NULL, \
                            lastSynced TEXT, \
                            totalSynced INT NOT NULL, \
                            syncAll TEXT \
                        )"
    var emailTable =    "CREATE TABLE IF NOT EXISTS emails \
                        (\
                            id TEXT NOT NULL UNIQUE, \
                            uid NUM NOT NULL, \
                            account TEXT NOT NULL, \
                            path TEXT NOT NULL, \
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
                            seen INT NOT NULL \
                        )";
    var queueTable =    "CREATE TABLE IF NOT EXISTS queue \
                        (\
                            id INT NOT NULL UNIQUE, \
                            command TEXT NOT NULL, \
                            args TEXT NOT NULL, \
                            account TEXT NOT NULL, \
                            path TEXT, \
                            uid NUM \
                        )"
    return {
        open: db.open,
        getAccounts: function(success) {
            db.all("SELECT * FROM accounts", [], success);
        },
        createDatabase: function() {
            db.run(accountTable);
            db.run(contactTable);
            db.run(folderTable);
            db.run(emailTable);
            db.run(queueTable);
        },
        saveAccount: function(args) {
            db.run("INSERT INTO accounts (username, password, imapHost, imapPort, smtpHost, smtpPort) VALUES (?, ?, ?, ?, ?, ?)", [args.username, args.password, args.imapHost, args.imapPort, args.smtpHost, args.smtpPort]);
        },
        getContacts: function(key, success) {
            key = '%' + escape(key) + '%';
            db.all("SELECT * FROM contacts WHERE name LIKE ? ESCAPE '^' OR email LIKE ? ESCAPE '^'", [key, key], success);
        },
        UnsafeAccount: EmailStoreAccount,
        Account: LockedEmailStoreAccount
    };
    function EmailStoreAccount(account) {
        var delimiter;
        return {
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
                            return folder1.path.localeCompare(folder2.path); 
                        return folder2Index - folder1Index;
                    });
                    success(folders);
                });
            },
            getFolder: function(path, success) {
                db.all("SELECT * FROM folders WHERE account = ? AND path = ?", [account, path], function(folders) {
                    success(folders[0]);
                });
            },
            saveFolders: function(root, success) {
                var foldersList = EmailStore.flattenFolders(root, account);
                db.all("SELECT * FROM folders WHERE account = ?", [account], function(oldFoldersResult){
                    var oldFolders = oldFoldersResult.map(function(folder) { return folder.path; });
                    var newFolders = foldersList.map(function(folder) { return folder.path; });
                    var stmts = [];
                    var bgStmts = [];
                    foldersList.filter(function(folder) { return oldFolders.indexOf(folder.path) == -1; }).forEach(function(folder){
                        stmts.push(insertInto("folders", folder));
                    });
                    oldFolders.filter(function(folderPath) { return newFolders.indexOf(folderPath) == -1; }).forEach(function(folderPath){
                        stmts.push({ text: "DELETE FROM folders WHERE path = ? AND account = ?", params: [folderPath, account] });
                        bgStmts.push({ text: "DELETE FROM emails WHERE path = ? AND account = ?", params: [folderPath, account] });
                    });
                    runAll(stmts, function(){
                        if (success !== undefined)
                            success(stmts.length > 0);
                    });
                    runAll(bgStmts, function(){});
                });
            },
            createFolder: function(path, name, success) {
                db.run("INSERT INTO folders (id, path, account, name, delimiter, unseen, totalSynced, lastSynced) VALUES (?, ?, ?, ?, ?, 0, 1, ?)", 
                        [account + '/' + path.toLowerCase(), path, account, name, delimiter, new Date().toISOString()],
                        success);
            },
            deleteFolder: function(path, success) {
                var stmts = [
                    { text: "DELETE FROM folders WHERE (path LIKE ? ESCAPE '^' OR path = ?) AND account = ?", params: [escape(path + delimiter) + '%', path, account] },
                    { text: "DELETE FROM emails WHERE (path LIKE ? ESCAPE '^' OR path = ?) AND account = ?", params: [escape(path + delimiter) + '%', path, account] }
                ];
                runAll(stmts, success);
            },
            moveFolder: function(path, targetPath, targetName, success) {
                db.run("UPDATE folders SET id = ?, path = ?, name = ? WHERE path = ? AND account = ?", [account + '/' + targetPath.toLowerCase(), targetPath, targetName, path, account], function(err){
                    if (!err) {
                        db.all("SELECT path FROM folders WHERE path LIKE ? ESCAPE '^' AND account = ?", [escape(path + delimiter) + '%', account], function(folders){
                            db.all("SELECT path, uid FROM emails WHERE (path LIKE ? ESCAPE '^' OR path = ?) AND account = ?", [escape(path + delimiter) + '%', path, account], function(emails){
                                var stmts = folders.map(function(folder) {
                                    var newPath = folder.path.replace(path, targetPath);
                                    return { 
                                        text: "UPDATE folders SET id = ?, path = ? WHERE path = ? AND account = ?", 
                                        params: [account + '/' + newPath.toLowerCase(), newPath, folder.path, account] 
                                    };
                                }).concat(emails.map(function(email){
                                    var newPath = email.path.replace(path, targetPath);
                                    return { 
                                        text: "UPDATE emails SET id = ?, path = ? WHERE path = ? AND uid = ? AND account = ?", 
                                        params: [account + "/" + newPath + "/" + email.uid, newPath, email.path, email.uid, account]
                                    };
                                }));
                                runAll(stmts, function(res){
                                    success(res == stmts.length ? undefined : "error"); 
                                });
                            });
                        });
                    } else {
                        success(err);
                    }
                });
            },
            getEmails: function(path, offset, size, success) {
                var columns = emailTable.replace(/[\r\n]/g, '').match(/\(.*\)/)[0].slice(1, -1).split(',').map(function(r){return r.split(' ').filter(function(str){return str})[0]}).filter(function(col) { return col != "text" });
                db.all("SELECT " + columns.join(',') + " FROM emails WHERE path = ? AND account = ? ORDER BY date DESC LIMIT ? OFFSET ?", [path, account, size, offset], function(emails){
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
            getEmailBody: function(path, uid, success) {
                db.all("SELECT text FROM emails WHERE account = ? AND path = ? AND uid = ?", [account, path, uid], function(result){
                    success(result[0].text);
                });
            },
            saveEmails: function(emails, path, success) {
                var reverseEmails = [].concat(emails);
                reverseEmails.reverse();
                var stmts = [];
                reverseEmails.forEach(function(email){
                    stmts.push(insertInto("contacts", { name: email.envelope.from[0].name, email: email.envelope.from[0].address }));
                    stmts.push(insertInto("emails", EmailStore.convertEmail(email, account, path)));
                    if (email.flags.indexOf("\\Seen") == -1) {
                        stmts[stmts.length - 1].after = {
                            text: "UPDATE folders SET unseen = unseen + 1 WHERE account = ? AND path = ?",
                            params: [account, path]
                        };
                    }
                });
                runAll(stmts, success);
            },
            deleteEmail: function(path, uid, success) {
                db.run("DELETE FROM emails WHERE account = ? AND path = ? AND uid = ?", [account, path, uid], success);
            },
            moveEmail: function(path, uid, targetPath, success) {
                db.all("SELECT MIN(uid) AS minUid FROM emails WHERE account = ?", [account], function(result){
                    var nextUid = result[0] ? Math.min(result[0].minUid - 1, -1) : -1;
                    db.run("UPDATE emails SET id = ?, uid = ?, path = ? WHERE account = ? AND path = ? AND uid = ?",  [account + "/" + targetPath + "/" + nextUid, nextUid, targetPath, account, path, uid], function(){
                        success(nextUid);
                    });
                });
            },
            getEmailProperties: function(path, uid, success) {
                db.all("SELECT "+ EmailStore.emailCompareProperties.concat(['uid']).join(',') + " FROM emails WHERE account = ? AND path = ? AND uid = ?", [account, path, uid], function(result){
                    success(result[0]);
                });
            },
            setUids: function(path, uid, targetUid, success) {
                var stmts = [ 
                    { text: "UPDATE emails SET id = ?, uid = ? WHERE account = ? AND path = ? AND uid = ?", params: [account + "/" + path + "/" + targetUid, targetUid, account, path, uid] }, 
                    { text: "UPDATE queue SET uid = ? WHERE account = ? AND path = ? AND uid = ?", params: [targetUid, account, path, uid] }
                ];
                runAll(stmts, success);
            },
            getLastUid: function(path, success) {
                db.all("SELECT MAX(uid) AS lastUid FROM emails WHERE account = ? AND path = ?", [account, path], function(result) {
                    success(result[0].lastUid);
                });
            },
            getOldestDate: function(path, success) {
                db.all("SELECT MIN(date) AS minDate FROM emails WHERE account = ? AND path = ?", [account, path], function(result){
                    success(result[0] ? new Date(result[0].minDate) : null);
                });
            },
            seeEmail: function(path, uid, success) {
                db.all("SELECT * FROM emails WHERE account = ? AND path = ? AND uid = ?", [account, path, uid], function(result){
                    if (!result[0].seen) {
                        var stmts = [
                            { text: "UPDATE emails SET seen = 1 WHERE account = ? AND path = ? and uid = ?", params: [account, path, uid] },
                            { text: "UPDATE folders SET unseen = unseen - 1 WHERE account = ? AND path = ?", params: [account, path] }
                        ];
                        runAll(stmts, success || function(){});
                    }
                });
            },
            syncFolder: function(path, success) {
                db.run("UPDATE folders SET lastSynced = ? WHERE account = ? AND path = ?", [new Date().toISOString(), account, path], success);
            },
            setTotalSynced: function(path, value, success) {
                db.run("UPDATE folders SET totalSynced = ? WHERE account = ? AND path = ?", [value ? 1 : 0, account, path], success);
            },
            setSyncAll: function(path, success) {
                db.all("SELECT MIN(date) AS minDate FROM emails WHERE account = ? AND path = ?", [account, path], function(result){
                    db.run("UPDATE folders SET syncAll = ? WHERE account = ? AND path = ?", [result[0] && result[0].minDate ? result[0].minDate : new Date().toISOString(), account, path], success);
                });
            },
            resetSyncAll: function(path, success) {
                db.run("UPDATE folders SET syncAll = NULL WHERE account = ? AND path = ?", [account, path], success);
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
                db.all("SELECT MAX(id) AS maxId FROM queue WHERE account = ?", [account], function(result){
                    var nextId = result.length ? result[0].maxId + 1 : 0;
                    var path, uid;
                    if (typeof args == "object") {
                        var path = args.path;
                        var uid = args.uid;
                        delete args.path;
                        delete args.uid;
                    }
                    db.run("INSERT INTO queue (id, command, args, account, path, uid) VALUES (?, ?, ?, ?, ? ,?)", [nextId, command, JSON.stringify(args), account, path, uid], success);
                });
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

    function escape(str) {
        return str.replace(/\^/g, '^^').replace(/_/g, '^_').replace(/%/g, '^%');
    }
}
EmailStore.convertEmail = function(email, account, path) {
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
        id: account + "/" + path + "/" + email.uid, 
        uid: email.uid, 
        account: account, 
        path: path, 
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
EmailStore.flattenFolders = function(folder, account) {
    var res = [];
    if (folder.path !== undefined) {
        res.push({
            id: account + '/' + folder.path.toLowerCase(), 
            path: folder.path,
            account: account, 
            name: folder.name, 
            delimiter: folder.delimiter, 
            unseen: 0, 
            totalSynced: 0 
        });
    }
    if (folder.children !== undefined) {
        folder.children.forEach(function(child){
            EmailStore.flattenFolders(child, account).forEach(function(v){
                res.push(v);
            });
        });
    }
    return res;
}
EmailStore.createFolderTree = function(folders, root, depth) {
    root = root || { children: [], path: "" };
    depth = depth || 1;
    var children = folders.filter(function(f) { return (root.path == "" || f.path.indexOf(root.path + root.delimiter) == 0) && f.path.split(f.delimiter).length == depth });
    children.forEach(function(child){
        child.children = [];
        root.children.push(child);
        EmailStore.createFolderTree(folders, child, depth + 1);
    });
    return root;
}


module.exports = EmailStore;