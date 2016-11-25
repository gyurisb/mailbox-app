function AccountsTable(store, db) {
    return {

        createCommand:"CREATE TABLE IF NOT EXISTS accounts \
                        (  \
                            username TEXT PRIMARY KEY, \
                            password TEXT NOT NULL, \
                            imapHost TEXT NOT NULL, \
                            imapPort INTEGER NOT NULL, \
                            smtpHost TEXT NOT NULL, \
                            smtpPort INTEGER NOT NULL, \
                            serverUrl TEXT \
                        )",

        list: function(success) {
            db.all("SELECT * FROM accounts", [], success);
        },
        create: function(args, success) {
            db.run("INSERT INTO accounts (username, password, imapHost, imapPort, smtpHost, smtpPort, serverUrl) VALUES (?, ?, ?, ?, ?, ?, ?)", [args.username, args.password, args.imapHost, args.imapPort, args.smtpHost, args.smtpPort, args.serverUrl], success);
        },
    }
}

module.exports = AccountsTable;