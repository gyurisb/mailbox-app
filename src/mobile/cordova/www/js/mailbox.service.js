ngApp.factory('$mailbox', ['$timeout',
    function($timeout) {
        var mailbox = new Mailbox(new SQLitePluginSubsystem('mailbox.db'), EmailConnectionProxy, EmailStore);
        return {
            login: function(args) {
                var p = angularPromise();
                mailbox.login(args, p.performSuccess, p.performError);
                return p.future;
            },
            restore: function() {
                var p = angularPromise();
                mailbox.restore(p.performSuccess, p.performError);
                return p.future;
            },
            getFolders: function() {
                var p = angularPromise();
                mailbox.getFolders(p.performSuccess, p.performError);
                return p.future;
            },
            getEmails: function(path, page) {
                var p = angularPromise();
                mailbox.getEmails({ path: path, page: page }, p.performSuccess, p.performError);
                return p.future;
            },
            getEmailBody: function(uid, path) {
                var p = angularPromise();
                mailbox.getEmailBody({ uid: uid, path: path }, p.performSuccess, p.performError);
                return p.future;
            },
            sendEmail: function(args) {
                var p = angularPromise();
                mailbox.sendEmail(args, p.performSuccess, p.performError);
                return p.future;
            },
            contacts: function(key) {
                var p = angularPromise();
                mailbox.contacts(key, p.performSuccess);
                return p.future;
            },
            onFolderUpdate: function() {
                var p = angularPromise();
                mailbox.onFolderUpdate(p.performSuccess);
                return p.future;
            },
            onMailboxUpdate: function() {
                var p = angularPromise();
                mailbox.onMailboxUpdate(p.performSuccess);
                return p.future;
            },
            onError: function(callback) {}
        };
        function angularPromise() {
            var successCallback = angular.noop;
            var errorCallback = angular.noop;
            return {
                future: {
                    success: function(callback) {
                        successCallback = callback;
                    },
                    error: function(callbac) {
                        errorCallback = callback;
                    }
                },
                performSuccess: function(res) {
                    $timeout(function() {
                        successCallback(res);
                    },0);
                },
                performError: function(err) {
                    $timeout(function() {
                        errorCallback(err);
                    },0);
                }
            };
        }
    }
]);