app.controller('NewController', ['$scope', '$email', function($scope, $email) {
    $email.onError(function(error) {
        alert(JSON.stringify(error));
    });
    
    $scope.send = function() {
        $scope.isSending = true;
        $email.sendEmail({
            to: $scope.to,
            subject: $scope.subject,
            body: $scope.text
        });
        //TODO: itt bezárni az ablakot/visszalépni
    }
}]);