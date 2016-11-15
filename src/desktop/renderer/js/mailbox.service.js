ngApp.factory('$mailbox', ['$timeout',
    function($timeout) {

        var actions = remote.getGlobal('mailboxActions');
        var nextRequestId = 0;

        var replyHandlers = {};
        var errorHandlers = {};
        var eventHandlers = {};
        actions.forEach(function(action){
            replyHandlers[action] = {};
            errorHandlers[action] = {};
            if (action.startsWith("on")) {
                ipcRenderer.on(action + "Triggered", function(event, eventParam){
                    eventHandlers[action].forEach(function(eventCallback){
                        eventCallback(eventParam);
                    });
                });
            } else {
                ipcRenderer.on(action + "Reply", function(event, reply){
                    replyHandlers[action][reply.id](reply.result);
                    deleteHandlers(reply.id);
                });
                ipcRenderer.on(action + "Error", function(event, reply){
                    errorHandlers[action][reply.id](reply.error);
                    deleteHandlers(reply.id);
                });
                function deleteHandlers(id) {
                    delete replyHandlers[action][id];
                    delete errorHandlers[action][id];
                }
            }
        });
        
        var service = {};
        actions.forEach(function(action){
            if (action.startsWith("on")) {
                eventHandlers[action] = [];
                service[action] = function(eventCallback) {
                    eventHandlers[action].push(angularCallback(eventCallback));
                    ipcRenderer.send(action);
                }
            } else {
                service[action] = function() {
                    var requestId = nextRequestId++;
                    ipcRenderer.send(action + 'Async', { id: requestId, params: Array.prototype.slice.call(arguments) });
                    replyHandlers[action][requestId] = function(){};
                    errorHandlers[action][requestId] = function(){};
                    var future = {
                        success: function(callback) {
                            replyHandlers[action][requestId] = angularCallback(callback);
                            return future;
                        },
                        error: function(callback) {
                            errorHandlers[action][requestId] = angularCallback(callback);
                            return future;
                        }
                    };
                    return future;
                }
            }
        });
        return service;

        function angularCallback(callback) {
            return function(res) {
                $timeout(function(){
                    callback(res);
                }, 0);
            }
        }
    }
]);