ngApp.controller('EmailsController', ['$scope', '$mailbox', '$app', '$master', '$filter', '$mdToast', '$document', function($scope, $mailbox, $app, $master, $filter, $mdToast, $document) {
    
    function emailsLoaded(emails) {
        $scope.emails = emails;
        $master.focus(1);
    }
    
    var path;
    $scope.page = 0;
    $scope.emails = [];
    $scope.selectedEmail = null;
    
    $app.secondaryOnRestore(function(){
        if (platform == 'desktop') {
            path = 'Inbox';
            $mailbox.getEmails().success(emailsLoaded);
        }
    });
    
    $app.onFolderFocus(function(currentPath) {
        if (currentPath != path) {
            path = currentPath;
            $scope.page = 0;
            $mailbox.getEmails(path).success(emailsLoaded);
        }
    });
    
    
    syncToastMessage = 'Authenticating user accounts.';
    showToast();
    
    $mailbox.onFolderUpdate().success(function(args){
        if (args.changed && args.folder.path == path) {
            $mailbox.getEmails(path, $scope.page).success(emailsLoaded);
        }
        if (args.folder.progress >= 0) {
            // syncToastMessage = 'Folder updated: ' + args.folder.name;
            syncToastMessage = 'Fetching new messages.';
            syncToastProgress = args.folder.progress;
            changeSyncToastMessage();
            showToast();
        }
    });
    
    $scope.nextPage = function() {
        $scope.page++;
        $mailbox.getEmails(path, $scope.page).success(emailsLoaded);
    }
    
    $scope.prevPage = function() {
        $scope.page--;
        $mailbox.getEmails(path, $scope.page).success(emailsLoaded);
    }
    
    $scope.emailClicked = function(email){
        $scope.selectedEmail = email.uid;
        $app.focusEmail(email.uid, path);
    }
    
    $scope.formatEmailDate = function(dateString) {
        var date = new Date(dateString);
        var now = new Date();
        if (date.toDateString() == now.toDateString()) {
            //return date.toLocaleTimeString().match(/\d{2}:\d{2}|[AMP]+/g).join(' ');
            return $filter('date')(date, 'shortTime');
        } else if ($filter('date')(date, 'ww') == $filter('date')(now, 'ww')) {
            return $filter('date')(date, 'EEE');
        } else {
            //return date.toLocaleDateString();
            return $filter('date')(date, 'shortDate');
        }
    }
    
    function showToast() {
        if (!syncToastOpen) {
            syncToastOpen = true;
            $mdToast.show({
                controller: 'SyncToastController',
                templateUrl: 'partials/sync.toast.html',
                hideDelay: false,
                position: 'top right',
                parent : $document[0].querySelector('.toastBounds'),
            });
        }
    }
}]);

var syncToastOpen = false;
var syncToastMessage = "";
var syncToastProgress = 0;
var changeSyncToastMessage = angular.noop;
ngApp.controller('SyncToastController', ['$scope', '$mdToast', '$timeout', function($scope, $mdToast, $timeout) {
    $scope.message = syncToastMessage;
    $scope.progress = syncToastProgress;
    changeSyncToastMessage = function() {
        $scope.message = syncToastMessage;
        $scope.progress = syncToastProgress;
        if ($scope.progress == 100) {
            $mdToast.hide();
        }
    }
}]);