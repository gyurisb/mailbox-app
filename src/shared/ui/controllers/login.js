app.controller('LoginController', ['$scope', '$email', '$location', '$app', function($scope, $email, $location, $app) {
    
    $email.onError(function(error){
        $scope.error = error;
        $scope.loginInProgress = false;
        alert(JSON.stringify(error));
    });
    
    $scope.formUserName = "gyuris.bence@hotmail.com";
    $scope.formPassword = "";
    $scope.loginInProgress = false;
    mainScope.loggedIn = false;
    $scope.login = function() {
        $scope.userName = $scope.formUserName;
        $scope.loginInProgress = true;
        $email.login({
            imapHost: "imap-mail.outlook.com",
            imapPort: 993,
            smtpHost: "smtp.live.com",
            smtpPort: 587,//25,
            username: $scope.userName,
            password: $scope.formPassword
        }).success(function(loginSuccessful){
            $scope.loginInProgress = false;
            if (loginSuccessful) {
                mainScope.loggedIn = true;
                $app.login();
            }
        });
    }
}]);