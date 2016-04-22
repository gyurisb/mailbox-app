const sqlite3 = require('sqlite3');
const EmailConnection = require('./email.js');

function Mailbox() {
    var db = new sqlite3.Database('mailbox.db');
    // createDatabase();
    var conn = new EmailConnection();
    return {
        login: function(args, success, error) {
            conn.login(args, success, error);
        },
        getFolders: function(success, error) {
            conn.getFolders(function(root) {
                success(root);
                // saveAllFolder(root);
            }, error);
        },
        getEmails: function(path, success, error) {
            path = path || "Inbox";
            db.all("SELECT * FROM emails WHERE path = ? AND account = ? ORDER BY date DESC LIMIT 9", [path, conn.getAccount()], function(err, cachedEmails) {
                success(cachedEmails.map(deserializeEmail));
            
                conn.getEmails(path, function(emails) {
                    if (cachedEmails.length!=emails.length || !emails.every(function(v,i) { return v.uid === cachedEmails[i].uid})) {
                        success(emails);
                        saveAllEmail(emails, path);
                    }
                }, error);
            });
        },
        getEmailBody: function(uid, success, error) {
            conn.getEmailBody(uid, success, error);
        },
        sendEmail: function(args, success, error) {
            conn.sendEmail(args, success, error);
        },
        contacts: function(key, selector) {
            key = '%' + key + '%';
            db.all("SELECT * FROM contacts WHERE name LIKE ? OR email LIKE ?", [key, key], function(err, contacts){
                selector(contacts);
            });
        },
    };
    
    function saveAllFolder(folder) {
        if (folder.path !== undefined) {
            db.run("INSERT INTO folders (path, account) VALUES (?, ?)", [folder.path, db.getAccount()], function(err, res) {});
        }
        if (folder.children !== undefined) {
            folder.children.forEach(function(child){
               saveAllFolder(child); 
            });
        }
    }
    
    function saveAllEmail(emails, path) {
        var reverseEmails = [].concat(emails);
        reverseEmails.reverse();
        reverseEmails.forEach(function(email){
            db.run("INSERT INTO contacts (name, email) VALUES (?, ?)", [email.envelope.from[0].name, email.envelope.from[0].address], function(err, res) {});
            db.run("INSERT INTO emails (uid, account, path, subject, senderName, senderEmail, date) VALUES (?, ?, ?, ?, ?, ?, ?)", 
                [email.uid, conn.getAccount(), path, email.envelope.subject, email.envelope.from[0].name, email.envelope.from[0].address, new Date(email.envelope.date).toISOString()], 
                function(err, res) {}
            );
        });
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
    
    function createDatabase() {
        db.run("CREATE TABLE contacts (name TEXT, email TEXT NOT NULL UNIQUE)");
        db.run("CREATE TABLE folders (path TEXT NUT NULL, account TEXT NOT NULL)");
        db.run("CREATE TABLE emails (uid NUM NOT NULL PRIMARY KEY, account TEXT NOT NULL, path TEXT NOT NULL, subject TEXT, senderName TEXT, senderEmail TEXT, date TEXT)");
    }
}

module.exports = Mailbox;



// <p>
//     <i class="email-from">{{email.envelope.from[0].name || email.envelope.from[0].address}}</i>
//     <span class="email-date">{{formatEmailDate(email.envelope.date)}}</span>
// </p>
// <h3 class="email-subject">{{email.envelope.subject}}</h3>
//email.uid