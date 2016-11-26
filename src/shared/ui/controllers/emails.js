ngApp.controller('EmailsController', ['$scope', '$mailbox', '$app', '$master', '$filter', '$document', '$window', function($scope, $mailbox, $app, $master, $filter, $document, $window) {
    
    $scope.folderId = null;
    $scope.page = 0;
    $scope.emails = [];
    $scope.hasNextPage = false;
    $scope.selected = null;
    
    function loadEmails(folderId) {
        $mailbox.getEmails(folderId || $scope.folderId, $scope.page*$scope.itemCount, $scope.itemCount + 1).success(function(emails){
            $scope.folderId = folderId || $scope.folderId;
            $master.focus(1);
            $scope.emails = emails.slice(0, $scope.itemCount);
            $scope.paddings = [];
            $scope.hasNextPage = emails.length == $scope.itemCount + 1;
            for (var i = 0; i < $scope.itemCount - $scope.emails.length; i++)
                $scope.paddings.push({});
        });
    }

    function foldersLoaded(root) {
        if ($scope.folderId == null && root && root.children.length > 0) {
            loadEmails(root.children[0].id);
        }
    }
    
    $app.onFolderFocus(function(folder) {
        if (platform == 'mobile' || folder.id != $scope.folderId) {
            $scope.titles[1] = folder.name;
            $scope.page = 0;
            loadEmails(folder.id);
        }
    });
    
    $mailbox.onFolderUpdate(function(folder){
        if (folder.id == $scope.folderId && $master.isFocused(1)) {
            loadEmails();
        }
    });
    
    $app.onRestore(function(){
        if (platform == 'desktop') {
            $mailbox.getFolders().success(foldersLoaded);
        }
    });
    
    $mailbox.onMailboxUpdate(function(){
        if (platform == 'desktop') {
            $mailbox.getFolders().success(foldersLoaded);
        }
    });

    $app.onEmailModify(function(emailId){
        if (emailId == $scope.selected) {
            $scope.selected = null
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
        $scope.selected = email.id;
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
        var minItemHeight = (platform == 'desktop' ? 59 : 75);
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