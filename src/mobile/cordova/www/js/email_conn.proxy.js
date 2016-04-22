var backendHostName = "https://email-globaltransit.rhcloud.com";
// backendHostName = "";

function EmailConnectionProxy() {
    var token;
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
        onError: function(callback) {}
    };
    function request(method, action, data, saveToken) {
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
        $.ajax(backendHostName + '/' + action, {
           method: method,
           headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': token || ""
            },
            data: JSON.stringify(data),
            success: function(responseData) {
                if (saveToken)
                    token = responseData;
                if (future.onSuccess !== undefined)
                    future.onSuccess(responseData);
            },
            error: function(err, status, message) {
                if (err.status == 401 && window.location.href.indexOf('login') == -1) 
                    window.location.replace('/#/login?ref=' + encodeURIComponent(window.location.hash));
                else if (future.onError !== undefined)
                    future.onError(err);
            }
        });
        return future;
    }
}