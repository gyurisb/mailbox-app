app.controller('MainController', ['$scope', '$app', '$master', function($scope, $app, $master) {
    mainScope = $scope;
    
    $scope.loggedIn = false;
    
    $scope.loaded = function() {
        $master.includedDivLoaded();
    };
    
    $scope.newEmail = function() {
        $app.newEmail();
    };
}]);