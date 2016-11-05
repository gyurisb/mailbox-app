function EmailStore(db) {
    return {
        open: db.open,
        getAccounts: function(success) {
            db.all("SELECT * FROM accounts", [], success);
        },
        createDatabase: function() {
            db.run(
                "CREATE TABLE IF NOT EXISTS accounts \
                (  \
                    username TEXT NOT NULL PRIMARY KEY, \
                    password TEXT NOT NULL, \
                    imapHost TEXT NOT NULL, \
                    imapPort INT NOT NULL, \
                    smtpHost TEXT NOT NULL, \
                    smtpPort INT NOT NULL \
                )"
            );
            db.run(
                "CREATE TABLE IF NOT EXISTS contacts \
                ( \
                    name TEXT, \
                    email TEXT NOT NULL UNIQUE \
                )"
            );
            db.run(
                "CREATE TABLE IF NOT EXISTS folders \
                ( \
                    id TEXT NOT NULL UNIQUE, \
                    path TEXT NOT NULL, \
                    account TEXT NOT NULL, \
                    name TEXT NOT NULL, \
                    unseen INT NOT NULL, \
                    lastSynced TEXT, \
                    totalSynced INT NOT NULL \
                )"
            );
            db.run(
                "CREATE TABLE IF NOT EXISTS emails \
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
                    attachmentsJSON TEXT, \
                    seen INT NOT NULL \
                )"
            );
        },
        saveAccount: function(args) {
            db.run("INSERT INTO accounts (username, password, imapHost, imapPort, smtpHost, smtpPort) VALUES (?, ?, ?, ?, ?, ?)", [args.username, args.password, args.imapHost, args.imapPort, args.smtpHost, args.smtpPort]);
        },
        getContacts: function(key, success) {
            key = '%' + key + '%';
            db.all("SELECT * FROM contacts WHERE name LIKE ? OR email LIKE ?", [key, key], success);
        },
        Account: EmailStoreAccount
    };
    function EmailStoreAccount(account) {
        return {
            account: account,
            getFolders: function(success) {
                // db.all("SELECT * FROM folders WHERE account = ?", [account], success);
                db.all("SELECT * FROM folders WHERE account = ?", [account], function(folders){
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
            saveFolders: function(foldersList, success) {
                db.all("SELECT * FROM folders WHERE account = ?", [account], function(oldFoldersResult){
                    var oldFolders = oldFoldersResult.map(function(folder) { return folder.path; });
                    var newFolders = foldersList.map(function(folder) { return folder[1]; });
                    var stmts = [];
                    var bgStmts = [];
                    foldersList.filter(function(folder) { return oldFolders.indexOf(folder[1]) == -1; }).forEach(function(folder){
                        stmts.push({ text: "INSERT INTO folders (id, path, account, name, unseen, totalSynced) VALUES (?, ?, ?, ?, 0, 0)", params: folder }); 
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
            getEmails: function(path, offset, size, success) {
                db.all("SELECT uid,account,path,subject,senderName,senderEmail,recipientName,recipientEmail,ccRecipientNames,ccRecipientEmails,date,contentType,attachmentsJSON,seen FROM emails WHERE path = ? AND account = ? ORDER BY date DESC LIMIT ? OFFSET ?", [path, account, size, offset], function(emails){
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
                    stmts.push({ text: "INSERT INTO contacts (name, email) VALUES (?, ?)", params: [email.envelope.from[0].name, email.envelope.from[0].address] });
                    stmts.push({
                        text: "INSERT INTO emails \
                               (id, uid, account, path, subject, senderName, senderEmail, recipientName, recipientEmail, ccRecipientNames, ccRecipientEmails, date, text, contentType, attachmentsJSON, seen) \
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", 
                        params: [
                            account + "/" + path + "/" + email.uid, 
                            email.uid, 
                            account, 
                            path, 
                            email.envelope.subject, 
                            email.envelope.from[0].name, 
                            email.envelope.from[0].address, 
                            email.envelope.to[0].name,
                            email.envelope.to[0].address,
                            email.envelope.to.slice(1).map(function(to){ return to.name }).join('\n'),
                            email.envelope.to.slice(1).map(function(to){ return to.address }).join('\n'),
                            new Date(email.envelope.date).toISOString(), 
                            email.text,
                            email.contentType,
                            JSON.stringify((email.bodystructure.childNodes || [])
                                .filter(function(n) { return n.disposition == "attachment"; })
                                .map(function(n) { return { name: n.parameters ? n.parameters.name : n.dispositionParameters.filename, size: n.size, contentType: n.type, part: n.part }; })
                            ),
                            email.flags.indexOf("\\Seen") != -1
                        ]
                    });
                    if (email.flags.indexOf("\\Seen") == -1) {
                        stmts[stmts.length - 1].after = {
                            text: "UPDATE folders SET unseen = unseen + 1 WHERE account = ? AND path = ?",
                            params: [account, path]
                        };
                    }
                });
                runAll(stmts, success || function(){});
            },
            getLastUid: function(path, success) {
                db.all("SELECT MAX(uid) AS lastUid FROM emails WHERE account = ? AND path = ?", [account, path], function(result) {
                    success(result[0].lastUid);
                });
            },
            getOldestDate: function(path, success) {
                db.all("SELECT COUNT(*) AS count FROM emails WHERE account = ? AND path = ?", [account, path], function(result){
                    if (result[0].count == 0) {
                        success(null);
                    } else {
                        db.all("SELECT MIN(date) AS minDate FROM emails WHERE account = ? AND path = ?", [account, path], function(result){
                            success(new Date(result[0].minDate));
                        });
                    }
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
            getSyncDate: function(success) {
                db.all("SELECT MIN(lastSynced) AS syncDate FROM folders WHERE account = ?", [account], function(result){
                    success(new Date(result[0].syncDate));
                });
            }
        }
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


module.exports = EmailStore;