var token;
var backendHostName = "https://email-globaltransit.rhcloud.com";
// var backendHostName = "";

var emailActions = ['login', 'getFolders', 'getEmails', 'getEmailBody', 'sendEmail'];
var replyHandlers = {};
var errorHandlers = {};
emailActions.forEach(function(action){
   ipcRenderer.on(action + "Reply", function(event, result){
       replyHandlers[action](result);
   });
   ipcRenderer.on(action + "Error", function(event, error){
       errorHandlers[action](error);
   });
});

app.factory('$email', ['$http', '$timeout',
    function($http, $timeout) {
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
            }
            ipcRenderer.send(action + 'Async', data);
            return future;
        }
    }
]);