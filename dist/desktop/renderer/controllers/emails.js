app.controller('EmailsController', ['$scope', '$email', '$app', '$master', function($scope, $email, $app, $master) {
    
    $scope.emails = [];
    $scope.selectedEmail = null;
    
    $app.secondaryOnLogin(function(){
        if (platform == 'desktop') {
            $email.getEmails().success(function(emails){
                $scope.emails = emails;
            });
        }
    });
    
    $app.onFolderFocus(function(path) {
        $email.getEmails(path).success(function(emails){
            $scope.emails = emails;
            $master.focus(2);
        });
    });
    
    $scope.emailClicked = function(email){
        $scope.selectedEmail = email.uid;
        $app.focusEmail(email);
    }
}]);