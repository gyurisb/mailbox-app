function QueueTable(store, db) {
    return {
        
        createCommand: "CREATE TABLE IF NOT EXISTS queue \
                        (\
                            id INTEGER PRIMARY KEY AUTOINCREMENT, \
                            command TEXT NOT NULL, \
                            args TEXT NOT NULL, \
                            account TEXT NOT NULL, \
                            path TEXT, \
                            uid INTEGER \
                        )",

        list: function(account, success) {
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
        create: function(command, account, args, success) {
            var path, uid;
            if (typeof args == "object") {
                var path = args.path;
                var uid = args.uid;
                delete args.path;
                delete args.uid;
            }
            db.run("INSERT INTO queue (command, args, account, path, uid) VALUES (?, ?, ?, ?, ?)", [command, JSON.stringify(args), account, path, uid], success);
        },
        delete: function(id, success) {
            db.all("DELETE FROM queue WHERE id = ?", [id], success);
        }
        
    }
}

module.exports = QueueTable;