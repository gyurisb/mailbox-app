function SQLitePluginSubsystem(path) {
    var db;
    return {
        open: function(success) {
            // success(); return;
            if (db === undefined) {
                document.addEventListener('deviceready', function(){
                    db = window.sqlitePlugin.openDatabase({name: path, location: 'default'}, function(){
                        success();
                    }, function(err){});
                }, false);
            } else {
                success();
            }
        },
        each: function(query, params, selector) {
            // return;
            db.executeSql(query, params || [], function(result){
                for (var i = 0; i < result.rows.length; i++) {
                    selector(result.rows.item(i));
                }
            }, function(err) {}); 
        },
        all: function(query, params, success) {
            // success([]); return;
            db.executeSql(query, params || [], function(result){
                var resultArr = [];
                for (var i = 0; i < result.rows.length; i++)
                    resultArr.push(result.rows.item(i));
                success(resultArr);
            }, function(err) {}); 
        },
        run: function(statement, params, done) {
            // return;
            done = done || function(){};
            db.executeSql(statement, params || [], function(res) {
                done(undefined, res);
            }, function(err) {
                done(err);
            });
        }
    };
}