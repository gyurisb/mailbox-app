var mailboxServiceCount = 0;
ngApp.factory('$mailbox', ['$timeout',
    function($timeout) {
        mailboxServiceCount++;
        var actions = ['login', 'restore', 'getFolders', 'getEmails', 'getEmailBody', 'sendEmail', 'contacts', 'onFolderUpdate', 'onMailboxUpdate', 'onAccountUpdate'];
        var replyHandlers = {};
        var errorHandlers = {};
        actions.forEach(function(action){
            ipcRenderer.on(action + "Reply", function(event, result){
                replyHandlers[action](result);
            });
            ipcRenderer.on(action + "Error", function(event, error){
                errorHandlers[action](error);
            });
        });
        
        var errorHandler = function(){};
        return {
            login: function(args) {
                return ipc('login', args);
            },
            restore: function() {
                return ipc('restore');
            },
            getFolders: function() {
                return ipc('getFolders');
            },
            getEmails: function(path, offset, count) {
                return ipc('getEmails', { path: path, offset: offset, count: count });
            },
            getEmailBody: function(path, uid, seen) {
                return ipc('getEmailBody', { uid: uid, path: path, seen: seen });
            },
            sendEmail: function(args) {
                return ipc('sendEmail', args);
            },
            contacts: function(key) {
                return ipc('contacts', key);
            },
            onFolderUpdate: function() {
                return ipc('onFolderUpdate');
            },
            onMailboxUpdate: function() {
                return ipc('onMailboxUpdate');
            },
            onAccountUpdate: function() {
                return ipc('onAccountUpdate');
            },
            onError: function(handler) {
                errorHandler = handler;
            }
        };
        function ipc(action, data) {
            var successCallback = function(x){};
            var future = {
                success: function(callback) {
                    successCallback = callback;
                }
            }
            replyHandlers[action] = function(result) {
                $timeout(function() {
                    successCallback(result);
                },0);
            };
            errorHandlers[action] = function(error) {
                $timeout(function() {
                    errorHandler(error);
                },0);
            };
            ipcRenderer.send(action + 'Async', data);
            return future;
        }
    }
]);