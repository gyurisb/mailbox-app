var mailboxServiceCount = 0;
ngApp.factory('$mailbox', ['$timeout',
    function($timeout) {
        mailboxServiceCount++;
        var actions = ['login', 'restore', 'getFolders', 'getEmails', 'getEmailBody', 'sendEmail', 'contacts', 'onFolderUpdate', 'onMailboxUpdate'];
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
            getEmails: function(path, page) {
                return ipc('getEmails', { path: path, page: page });
            },
            getEmailBody: function(uid, path) {
                return ipc('getEmailBody', { uid: uid, path: path });
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