app.controller('MainController', ['$scope', '$email', '$app', '$master', function($scope, $email, $app, $master) {
    mainScope = $scope;
    
    $scope.loggedIn = false;
    
    $scope.loaded = function() {
        $master.includedDivLoaded();
    };
    
    $scope.newEmail = function() {
        $app.newEmail();
    };
}]);