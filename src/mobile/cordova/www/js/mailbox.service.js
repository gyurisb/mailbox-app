app.factory('$mailbox', ['$timeout',
    function($timeout) {
        var conn = new EmailConnectionProxy();
        return {
            login: function(args) {
                return wrapToAngular(conn.login(args));
            },
            getFolders: function() {
                return wrapToAngular(conn.getFolders());
            },
            getEmails: function(path) {
                return wrapToAngular(conn.getEmails(path));
            },
            getEmailBody: function(uid) {
                return wrapToAngular(conn.getEmailBody(uid));
            },
            sendEmail: function(args) {
                return wrapToAngular(conn.sendEmail(args));
            },
            onError: function(callback) {}
        };
        function wrapToAngular(request) {
            // var successCallback;
            // var future = {
            //     success: function(callback){
            //         successCallback = callback;
            //     },
            //     error: function(){}
            // };
            // request.success(function(responseData) {
            //     $timeout(function() {
            //         successCallback(responseData);
            //     },0);
            // });
            // return future;
            
            var originalSuccess = request.success;
            request.success = function(callback) {
                originalSuccess(function(responseData) {
                    $timeout(function() {
                        callback(responseData);
                    },0);
                });
            };
            return request;
        }
    }
]);