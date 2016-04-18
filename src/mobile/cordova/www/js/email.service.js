var token;
var backendHostName = "https://email-globaltransit.rhcloud.com";
backendHostName = "";

app.factory('$email', ['$http',
    function($http) {
        return {
            login: function(args) {
                return request('POST', 'login', args, true);
            },
            getFolders: function() {
                return request('GET', 'folders');
            },
            getEmails: function(path) {
                return request('GET', 'emails/' + path);
            },
            getEmailBody: function(uid) {
                return request('GET', 'emailbody/' + uid);
            },
            sendEmail: function(args) {
                return request('POST', 'send', args);
            },
            onError: function(callback) {
                
            }
        };
        function request(method, action, data, saveToken) {
            NProgress.start();
            var future = {
                success: function(callback) {
                    future.onSuccess = callback;
                    return future;
                },
                error: function(callback) {
                    future.onError = callback;
                    return future;
                }
            };
            var req = {
                method: method,
                url: backendHostName + '/' + action,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': token || ""
                },
                data: data
            };
            $http(req).then(function(response) {
				if (saveToken)
					token = response.data;
                if (future.onSuccess !== undefined)
                    future.onSuccess(response.data);
                NProgress.done();
            }, function(err) {
                if (err.status == 401 && window.location.href.indexOf('login') == -1) 
                    window.location.replace('/#/login?ref=' + encodeURIComponent(window.location.hash));
                else if (future.onError !== undefined)
                    future.onError(err);
                NProgress.done();
            });
            return future;
        }
    }
]);