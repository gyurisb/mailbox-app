function EmailStore(db) {
    return {
        open: db.open,
        getAccounts: function(success) {
            db.all("SELECT * FROM accounts", [], success);
        },
        createDatabase: function() {
            db.run("CREATE TABLE IF NOT EXISTS accounts (username TEXT NOT NULL PRIMARY KEY, password TEXT NOT NULL, imapHost TEXT NOT NULL, imapPort INT NOT NULL, smtpHost TEXT NOT NULL, smtpPort INT NOT NULL)");
            db.run("CREATE TABLE IF NOT EXISTS contacts (name TEXT, email TEXT NOT NULL UNIQUE)");
            db.run("CREATE TABLE IF NOT EXISTS folders (id TEXT NOT NULL UNIQUE, path TEXT NOT NULL, account TEXT NOT NULL, name TEXT NOT NULL)");
            db.run("CREATE TABLE IF NOT EXISTS emails (id TEXT NOT NULL UNIQUE, uid NUM NOT NULL, account TEXT NOT NULL, path TEXT NOT NULL, subject TEXT, senderName TEXT, senderEmail TEXT, date TEXT)");
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
                    var defaultMailboxes = ['Inbox', 'Deleted', 'Sent', 'Drafts', 'Junk', 'Archive'];
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
            saveFolders: function(foldersList, success) {
                db.all("SELECT * FROM folders WHERE account = ?", [account], function(oldFoldersResult){
                    var oldFolders = oldFoldersResult.map(function(folder) { return folder.path; });
                    var newFolders = foldersList.map(function(folder) { return folder[1]; });
                    var stmts = [];
                    var bgStmts = [];
                    foldersList.filter(function(folder) { return oldFolders.indexOf(folder[1]) == -1; }).forEach(function(folder){
                        stmts.push({ text: "INSERT INTO folders (id, path, account, name) VALUES (?, ?, ?, ?)", params: folder }); 
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
                db.all("SELECT * FROM emails WHERE path = ? AND account = ? ORDER BY date DESC LIMIT ? OFFSET ?", [path, account, size, offset], success);
            },    
            saveEmails: function(emails, path, success) {
                var reverseEmails = [].concat(emails);
                reverseEmails.reverse();
                var stmts = [];
                reverseEmails.forEach(function(email){
                    stmts.push({ text: "INSERT INTO contacts (name, email) VALUES (?, ?)", params: [email.envelope.from[0].name, email.envelope.from[0].address] });
                    stmts.push({
                        text: "INSERT INTO emails (id, uid, account, path, subject, senderName, senderEmail, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", 
                        params: [account + "/" + path + "/" + email.uid, email.uid, account, path, email.envelope.subject, email.envelope.from[0].name, email.envelope.from[0].address, new Date(email.envelope.date).toISOString()]
                    });
                });
                runAll(stmts, success || function(){});
            },
            getLastUid: function(path, success) {
                db.all("SELECT MAX(uid) AS lastUid FROM emails WHERE path = ? AND account = ?", [path, account], function(result) {
                    success(result[0].lastUid);
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
            statements.forEach(function(statement){
                db.run(statement.text, statement.params, function(err){
                    if (err == undefined || err == null) {
                        successfulStatements++;
                    }
                    remainingStatements--;
                    if (remainingStatements == 0) {
                        success(successfulStatements);
                    }
                }); 
            });
        }
    }
}


module.exports = EmailStore;