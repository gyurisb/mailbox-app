function EmailsTable(store, db) {
    var table;
    var compareProperties = ['subject', 'senderEmail', 'recipientEmail', 'ccRecipientEmails', 'date'];
    return table = {
    
        createCommand: "CREATE TABLE IF NOT EXISTS emails \
                        (\
                            id INTEGER PRIMARY KEY AUTOINCREMENT, \
                            uid INTEGER NOT NULL, \
                            folderId INTEGER NOT NULL, \
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
                        )",
        indexCommand:  "CREATE UNIQUE INDEX IF NOT EXISTS email_unique ON emails (folderId, uid)",

        get: function(id, success) {
            db.all("SELECT " + store.getColumns(table.createCommand).filter(function(col) { return col != "text" }).join(',') + " FROM emails WHERE id = ?", [id], function(result){
                success(result[0]);
            });
        },
        list: function(folderId, offset, size, success) {
            db.all("SELECT " + store.getColumns(table.createCommand).filter(function(col) { return col != "text" }).join(',') + " FROM emails WHERE folderId = ? ORDER BY date DESC LIMIT ? OFFSET ?", [folderId, size, offset], function(emails){
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
        getBody: function(emailId, success) {
            db.all("SELECT text FROM emails WHERE id = ?", [emailId], function(result){
                success(result[0].text);
            });
        },
        createAll: function(emails, folderId, success) {
            var reverseEmails = [].concat(emails);
            reverseEmails.reverse();
            var stmts = [];
            reverseEmails.forEach(function(email){
                stmts.push(store.insertInto("contacts", { name: email.envelope.from[0].name, email: email.envelope.from[0].address }));
                stmts.push(store.insertInto("emails", convert(email, folderId)));
                if (email.flags.indexOf("\\Seen") == -1) {
                    stmts[stmts.length - 1].after = { text: "UPDATE folders SET unseen = unseen + 1 WHERE id = ?", params: [folderId] };
                }
            });
            store.runAll(stmts, success);
        },
        delete: function(id, success) {
            db.run("DELETE FROM emails WHERE id = ?", [id], success);
        },
        move: function(id, targetFolderId, success) {
            db.all("SELECT MIN(uid) AS minUid FROM emails", [], function(result1){
                db.all("SELECT MIN(uid) AS minUid FROM queue", [], function(result2){
                    var nextUid = Math.min.apply(null, result1.concat(result2).map(function(x) { return x.minUid - 1; }).concat([-1]));
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
            store.runAll(stmts, success);
        },
        see: function(id, success) {
            db.all("SELECT * FROM emails WHERE id = ?", [id], function(result){
                if (!result[0].seen) {
                    var stmts = [
                        { text: "UPDATE emails SET seen = 1 WHERE id = ?", params: [id] },
                        { text: "UPDATE folders SET unseen = unseen - 1 WHERE id = ?", params: [result[0].folderId] }
                    ];
                    store.runAll(stmts, success || function(){});
                }
            });
        },
        searchFromList: function(targetEmail, emails) {
            return emails.map(convert).filter(function(email){ return compareProperties.every(function(prop){ return email[prop] == targetEmail[prop] }) })[0];
        },
    }

    function convert(email, folderId) {
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
}

module.exports = EmailsTable;