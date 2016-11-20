function ServerCommands(conn, store, events) {
    return {
        setEmailRead: function(args) {
            return {
                operation: function(e, success, error) {
                    conn.setEmailRead(args.path, args.uid, success, error);
                }
            }
        },
        sendEmail: function(args) {
            return {
                operation: function(e, success, error) {
                    conn.sendEmail(args, success, function(err){
                        if (err.type == "rejectedAddresses") {
                            success();
                            events.accountUpdate({ type: "rejectedAddresses", failedRecipients: err.failedRecipients });
                        } else {
                            error(err);
                        }
                    });
                }
            }
        },
        deleteEmail: function(args) {
            return {
                operation: function(e, success, error) {
                    conn.deleteEmail(args.path, args.uid, success, error);
                }
            }
        },
        moveEmail: function(args) {
            return {
                operation: function(e, success, error) {
                    moveEmail();
                    function moveEmail() {
                        conn.getLastEmails(args.path, -1, new Date(args.email.date), function(result){
                            var email = store.emails.searchFromList(args.email, result.messages);
                            if (email) {
                                conn.moveEmail(args.path, email.uid, args.targetPath, checkTarget, error);
                            } else {
                                checkTarget();
                            }
                            function checkTarget() {
                                conn.getLastEmails(args.targetPath, -1, new Date(args.email.date), function(result){
                                    var checkEmail = store.emails.searchFromList(args.email, result.messages);
                                    if (checkEmail) {
                                        success(checkEmail);
                                    } else {
                                        if (!email) {
                                            error({ type: "emailLost", message: "Email lost while being moved." });
                                        } else {
                                            moveEmail();
                                        }
                                    }
                                }, error);
                            }
                        }, error);
                    }
                },
                processing: function(checkEmail, success, error) {
                    if (args.email.uid != null) {
                        store.emails.setUids(args.email.uid, checkEmail.uid, success);
                    } else {
                        success();
                    }
                }
            }
        },
        createFolder: function(args) {
            return {
                operation: function(e, success, error) {
                    conn.createFolder(args.path, success, error);
                }
            }
        },
        deleteFolder: function(args) {
            return {
                operation: function(e, success, error) {
                    conn.deleteFolder(args.path, success, error);
                }
            }
        },
        moveFolder: function(args) {
            return {
                operation: function(e, success, error) {
                    conn.moveFolder(args.path, args.newPath, success, error);
                }
            }
        }
    }
}

module.exports = ServerCommands;