ngApp.controller('LoginController', ['$scope', '$location', '$app', '$mailbox', function($scope, $location, $app, $mailbox) {
    
    $mailbox.onError(function(error){
        $scope.error = error;
        $scope.loginInProgress = false;
        alert(JSON.stringify(error));
    });
    
    $scope.account = {};
    $scope.loginInProgress = false;
    
    $scope.login = function() {
        $scope.loginInProgress = true;
        $mailbox.login($scope.account).success(function(){
            $scope.loginInProgress = false;
            $app.login();
        });
    }
}]);