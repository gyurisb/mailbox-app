ngApp.factory('$mailbox', ['$timeout',
    function($timeout) {
        var mailbox = new Mailbox(LockObject, SQLitePluginSubsystem, Object, EmailConnectionProxy, FetchProcess, ServerCommands, EmailStore, AccountsTable, ContactsTable, EmailsTable, FoldersTable, QueueTable);
        var service = {};
        Object.keys(mailbox).forEach(function(action){
            if (action.substr(0, 2) == "on") {
                var eventHandlers = [];
                mailbox[action](function(eventParams){
                    $timeout(function() {
                        eventHandlers.forEach(function(eventCallback){
                            eventCallback(eventParams);
                        });
                    },0);
                });
                service[action] = function(eventCallback) {
                    eventHandlers.push(eventCallback);
                }
            } else {
                service[action] = function() {
                    var promise = angularPromise();
                    mailbox[action].apply(mailbox, Array.prototype.slice.call(arguments).concat([promise.performSuccess, promise.performError]));
                    return promise.future;
                }
            }
        });
        return service;
        function angularPromise() {
            var successCallback = angular.noop;
            var errorCallback = angular.noop;
            var promise = {
                future: {
                    success: function(callback) {
                        successCallback = callback;
                        return promise.future;
                    },
                    error: function(callbac) {
                        errorCallback = callback;
                        return promise.future;
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
            return promise;
        }
    }
]);