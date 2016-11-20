function FoldersTable(store, db) {
    var table;
    return table = {

        createCommand: "CREATE TABLE IF NOT EXISTS folders \
                        ( \
                            id INTEGER PRIMARY KEY, \
                            parentId INTEGER, \
                            account TEXT NOT NULL, \
                            name TEXT NOT NULL, \
                            unseen INTEGER NOT NULL, \
                            delimiter TEXT NOT NULL, \
                            lastSynced TEXT, \
                            totalSynced INTEGER NOT NULL \
                        )",
        indexCommand:   "CREATE UNIQUE INDEX IF NOT EXISTS folder_unique ON folders (parentId, name)",

        list: function(account, success) {
            var query = "SELECT * FROM folders";
            var params = [];
            if (account) {
                query = "SELECT * FROM folders WHERE account = ?";
                params = [account];
            }
            db.all(query, params, function(folders){
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
        getTree: function(success) {
            table.list(null, function(folders){
                success(createFolderTree(folders));
            });
        },
        get: function(id, success) {
            table.list(null, function(folders){
                var folder = folders.filter(function(f) { return f.id == id; })[0];
                success(folder);
            });
        },
        getTrash: function(account, success) {
            table.list(account, function(folders){
                success(folders.filter(function(f) { return f.path == "Deleted"; })[0]);
            });
        },
        createAll: function(account, root, success) {
            db.all("SELECT MAX(id) as maxId FROM folders", [], function(result){
                var nextId = result[0] ? result[0].maxId + 1 : 1;
                var foldersList = flattenFolders(root, account, { value: nextId });
                table.list(account, function(oldFoldersResult){
                    var oldFolders = oldFoldersResult.map(function(folder) { return folder.path; });
                    var newFolders = foldersList.map(function(obj) { return obj.path; });
                    var stmts = [];
                    var bgStmts = [];
                    foldersList.filter(function(obj) { return oldFolders.indexOf(obj.path) == -1; }).forEach(function(obj){
                        stmts.push(store.insertInto("folders", obj.folder));
                    });
                    oldFoldersResult.filter(function(f) { return newFolders.indexOf(f.path) == -1; }).forEach(function(folder){
                        stmts.push({ text: "DELETE FROM folders WHERE id = ?", params: [folder.id] });
                        bgStmts.push({ text: "DELETE FROM emails WHERE folderId = ?", params: [folder.id] });
                    });
                    store.runAll(stmts, function(){
                        success(stmts.length > 0);
                    });
                    store.runAll(bgStmts, function(){});
                });
            });
        },
        create: function(account, parentId, name, success) {
            db.all("SELECT MAX(id) as maxId FROM folders", [], function(result){
                db.run("INSERT INTO folders (id, parentId, account, name, delimiter, unseen, totalSynced, lastSynced) VALUES (?, ?, ?, ?, ?, 0, 1, ?)", 
                        [result[0] ? result[0].maxId + 1 : 1, parentId, account, name, delimiter, new Date().toISOString()],
                        function(err){
                    if (!err) {
                        table.list(account, function(folders){
                            success(folders.filter(function(f) { return f.parentId == parentId && f.name == name })[0])
                        });
                    } else {
                        success();
                    }
                });
            });
        },
        delete: function(id, success) {
            var stmts = [
                { text: "DELETE FROM folders WHERE id = ?", params: [id] },
                { text: "DELETE FROM emails WHERE folderId = ?", params: [id] }
            ];
            store.runAll(stmts, function(){
                db.all("SELECT id FROM folders WHERE parentId = ?", [id], function(folders){
                    if (folders.length == 0) {
                        success();
                    } else {
                        var successCount = 0;
                        folders.forEach(function(folder){
                            table.delete(folder.id, function(){
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
        move: function(id, targetId, success) {
            db.run("UPDATE folders SET parentId = ? WHERE id = ?", [targetId, id], function(err){
                if (!err) {
                    table.get(id, success);
                } else {
                    success();
                }
            });
        },
        rename: function(id, name, success) {
            db.run("UPDATE folders SET name = ? WHERE id = ?", [name, id], function(err){
                if (!err) {
                    table.get(id, success);
                } else {
                    success();
                }
            });
        },
        getOldestDate: function(folderId, success) {
            db.all("SELECT MIN(date) AS minDate FROM emails WHERE folderId = ?", [folderId], function(result){
                success(result[0] ? new Date(result[0].minDate) : null);
            });
        },
        sync: function(id, success) {
            db.run("UPDATE folders SET lastSynced = ? WHERE id = ?", [new Date().toISOString(), id], success);
        },
        setTotalSynced: function(id, value, success) {
            db.run("UPDATE folders SET totalSynced = ? WHERE id = ?", [value ? 1 : 0, id], success);
        },
        getSyncDate: function(success) {
            db.all("SELECT lastSynced FROM folders", [], function(result){
                result = result.map(function(row) { return row.lastSynced; });
                if (result.length == 0 || result.indexOf(null) >= 0) {
                    success(null);
                } else {
                    result.sort();
                    success(new Date(result[0]));
                }
            });
        },
    }

    function flattenFolders(folder, account, nextId, parentFolderId) {
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
                flattenFolders(child, account, nextId, currentId).forEach(function(v){
                    res.push(v);
                });
            });
        }
        return res;
    }
    function createFolderTree(folders) {
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
}

module.exports = FoldersTable;