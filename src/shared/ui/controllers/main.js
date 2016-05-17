ngApp.controller('MainController', ['$scope', '$app', '$master', '$mailbox', function($scope, $app, $master, $mailbox) {
    mainScope = $scope;
    
    $scope.loggedIn = false;
    
    $scope.loaded = function() {
        $master.includedDivLoaded();
    };
    
    $scope.newEmail = function() {
        $app.newEmail();
    };
    
    $scope.editAccount = function() {
        $app.loginDialog();
    }
    
    $mailbox.restore().success(function(email){
        if (email !== undefined && email !== null) {
            $scope.loggedIn = true;
            $scope.emailAddress = email;
            $app.restore();
        } else {
            $app.requestLogin();
        }
    });
}]);