function EmailConnectionProxy() {
    var token;
    var serverUrl;

    var proxy = {};
    Generated.emailActions.forEach(function(action){
        proxy[action] = function() {
            if (action == "login") {
                var credentials = arguments[0];
                serverUrl = credentials.serverUrl;
            }
            var args = Array.prototype.slice.call(arguments);
            var params = args.slice(0, -2);
            var success = args.slice(-2)[0];
            var error = args.slice(-1)[0];
            request('POST', action, params, action == "login", success, error);
        }
    });
    return proxy;

    function request(method, action, data, saveToken, success, error) {
        $.ajax(serverUrl + '/' + action, {
           method: method,
           headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': token || ""
            },
            data: JSON.stringify(data),
            timeout: 120000,
            success: function(responseData) {
                if (saveToken)
                    token = responseData;
                success(responseData);
            },
            error: function(err, status, message) {
                error(err);
            }
        });
    }
}