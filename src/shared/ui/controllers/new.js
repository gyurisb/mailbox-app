app.controller('NewController', ['$scope', '$email', '$master', function($scope, $email, $master) {
    $email.onError(function(error) {
        alert(JSON.stringify(error));
    });
    
    $scope.to = [];
    $scope.toBcc = [];
    
    $scope.send = function() {
        $scope.isSending = true;
        $email.sendEmail({
            to: $scope.to,
            subject: $scope.subject,
            body: $scope.text
        });
        //TODO: itt bezárni az ablakot/visszalépni
    }
    
    // var semicolon = 186;
    // $scope.customKeys = [$mdConstant.KEY_CODE.ENTER, $mdConstant.KEY_CODE.COMMA, semicolon];
}]);