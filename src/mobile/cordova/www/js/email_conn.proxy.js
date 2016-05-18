var backendHostName = "https://email-globaltransit.rhcloud.com";
// backendHostName = "";

function EmailConnectionProxy() {
    var token;
    return {
        login: function(args, success, error) {
            request('POST', 'login', args, true).success(success).error(error);
        },
        getFolders: function(success, error) {
            request('GET', 'folders').success(success).error(error);
        },
        getEmails: function(path, offset, count, success, error) {
            request('GET', 'emails/' + path + "?offset=" + offset + "&count=" + count).success(success).error(error);
        },
        getEmailsAfterUid: function(path, uid, success, error) {
            request('GET', 'emails/' + path + "?afterUid=" + uid).success(success).error(error);
        },
        getEmailBody: function(uid, path, success, error) {
            request('GET', 'emailbody/' + path + '/' + uid).success(success).error(error);
        },
        sendEmail: function(args, success, error) {
            request('POST', 'send', args).success(success).error(error);
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