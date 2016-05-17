const sqlite3 = require('sqlite3');

function SQLite3Subsystem(path) {
    var db = new sqlite3.Database(path);
    return {
        open: function(success) {
            success();
        },
        each: function(query, params, selector) {
            db.each(query, params, function(err, row){
               selector(row); 
            });
        },
        all: function(query, params, success) {
            db.all(query, params, function(err, all) {
                success(all);
            });
        },
        run: function(statement, params, done) {
            db.run(statement, params, function(err, res){
                if (done !== undefined)
                    done(err, res);
            });
        }
    };
}

module.exports = SQLite3Subsystem;