var mailboxServiceCount = 0;
app.factory('$mailbox', ['$timeout',
    function($timeout) {
        mailboxServiceCount++;
        var actions = ['login', 'getFolders', 'getEmails', 'getEmailBody', 'sendEmail', 'contacts'];
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
            getFolders: function() {
                return ipc('getFolders');
            },
            getEmails: function(path) {
                return ipc('getEmails', path);
            },
            getEmailBody: function(uid) {
                return ipc('getEmailBody', { uid: uid });
            },
            sendEmail: function(args) {
                return ipc('sendEmail', args);
            },
            contacts: function(key) {
                return ipc('contacts', key);
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