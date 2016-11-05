// var backendHostName = "https://email-globaltransit.rhcloud.com";
var backendHostName = "http://192.168.0.11";

function EmailConnectionProxy() {
    var token;
    return {
        login: function(args, success, error) {
            request('POST', 'login', args, true).success(success).error(error);
        },
        getFolders: function(success, error) {
            request('GET', 'folders').success(success).error(error);
        },
		getLastEmails: function(path, count, lastDate, success, error) {
            request('GET', 'lastEmails/' + encodeURIComponent(path) + "?count=" + count + (lastDate ? "&lastDate=" + encodeURIComponent(lastDate.toISOString()) : "")).success(success).error(error);
        },
		getNewEmails: function(path, firstDate, success, error) {
            request('GET', 'newEmails/' + encodeURIComponent(path) + "?firstDate=" + encodeURIComponent(firstDate.toISOString())).success(success).error(error);
        },
		setEmailRead: function(path, uid, success, error) {
            request('POST', 'reademail/' + encodeURIComponent(path) + '/' + uid).success(success).error(error);
        },
		getEmailAttachment: function(path, uid, part, success, error) {
            request('GET', 'attachment/' + encodeURIComponent(path) + '/' + uid + '/' + part).success(success).error(error);
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
            timeout: 120000,
            success: function(responseData) {
                if (saveToken)
                    token = responseData;
                if (future.onSuccess !== undefined)
                    future.onSuccess(responseData);
            },
            error: function(err, status, message) {
                if (future.onError !== undefined)
                    future.onError(err);
            }
        });
        return future;
    }
}