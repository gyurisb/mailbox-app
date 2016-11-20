function ContactsTable(store, db) {
    return {

        createCommand:  "CREATE TABLE IF NOT EXISTS contacts \
                        ( \
                            name TEXT, \
                            email TEXT NOT NULL UNIQUE \
                        )",

        search: function(key, success) {
            key = '%' + escape(key) + '%';
            db.all("SELECT * FROM contacts WHERE name LIKE ? ESCAPE '^' OR email LIKE ? ESCAPE '^'", [key, key], success);
        },
    }
}

module.exports = ContactsTable;