ngApp.controller('LoginController', ['$scope', '$location', '$app', '$mailbox', function($scope, $location, $app, $mailbox) {
    
    $scope.account = {};
    $scope.loginInProgress = false;
    
    $scope.account = {
        username: "gyuris.bence@hotmail.com",
        password: "asdasd",
        imapHost: "imap-mail.outlook.com",
        imapPort: 993,
        smtpHost: "smtp.live.com",
        smtpPort: 587
    }
    
    $scope.login = function() {
        $scope.loginInProgress = true;
        var userName = $scope.account.username;
        $mailbox.login($scope.account);
    }

    $mailbox.onLoginFinish(function(evt){
        $scope.loginInProgress = false;
        if (!evt.error) {
            $app.login();
        } else {
            $scope.error = evt.error;
            alert(JSON.stringify(evt.error));
        }
    });
}]);

ngApp.directive('login', function(){
   return {
       restrict: 'EA',
       templateUrl: 'partials/login.html',
   }; 
});