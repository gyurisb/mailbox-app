ngApp.controller('EmailsController', ['$scope', '$mailbox', '$app', '$master', '$filter', '$document', '$window', function($scope, $mailbox, $app, $master, $filter, $document, $window) {
    
    $scope.path = null;
    $scope.page = 0;
    $scope.emails = [];
    $scope.hasNextPage = false;
    $scope.selectedEmail = null;
    $scope.selectedPath = null;
    
    function loadEmails(currentPath) {
        $mailbox.getEmails(currentPath || $scope.path, $scope.page*$scope.itemCount, $scope.itemCount + 1).success(function(emails){
            $master.focus(1);
            $scope.emails = emails.slice(0, $scope.itemCount);
            $scope.paddings = [];
            $scope.hasNextPage = emails.length == $scope.itemCount + 1;
            for (var i = 0; i < $scope.itemCount - $scope.emails.length; i++)
                $scope.paddings.push({});
            if (currentPath)
                $scope.path = currentPath;
        });
    }
    
    $app.onRestore(function(){
        if (platform == 'desktop') {
            loadEmails('Inbox');
        }
    });
    
    $app.onFolderFocus(function(currentPath) {
        if (platform == 'mobile' || currentPath != $scope.path) {
            $scope.page = 0;
            loadEmails(currentPath);
        }
    });
    
    $mailbox.onFolderUpdate(function(folder){
        if (folder.path == $scope.path && $master.isFocused(1)) {
            loadEmails();
        }
    });

    $app.onEmailModify(function(path, uid){
        if (path == $scope.path && uid == $scope.selectedEmail) {
            $scope.selectedEmail = null;
            $scope.selectedPath = null;
        }
    });

    $mailbox.onEmailUpdate(function(evt){
        if (evt.oldPath == $scope.selectedPath && evt.oldUid == $scope.selectedEmail) {
            $scope.selectedEmail = evt.newUid;
            $scope.selectedPath = evt.newPath;
        }
    });

    $mailbox.onFolderPathUpdate(function(evt){
        if (evt.oldPath == $scope.path || $scope.path.indexOf(evt.oldPath + evt.delimiter) == 0) {
            $scope.path = evt.newPath ? $scope.path.replace(evt.oldPath, evt.newPath) : null;
        }
        if (evt.oldPath == $scope.selectedPath || $scope.selectedPath.indexOf(evt.oldPath + evt.delimiter) == 0) {
            $scope.selectedPath = evt.newPath ? $scope.selectedPath.replace(evt.oldPath, evt.newPath) : null;
        }
    });
    
    $scope.nextPage = function() {
        $scope.page++;
        loadEmails();
    }
    
    $scope.prevPage = function() {
        $scope.page--;
        loadEmails();
    }
    
    $scope.emailClicked = function(email){
        $scope.selectedEmail = email.uid;
        $scope.selectedPath = $scope.path;
        $app.focusEmail(email);
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

    function setEmailListHeight() {
        var height = $window.innerHeight - (platform == 'desktop' ? (15 + 40) : (24 + 2*8 + 60));
        var minItemHeight = (platform == 'desktop' ? 58 : 72);
        $scope.itemCount = Math.floor(height / minItemHeight);
    }

    setEmailListHeight();
    angular.element($window).bind('resize', function() {
        var oldItemCount = $scope.itemCount;
        setEmailListHeight();
        if (oldItemCount != $scope.itemCount) {
            if ($scope.selectedEmail && $scope.emails.some(function(e) { return e.uid == $scope.selectedEmail; })) {
                var selectedPageIndex = $scope.emails.indexOf($scope.emails.filter(function(e) { return e.uid == $scope.selectedEmail; })[0]);
                var selectedIndex = $scope.page*oldItemCount + selectedPageIndex;
                $scope.page = Math.floor(selectedIndex / $scope.itemCount);
            } else {
                $scope.page = Math.floor($scope.page*oldItemCount / $scope.itemCount);
            }
            if ($master.isFocused(1)) {
                loadEmails();
            }
        }
    });

}]);

ngApp.directive('emails', function(){
   return {
       restrict: 'EA',
       templateUrl: 'partials/emails.html',
   }; 
});