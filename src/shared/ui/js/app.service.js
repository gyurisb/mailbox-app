app.factory('$app', ['$master',
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
            login: function() {
                loginCallback();
                loginCallback2();
            },
            focusFolder: function(folder) {
                folderFocusedCallback(folder.path);
            },
            focusEmail: function(email) {
                emailFocusedCallback(email.uid);
            },
            newEmail: function() {
                if (platform == 'desktop') {
                    ipcRenderer.send('openNewEmailWindow');
                } else if (platform == 'mobile') {
                    $master.focus(4);
                }
            }
        };
    }
]);
