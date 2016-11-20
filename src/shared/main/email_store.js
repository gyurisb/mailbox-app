function EmailStore(SQLiteSubsystem, AccountsTable, ContactsTable, EmailsTable, FoldersTable, QueueTable) {
    var store;
    var tables;
    var db = new SQLiteSubsystem('mailbox.db');
    return store = {
        open: function(success) {
            store.accounts = new AccountsTable(store, db);
            store.contacts = new ContactsTable(store, db);
            store.emails = new EmailsTable(store, db);
            store.folders = new FoldersTable(store, db);
            store.queue = new QueueTable(store, db);
            tables = [store.accounts, store.contacts, store.emails, store.folders, store.queue];
            db.open(success);
        },
        createDatabase: function(success) {
            var tableCreateStatements = tables.map(function(table) { return { text: table.createCommand }; });
            var indexCreateStatements = tables.filter(function(table) { return table.indexCommand != null }).map(function(table) { return { text: table.indexCommand }; });
            store.runAll(tableCreateStatements, function(){
                store.runAll(indexCreateStatements, success);
            });
        },
        insertInto: function(table, object) {
            var keys = Object.keys(object);
            return {
                text: "INSERT INTO " + table + " (" + keys.join(',') + ") VALUES (" + keys.map(function(){return '?'}).join(',') + ")",
                params: keys.map(function(key){ return object[key]; })
            };
        },
        getColumns: function(table) {
            return table.replace(/[\r\n]/g, '').match(/\(.*\)/)[0].slice(1, -1).split(',').map(function(r){return r.split(' ').filter(function(str){return str})[0]})
        },
        runAll: function(statements, success) {
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
    };
}


module.exports = EmailStore;