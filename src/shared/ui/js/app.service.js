ngApp.factory('$app', ['$master',
    function($master) {
        var folderFocusedCallback;
        var emailFocusedCallback;
        var loginCallback;
        var loginCallback2;
        
        return {
            onLogin: function(callback) {
                loginCallback = callback;
            },
            secondaryOnLogin: function(callback) {
                loginCallback2 = callback;
            },
            onFolderFocus: function(callback) {
                folderFocusedCallback = callback;
            },
            onEmailFocus: function(callback) {
                emailFocusedCallback = callback;
            },
            restore: function() {
                loginCallback();
                loginCallback2();
            },
            focusFolder: function(folder) {
                folderFocusedCallback(folder.path);
            },
            focusEmail: function(uid, path) {
                emailFocusedCallback(uid, path);
            },
            newEmail: function() {
                if (platform == 'desktop') {
                    ipcRenderer.send('openNewEmailWindow');
                } else if (platform == 'mobile') {
                    $master.focus(4);
                }
            },
            sendEmail: function() {
                if (platform == 'desktop') {
                    remote.getCurrentWindow().close();
                } else if (platform == 'mobile') {
                    $master.focus(0);
                }
            },
            requestLogin: function() {
                if (platform == 'desktop') {
                    ipcRenderer.send('openNewLoginDialog');
                } else if (platform == 'mobile') {
                    $master.focus(3);
                }
            },
            login: function() {
                if (platform == 'desktop') {
                    remote.getCurrentWindow().close();
                } else if (platform == 'mobile') {
                    $master.focus(0);
                }
            },
        };
    }
]);
