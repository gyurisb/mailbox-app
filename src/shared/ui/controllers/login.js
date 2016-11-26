ngApp.controller('LoginController', ['$scope', '$location', '$app', '$mailbox', function($scope, $location, $app, $mailbox) {
    
    if ($scope.titles) {
        $scope.titles[3] = "New account"
    }
    $scope.account = {};
    $scope.loginInProgress = false;
    if (platform == "mobile") {
        $scope.serverUrlEnabled = true;
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