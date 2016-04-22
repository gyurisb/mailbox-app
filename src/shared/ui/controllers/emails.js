app.controller('EmailsController', ['$scope', '$mailbox', '$app', '$master', '$filter', function($scope, $mailbox, $app, $master, $filter) {
    
    $scope.emails = [];
    $scope.selectedEmail = null;
    
    $app.secondaryOnLogin(function(){
        if (platform == 'desktop') {
            $mailbox.getEmails().success(function(emails){
                $scope.emails = emails;
            });
        }
    });
    
    $app.onFolderFocus(function(path) {
        $mailbox.getEmails(path).success(function(emails){
            $scope.emails = emails;
            $master.focus(2);
        });
    });
    
    $scope.emailClicked = function(email){
        $scope.selectedEmail = email.uid;
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
}]);