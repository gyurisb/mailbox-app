ngApp.controller('LoginController', ['$scope', '$location', '$app', '$mailbox', function($scope, $location, $app, $mailbox) {
    
    $scope.account = {};
    $scope.loginInProgress = false;
    
    $scope.login = function() {
        $scope.loginInProgress = true;
        var userName = $scope.account.username;
        $mailbox.login($scope.account).success(function(){
            $scope.loginInProgress = false;
            $app.login(userName);
        }).error(function(error){
            $scope.error = error;
            $scope.loginInProgress = false;
            alert(JSON.stringify(error));
        });
    }
}]);

ngApp.directive('login', function(){
   return {
       restrict: 'EA',
       templateUrl: 'partials/login.html',
   }; 
});