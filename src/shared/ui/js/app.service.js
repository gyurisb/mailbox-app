ngApp.factory('$app', ['$master', '$rootScope',
    function($master, $rootScope) {
        var folderFocusedCallbacks = [];
        var emailFocusedCallbacks = [];
        var restoredCallbacks = [];
        var emailModifiedCallbacks = [];
        var emailParametersCallbacks = [];
        
        return {
            onRestore: function(callback) {
                restoredCallbacks.push(callback);
            },
            onFolderFocus: function(callback) {
                folderFocusedCallbacks.push(callback);
            },
            onEmailFocus: function(callback) {
                emailFocusedCallbacks.push(callback);
            },
            onEmailModify: function(callback) {
                emailModifiedCallbacks.push(callback);
            },
            onEmailParameters: function(callback) {
                if (platform == 'desktop') {
                    callback(JSON.parse(remote.getGlobal('newEmailParams')));
                } else {
                    emailParametersCallbacks.push(callback);
                }
            },
            restore: function() {
                restoredCallbacks.forEach(function(callback){
                    callback();
                });
            },
            focusFolder: function(folder) {
                folderFocusedCallbacks.forEach(function(callback){
                    callback(folder);
                });
            },
            focusEmail: function(email) {
                emailFocusedCallbacks.forEach(function(callback){
                    callback(email);
                });
            },
            modifyEmail: function(emailId) {
                emailModifiedCallbacks.forEach(function(callback){
                    callback(emailId);
                });
            },
            closeEmail: function() {
                if (platform == 'mobile' && $master.isFocused(2)) {
                    window.history.back();
                }
            },
            newEmail: function(params) {
                if (platform == 'desktop') {
                    ipcRenderer.send('openNewEmailWindow', params || {});
                } else if (platform == 'mobile') {
                    emailParametersCallbacks.forEach(function(callback){
                        callback(params || {});
                    });
                    $master.focus(4);
                }
            },
            sendEmail: function() {
                if (platform == 'desktop') {
                    remote.getCurrentWindow().close();
                } else if (platform == 'mobile') {
                    window.history.back();
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
                    window.history.back();
                }
            },
            openLink: function(href) {
                if (platform == 'desktop') {
                    ipcRenderer.send('openLink', href);
                }
            },
            showSaveDialog: function(defaultPath, success, error) {
                if (platform == "desktop") {
                    dialog.showSaveDialog({ defaultPath: defaultPath, title: "Save attachment" }, function(fileName){
                        $rootScope.$apply(function(){
                            if (fileName !== undefined) {
                                    success(fileName);
                            } else {
                                error();
                            }
                        });
                    });
                }
            },
            showOpenDialog: function(success, error) {
                if (platform == "desktop") {
                    dialog.showOpenDialog({ title: "Attach a file", properties: ['openFile', 'multiSelections'] }, function(files){
                        $rootScope.$apply(function(){
                            if (files && files.length > 0) {
                                success(files.map(function(file) { return { name: path.basename(file), path: file, size: fs.statSync(file).size }; }));
                            } else {
                                error();
                            }
                        });
                    });
                }
            }
        };
    }
]);
